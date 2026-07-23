import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";

// Helper to check locked periods
async function checkPeriodsLocked(operationType: string, dates: Date[], tx: any): Promise<boolean> {
  const periods = Array.from(new Set(dates.map(d => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  })));

  for (const period of periods) {
    const lock = await tx.manpowerSchedulingPeriodLock.findUnique({
      where: {
        operationType_period: { operationType, period }
      }
    });
    if (lock && lock.locked) {
      return true;
    }
  }
  return false;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const operationType = searchParams.get("operationType") || undefined;
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const contractId = searchParams.get("contractId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  const employeeId = searchParams.get("employeeId") || undefined;
  const status = searchParams.get("status") || undefined;
  const exceptionType = searchParams.get("exceptionType") || undefined;

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;

  // Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.view")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to view planning exceptions." }, { status: 403 });
  }

  // SG/FM Scope isolation:
  if (!hasPermission(user, "manpower.admin.full_access") && operationType) {
    const requiredPermission = operationType === "SECURITY_GUARDING" ? "manpower.security.view" : "manpower.fm.view";
    if (!hasPermission(user, requiredPermission)) {
      return NextResponse.json({ error: "Forbidden: Scope isolation mismatch" }, { status: 403 });
    }
  }

  // Contrive businessDate filter
  let businessDateFilter: any = undefined;
  if (startDateStr || endDateStr) {
    businessDateFilter = {};
    if (startDateStr) {
      businessDateFilter.gte = new Date(startDateStr);
    }
    if (endDateStr) {
      businessDateFilter.lte = new Date(endDateStr);
    }
  }

  try {
    const exceptions = await prisma.rosterPlanningException.findMany({
      where: {
        operationType,
        contractId,
        siteId,
        employeeId,
        status,
        exceptionType,
        businessDate: businessDateFilter
      },
      include: {
        primaryAssignment: {
          include: { employee: true, slot: true }
        },
        relievers: {
          orderBy: { createdAt: "desc" }
        },
        leaveRequest: true,
        cancelledBy: true,
        resolvedBy: true
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ success: true, exceptions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch planning exceptions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;
  const user = auth.session?.user;

  // Permissions: manpower.schedule.write or manpower.admin.full_access
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.write") &&
      !hasPermission(user, "manpower.schedule.edit")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to write scheduling exceptions." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { exceptionType, primaryAssignmentIds, leaveRequestId, reason } = body;
  if (!exceptionType || !primaryAssignmentIds || !Array.isArray(primaryAssignmentIds) || primaryAssignmentIds.length === 0) {
    return NextResponse.json({ error: "Invalid payload: exceptionType and non-empty primaryAssignmentIds[] required" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "Invalid payload: reason is required" }, { status: 400 });
  }
  if (!["DAY_OFF", "LEAVE_EFFECT", "ABSENT"].includes(exceptionType)) {
    return NextResponse.json({ error: "Invalid payload: invalid exceptionType" }, { status: 400 });
  }

  try {
    const assignments = await prisma.rosterSlotAssignment.findMany({
      where: { id: { in: primaryAssignmentIds } },
      include: { slot: true, employee: true }
    });

    if (assignments.length !== primaryAssignmentIds.length) {
      return NextResponse.json({ error: "One or more assignment IDs were not found" }, { status: 404 });
    }

    // Validate that all assignments belong to the same: employee, contract, site, requirement, shift, and operation scope.
    const firstAsg = assignments[0];
    const employeeId = firstAsg.employeeId;
    const contractId = firstAsg.slot.contractId;
    const siteId = firstAsg.slot.siteId;
    const position = firstAsg.slot.snapshotPosition;
    const shiftName = firstAsg.slot.snapshotShiftName;
    const operationType = firstAsg.slot.operationType;

    for (const asg of assignments) {
      if (asg.employeeId !== employeeId ||
          asg.slot.contractId !== contractId ||
          asg.slot.siteId !== siteId ||
          asg.slot.snapshotPosition !== position ||
          asg.slot.snapshotShiftName !== shiftName ||
          asg.slot.operationType !== operationType) {
        return NextResponse.json({ error: "Invalid request: All selected assignments must belong to the same employee, contract, site, position, shift, and operation scope" }, { status: 400 });
      }
    }

    // SG/FM Scope isolation:
    if (!hasPermission(user, "manpower.admin.full_access")) {
      const requiredPermission = operationType === "SECURITY_GUARDING" ? "manpower.security.write" : "manpower.fm.write";
      if (!hasPermission(user, requiredPermission)) {
        return NextResponse.json({ error: "Forbidden: Scope isolation mismatch" }, { status: 403 });
      }
    }

    // If LEAVE_EFFECT, validate matching approved LeaveRequest covering the exact dates of the assignments
    if (exceptionType === "LEAVE_EFFECT") {
      if (!leaveRequestId) {
        return NextResponse.json({ error: "Invalid payload: leaveRequestId is required for LEAVE_EFFECT exception" }, { status: 400 });
      }
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId }
      });
      if (!leaveRequest) {
        return NextResponse.json({ error: `Leave request ${leaveRequestId} not found` }, { status: 404 });
      }
      if (leaveRequest.employeeId !== employeeId) {
        return NextResponse.json({ error: "Invalid request: Leave request employee does not match assignment employee" }, { status: 400 });
      }
      if (leaveRequest.status !== "Approved" && leaveRequest.status !== "APPROVED") {
        return NextResponse.json({ error: "Invalid request: Leave request must be APPROVED to record LEAVE_EFFECT" }, { status: 422 });
      }
      
      const leaveStart = new Date(leaveRequest.startDate!);
      const leaveEnd = new Date(leaveRequest.endDate!);
      leaveStart.setHours(0,0,0,0);
      leaveEnd.setHours(0,0,0,0);

      for (const asg of assignments) {
        const asgDate = new Date(asg.slot.businessDate);
        asgDate.setHours(0,0,0,0);
        if (asgDate < leaveStart || asgDate > leaveEnd) {
          return NextResponse.json({ error: `Invalid request: Date ${asg.slot.businessDate.toISOString().split("T")[0]} is not covered by the leave period` }, { status: 422 });
        }
      }
    }

    // Check period locks
    const businessDates = assignments.map(a => new Date(a.slot.businessDate));
    const isLocked = await checkPeriodsLocked(operationType, businessDates, prisma);
    if (isLocked) {
      return NextResponse.json({ error: "Conflict: One or more months in the range are locked. Action not allowed." }, { status: 409 });
    }

    // Check if any of these primary assignments already has an active exception
    const existingActiveExceptions = await prisma.rosterPlanningException.findMany({
      where: {
        primaryAssignmentId: { in: primaryAssignmentIds },
        status: { in: ["OPEN", "COVERAGE_REQUIRED", "RELIEVER_ASSIGNED"] }
      }
    });
    if (existingActiveExceptions.length > 0) {
      return NextResponse.json({ error: "Conflict: One or more selected assignments already have active exceptions recorded." }, { status: 409 });
    }

    // Write transactionally
    const result = await prisma.$transaction(async (tx) => {
      const createdExceptions = [];
      for (const asg of assignments) {
        const exception = await tx.rosterPlanningException.create({
          data: {
            operationType,
            contractId,
            siteId,
            exceptionType,
            severity: exceptionType === "ABSENT" ? "CRITICAL" : "WARNING",
            message: `${exceptionType} exception recorded for employee ${asg.employee.name} on ${asg.slot.businessDate.toISOString().split("T")[0]}`,
            details: { reason },
            status: "COVERAGE_REQUIRED",
            resolved: false,
            businessDate: asg.slot.businessDate,
            slotId: asg.slotId,
            employeeId: asg.employeeId,
            leaveRequestId: exceptionType === "LEAVE_EFFECT" ? leaveRequestId : null,
            primaryAssignmentId: asg.id,
            activeExceptionKey: asg.id
          }
        });
        
        // Cancel primary legacy projections for that date
        if (asg.legacyShiftAssignmentId) {
          await tx.shiftAssignment.updateMany({
            where: { id: asg.legacyShiftAssignmentId },
            data: { assignmentStatus: "CANCELLED" }
          });
        }
        if (asg.legacyDeploymentId) {
          await tx.manpowerDeploymentAssignment.updateMany({
            where: { id: asg.legacyDeploymentId },
            data: { deploymentType: "CANCELLED" }
          });
        }

        createdExceptions.push(exception);
      }

      await tx.userActivityLog.create({
        data: {
          userId: user.id,
          action: `CREATE_RANGE_EXCEPTIONS_${exceptionType}`,
          entityType: "RosterPlanningException",
          entityId: firstAsg.employeeId,
          afterJson: JSON.stringify({ primaryAssignmentIds, exceptionType, reason })
        }
      });

      return createdExceptions;
    });

    return NextResponse.json({ success: true, exceptions: result });
  } catch (error: any) {
    console.error("POST EXCEPTIONS ERROR:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Conflict: An active exception already exists for this primary assignment." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Failed to record exceptions" }, { status: 500 });
  }
}
