import { prisma } from "@ahh-wfm/database";
import { createSecfacFieldExecutionAudit } from "./secfac-audit-helpers";

export interface CreateSupervisorInspectionParams {
  operationType?: string;
  companyId: string;
  siteId: string;
  checkpointId?: string;
  supervisorId: string;
  inspectedEmployeeId: string;
  inspectionDate?: string | Date;
  templateId: string;
  responses: Array<{
    itemTemplateId: string;
    responseValue: string;
    isCompliant?: boolean;
    remarks?: string;
  }>;
  overallResult?: "COMPLIANT" | "NON_COMPLIANT" | "REQUIRES_ACTION";
  notes?: string;
  correctiveAction?: string;
  followUpRequired?: boolean;
  followUpDueDate?: string | Date;
}

export async function createSupervisorInspection(params: CreateSupervisorInspectionParams) {
  const opType = params.operationType || "SECURITY_GUARDING";
  const inspectionDate = params.inspectionDate ? new Date(params.inspectionDate) : new Date();

  // Re-use 100% of existing SECFAC checklist engine for underlying execution
  const assignment = await prisma.secfacAssignment.create({
    data: {
      operationType: opType,
      siteId: params.siteId,
      checkpointId: params.checkpointId || null,
      templateId: params.templateId,
      employeeId: params.inspectedEmployeeId,
      supervisorId: params.supervisorId,
      assignmentName: `Supervisor Inspection Audit - ${params.inspectedEmployeeId}`,
      scheduledStart: inspectionDate,
      scheduledEnd: inspectionDate,
      status: "COMPLETED"
    }
  });

  const execution = await prisma.secfacChecklistExecution.create({
    data: {
      checklistTemplateId: params.templateId,
      operationType: opType,
      assignmentId: assignment.id,
      siteId: params.siteId,
      checkpointId: params.checkpointId || null,
      employeeId: params.supervisorId,
      status: "SUBMITTED",
      submittedAt: inspectionDate,

      responses: {
        create: params.responses.map(r => ({
          checklistItemId: r.itemTemplateId,
          itemTextSnapshot: "Supervisor Audit Item",
          itemTypeSnapshot: "PASS_FAIL",
          answerValue: r.responseValue,
          comment: r.remarks || null
        }))
      }
    }
  });


  const inspection = await prisma.secfacSupervisorInspection.create({
    data: {
      operationType: opType,
      companyId: params.companyId,
      siteId: params.siteId,
      checkpointId: params.checkpointId || null,
      supervisorId: params.supervisorId,
      inspectedEmployeeId: params.inspectedEmployeeId,
      inspectionDate,
      checklistExecutionId: execution.id,
      overallResult: params.overallResult || "COMPLIANT",
      notes: params.notes || null,
      correctiveAction: params.correctiveAction || null,
      followUpRequired: params.followUpRequired === true,
      followUpDueDate: params.followUpDueDate ? new Date(params.followUpDueDate) : null,
      status: params.followUpRequired ? "FOLLOW_UP_PENDING" : "COMPLETED"
    },
    include: {
      checklistExecution: {
        include: {
          responses: true
        }
      }
    }
  });

  await createSecfacFieldExecutionAudit({
    operationType: opType,
    employeeId: params.supervisorId,
    inspectionId: inspection.id,
    checklistExecutionId: execution.id,
    actionType: "SUPERVISOR_INSPECTION_CREATED",
    actionSource: "MOBILE_APP",
    resultStatus: "SUCCESS",
    resultMessage: `Supervisor Inspection created for employee ${params.inspectedEmployeeId} (Result: ${inspection.overallResult})`
  }).catch(() => {});

  return inspection;
}

export async function getSupervisorInspectionDetails(id: string) {
  const inspection = await prisma.secfacSupervisorInspection.findUnique({
    where: { id },
    include: {
      site: true,
      checkpoint: true,
      supervisor: { select: { id: true, name: true, email: true } },
      inspectedEmployee: { select: { id: true, name: true, email: true } },
      checklistExecution: {
        include: {
          checklistTemplate: true,
          responses: {
            include: {
              checklistItem: true
            }
          },
          evidenceAttachments: true
        }
      }

    }
  });


  return inspection;
}

export async function resolveInspectionFollowUp(id: string, notes: string, supervisorId: string) {
  const inspection = await prisma.secfacSupervisorInspection.findUnique({ where: { id } });
  if (!inspection) throw new Error(`Supervisor Inspection '${id}' not found.`);

  const updated = await prisma.secfacSupervisorInspection.update({
    where: { id },
    data: {
      status: "RESOLVED",
      correctiveAction: inspection.correctiveAction ? `${inspection.correctiveAction}\n[Resolution]: ${notes}` : `[Resolution]: ${notes}`
    }
  });

  await createSecfacFieldExecutionAudit({
    operationType: inspection.operationType,
    employeeId: supervisorId,
    inspectionId: inspection.id,
    actionType: "INSPECTION_FOLLOW_UP_RESOLVED",
    actionSource: "WEB_APP",
    resultStatus: "SUCCESS",
    resultMessage: `Supervisor Inspection ${id} follow-up resolved`
  }).catch(() => {});

  return updated;
}
