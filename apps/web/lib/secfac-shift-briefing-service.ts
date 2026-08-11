import { prisma } from "@ahh-wfm/database";
import { createSecfacFieldExecutionAudit } from "./secfac-audit-helpers";

export interface CreateBriefingParams {
  operationType?: string;
  companyId: string;
  siteId: string;
  shiftId?: string;
  briefingDate?: string | Date;
  supervisorId: string;
  postAssignments?: any;
  safetyNotes?: string;
  knownRisks?: string;
  temporaryInstructions?: string;
  briefingNotes?: string;
}

export async function createOrUpdateBriefing(params: CreateBriefingParams) {
  const opType = params.operationType || "SECURITY_GUARDING";
  const briefingDate = params.briefingDate ? new Date(params.briefingDate) : new Date();

  // Single lifecycle record per site/shift/date
  const briefing = await prisma.secfacShiftBriefing.create({
    data: {
      operationType: opType,
      companyId: params.companyId,
      siteId: params.siteId,
      shiftId: params.shiftId || null,
      briefingDate,
      supervisorId: params.supervisorId,
      stage: "BRIEFING_DRAFT",
      postAssignments: params.postAssignments || null,
      safetyNotes: params.safetyNotes || null,
      knownRisks: params.knownRisks || null,
      temporaryInstructions: params.temporaryInstructions || null,
      briefingNotes: params.briefingNotes || null
    }
  });

  await createSecfacFieldExecutionAudit({
    operationType: opType,
    employeeId: params.supervisorId,
    actionType: "SHIFT_BRIEFING_CREATED",
    actionSource: "WEB_APP",
    resultStatus: "SUCCESS",
    resultMessage: `Shift Briefing draft created for site ${params.siteId}`
  }).catch(() => {});

  return briefing;
}

export async function manageBriefingParticipants(briefingId: string, participants: Array<{
  employeeId: string;
  deploymentId?: string;
  attendanceStatus?: "PRESENT" | "ABSENT" | "EXCUSED" | "LATE";
  recordedById?: string;
}>) {
  const briefing = await prisma.secfacShiftBriefing.findUnique({ where: { id: briefingId } });
  if (!briefing) throw new Error(`Shift Briefing '${briefingId}' not found.`);

  if (briefing.stage === "DEBRIEFING_COMPLETED") {
    throw new Error(`Cannot modify participants for a briefing in stage 'DEBRIEFING_COMPLETED'.`);
  }

  const results = [];
  for (const p of participants) {
    const item = await prisma.secfacShiftBriefingParticipant.upsert({
      where: {
        briefingId_employeeId: {
          briefingId,
          employeeId: p.employeeId
        }
      },
      update: {
        attendanceStatus: p.attendanceStatus || "PRESENT",
        acknowledgedAt: new Date(),
        recordedById: p.recordedById || null
      },
      create: {
        briefingId,
        employeeId: p.employeeId,
        deploymentId: p.deploymentId || null,
        attendanceStatus: p.attendanceStatus || "PRESENT",
        acknowledgedAt: new Date(),
        recordedById: p.recordedById || null
      }
    });
    results.push(item);
  }

  return results;
}

export async function completeBriefingStage(params: {
  briefingId: string;
  targetStage: "BRIEFING_COMPLETED" | "DEBRIEFING_COMPLETED";
  notes?: string;
  supervisorId: string;
  carriedIncidentIds?: string[];
}) {
  const briefing = await prisma.secfacShiftBriefing.findUnique({
    where: { id: params.briefingId }
  });

  if (!briefing) throw new Error(`Shift Briefing '${params.briefingId}' not found.`);

  const now = new Date();

  if (params.targetStage === "BRIEFING_COMPLETED") {
    if (briefing.stage === "DEBRIEFING_COMPLETED") {
      throw new Error(`Cannot revert stage from DEBRIEFING_COMPLETED to BRIEFING_COMPLETED.`);
    }

    const updated = await prisma.secfacShiftBriefing.update({
      where: { id: params.briefingId },
      data: {
        stage: "BRIEFING_COMPLETED",
        briefingNotes: params.notes || briefing.briefingNotes,
        briefingCompletedAt: now
      }
    });

    await createSecfacFieldExecutionAudit({
      operationType: briefing.operationType,
      employeeId: params.supervisorId,
      actionType: "SHIFT_BRIEFING_COMPLETED",
      actionSource: "WEB_APP",
      resultStatus: "SUCCESS",
      resultMessage: `Pre-shift Briefing completed for site ${briefing.siteId}`
    }).catch(() => {});

    return updated;
  }

  if (params.targetStage === "DEBRIEFING_COMPLETED") {
    if (briefing.stage !== "BRIEFING_COMPLETED" && briefing.stage !== "DEBRIEFING_COMPLETED") {
      throw new Error(`Briefing must be in stage BRIEFING_COMPLETED before debriefing can be completed.`);
    }

    // Link carried incidents if provided
    if (params.carriedIncidentIds && params.carriedIncidentIds.length > 0) {
      for (const incidentId of params.carriedIncidentIds) {
        await prisma.secfacShiftBriefingCarriedIncident.upsert({
          where: {
            briefingId_incidentId: {
              briefingId: params.briefingId,
              incidentId
            }
          },
          update: {},
          create: {
            briefingId: params.briefingId,
            incidentId
          }
        }).catch(() => {});
      }
    }

    const updated = await prisma.secfacShiftBriefing.update({
      where: { id: params.briefingId },
      data: {
        stage: "DEBRIEFING_COMPLETED",
        debriefingNotes: params.notes || briefing.debriefingNotes,
        debriefingCompletedAt: now
      }
    });

    await createSecfacFieldExecutionAudit({
      operationType: briefing.operationType,
      employeeId: params.supervisorId,
      actionType: "SHIFT_DEBRIEFING_COMPLETED",
      actionSource: "WEB_APP",
      resultStatus: "SUCCESS",
      resultMessage: `Post-shift Debriefing completed for site ${briefing.siteId}`
    }).catch(() => {});

    return updated;
  }

  throw new Error(`Invalid targetStage '${params.targetStage}'`);
}

export async function getBriefingDetails(briefingId: string) {
  const briefing = await prisma.secfacShiftBriefing.findUnique({
    where: { id: briefingId },
    include: {
      site: true,
      supervisor: {
        select: { id: true, name: true, email: true }
      },
      participants: {
        include: {
          employee: {
            select: { id: true, name: true, email: true }
          }
        }
      },

      carriedIncidents: {
        include: {
          incident: true
        }
      }
    }
  });

  return briefing;
}
