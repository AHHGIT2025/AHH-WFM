import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { PrismaClient } from "@ahh-wfm/database";
import {
  acquireScopeLock,
  releaseScopeLock,
  checkPeriodLock,
  logCentralAudit
} from "../../../../../../../../lib/roster-publication-service";

const prisma = new PrismaClient();

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "OPERATIONS_MANAGER"], {
    requiredPermission: "manpower.roster.changeRequest.review"
  });
  if (auth.error) return auth.error;

  const sessionUser = auth.session.user;
  const requestId = params.id;
  const body = await req.json();
  const { decision, reviewNotes, allowSelfApprovalOverride, selfApprovalReason } = body;

  if (!decision || !["APPROVE", "REJECT"].includes(decision)) {
    return NextResponse.json({ error: "Invalid decision. Must be APPROVE or REJECT." }, { status: 400 });
  }

  const changeRequest = await prisma.rosterChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      basePublication: true,
      publicationSlot: true,
      slot: true
    }
  });

  if (!changeRequest) {
    return NextResponse.json({ error: "Change request not found" }, { status: 404 });
  }

  if (changeRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: `Cannot review change request in ${changeRequest.status} status. Request must be PENDING.` },
      { status: 400 }
    );
  }

  const reviewerEmployeeId = (sessionUser as any)?.employeeId || sessionUser.id;
  const isSelfRequest = changeRequest.requestedById === reviewerEmployeeId || changeRequest.requestedById === sessionUser.id;

  if (decision === "REJECT") {
    const updated = await prisma.rosterChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedById: reviewerEmployeeId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || "Change request rejected",
        activeRequestKey: null
      }
    });

    await logCentralAudit({
      action: "REJECT_CHANGE_REQUEST",
      actorId: sessionUser.id,
      operationType: changeRequest.operationType,
      contractId: changeRequest.contractId,
      siteId: changeRequest.siteId || undefined,
      requestId: changeRequest.id,
      oldPublicationId: changeRequest.basePublicationId,
      details: { reviewNotes }
    });

    return NextResponse.json({ success: true, changeRequest: updated });
  }

  if (isSelfRequest) {
    const isSuperAdmin = sessionUser.role === "SUPER_ADMIN";
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Self-approval is forbidden. Another authorized user must review and approve this change request." },
        { status: 403 }
      );
    }

    if (!allowSelfApprovalOverride || !selfApprovalReason || selfApprovalReason.trim().length < 15) {
      return NextResponse.json(
        {
          error: "SUPER_ADMIN self-approval requires explicit allowSelfApprovalOverride=true and mandatory selfApprovalReason (min 15 characters)."
        },
        { status: 400 }
      );
    }
  }

  const basePub = changeRequest.basePublication;
  const lockOwner = `review:${sessionUser.id}:${Date.now()}`;
  const lockKey = await acquireScopeLock(basePub.operationType, basePub.contractId, basePub.siteId, lockOwner);

  try {
    const isLocked = await checkPeriodLock(basePub.operationType, basePub.startDate, basePub.endDate);
    if (isLocked) {
      return NextResponse.json({ error: "Cannot approve change request while period is locked" }, { status: 409 });
    }

    const { newPublication, updatedRequest } = await prisma.$transaction(async (tx) => {
      const currentBase = await tx.rosterPublication.findUnique({
        where: { id: basePub.id }
      });

      if (!currentBase || currentBase.status !== "ACTIVE") {
        throw new Error(`Base publication is no longer ACTIVE (status: ${currentBase?.status || "UNKNOWN"}). Approval aborted.`);
      }

      if (changeRequest.changeType === "EMPLOYEE_REPLACEMENT" && changeRequest.targetEmployeeId) {
        if (changeRequest.primaryAssignmentId) {
          await tx.rosterSlotAssignment.update({
            where: { id: changeRequest.primaryAssignmentId },
            data: {
              employeeId: changeRequest.targetEmployeeId,
              updatedAt: new Date()
            }
          });
        } else {
          await tx.rosterSlotAssignment.create({
            data: {
              slotId: changeRequest.slotId,
              employeeId: changeRequest.targetEmployeeId,
              assignmentType: "PRIMARY",
              historyStatus: "ACTIVE",
              assignedById: reviewerEmployeeId
            }
          });
        }
      } else if (changeRequest.changeType === "ASSIGNMENT_REMOVAL") {
        if (changeRequest.primaryAssignmentId) {
          await tx.rosterSlotAssignment.update({
            where: { id: changeRequest.primaryAssignmentId },
            data: {
              historyStatus: "ENDED",
              unassignedById: reviewerEmployeeId,
              unassignedAt: new Date(),
              unassignmentReason: "Post-publication change request assignment removal",
              updatedAt: new Date()
            }
          });
        }
      } else if (changeRequest.changeType === "SHIFT_TIME_CHANGE") {
        await tx.rosterRequirementSlot.update({
          where: { id: changeRequest.slotId },
          data: {
            snapshotShiftName: changeRequest.proposedShiftName || changeRequest.slot.snapshotShiftName,
            snapshotStartTime: changeRequest.proposedStartTime || changeRequest.slot.snapshotStartTime,
            snapshotEndTime: changeRequest.proposedEndTime || changeRequest.slot.snapshotEndTime,
            updatedAt: new Date()
          }
        });
      } else if (changeRequest.changeType === "SLOT_CANCELLATION") {
        await tx.rosterRequirementSlot.update({
          where: { id: changeRequest.slotId },
          data: { fulfillmentStatus: "CANCELLED", updatedAt: new Date() }
        });
      }

      await tx.rosterPublication.update({
        where: { id: basePub.id },
        data: {
          status: "SUPERSEDED",
          supersededAt: new Date(),
          activeSeriesKey: null
        }
      });

      const nextVersion = basePub.publicationVersion + 1;
      const newPub = await tx.rosterPublication.create({
        data: {
          operationType: basePub.operationType,
          contractId: basePub.contractId,
          siteId: basePub.siteId,
          startDate: basePub.startDate,
          endDate: basePub.endDate,
          seriesKey: basePub.seriesKey,
          activeSeriesKey: basePub.seriesKey,
          publicationVersion: nextVersion,
          status: "ACTIVE",
          revisionReason: `Approved change request ${changeRequest.id}: ${changeRequest.changeType}`,
          supersedesPublicationId: basePub.id,
          publishedById: reviewerEmployeeId
        }
      });

      const baseSlots = await tx.rosterPublicationSlot.findMany({
        where: { publicationId: basePub.id }
      });

      for (const baseSlot of baseSlots) {
        if (baseSlot.id === changeRequest.publicationSlotId) {
          const proposed = changeRequest.proposedSnapshot as any;
          await tx.rosterPublicationSlot.create({
            data: {
              publicationId: newPub.id,
              slotId: baseSlot.slotId,
              snapshotKey: `PUB_SLOT:${newPub.id}:${baseSlot.slotId}:${changeRequest.id}`,
              sourceAssignmentId: proposed.employeeId ? baseSlot.sourceAssignmentId : null,
              sourceAssignmentRole: proposed.coverageType === "VACANT" ? "UNFILLED" : baseSlot.sourceAssignmentRole,
              sourcePlanningExceptionId: baseSlot.sourcePlanningExceptionId,
              coverageType: proposed.coverageType || baseSlot.coverageType,
              employeeId: proposed.employeeId,
              employeeCode: proposed.employeeCode,
              employeeName: proposed.employeeName,
              position: proposed.position || baseSlot.position,
              shiftName: proposed.shiftName || baseSlot.shiftName,
              startTime: proposed.startTime || baseSlot.startTime,
              endTime: proposed.endTime || baseSlot.endTime,
              businessDate: baseSlot.businessDate,
              assignmentStatus: proposed.assignmentStatus || baseSlot.assignmentStatus
            }
          });
        } else {
          await tx.rosterPublicationSlot.create({
            data: {
              publicationId: newPub.id,
              slotId: baseSlot.slotId,
              snapshotKey: `PUB_SLOT:${newPub.id}:${baseSlot.slotId}:${baseSlot.id}`,
              sourceAssignmentId: baseSlot.sourceAssignmentId,
              sourceAssignmentRole: baseSlot.sourceAssignmentRole,
              sourcePlanningExceptionId: baseSlot.sourcePlanningExceptionId,
              coverageType: baseSlot.coverageType,
              employeeId: baseSlot.employeeId,
              employeeCode: baseSlot.employeeCode,
              employeeName: baseSlot.employeeName,
              position: baseSlot.position,
              shiftName: baseSlot.shiftName,
              startTime: baseSlot.startTime,
              endTime: baseSlot.endTime,
              businessDate: baseSlot.businessDate,
              assignmentStatus: baseSlot.assignmentStatus
            }
          });
        }
      }

      await tx.rosterChangeRequest.updateMany({
        where: {
          basePublicationId: basePub.id,
          id: { not: requestId },
          status: "PENDING"
        },
        data: {
          status: "SUPERSEDED",
          activeRequestKey: null,
          reviewNotes: `Superseded by approval of change request ${requestId}`
        }
      });

      const updatedReq = await tx.rosterChangeRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedById: reviewerEmployeeId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || "Approved change request",
          selfApprovalOverride: isSelfRequest,
          selfApprovalReason: isSelfRequest ? selfApprovalReason : null,
          resultingPublicationId: newPub.id,
          activeRequestKey: null
        }
      });

      return { newPublication: newPub, updatedRequest: updatedReq };
    });

    await logCentralAudit({
      action: "APPROVE_CHANGE_REQUEST",
      actorId: sessionUser.id,
      operationType: basePub.operationType,
      contractId: basePub.contractId,
      siteId: basePub.siteId || undefined,
      requestId: changeRequest.id,
      oldPublicationId: basePub.id,
      newPublicationId: newPublication.id,
      details: {
        changeType: changeRequest.changeType,
        newVersion: newPublication.publicationVersion,
        isSelfApprovalOverride: isSelfRequest
      }
    });

    if (isSelfRequest) {
      await logCentralAudit({
        action: "SUPER_ADMIN_SELF_APPROVAL_OVERRIDE",
        actorId: sessionUser.id,
        operationType: basePub.operationType,
        contractId: basePub.contractId,
        requestId: changeRequest.id,
        details: { selfApprovalReason }
      });
    }

    return NextResponse.json({ success: true, newPublication, changeRequest: updatedRequest });
  } catch (err: any) {
    console.error("[PUT /change-requests/review Error]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  } finally {
    await releaseScopeLock(lockKey, lockOwner);
  }
}
