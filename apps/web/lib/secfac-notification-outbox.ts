import { AlertNotificationChannel, OperationType, ProviderDeliveryResult, ProviderNotificationPayload, SecFacAlertNotification } from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";
import { resolveNotificationPreferences, evaluateQuietHours } from "./secfac-notification-preferences";
import { resolveRecipientContactDetails } from "./secfac-notification-recipient";
import { emailProvider } from "./notifications/providers/email-provider";
import { pushProvider } from "./notifications/providers/push-provider";
import { whatsappProvider } from "./notifications/providers/whatsapp-provider";
import { smsProvider } from "./notifications/providers/sms-provider";

export function getExponentialRetryDelaySeconds(attemptNumber: number): number {
  switch (attemptNumber) {
    case 1: return 60;     // 1 minute
    case 2: return 300;    // 5 minutes
    case 3: return 900;    // 15 minutes
    case 4: return 3600;   // 60 minutes
    default: return 7200;  // 2 hours fallback
  }
}

export interface ProcessOutboxResult {
  claimedCount: number;
  processedCount: number;
  sentCount: number;
  retryScheduledCount: number;
  failedCount: number;
  deadLetterCount: number;
  suppressedCount: number;
  errors: string[];
}

/**
 * Atomically claims pending notifications in MySQL using a unique claim token and status guard.
 */
export async function claimPendingNotificationsBatch(
  batchSize: number = 20,
  workerId: string = `worker-${process.pid}`,
  ttlSeconds: number = 300,
  opType: OperationType = "SECURITY_GUARDING",
  channelFilter: AlertNotificationChannel = "IN_APP"
): Promise<{ claimToken: string; notifications: SecFacAlertNotification[] }> {
  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const claimToken = `claim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const whereClause: any = {
    scheduledAt: { lte: now },
    operationType: opType,
    channel: channelFilter,
    OR: [
      { status: "PENDING" },
      { status: "RETRY_SCHEDULED" },
      {
        status: { in: ["CLAIMED", "PROCESSING"] },
        claimExpiresAt: { lte: now } // Recover stale expired claim
      }
    ]
  };

  // Find candidate IDs ready for claim
  const candidates = await prisma.secFacAlertNotification.findMany({
    where: whereClause,
    take: batchSize,
    orderBy: { scheduledAt: "asc" },
    select: { id: true }
  });

  if (candidates.length === 0) {
    return { claimToken, notifications: [] };
  }

  const candidateIds = candidates.map(c => c.id);

  // Atomic claim update using status/token guard
  const updatedCount = await prisma.secFacAlertNotification.updateMany({
    where: {
      id: { in: candidateIds },
      operationType: opType,
      channel: channelFilter,
      OR: [
        { status: "PENDING" },
        { status: "RETRY_SCHEDULED" },
        {
          status: { in: ["CLAIMED", "PROCESSING"] },
          claimExpiresAt: { lte: now }
        }
      ]
    },
    data: {
      status: "CLAIMED",
      claimToken,
      claimedAt: now,
      claimedBy: workerId,
      claimExpiresAt
    }
  });

  if (updatedCount.count === 0) {
    return { claimToken, notifications: [] };
  }

  // Retrieve full claimed notification objects with alert relationship
  const claimedNotifications = await prisma.secFacAlertNotification.findMany({
    where: {
      claimToken,
      status: "CLAIMED",
      operationType: opType,
      channel: channelFilter
    },
    include: {
      alert: true
    }
  });

  return { claimToken, notifications: claimedNotifications as unknown as SecFacAlertNotification[] };
}

/**
 * Processes a single claimed notification through preferences, quiet hours, recipient resolution, and provider adapters.
 */
export async function processClaimedNotification(
  notification: SecFacAlertNotification & { alert?: any }
): Promise<{ status: string; result: ProviderDeliveryResult }> {
  const now = new Date();
  const alert = notification.alert;
  const opType = notification.operationType as OperationType;

  // 1. Check if underlying alert is still active
  if (alert && ["RESOLVED", "DISMISSED", "CANCELLED"].includes(alert.status)) {
    await prisma.secFacAlertNotification.update({
      where: { id: notification.id },
      data: {
        status: "CANCELLED",
        failureReason: `Underlying alert '${alert.id}' is ${alert.status}. Notification cancelled.`
      }
    });

    return {
      status: "CANCELLED",
      result: {
        success: false,
        status: "SUPPRESSED",
        responseMessage: `Alert resolved/cancelled`,
        retryable: false
      }
    };
  }

  // 2. Resolve preferences & quiet hours
  const prefs = await resolveNotificationPreferences(
    opType,
    notification.recipientUserId,
    notification.recipientRole,
    alert?.alertCode
  );

  const quietResult = evaluateQuietHours(
    prefs.quietHoursStart,
    prefs.quietHoursEnd,
    prefs.timezone,
    alert?.severity || "MEDIUM",
    prefs.allowCriticalOverride,
    now
  );

  if (quietResult.action === "DEFER" && quietResult.deferredUntil) {
    await prisma.secFacAlertNotification.update({
      where: { id: notification.id },
      data: {
        status: "RETRY_SCHEDULED",
        scheduledAt: quietResult.deferredUntil,
        failureReason: quietResult.reason
      }
    });

    return {
      status: "RETRY_SCHEDULED",
      result: {
        success: false,
        status: "SUPPRESSED",
        responseMessage: quietResult.reason || "Deferred during quiet hours",
        retryable: true
      }
    };
  }

  if (quietResult.action === "SUPPRESS") {
    await prisma.secFacAlertNotification.update({
      where: { id: notification.id },
      data: {
        status: "SUPPRESSED",
        failureReason: quietResult.reason
      }
    });

    return {
      status: "SUPPRESSED",
      result: {
        success: false,
        status: "SUPPRESSED",
        responseMessage: quietResult.reason || "Suppressed during quiet hours",
        retryable: false
      }
    };
  }

  // 3. Resolve trusted recipient contact details
  const recipient = await resolveRecipientContactDetails(
    opType,
    notification.recipientUserId,
    notification.recipientRole
  );

  if (!recipient.eligible) {
    await prisma.secFacAlertNotification.update({
      where: { id: notification.id },
      data: {
        status: "SUPPRESSED",
        failureReason: recipient.ineligibilityReason
      }
    });

    return {
      status: "SUPPRESSED",
      result: {
        success: false,
        status: "RECIPIENT_NOT_ELIGIBLE",
        responseMessage: recipient.ineligibilityReason,
        retryable: false
      }
    };
  }

  // 4. Construct provider payload
  const currentAttemptNumber = (notification.attemptCount || 0) + 1;
  const payload: ProviderNotificationPayload = {
    notificationId: notification.id,
    alertId: notification.alertId,
    operationType: opType,
    alertCode: alert?.alertCode || "OPERATIONAL_ALERT",
    severity: alert?.severity || "MEDIUM",
    title: alert?.title || "Operational Alert",
    message: alert?.message || "",
    recipientUserId: recipient.userId,
    recipientRole: recipient.roleCode,
    recipientEmail: recipient.email,
    recipientPhone: recipient.phone,
    recipientPushTokens: recipient.pushTokens,
    channel: notification.channel as AlertNotificationChannel,
    notificationType: notification.notificationType,
    attemptNumber: currentAttemptNumber
  };

  // 5. Select provider adapter
  let deliveryResult: ProviderDeliveryResult;
  switch (notification.channel) {
    case "EMAIL":
      deliveryResult = await emailProvider.send(payload);
      break;
    case "PUSH":
      deliveryResult = await pushProvider.send(payload);
      break;
    case "WHATSAPP":
      deliveryResult = await whatsappProvider.send(payload);
      break;
    case "SMS":
      deliveryResult = await smsProvider.send(payload);
      break;
    case "IN_APP":
    default:
      // IN_APP is queued directly into the database system
      deliveryResult = {
        success: true,
        status: "SENT",
        providerMessageId: `inapp-${notification.id}`,
        responseCode: "200",
        responseMessage: "In-app notification ready in system feed",
        retryable: false
      };
      break;
  }

  // 6. Record attempt history
  await prisma.secFacNotificationAttempt.create({
    data: {
      notificationId: notification.id,
      operationType: opType,
      channel: notification.channel,
      provider: deliveryResult.responseMetadata?.provider || "SYSTEM",
      providerMessageId: deliveryResult.providerMessageId,
      attemptNumber: currentAttemptNumber,
      status: deliveryResult.status,
      attemptedAt: now,
      completedAt: new Date(),
      responseCode: deliveryResult.responseCode,
      responseMessage: deliveryResult.responseMessage,
      errorCode: deliveryResult.errorCode,
      errorMessage: deliveryResult.errorMessage,
      retryable: deliveryResult.retryable,
      nextRetryAt: deliveryResult.retryable
        ? new Date(now.getTime() + getExponentialRetryDelaySeconds(currentAttemptNumber) * 1000)
        : null
    }
  });

  // 7. Update notification state & status
  let finalStatus: string = "SENT";
  if (deliveryResult.success) {
    finalStatus = "SENT";
    await prisma.secFacAlertNotification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        attemptCount: currentAttemptNumber,
        sentAt: now
      }
    });
  } else if (deliveryResult.retryable) {
    const maxAttempts = 5;
    if (currentAttemptNumber >= maxAttempts) {
      finalStatus = "DEAD_LETTER";
      await prisma.secFacAlertNotification.update({
        where: { id: notification.id },
        data: {
          status: "DEAD_LETTER",
          attemptCount: currentAttemptNumber,
          failedAt: now,
          failureReason: `Exceeded maximum attempts (${maxAttempts}). Last error: ${deliveryResult.errorMessage || deliveryResult.responseMessage}`
        }
      });
    } else {
      finalStatus = "RETRY_SCHEDULED";
      const nextRetryAt = new Date(now.getTime() + getExponentialRetryDelaySeconds(currentAttemptNumber) * 1000);
      await prisma.secFacAlertNotification.update({
        where: { id: notification.id },
        data: {
          status: "RETRY_SCHEDULED",
          attemptCount: currentAttemptNumber,
          scheduledAt: nextRetryAt,
          failureReason: deliveryResult.errorMessage || deliveryResult.responseMessage
        }
      });
    }
  } else {
    // Non-retryable failure or suppressed
    finalStatus = deliveryResult.status === "SUPPRESSED" || deliveryResult.status === "PROVIDER_DISABLED" || deliveryResult.status === "CHANNEL_DISABLED" || deliveryResult.status === "RECIPIENT_NOT_ELIGIBLE"
      ? "SUPPRESSED"
      : "FAILED";

    await prisma.secFacAlertNotification.update({
      where: { id: notification.id },
      data: {
        status: finalStatus,
        attemptCount: currentAttemptNumber,
        failedAt: now,
        failureReason: deliveryResult.errorMessage || deliveryResult.responseMessage
      }
    });
  }

  // 8. Record alert event
  await prisma.secFacAlertEvent.create({
    data: {
      alertId: notification.alertId,
      operationType: opType,
      eventType: `NOTIFICATION_${finalStatus}`,
      note: `Notification '${notification.id}' (${notification.channel}) status updated to ${finalStatus}: ${deliveryResult.responseMessage || ""}`
    }
  });

  return { status: finalStatus, result: deliveryResult };
}

/**
 * Claims and processes a batch of notifications.
 */
export async function processOutboxBatch(
  batchSize: number = 20,
  workerId: string = `worker-${process.pid}`,
  opType: OperationType = "SECURITY_GUARDING",
  channelFilter: AlertNotificationChannel = "IN_APP"
): Promise<ProcessOutboxResult> {
  const { claimToken, notifications } = await claimPendingNotificationsBatch(batchSize, workerId, 300, opType, channelFilter);

  let sentCount = 0;
  let retryScheduledCount = 0;
  let failedCount = 0;
  let deadLetterCount = 0;
  let suppressedCount = 0;
  const errors: string[] = [];

  for (const n of notifications) {
    try {
      const res = await processClaimedNotification(n);
      if (res.status === "SENT") sentCount++;
      else if (res.status === "RETRY_SCHEDULED") retryScheduledCount++;
      else if (res.status === "DEAD_LETTER") deadLetterCount++;
      else if (res.status === "SUPPRESSED" || res.status === "CANCELLED") suppressedCount++;
      else failedCount++;
    } catch (e: any) {
      console.error(`Error processing notification '${n.id}':`, e);
      errors.push(`Notification ${n.id}: ${e?.message || e}`);
      failedCount++;
    }
  }

  return {
    claimedCount: notifications.length,
    processedCount: notifications.length,
    sentCount,
    retryScheduledCount,
    failedCount,
    deadLetterCount,
    suppressedCount,
    errors
  };
}

/**
 * Manually retries a failed or dead-letter notification.
 */
export async function manualRetryNotification(
  notificationId: string,
  actorUserId: string,
  reason: string,
  forceOverride: boolean = false
): Promise<{ success: boolean; message: string }> {
  const notification = await prisma.secFacAlertNotification.findUnique({
    where: { id: notificationId },
    include: { alert: true }
  });

  if (!notification) {
    return { success: false, message: "Notification not found." };
  }

  if (notification.alert && ["RESOLVED", "DISMISSED", "CANCELLED"].includes(notification.alert.status) && !forceOverride) {
    return { success: false, message: `Cannot retry notification for resolved/dismissed alert '${notification.alertId}' without explicit override.` };
  }

  const now = new Date();
  await prisma.secFacAlertNotification.update({
    where: { id: notificationId },
    data: {
      status: "PENDING",
      scheduledAt: now,
      claimToken: null,
      claimedAt: null,
      claimedBy: null,
      claimExpiresAt: null,
      failureReason: `Manual retry requested by user '${actorUserId}'. Reason: ${reason}`
    }
  });

  await prisma.secFacAlertEvent.create({
    data: {
      alertId: notification.alertId,
      operationType: notification.operationType,
      eventType: "NOTIFICATION_MANUAL_RETRY",
      performedById: actorUserId,
      note: `Manual retry initiated for notification '${notificationId}'. Reason: ${reason}`
    }
  });

  return { success: true, message: `Notification '${notificationId}' reset to PENDING for outbox worker processing.` };
}
