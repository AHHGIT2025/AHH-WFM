import { prisma } from "@ahh-wfm/database";
import {
  AlertCountSummary,
  AlertListFilters,
  AlertRuleResolutionResult,
  CreateOperationalAlertInput,
  OperationType,
  SecFacAlertRule,
  SecFacOperationalAlert
} from "@ahh-wfm/types";
import { resolveAlertSupervisor } from "./secfac-alert-resolver";

/**
 * Gets Qatar operational business date string (YYYY-MM-DD) in UTC+3 timezone.
 */
export function getQatarBusinessDateString(dateInput?: Date | string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  // Adjust to Qatar Time (UTC+3)
  const qatarTime = new Date(d.getTime() + (3 * 60 * 60 * 1000));
  return qatarTime.toISOString().split("T")[0];
}

/**
 * Resolves alert rule in priority order:
 * Site rule -> Project rule -> Global rule -> No alert
 */
export async function resolveApplicableAlertRule(
  operationType: OperationType,
  code: string,
  siteId?: string | null,
  projectId?: string | null,
  contractId?: string | null
): Promise<AlertRuleResolutionResult> {
  // 1. Site-specific active rule
  if (siteId) {
    const siteRule = await prisma.secFacAlertRule.findFirst({
      where: { operationType, code, siteId, isActive: true }
    });
    if (siteRule) return { rule: siteRule as unknown as SecFacAlertRule, scopeLevel: "SITE" };
  }

  // 2. Project-specific active rule
  if (projectId) {
    const projectRule = await prisma.secFacAlertRule.findFirst({
      where: { operationType, code, projectId, siteId: null, isActive: true }
    });
    if (projectRule) return { rule: projectRule as unknown as SecFacAlertRule, scopeLevel: "PROJECT" };
  }

  // 3. Operation-level global active rule
  const globalRule = await prisma.secFacAlertRule.findFirst({
    where: { operationType, code, siteId: null, projectId: null, contractId: null, isActive: true }
  });
  if (globalRule) return { rule: globalRule as unknown as SecFacAlertRule, scopeLevel: "GLOBAL" };

  return { rule: null, scopeLevel: "NONE" };

}

/**
 * Creates or updates an operational alert transactionally with deduplication and supervisor resolution.
 */
export async function createOrUpdateOperationalAlert(
  input: CreateOperationalAlertInput
): Promise<{ alert: SecFacOperationalAlert | null; created: boolean; redetected: boolean; reopened: boolean; warning?: string }> {
  const {
    operationType,
    alertCode,
    sourceType,
    sourceId = "system-event",
    sourceReference,
    contractId,
    projectId,
    siteId,
    employeeId,
    assignmentId,
    patrolId,
    checklistId,
    incidentId,
    title,
    message,
    severityOverride,
    metadata,
    actorUserId
  } = input;

  // 1. Resolve active rule
  const ruleRes = await resolveApplicableAlertRule(operationType, alertCode, siteId, projectId, contractId);
  if (!ruleRes.rule) {
    return {
      alert: null,
      created: false,
      redetected: false,
      reopened: false,
      warning: `No active alert rule found for ${operationType}:${alertCode}. Alert generation skipped.`
    };
  }

  const rule = ruleRes.rule;
  const severity = severityOverride || rule.severity || "MEDIUM";
  const bDateStr = getQatarBusinessDateString(input.businessDate);
  const deduplicationKey = `${operationType}:${alertCode}:${sourceId}:${bDateStr}`;
  const now = new Date();
  const bDateObj = new Date(`${bDateStr}T00:00:00.000Z`);

  // Calculate next reminder time if rule configures interval
  const nextReminderAt = rule.reminderIntervalMinutes
    ? new Date(now.getTime() + rule.reminderIntervalMinutes * 60 * 1000)
    : null;

  // Check existing alert by deduplication key
  const existingAlert = await prisma.secFacOperationalAlert.findUnique({
    where: { operationType_deduplicationKey: { operationType, deduplicationKey } }
  });

  if (existingAlert) {
    const isInactiveStatus = ["RESOLVED", "DISMISSED", "CANCELLED"].includes(existingAlert.status);

    if (isInactiveStatus) {
      // Reopen alert if issue re-occurs on same business date
      const resolvedAlert = await prisma.$transaction(async (tx) => {
        const reopened = await tx.secFacOperationalAlert.update({
          where: { id: existingAlert.id },
          data: {
            status: "OPEN",
            lastDetectedAt: now,
            acknowledgedAt: null,
            acknowledgedById: null,
            actionStartedAt: null,
            actionStartedById: null,
            resolvedAt: null,
            resolvedById: null,
            resolutionNote: null,
            dismissedAt: null,
            dismissedById: null,
            dismissalReason: null,
            cancelledAt: null,
            cancelledById: null,
            cancellationReason: null,
            nextReminderAt,
            metadata: {
              ...(existingAlert.metadata as object || {}),
              ...(metadata || {}),
              lastReopenedAt: now.toISOString()
            }
          }
        });

        await tx.secFacAlertEvent.create({
          data: {
            alertId: existingAlert.id,
            operationType,
            eventType: "ALERT_REOPENED",
            previousStatus: existingAlert.status,
            newStatus: "OPEN",
            performedById: actorUserId || null,
            note: `Reopened upon operational re-detection: ${title}`
          }
        });

        return reopened;
      });

      return { alert: resolvedAlert as unknown as SecFacOperationalAlert, created: false, redetected: false, reopened: true };
    }

    // Redetection on open/acknowledged/in_progress alert: update timestamps, preserve lifecycle & acknowledgment!
    const redetectedAlert = await prisma.$transaction(async (tx) => {
      const updated = await tx.secFacOperationalAlert.update({
        where: { id: existingAlert.id },
        data: {
          lastDetectedAt: now,
          metadata: {
            ...(existingAlert.metadata as object || {}),
            ...(metadata || {}),
            lastRedetectedAt: now.toISOString()
          }
        }
      });

      await tx.secFacAlertEvent.create({
        data: {
          alertId: existingAlert.id,
          operationType,
          eventType: "ALERT_REDETECTED",
          previousStatus: existingAlert.status,
          newStatus: existingAlert.status,
          performedById: actorUserId || null,
          note: `Redetected event: ${title}`
        }
      });

      return updated;
    });

    return { alert: redetectedAlert as unknown as SecFacOperationalAlert, created: false, redetected: true, reopened: false };
  }

  // Resolving Supervisor Responsibility
  const supervisorRes = await resolveAlertSupervisor({
    operationType,
    siteId,
    projectId,
    employeeId,
    targetRole: rule.targetRole,
    fallbackRole: rule.fallbackRole
  });

  // Create new persistent alert transactionally
  try {
    const newAlert = await prisma.$transaction(async (tx) => {
      const createdAlert = await tx.secFacOperationalAlert.create({
        data: {
          operationType,
          ruleId: rule.id,
          alertCode,
          sourceType,
          sourceId,
          sourceReference,
          contractId,
          projectId,
          siteId,
          employeeId,
          assignmentId,
          patrolId,
          checklistId,
          incidentId,
          severity,
          status: "OPEN",
          title,
          message,
          businessDate: bDateObj,
          deduplicationKey,
          assignedUserId: supervisorRes.assignedUserId,
          assignedRole: supervisorRes.assignedRole,
          assignmentSource: supervisorRes.source,
          escalationLevel: 0,
          firstDetectedAt: now,
          lastDetectedAt: now,
          nextReminderAt,
          metadata: {
            ...(metadata || {}),
            resolutionWarnings: supervisorRes.warnings
          }
        }
      });

      await tx.secFacAlertEvent.create({
        data: {
          alertId: createdAlert.id,
          operationType,
          eventType: "ALERT_CREATED",
          previousStatus: null,
          newStatus: "OPEN",
          newAssignedUserId: supervisorRes.assignedUserId,
          performedById: actorUserId || null,
          note: `Alert created and assigned via ${supervisorRes.source}`
        }
      });

      // Idempotent initial notification queue
      const notifKey = `${createdAlert.id}:${supervisorRes.assignedUserId || "ADMIN"}:INITIAL:0`;
      await tx.secFacAlertNotification.create({
        data: {
          alertId: createdAlert.id,
          operationType,
          recipientUserId: supervisorRes.assignedUserId,
          recipientRole: supervisorRes.assignedRole,
          channel: "IN_APP",
          notificationType: "INITIAL",
          status: "PENDING",
          notificationKey: notifKey,
          scheduledAt: now,
          payload: {
            title: createdAlert.title,
            message: createdAlert.message,
            severity: createdAlert.severity,
            alertCode: createdAlert.alertCode
          }
        }
      });

      return createdAlert;
    });

    return { alert: newAlert as unknown as SecFacOperationalAlert, created: true, redetected: false, reopened: false, warning: supervisorRes.warnings.join("; ") };
  } catch (e: any) {
    // Handle potential concurrent race condition on deduplication key unique constraint
    if (e?.code === "P2002") {
      const racedAlert = await prisma.secFacOperationalAlert.findUnique({
        where: { operationType_deduplicationKey: { operationType, deduplicationKey } }
      });
      return { alert: racedAlert as unknown as SecFacOperationalAlert, created: false, redetected: true, reopened: false };
    }
    throw e;
  }

}

/**
 * Lists operational alerts with strict operation scope filtering.
 */
export async function listOperationalAlerts(filters: AlertListFilters) {
  const {
    operationType,
    status,
    severity,
    alertCode,
    siteId,
    projectId,
    assignedUserId,
    fromDate,
    toDate,
    escalatedOnly,
    unassignedOnly,
    search,
    page = 1,
    pageSize = 20,
    sortBy = "firstDetectedAt",
    sortOrder = "desc"
  } = filters;

  const where: any = { operationType };

  if (status) {
    where.status = Array.isArray(status) ? { in: status } : status;
  }
  if (severity) {
    where.severity = Array.isArray(severity) ? { in: severity } : severity;
  }
  if (alertCode) where.alertCode = alertCode;
  if (siteId) where.siteId = siteId;
  if (projectId) where.projectId = projectId;
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (escalatedOnly) where.escalationLevel = { gt: 0 };
  if (unassignedOnly) where.assignedUserId = null;

  if (fromDate || toDate) {
    where.firstDetectedAt = {};
    if (fromDate) where.firstDetectedAt.gte = new Date(fromDate);
    if (toDate) where.firstDetectedAt.lte = new Date(toDate);
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q } },
      { message: { contains: q } },
      { alertCode: { contains: q } },
      { sourceReference: { contains: q } }
    ];
  }

  const allowedSortFields = [
    "firstDetectedAt",
    "lastDetectedAt",
    "severity",
    "status",
    "escalationLevel",
    "nextReminderAt",
    "createdAt"
  ];
  const activeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "firstDetectedAt";
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const skip = (Math.max(page, 1) - 1) * safePageSize;

  const [total, alerts] = await Promise.all([
    prisma.secFacOperationalAlert.count({ where }),
    prisma.secFacOperationalAlert.findMany({
      where,
      skip,
      take: safePageSize,
      orderBy: { [activeSortBy]: sortOrder },
      include: {
        rule: true,
        events: { orderBy: { createdAt: "desc" }, take: 10 }
      }
    })
  ]);

  return {
    alerts,
    pagination: {
      page: Math.max(page, 1),
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize)
    }
  };
}

/**
 * Gets lightweight alert counts for scoped in-app header indicator.
 */
export async function getOperationalAlertCount(operationType: OperationType): Promise<AlertCountSummary> {
  const alerts = await prisma.secFacOperationalAlert.findMany({
    where: { operationType },
    select: { status: true, severity: true, escalationLevel: true }
  });

  const summary: AlertCountSummary = {
    total: alerts.length,
    open: 0,
    acknowledged: 0,
    inProgress: 0,
    resolved: 0,
    dismissed: 0,
    cancelled: 0,
    critical: 0,
    escalated: 0,
    overdue: 0
  };

  for (const a of alerts) {
    if (a.status === "OPEN") summary.open++;
    if (a.status === "ACKNOWLEDGED") summary.acknowledged++;
    if (a.status === "IN_PROGRESS") summary.inProgress++;
    if (a.status === "RESOLVED") summary.resolved++;
    if (a.status === "DISMISSED") summary.dismissed++;
    if (a.status === "CANCELLED") summary.cancelled++;

    if (["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"].includes(a.status)) {
      if (a.severity === "CRITICAL") summary.critical++;
      if (a.escalationLevel > 0) summary.escalated++;
    }
  }

  return summary;
}

/**
 * Lifecycle Action: Acknowledge Alert
 */
export async function acknowledgeOperationalAlert(alertId: string, userId: string, note?: string) {
  const alert = await prisma.secFacOperationalAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alert not found");
  if (alert.status !== "OPEN") throw new Error(`Cannot acknowledge alert in status ${alert.status}`);

  const now = new Date();
  return await prisma.$transaction(async (tx) => {
    const updated = await tx.secFacOperationalAlert.update({
      where: { id: alertId },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: now,
        acknowledgedById: userId,
        updatedAt: now
      }
    });

    await tx.secFacAlertEvent.create({
      data: {
        alertId,
        operationType: alert.operationType,
        eventType: "ALERT_ACKNOWLEDGED",
        previousStatus: "OPEN",
        newStatus: "ACKNOWLEDGED",
        performedById: userId,
        note: note || "Supervisor acknowledged alert"
      }
    });

    return updated;
  });
}

/**
 * Lifecycle Action: Start Action
 */
export async function startOperationalAlertAction(alertId: string, userId: string, note?: string) {
  const alert = await prisma.secFacOperationalAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alert not found");
  if (!["OPEN", "ACKNOWLEDGED"].includes(alert.status)) {
    throw new Error(`Cannot start action on alert in status ${alert.status}`);
  }

  const now = new Date();
  return await prisma.$transaction(async (tx) => {
    const updated = await tx.secFacOperationalAlert.update({
      where: { id: alertId },
      data: {
        status: "IN_PROGRESS",
        actionStartedAt: now,
        actionStartedById: userId,
        updatedAt: now
      }
    });

    await tx.secFacAlertEvent.create({
      data: {
        alertId,
        operationType: alert.operationType,
        eventType: "ALERT_ACTION_STARTED",
        previousStatus: alert.status,
        newStatus: "IN_PROGRESS",
        performedById: userId,
        note: note || "Started action on alert"
      }
    });

    return updated;
  });
}

/**
 * Lifecycle Action: Resolve Alert (Requires note for High / Critical severity)
 */
export async function resolveOperationalAlert(alertId: string, userId: string, resolutionNote: string) {
  const alert = await prisma.secFacOperationalAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alert not found");
  if (["RESOLVED", "DISMISSED", "CANCELLED"].includes(alert.status)) {
    throw new Error(`Alert is already in ${alert.status} state`);
  }

  if (["HIGH", "CRITICAL"].includes(alert.severity) && (!resolutionNote || !resolutionNote.trim())) {
    throw new Error(`Resolution note is mandatory for ${alert.severity} severity alerts`);
  }

  const now = new Date();
  return await prisma.$transaction(async (tx) => {
    const updated = await tx.secFacOperationalAlert.update({
      where: { id: alertId },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
        resolvedById: userId,
        resolutionNote,
        nextReminderAt: null,
        updatedAt: now
      }
    });

    await tx.secFacAlertEvent.create({
      data: {
        alertId,
        operationType: alert.operationType,
        eventType: "ALERT_RESOLVED",
        previousStatus: alert.status,
        newStatus: "RESOLVED",
        performedById: userId,
        note: resolutionNote
      }
    });

    return updated;
  });
}

/**
 * Lifecycle Action: Dismiss Alert (Requires reason)
 */
export async function dismissOperationalAlert(alertId: string, userId: string, dismissalReason: string) {
  const alert = await prisma.secFacOperationalAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alert not found");
  if (["RESOLVED", "DISMISSED", "CANCELLED"].includes(alert.status)) {
    throw new Error(`Alert is already in ${alert.status} state`);
  }

  if (!dismissalReason || !dismissalReason.trim()) {
    throw new Error("Dismissal reason is required");
  }

  const now = new Date();
  return await prisma.$transaction(async (tx) => {
    const updated = await tx.secFacOperationalAlert.update({
      where: { id: alertId },
      data: {
        status: "DISMISSED",
        dismissedAt: now,
        dismissedById: userId,
        dismissalReason,
        nextReminderAt: null,
        updatedAt: now
      }
    });

    await tx.secFacAlertEvent.create({
      data: {
        alertId,
        operationType: alert.operationType,
        eventType: "ALERT_DISMISSED",
        previousStatus: alert.status,
        newStatus: "DISMISSED",
        performedById: userId,
        note: dismissalReason
      }
    });

    return updated;
  });
}

/**
 * Lifecycle Action: Cancel Alert (Reserved for invalidated source data)
 */
export async function cancelOperationalAlert(alertId: string, userId: string, cancellationReason: string) {
  const alert = await prisma.secFacOperationalAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alert not found");

  if (!cancellationReason || !cancellationReason.trim()) {
    throw new Error("Cancellation reason is required");
  }

  const now = new Date();
  return await prisma.$transaction(async (tx) => {
    const updated = await tx.secFacOperationalAlert.update({
      where: { id: alertId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledById: userId,
        cancellationReason,
        nextReminderAt: null,
        updatedAt: now
      }
    });

    await tx.secFacAlertEvent.create({
      data: {
        alertId,
        operationType: alert.operationType,
        eventType: "ALERT_CANCELLED",
        previousStatus: alert.status,
        newStatus: "CANCELLED",
        performedById: userId,
        note: cancellationReason
      }
    });

    return updated;
  });
}

/**
 * Lifecycle Action: Assign / Reassign Alert
 */
export async function assignOperationalAlert(
  alertId: string,
  targetUserId: string,
  performedById: string,
  note?: string
) {
  const alert = await prisma.secFacOperationalAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alert not found");

  const targetEmp = await prisma.employee.findUnique({ where: { id: targetUserId } });
  if (!targetEmp || !targetEmp.isActive) throw new Error("Target user is inactive or not found");

  const now = new Date();
  return await prisma.$transaction(async (tx) => {
    const updated = await tx.secFacOperationalAlert.update({
      where: { id: alertId },
      data: {
        assignedUserId: targetUserId,
        assignedRole: targetEmp.role,
        assignmentSource: "MANUAL_REASSIGNMENT",
        updatedAt: now
      }
    });

    await tx.secFacAlertEvent.create({
      data: {
        alertId,
        operationType: alert.operationType,
        eventType: alert.assignedUserId ? "ALERT_REASSIGNED" : "ALERT_ASSIGNED",
        previousStatus: alert.status,
        newStatus: alert.status,
        previousAssignedUserId: alert.assignedUserId,
        newAssignedUserId: targetUserId,
        performedById,
        note: note || `Assigned to ${targetEmp.name}`
      }
    });

    return updated;
  });
}
