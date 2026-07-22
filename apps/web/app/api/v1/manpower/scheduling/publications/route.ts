import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";
import { getQatarDate, getQatarDateString, syncAssignmentToLegacy } from "../../../../../../lib/roster-engine";

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;

  // 1. Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.publish")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to publish schedules." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contractId, startDate: startDateStr, endDate: endDateStr } = body;

  if (!contractId || !startDateStr || !endDateStr) {
    return NextResponse.json({ error: "Missing contractId, startDate, or endDate in request body" }, { status: 400 });
  }

  try {
    const contract = await prisma.manpowerContract.findUnique({
      where: { id: contractId }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const startDate = getQatarDate(startDateStr);
    const endDate = getQatarDate(endDateStr);

    // Fetch all slots in the range
    const slots = await prisma.rosterRequirementSlot.findMany({
      where: {
        contractId,
        businessDate: { gte: startDate, lte: endDate },
        fulfillmentStatus: { not: "CANCELLED" }
      },
      include: {
        assignments: {
          where: { historyStatus: "ACTIVE" },
          include: { employee: true }
        }
      }
    });

    if (slots.length === 0) {
      return NextResponse.json({ error: "No active requirement slots found in this date range to publish." }, { status: 400 });
    }

    // Determine the next version
    const lastPub = await prisma.rosterPublication.findFirst({
      where: { contractId },
      orderBy: { publicationVersion: "desc" }
    });
    const nextVersion = lastPub ? lastPub.publicationVersion + 1 : 1;

    const res = await prisma.$transaction(async (tx) => {
      // 2. Create the publication record
      const publication = await tx.rosterPublication.create({
        data: {
          operationType: contract.operationType,
          contractId,
          siteId: contract.siteId,
          startDate,
          endDate,
          publicationVersion: nextVersion,
          publishedById: user.id
        }
      });

      const assignmentIdsToSync: string[] = [];

      // 3. Loop through slots to create snapshots and update statuses
      for (const slot of slots) {
        const activeAssignment = slot.assignments[0];

        // Create immutable snapshot of the slot and assignment
        await tx.rosterPublicationSlot.create({
          data: {
            publicationId: publication.id,
            slotId: slot.id,
            employeeId: activeAssignment?.employeeId || null,
            employeeCode: activeAssignment?.employee?.id || null,
            employeeName: activeAssignment?.employee?.name || null,
            position: slot.snapshotPosition,
            shiftName: slot.snapshotShiftName,
            startTime: slot.snapshotStartTime,
            endTime: slot.snapshotEndTime,
            businessDate: slot.businessDate,
            assignmentStatus: activeAssignment ? "FILLED" : "VACANT"
          }
        });

        // Update schedule status to PUBLISHED
        await tx.rosterRequirementSlot.update({
          where: { id: slot.id },
          data: { scheduleStatus: "PUBLISHED" }
        });

        if (activeAssignment) {
          assignmentIdsToSync.push(activeAssignment.id);
        }
      }

      // Write activity log
      await tx.userActivityLog.create({
        data: {
          userId: user.id,
          action: "ROSTER_PUBLISH",
          entityType: "RosterPublication",
          entityId: publication.id,
          afterJson: JSON.stringify({ contractId, version: nextVersion, startDateStr, endDateStr })
        }
      });

      return { publication, assignmentIdsToSync };
    });

    // 4. Trigger legacy projections for the published assignments in parallel (non-blocking or bounded retryable)
    for (const assignmentId of res.assignmentIdsToSync) {
      await syncAssignmentToLegacy(assignmentId);
    }

    return NextResponse.json({
      success: true,
      publication: res.publication,
      slotsPublishedCount: slots.length
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to publish roster" }, { status: 500 });
  }
}
