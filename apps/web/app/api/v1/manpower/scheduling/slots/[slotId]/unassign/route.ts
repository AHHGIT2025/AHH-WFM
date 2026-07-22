import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../../lib/permissions";
import { getQatarDateString, syncAssignmentToLegacy } from "../../../../../../../../lib/roster-engine";

export async function POST(
  request: Request,
  { params }: { params: { slotId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const slotId = params.slotId;
  const user = auth.session?.user;

  // 1. Permission checks
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.unassign")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to unassign schedules." }, { status: 403 });
  }

  // 2. Parse request body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = {}; // Reason is optional
  }

  const { unassignmentReason } = body;

  try {
    const res = await prisma.$transaction(async (tx) => {
      // Load slot with current assignments
      const slot = await tx.rosterRequirementSlot.findUnique({
        where: { id: slotId },
        include: {
          assignments: { where: { historyStatus: "ACTIVE" } }
        }
      });

      if (!slot) {
        return { status: 404, data: { error: "Roster requirement slot not found." } };
      }

      // 3. Period Lock verification
      const periodStr = getQatarDateString(slot.businessDate).slice(0, 7); // Format: YYYY-MM
      const lock = await tx.manpowerSchedulingPeriodLock.findUnique({
        where: {
          operationType_period: {
            operationType: slot.operationType,
            period: periodStr
          }
        }
      });

      if (lock && lock.locked) {
        return { status: 409, data: { error: "Edits blocked: This scheduling period is locked." } };
      }

      // 4. Ensure active assignment exists
      if (slot.assignments.length === 0) {
        return { status: 409, data: { error: "Roster slot is already vacant." } };
      }

      const activeAssignment = slot.assignments[0];

      // 5. Update Slot Assignment
      const updatedAssignment = await tx.rosterSlotAssignment.update({
        where: { id: activeAssignment.id },
        data: {
          historyStatus: "CANCELLED",
          unassignedById: user.id,
          unassignedAt: new Date(),
          unassignmentReason: unassignmentReason || "Manual unassignment",
          syncStatus: "PENDING"
        }
      });

      // 6. Update Slot Status to vacant
      const updatedSlot = await tx.rosterRequirementSlot.update({
        where: { id: slotId },
        data: {
          fulfillmentStatus: "VACANT",
          rowVersion: slot.rowVersion + 1
        }
      });

      // Write activity audit log
      await tx.userActivityLog.create({
        data: {
          userId: user.id,
          action: "ROSTER_SLOT_UNASSIGN",
          entityType: "RosterSlotAssignment",
          entityId: activeAssignment.id,
          afterJson: JSON.stringify({ slotId, unassignmentReason })
        }
      });

      return { status: 200, data: { success: true, assignment: updatedAssignment, slot: updatedSlot } };
    });

    if (res.status !== 200) {
      return NextResponse.json(res.data, { status: res.status });
    }

    const resData = res.data as any;

    // 7. Sync changes to legacy models asynchronously in background or retryable manner
    const syncRes = await syncAssignmentToLegacy(resData.assignment.id);
    if (!syncRes.success) {
      console.error(`Legacy synchronization failed for assignment ${resData.assignment.id}: ${syncRes.error}`);
    }

    return NextResponse.json(resData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to unassign roster slot" }, { status: 500 });
  }
}
