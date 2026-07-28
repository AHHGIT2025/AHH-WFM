import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { validateRelieverEligibility } from "@/lib/reliever-engine";
import { generateActiveExceptionKey } from "@/lib/roster-engine"; 

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "HR_MANAGER"]);
  if (auth.error) return auth.error;

  const userId = auth.session?.user?.id || "AD-0001";

  try {
    const payload = await request.json();
    const { 
      slotId, 
      primaryAssignmentId,
      exceptionType, // "DAY_OFF", "LEAVE", "SICK_LEAVE", "ABSENT", "OTHER"
      relieverEmployeeId,
      sourceReferenceId,
      businessDate
    } = payload;

    if (!slotId || !primaryAssignmentId || !exceptionType || !businessDate) {
      return NextResponse.json(
        { error: "slotId, primaryAssignmentId, exceptionType, and businessDate are required" },
        { status: 400 }
      );
    }

    const slot = await prisma.rosterRequirementSlot.findUnique({
      where: { id: slotId },
      include: { assignments: true }
    });

    if (!slot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    const primaryAssignment = slot.assignments.find(a => a.id === primaryAssignmentId);
    if (!primaryAssignment) {
      return NextResponse.json({ error: "Primary assignment not found" }, { status: 404 });
    }

    // 1. Check leave logic for LEAVE and SICK_LEAVE
    let resolvedLeaveId = null;
    let finalExceptionType = exceptionType;
    let finalStatus = relieverEmployeeId ? "RELIEVER_ASSIGNED" : "COVERAGE_REQUIRED";

    if (exceptionType === "LEAVE" || exceptionType === "SICK_LEAVE") {
      if (!sourceReferenceId) {
         return NextResponse.json({ error: "sourceReferenceId (Leave Request ID) is required for LEAVE exceptions" }, { status: 400 });
      }
      const leave = await prisma.leaveRequest.findUnique({ where: { id: sourceReferenceId } });
      if (!leave) {
         return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
      }
      if (leave.status !== "APPROVED") {
         // It's pending/provisional
         finalStatus = "OPEN"; 
      }
      resolvedLeaveId = leave.id;
    }

    const activeExceptionKey = generateActiveExceptionKey ? generateActiveExceptionKey(slotId, primaryAssignment.employeeId) : `${slotId}-${primaryAssignment.employeeId}`;

    const result = await prisma.$transaction(async (tx) => {
      // 2. Upsert the RosterPlanningException
      const exception = await tx.rosterPlanningException.upsert({
        where: { activeExceptionKey },
        create: {
          operationType: slot.operationType,
          contractId: slot.contractId,
          siteId: slot.siteId,
          exceptionType: finalExceptionType,
          severity: "WARNING",
          message: `Reliever coverage required due to ${finalExceptionType}`,
          status: finalStatus as any,
          businessDate: new Date(businessDate),
          slotId: slot.id,
          employeeId: primaryAssignment.employeeId,
          leaveRequestId: resolvedLeaveId,
          primaryAssignmentId: primaryAssignment.id,
          activeExceptionKey,
          resolved: false
        },
        update: {
          exceptionType: finalExceptionType,
          status: finalStatus as any,
          leaveRequestId: resolvedLeaveId,
        }
      });

      // 3. Assign Reliever if requested
      if (relieverEmployeeId) {
        // Re-validate inside transaction
        const eligibilities = await validateRelieverEligibility({ slotId, targetDate: businessDate });
        const elig = eligibilities.find(e => e.employeeId === relieverEmployeeId);
        if (!elig || !elig.isEligible) {
          throw new Error("Selected employee is not eligible to be a reliever for this slot.");
        }

        // Deactivate old reliever if exists
        await tx.rosterSlotAssignment.updateMany({
          where: {
            slotId: slot.id,
            replacesAssignmentId: primaryAssignment.id,
            assignmentType: "RELIEVER",
            historyStatus: "ACTIVE"
          },
          data: {
            historyStatus: "CANCELLED",
            unassignedById: userId,
            unassignedAt: new Date(),
            unassignmentReason: "REPLACED_BY_NEW_RELIEVER"
          }
        });

        // Create new reliever
        const reliever = await tx.rosterSlotAssignment.create({
          data: {
            slotId: slot.id,
            employeeId: relieverEmployeeId,
            assignmentType: "RELIEVER",
            historyStatus: "ACTIVE",
            assignedById: userId,
            planningExceptionId: exception.id,
            replacesAssignmentId: primaryAssignment.id,
            activeCoverageKey: `${slot.id}-${primaryAssignment.id}-RELIEVER`
          }
        });
        
        return { exception, reliever };
      }

      return { exception };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to process exception and reliever" }, { status: 500 });
  }
}
