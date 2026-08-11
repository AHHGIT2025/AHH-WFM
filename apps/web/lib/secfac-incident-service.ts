import { prisma } from "@ahh-wfm/database";
import { createSecfacFieldExecutionAudit } from "./secfac-audit-helpers";

export interface ReportIncidentParams {
  operationType?: string;
  companyId: string;
  siteId: string;
  checkpointId?: string;
  reportedById: string;
  source?: string;
  type?: "OCCURRENCE" | "INCIDENT";
  category?: string;
  severity?: "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
  title: string;
  description: string;
  immediateAction?: string;
  incidentDate?: string | Date;
  assignedToId?: string;
  sosAlertId?: string;
  dispatchAssignmentId?: string;
  idempotencyKey?: string;
}

/**
 * Concurrency-safe, atomic, company-scoped and month-scoped reference generator.
 * Format: INC-YYYYMM-XXXX or OCC-YYYYMM-XXXX (e.g. INC-202608-0001)
 * Uses atomic sequence counter row (secfac_number_sequences) with incrementing currentValue.
 */
export async function generateIncidentNumber(companyId: string, type: string = "INCIDENT"): Promise<string> {
  const now = new Date();
  const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const recordType = type === "OCCURRENCE" ? "OCC" : "INC";

  let attempts = 0;
  let lastErr: any = null;
  while (attempts < 5) {
    attempts++;
    try {
      const seqRecord = await prisma.secfacNumberSequence.upsert({
        where: {
          companyId_period_recordType: {
            companyId,
            period,
            recordType
          }
        },
        create: {
          companyId,
          period,
          recordType,
          currentValue: 1
        },
        update: {
          currentValue: { increment: 1 }
        }
      });

      const seqStr = String(seqRecord.currentValue).padStart(4, "0");
      return `${recordType}-${period}-${seqStr}`;
    } catch (err) {
      lastErr = err;
      await new Promise(res => setTimeout(res, 20 * attempts));
    }
  }

  throw lastErr || new Error("Failed to allocate atomic incident reference number.");
}



export async function reportIncident(params: ReportIncidentParams) {
  const idempotencyKey = params.idempotencyKey || `INC-${params.companyId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Idempotency check: if key already exists, return existing record
  const existingByKey = await prisma.secfacIncident.findUnique({
    where: { idempotencyKey },
    include: { history: true }
  });

  if (existingByKey) {
    return existingByKey;
  }

  const opType = params.operationType || "SECURITY_GUARDING";
  let attempts = 0;
  let incident: any = null;

  while (attempts < 5) {
    attempts++;
    const incidentNumber = await generateIncidentNumber(params.companyId, params.type);

    try {
      incident = await prisma.secfacIncident.create({
        data: {
          incidentNumber,
          operationType: opType,
          companyId: params.companyId,
          siteId: params.siteId,
          checkpointId: params.checkpointId || null,
          reportedById: params.reportedById,
          source: params.source || "MOBILE_APP",
          type: params.type || "INCIDENT",
          category: params.category || "OTHER",
          severity: params.severity || "MINOR",
          title: params.title,
          description: params.description,
          immediateAction: params.immediateAction || null,
          incidentDate: params.incidentDate ? new Date(params.incidentDate) : new Date(),
          assignedToId: params.assignedToId || null,
          status: "REPORTED",
          sosAlertId: params.sosAlertId || null,
          dispatchAssignmentId: params.dispatchAssignmentId || null,
          idempotencyKey,
          history: {
            create: {
              toStatus: "REPORTED",
              action: "INCIDENT_REPORTED",
              remarks: `Incident ${incidentNumber} reported via ${params.source || "MOBILE_APP"}`,
              performedById: params.reportedById
            }
          }
        },
        include: {
          history: true
        }
      });
      break;
    } catch (err: any) {
      if (err.code === "P2002" && err.meta?.target?.includes("incidentNumber") && attempts < 5) {
        // Concurrency race on incidentNumber, retry with fresh sequence
        continue;
      }
      throw err;
    }
  }


  await createSecfacFieldExecutionAudit({
    operationType: opType,
    employeeId: params.reportedById,
    incidentId: incident.id,
    idempotencyKey,
    actionType: "INCIDENT_REPORTED",
    actionSource: params.source || "MOBILE_APP",
    resultStatus: "SUCCESS",
    resultMessage: `Incident ${incident.incidentNumber} (${params.severity}) reported`
  }).catch(() => {});

  return incident;
}

export async function promoteOccurrenceToIncident(params: {
  incidentId: string;
  performedById: string;
  remarks?: string;
  category?: string;
  severity?: "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
}) {
  const incident = await prisma.secfacIncident.findUnique({
    where: { id: params.incidentId }
  });

  if (!incident) throw new Error(`Incident '${params.incidentId}' not found.`);

  if (incident.type !== "OCCURRENCE") {
    throw new Error(`Record '${incident.incidentNumber}' is already an INCIDENT.`);
  }

  const updated = await prisma.secfacIncident.update({
    where: { id: params.incidentId },
    data: {
      type: "INCIDENT",
      category: params.category || incident.category,
      severity: params.severity || "MODERATE",
      history: {
        create: {
          fromStatus: incident.status,
          toStatus: incident.status,
          action: "PROMOTE_TO_INCIDENT",
          remarks: params.remarks || "Occurrence promoted to formal Incident",
          performedById: params.performedById
        }
      }
    },
    include: { history: true }
  });

  await createSecfacFieldExecutionAudit({
    operationType: incident.operationType,
    employeeId: params.performedById,
    incidentId: incident.id,
    actionType: "OCCURRENCE_PROMOTED",
    actionSource: "WEB_APP",
    resultStatus: "SUCCESS",
    resultMessage: `Occurrence ${incident.incidentNumber} promoted to INCIDENT (${updated.severity})`
  }).catch(() => {});

  return updated;
}

export async function assignIncidentSupervisor(params: {
  incidentId: string;
  assignedToId: string;
  performedById: string;
  remarks?: string;
}) {
  const incident = await prisma.secfacIncident.findUnique({
    where: { id: params.incidentId }
  });

  if (!incident) throw new Error(`Incident '${params.incidentId}' not found.`);

  const nextStatus = incident.status === "REPORTED" ? "ASSIGNED" : incident.status;

  const updated = await prisma.secfacIncident.update({
    where: { id: params.incidentId },
    data: {
      assignedToId: params.assignedToId,
      status: nextStatus,
      history: {
        create: {
          fromStatus: incident.status,
          toStatus: nextStatus,
          action: "SUPERVISOR_ASSIGNED",
          remarks: params.remarks || `Assigned to supervisor ${params.assignedToId}`,
          performedById: params.performedById
        }
      }
    },
    include: { history: true }
  });

  return updated;
}

export async function transitionIncidentStatus(params: {
  incidentId: string;
  targetStatus: "ACKNOWLEDGED" | "INVESTIGATING" | "ACTION_IN_PROGRESS" | "CANCELLED";
  performedById: string;
  remarks?: string;
}) {
  const incident = await prisma.secfacIncident.findUnique({
    where: { id: params.incidentId }
  });

  if (!incident) throw new Error(`Incident '${params.incidentId}' not found.`);

  const updated = await prisma.secfacIncident.update({
    where: { id: params.incidentId },
    data: {
      status: params.targetStatus,
      history: {
        create: {
          fromStatus: incident.status,
          toStatus: params.targetStatus,
          action: `TRANSITION_${params.targetStatus}`,
          remarks: params.remarks || `Status transitioned to ${params.targetStatus}`,
          performedById: params.performedById
        }
      }
    },
    include: { history: true }
  });

  return updated;
}

/**
 * Handles incident closure requests.
 * STRICT WORKFLOW RULE:
 * For MAJOR and CRITICAL severity incidents, Settings > Workflow Setup (SECFAC_INCIDENT_CLOSURE) is AUTHORITATIVE.
 * If NO workflow is configured for MAJOR/CRITICAL, throws WORKFLOW_CONFIGURATION_REQUIRED error. No silent bypass!
 */
export async function requestIncidentClosure(params: {
  incidentId: string;
  closedById: string;
  closureReason: string;
}) {
  const incident = await prisma.secfacIncident.findUnique({
    where: { id: params.incidentId }
  });

  if (!incident) throw new Error(`Incident '${params.incidentId}' not found.`);

  const isHighSeverity = incident.severity === "MAJOR" || incident.severity === "CRITICAL";

  // Check Settings > Workflow Setup for SECFAC_INCIDENT_CLOSURE module
  const workflowSetup = await prisma.leaveApprovalWorkflow.findFirst({
    where: {
      name: "SECFAC_INCIDENT_CLOSURE",
      isActive: true
    }
  }).catch(() => null);


  if (isHighSeverity) {
    if (!workflowSetup) {
      // STRICT MISSING-WORKFLOW GUARDRAIL: DO NOT SILENTLY PERMIT DIRECT CLOSURE!
      throw new Error(
        `WORKFLOW_CONFIGURATION_REQUIRED: Incident '${incident.incidentNumber}' has severity '${incident.severity}' which requires centralized approval, ` +
        `but no active workflow is configured under Settings > Workflow Setup for module SECFAC_INCIDENT_CLOSURE in company '${incident.companyId}'.`
      );
    }


    // Submit for workflow approval
    const updated = await prisma.secfacIncident.update({
      where: { id: params.incidentId },
      data: {
        status: "PENDING_CLOSURE",
        workflowStatus: "PENDING_APPROVAL",
        closureReason: params.closureReason,
        history: {
          create: {
            fromStatus: incident.status,
            toStatus: "PENDING_CLOSURE",
            action: "REQUEST_CLOSURE_WORKFLOW",
            remarks: `Submitted for workflow closure approval: ${params.closureReason}`,
            performedById: params.closedById
          }
        }
      },
      include: { history: true }
    });

    return {
      incident: updated,
      requiresWorkflow: true,
      workflowStatus: "PENDING_APPROVAL"
    };
  }

  // MINOR or MODERATE incidents can be closed directly by authorized roles if no workflow is configured
  const now = new Date();
  const updated = await prisma.secfacIncident.update({
    where: { id: params.incidentId },
    data: {
      status: "CLOSED",
      workflowStatus: "NONE",
      closureReason: params.closureReason,
      closedById: params.closedById,
      closedAt: now,
      history: {
        create: {
          fromStatus: incident.status,
          toStatus: "CLOSED",
          action: "INCIDENT_CLOSED",
          remarks: `Direct closure: ${params.closureReason}`,
          performedById: params.closedById
        }
      }
    },
    include: { history: true }
  });

  await createSecfacFieldExecutionAudit({
    operationType: incident.operationType,
    employeeId: params.closedById,
    incidentId: incident.id,
    actionType: "INCIDENT_CLOSED",
    actionSource: "WEB_APP",
    resultStatus: "SUCCESS",
    resultMessage: `Incident ${incident.incidentNumber} closed`
  }).catch(() => {});

  return {
    incident: updated,
    requiresWorkflow: false,
    workflowStatus: "NONE"
  };
}

export async function handleIncidentWorkflowAction(params: {
  incidentId: string;
  action: "APPROVE" | "RETURN" | "REJECT";
  performerId: string;
  remarks?: string;
}) {
  const incident = await prisma.secfacIncident.findUnique({
    where: { id: params.incidentId }
  });

  if (!incident) throw new Error(`Incident '${params.incidentId}' not found.`);

  if (incident.status !== "PENDING_CLOSURE" && incident.workflowStatus !== "PENDING_APPROVAL") {
    throw new Error(`Incident '${incident.incidentNumber}' is not pending workflow approval.`);
  }

  const now = new Date();

  if (params.action === "APPROVE") {
    const updated = await prisma.secfacIncident.update({
      where: { id: params.incidentId },
      data: {
        status: "CLOSED",
        workflowStatus: "APPROVED",
        closedById: params.performerId,
        closedAt: now,
        history: {
          create: {
            fromStatus: incident.status,
            toStatus: "CLOSED",
            action: "WORKFLOW_APPROVED",
            remarks: params.remarks || "Incident closure approved via workflow",
            performedById: params.performerId
          }
        }
      },
      include: { history: true }
    });

    return updated;
  }

  if (params.action === "RETURN") {
    const updated = await prisma.secfacIncident.update({
      where: { id: params.incidentId },
      data: {
        status: "INVESTIGATING",
        workflowStatus: "RETURNED",
        history: {
          create: {
            fromStatus: incident.status,
            toStatus: "INVESTIGATING",
            action: "WORKFLOW_RETURNED",
            remarks: params.remarks || "Incident closure returned for further investigation",
            performedById: params.performerId
          }
        }
      },
      include: { history: true }
    });

    return updated;
  }

  if (params.action === "REJECT") {
    const updated = await prisma.secfacIncident.update({
      where: { id: params.incidentId },
      data: {
        status: "INVESTIGATING",
        workflowStatus: "REJECTED",
        history: {
          create: {
            fromStatus: incident.status,
            toStatus: "INVESTIGATING",
            action: "WORKFLOW_REJECTED",
            remarks: params.remarks || "Incident closure rejected by approver",
            performedById: params.performerId
          }
        }
      },
      include: { history: true }
    });

    return updated;
  }

  throw new Error(`Invalid workflow action '${params.action}'`);
}

export async function getIncidentDetails(incidentId: string) {
  const incident = await prisma.secfacIncident.findUnique({
    where: { id: incidentId },
    include: {
      site: true,
      checkpoint: true,
      reportedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      closedBy: { select: { id: true, name: true, email: true } },
      history: {
        include: {
          performedBy: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: "asc" }
      },

      evidenceAttachments: true
    }
  });

  return incident;
}
