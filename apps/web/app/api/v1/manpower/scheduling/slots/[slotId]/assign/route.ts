import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../../lib/permissions";
import { checkEmployeeSchedulingEligibility, getQatarDateString, syncAssignmentToLegacy } from "../../../../../../../../lib/roster-engine";

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
      !hasPermission(user, "manpower.schedule.assign")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to assign schedules." }, { status: 403 });
  }

  // 2. Parse request body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { employeeId, expectedSlotVersion, ignoreEligibility } = body;

  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId in request body" }, { status: 400 });
  }

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

      if (slot.fulfillmentStatus === "CANCELLED") {
        return { status: 409, data: { error: "Cannot assign to a cancelled requirement slot." } };
      }

      // 3. Optimistic Concurrency Control (OCC)
      if (expectedSlotVersion !== undefined && slot.rowVersion !== expectedSlotVersion) {
        return { status: 409, data: { error: "Concurrency conflict: The slot was modified by another planner." } };
      }

      // 4. Period Lock verification
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

      // 5. Ensure vacancy
      if (slot.assignments.length > 0) {
        return { status: 409, data: { error: "Roster slot is already assigned to an employee." } };
      }

      // 6. Run scheduling eligibility checks
      const eligibility = await checkEmployeeSchedulingEligibility(employeeId, slotId, tx);
      
      if (!eligibility.canDeploy && !ignoreEligibility) {
        return {
          status: 400,
          data: {
            error: "Employee is ineligible for this assignment.",
            checklist: eligibility.checklist,
            errors: eligibility.errors,
            warnings: eligibility.warnings
          }
        };
      }

      // Check override permissions if ignoreEligibility is requested
      if (ignoreEligibility && !eligibility.canDeploy) {
        if (!hasPermission(user, "manpower.admin.full_access") &&
            !hasPermission(user, "manpower.schedule.override")) {
          return { status: 403, data: { error: "Forbidden: You do not have permission to override scheduling eligibility rules." } };
        }
      }

      // 7. Create Slot Assignment
      const newAssignment = await tx.rosterSlotAssignment.create({
        data: {
          slotId,
          employeeId,
          assignmentType: "PRIMARY",
          historyStatus: "ACTIVE",
          assignedById: user.id,
          validationSnapshot: {
            checklist: eligibility.checklist,
            overridden: ignoreEligibility && !eligibility.canDeploy,
            overrideReason: body.overrideReason || "Manual override"
          },
          syncStatus: "PENDING"
        }
      });

      // 8. Update Slot Status
      const updatedSlot = await tx.rosterRequirementSlot.update({
        where: { id: slotId },
        data: {
          fulfillmentStatus: "FILLED",
          rowVersion: slot.rowVersion + 1
        }
      });

      // Write activity audit log
      await tx.userActivityLog.create({
        data: {
          userId: user.id,
          action: "ROSTER_SLOT_ASSIGN",
          entityType: "RosterSlotAssignment",
          entityId: newAssignment.id,
          afterJson: JSON.stringify({ slotId, employeeId, ignoreEligibility })
        }
      });

      return { status: 200, data: { success: true, assignment: newAssignment, slot: updatedSlot } };
    });

    if (res.status !== 200) {
      return NextResponse.json(res.data, { status: res.status });
    }

    const resData = res.data as any;

    // 9. Sync changes to legacy models asynchronously in background or retryable manner
    const syncRes = await syncAssignmentToLegacy(resData.assignment.id);
    if (!syncRes.success) {
      console.error(`Legacy synchronization failed for assignment ${resData.assignment.id}: ${syncRes.error}`);
    }

    return NextResponse.json(resData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to assign roster slot" }, { status: 500 });
  }
}
