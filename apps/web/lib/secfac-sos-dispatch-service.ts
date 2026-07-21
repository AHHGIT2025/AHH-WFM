import { prisma } from "@ahh-wfm/database";
import { isDbConnected } from "@ahh-wfm/mock-data";
import { OperationType, SecFacDispatchAssignment, SecFacOperationalAlert } from "@ahh-wfm/types";
import { getQatarBusinessDateString } from "./secfac-alert-service";

export interface RaiseSosInput {
  operationType: OperationType;
  employeeId: string;
  idempotencyKey: string;
  siteId?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  holdDurationMs?: number;
  clientCapturedAt: string;
  emergencyNotes?: string;
  deviceSessionId?: string;
}

export interface CreateDispatchInput {
  operationType: OperationType;
  alertId: string;
  responderId: string;
  dispatchedById: string;
  siteId: string;
  acceptanceDeadlineSeconds?: number;
}

/**
 * Creates or retrieves an idempotent SOS panic alert atomically.
 */
export async function raiseSosPanicAlert(input: RaiseSosInput): Promise<{
  alert: any;
  isDuplicate: boolean;
}> {
  const {
    operationType,
    employeeId,
    idempotencyKey,
    siteId: clientSiteId,
    latitude,
    longitude,
    accuracyMeters,
    holdDurationMs = 2000,
    clientCapturedAt,
    emergencyNotes,
    deviceSessionId
  } = input;

  const deduplicationKey = `${operationType}:SOS_PANIC:${employeeId}:${idempotencyKey}`;

  // 1. Check if alert already exists for this idempotency key
  const existingAlert = await prisma.secFacOperationalAlert.findUnique({
    where: {
      operationType_deduplicationKey: {
        operationType,
        deduplicationKey
      }
    },
    include: {
      events: true,
      dispatchAssignments: {
        include: {
          responder: true,
          dispatchedBy: true
        },
        orderBy: { attemptNumber: "desc" }
      }
    }
  });

  if (existingAlert) {
    return { alert: existingAlert, isDuplicate: true };
  }

  // 2. Resolve employee and active deployment context
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, companyId: true }
  });

  if (!employee) {
    throw new Error(`Employee with ID ${employeeId} not found.`);
  }

  // Find active deployment or site
  let siteId = clientSiteId;
  let projectId: string | null = null;
  let contractId: string | null = null;
  let companyId: string | null = employee.companyId || (operationType === "SECURITY_GUARDING" ? "COMP-002" : "COMP-003");

  if (!siteId) {
    const activeDeployment = await prisma.employeeDeployment.findFirst({
      where: {
        employeeId,
        status: "ACTIVE"
      }
    });
    if (activeDeployment?.siteId) {
      siteId = activeDeployment.siteId;
    }
  }

  // If still no siteId, fallback to first active ManpowerSite
  if (!siteId) {
    const site = await prisma.manpowerSite.findFirst({
      where: { isActive: true }
    });
    if (site) siteId = site.id;
  }

  if (!siteId) {
    throw new Error("No active site or deployment context found for employee.");
  }

  const qatarDate = new Date();
  const businessDate = new Date(getQatarBusinessDateString(qatarDate));

  const alertTitle = `SOS PANIC ALERT: ${employee.name || employeeId}`.trim();
  const alertMessage = `Emergency SOS triggered by ${employee.name || employeeId} (ID: ${employeeId}) at site. Coordinates: ${latitude ?? "N/A"}, ${longitude ?? "N/A"}.`;

  const metaObj = {
    idempotencyKey,
    holdDurationMs,
    clientCapturedAt,
    latitude,
    longitude,
    accuracyMeters,
    emergencyNotes,
    deviceSessionId,
    employeeName: employee.name || employeeId
  };

  // 3. Atomically create SecFacOperationalAlert and initial event
  const newAlert = await prisma.$transaction(async (tx) => {
    const alert = await tx.secFacOperationalAlert.create({
      data: {
        operationType,
        alertCode: "SOS_PANIC",
        sourceType: "MOBILE_SOS",
        sourceId: employeeId,
        siteId,
        projectId,
        contractId,
        employeeId,
        severity: "CRITICAL",
        status: "OPEN",
        title: alertTitle,
        message: alertMessage,
        businessDate,
        deduplicationKey,
        firstDetectedAt: qatarDate,
        lastDetectedAt: qatarDate,
        metadata: metaObj,
        events: {
          create: {
            operationType,
            eventType: "ALERT_CREATED",
            newStatus: "OPEN",
            performedById: employeeId,
            note: "SOS panic alert triggered from mobile companion app.",
            metadata: metaObj
          }
        }
      },
      include: {
        events: true,
        dispatchAssignments: true
      }
    });

    await tx.secFacAlertNotification.create({
      data: {
        alertId: alert.id,
        operationType,
        channel: "IN_APP",
        notificationType: "SOS_PANIC_ALERT",
        notificationKey: `notif:sos:${employeeId}:${idempotencyKey}`,
        status: "PENDING",
        scheduledAt: qatarDate
      }
    });

    return alert;
  });

  return { alert: newAlert, isDuplicate: false };
}

/**
 * Acknowledges an SOS operational alert.
 */
export async function acknowledgeSosAlert(alertId: string, userId: string, operationType: OperationType): Promise<any> {
  const alert = await prisma.secFacOperationalAlert.findUnique({
    where: { id: alertId }
  });

  if (!alert) throw new Error("Alert not found.");
  if (alert.operationType !== operationType) throw new Error("Scope mismatch.");

  const now = new Date();
  const updated = await prisma.secFacOperationalAlert.update({
    where: { id: alertId },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: now,
      acknowledgedById: userId,
      events: {
        create: {
          operationType,
          eventType: "ALERT_ACKNOWLEDGED",
          previousStatus: alert.status,
          newStatus: "ACKNOWLEDGED",
          performedById: userId,
          note: "Alert acknowledged by Control Room dispatcher."
        }
      }
    },
    include: {
      events: true,
      dispatchAssignments: {
        include: { responder: true, dispatchedBy: true }
      }
    }
  });

  return updated;
}

/**
 * Dismisses an SOS alert as a False Alarm.
 */
export async function markSosFalseAlarm(alertId: string, userId: string, reason: string, operationType: OperationType): Promise<any> {
  const alert = await prisma.secFacOperationalAlert.findUnique({
    where: { id: alertId }
  });

  if (!alert) throw new Error("Alert not found.");
  if (alert.operationType !== operationType) throw new Error("Scope mismatch.");

  const now = new Date();
  const updated = await prisma.secFacOperationalAlert.update({
    where: { id: alertId },
    data: {
      status: "DISMISSED",
      dismissedAt: now,
      dismissedById: userId,
      dismissalReason: reason,
      events: {
        create: {
          operationType,
          eventType: "ALERT_DISMISSED_FALSE_ALARM",
          previousStatus: alert.status,
          newStatus: "DISMISSED",
          performedById: userId,
          note: `False Alarm: ${reason}`
        }
      }
    },
    include: { events: true, dispatchAssignments: true }
  });

  return updated;
}

/**
 * Cancels an SOS alert.
 */
export async function cancelSosAlert(alertId: string, userId: string, reason: string, operationType: OperationType): Promise<any> {
  const alert = await prisma.secFacOperationalAlert.findUnique({
    where: { id: alertId }
  });

  if (!alert) throw new Error("Alert not found.");
  if (alert.operationType !== operationType) throw new Error("Scope mismatch.");

  const now = new Date();
  const updated = await prisma.secFacOperationalAlert.update({
    where: { id: alertId },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledById: userId,
      cancellationReason: reason,
      events: {
        create: {
          operationType,
          eventType: "ALERT_CANCELLED",
          previousStatus: alert.status,
          newStatus: "CANCELLED",
          performedById: userId,
          note: `Cancelled: ${reason}`
        }
      }
    },
    include: { events: true, dispatchAssignments: true }
  });

  return updated;
}

/**
 * Creates a responder dispatch assignment for an operational alert.
 * Preserves all previous dispatch attempts without overwriting.
 */
export async function createDispatchAssignment(input: CreateDispatchInput): Promise<SecFacDispatchAssignment> {
  const {
    operationType,
    alertId,
    responderId,
    dispatchedById,
    siteId,
    acceptanceDeadlineSeconds = 120 // 2 minutes pilot default
  } = input;

  const alert = await prisma.secFacOperationalAlert.findUnique({
    where: { id: alertId },
    include: { dispatchAssignments: { orderBy: { attemptNumber: "desc" } } }
  });

  if (!alert) throw new Error(`Alert with ID ${alertId} not found.`);
  if (alert.operationType !== operationType) throw new Error("Scope mismatch.");

  // Check responder existence
  const responder = await prisma.employee.findUnique({
    where: { id: responderId }
  });
  if (!responder) throw new Error(`Responder with ID ${responderId} not found.`);

  // Check dispatcher existence
  const dispatcher = await prisma.employee.findUnique({
    where: { id: dispatchedById }
  });
  if (!dispatcher) throw new Error(`Dispatcher with ID ${dispatchedById} not found.`);

  const previousAttempts = alert.dispatchAssignments || [];
  const latestDispatch = previousAttempts[0];
  const nextAttemptNumber = previousAttempts.length + 1;
  const nextSequence = latestDispatch ? latestDispatch.assignmentSequence + 1 : 1;

  const dispatchedAt = new Date();
  const acceptanceDeadline = new Date(dispatchedAt.getTime() + acceptanceDeadlineSeconds * 1000);

  const dispatch = await prisma.$transaction(async (tx) => {
    // 1. Create new dispatch assignment
    const created = await tx.secFacDispatchAssignment.create({
      data: {
        operationType,
        siteId: siteId || alert.siteId || "",
        companyId: alert.contractId || responder.companyId || "COMP-002",
        alertId,
        responderId,
        dispatchedById,
        status: "PENDING_ACCEPTANCE",
        attemptNumber: nextAttemptNumber,
        assignmentSequence: nextSequence,
        previousAssignmentId: latestDispatch ? latestDispatch.id : null,
        dispatchedAt,
        acceptanceDeadline,
        responderEligibilitySnapshot: {
          responderName: responder.name || responder.id,
          companyId: responder.companyId
        }
      },
      include: {
        alert: true,
        responder: true,
        dispatchedBy: true
      }
    });

    // 2. Update alert status to IN_PROGRESS
    await tx.secFacOperationalAlert.update({
      where: { id: alertId },
      data: {
        status: "IN_PROGRESS",
        assignedUserId: responderId,
        events: {
          create: {
            operationType,
            eventType: "DISPATCH_CREATED",
            newStatus: "IN_PROGRESS",
            performedById: dispatchedById,
            note: `Assigned responder ${responder.name || responder.id} (Attempt #${nextAttemptNumber}).`
          }
        }
      }
    });

    return created;
  });

  return dispatch as unknown as SecFacDispatchAssignment;
}

/**
 * Accept a dispatch assignment (Responder action).
 */
export async function acceptDispatchAssignment(dispatchId: string, responderId: string): Promise<any> {
  const dispatch = await prisma.secFacDispatchAssignment.findUnique({
    where: { id: dispatchId },
    include: { alert: true }
  });

  if (!dispatch) throw new Error("Dispatch assignment not found.");
  if (dispatch.responderId !== responderId) throw new Error("Forbidden: You are not the assigned responder.");

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.secFacDispatchAssignment.update({
      where: { id: dispatchId },
      data: {
        status: "ACCEPTED",
        acceptedAt: now
      }
    });

    await tx.secFacAlertEvent.create({
      data: {
        alertId: dispatch.alertId,
        operationType: dispatch.operationType,
        eventType: "DISPATCH_ACCEPTED",
        performedById: responderId,
        note: "Responder accepted dispatch assignment."
      }
    });

    return res;
  });

  return updated;
}

/**
 * Reject a dispatch assignment with category & reason (Responder action).
 */
export async function rejectDispatchAssignment(
  dispatchId: string,
  responderId: string,
  rejectionCategory: string,
  rejectionReason: string
): Promise<any> {
  const dispatch = await prisma.secFacDispatchAssignment.findUnique({
    where: { id: dispatchId }
  });

  if (!dispatch) throw new Error("Dispatch assignment not found.");
  if (dispatch.responderId !== responderId) throw new Error("Forbidden: You are not the assigned responder.");

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.secFacDispatchAssignment.update({
      where: { id: dispatchId },
      data: {
        status: "REJECTED",
        rejectedAt: now,
        rejectionCategory,
        rejectionReason
      }
    });

    await tx.secFacAlertEvent.create({
      data: {
        alertId: dispatch.alertId,
        operationType: dispatch.operationType,
        eventType: "DISPATCH_REJECTED",
        performedById: responderId,
        note: `Responder rejected dispatch (${rejectionCategory}): ${rejectionReason}`
      }
    });

    return res;
  });

  return updated;
}

/**
 * Mark arrival at scene with GPS coordinates (Responder action).
 */
export async function arriveDispatchAssignment(
  dispatchId: string,
  responderId: string,
  latitude?: number,
  longitude?: number,
  accuracyMeters?: number
): Promise<any> {
  const dispatch = await prisma.secFacDispatchAssignment.findUnique({
    where: { id: dispatchId }
  });

  if (!dispatch) throw new Error("Dispatch assignment not found.");
  if (dispatch.responderId !== responderId) throw new Error("Forbidden: You are not the assigned responder.");

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.secFacDispatchAssignment.update({
      where: { id: dispatchId },
      data: {
        status: "ARRIVED",
        arrivedAt: now,
        arrivalLatitude: latitude,
        arrivalLongitude: longitude,
        arrivalAccuracyMeters: accuracyMeters
      }
    });

    await tx.secFacAlertEvent.create({
      data: {
        alertId: dispatch.alertId,
        operationType: dispatch.operationType,
        eventType: "DISPATCH_ARRIVED",
        performedById: responderId,
        note: `Responder arrived at scene. Coordinates: ${latitude ?? "N/A"}, ${longitude ?? "N/A"}`
      }
    });

    return res;
  });

  return updated;
}

/**
 * Complete a dispatch assignment & resolve the alert.
 */
export async function completeDispatchAssignment(
  dispatchId: string,
  actorUserId: string,
  completionNotes: string
): Promise<any> {
  const now = new Date();

  if (isDbConnected()) {
    const dispatch = await prisma.secFacDispatchAssignment.findUnique({
      where: { id: dispatchId }
    });

    if (!dispatch) throw new Error("Dispatch assignment not found.");

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.secFacDispatchAssignment.update({
        where: { id: dispatchId },
        data: {
          status: "COMPLETED",
          completedAt: now,
          completionNotes
        }
      });

      await tx.secFacAlertEvent.create({
        data: {
          alertId: dispatch.alertId,
          operationType: dispatch.operationType,
          eventType: "DISPATCH_COMPLETED",
          performedById: actorUserId,
          note: `Responder completed dispatch assignment: ${completionNotes}`
        }
      });

      return res;
    });

    return updated;
  }

  return {
    id: dispatchId,
    status: "COMPLETED",
    completedAt: now.toISOString(),
    completionNotes
  };
}

/**
 * Evaluates pending dispatch assignments that have passed acceptanceDeadline and transitions them to TIMED_OUT.
 */
export async function timeoutPendingDispatchAssignments(): Promise<{ timedOutCount: number }> {
  const now = new Date();
  let timedOutCount = 0;

  if (isDbConnected()) {
    const pendingOverdue = await prisma.secFacDispatchAssignment.findMany({
      where: {
        status: "PENDING_ACCEPTANCE",
        acceptanceDeadline: { lt: now }
      },
      include: { alert: true }
    });

    for (const assignment of pendingOverdue) {
      await prisma.$transaction(async (tx) => {
        await tx.secFacDispatchAssignment.update({
          where: { id: assignment.id },
          data: {
            status: "TIMED_OUT",
            timedOutAt: now
          }
        });

        await tx.secFacAlertEvent.create({
          data: {
            alertId: assignment.alertId,
            operationType: assignment.operationType,
            eventType: "DISPATCH_TIMED_OUT",
            performedById: assignment.dispatchedById,
            note: `Dispatch assignment #${assignment.attemptNumber} timed out after acceptance deadline.`
          }
        });
      });

      timedOutCount++;
    }
  }

  return { timedOutCount };
}

/**
 * Queries Control Room events & dispatches incrementally using cursor pagination.
 */
export async function getControlRoomIncrementalFeed(params: {
  operationType: OperationType;
  updatedAfter?: string;
  limit?: number;
  siteId?: string;
  companyId?: string;
}) {
  const { operationType, updatedAfter, limit = 50, siteId, companyId } = params;
  const take = Math.min(limit, 100);

  const whereClause: any = {
    operationType
  };

  if (siteId) whereClause.siteId = siteId;
  if (companyId) whereClause.companyId = companyId;
  if (updatedAfter) {
    whereClause.updatedAt = { gt: new Date(updatedAfter) };
  }

  const [alerts, dispatches] = await Promise.all([
    prisma.secFacOperationalAlert.findMany({
      where: whereClause,
      take,
      orderBy: { updatedAt: "desc" },
      include: {
        events: { take: 5, orderBy: { createdAt: "desc" } },
        dispatchAssignments: {
          orderBy: { attemptNumber: "desc" },
          take: 1,
          include: { responder: true, dispatchedBy: true }
        }
      }
    }),
    prisma.secFacDispatchAssignment.findMany({
      where: whereClause,
      take,
      orderBy: { updatedAt: "desc" },
      include: {
        responder: true,
        dispatchedBy: true,
        alert: true
      }
    })
  ]);

  const latestAlertUpdate = alerts[0]?.updatedAt;
  const latestDispatchUpdate = dispatches[0]?.updatedAt;
  const maxTime = [latestAlertUpdate, latestDispatchUpdate]
    .filter(Boolean)
    .sort((a, b) => b!.getTime() - a!.getTime())[0];

  return {
    alerts,
    dispatches,
    nextCursor: maxTime ? maxTime.toISOString() : updatedAfter || new Date().toISOString()
  };
}
