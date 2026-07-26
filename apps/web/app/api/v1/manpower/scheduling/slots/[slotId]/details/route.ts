import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { getQatarDateString } from "@/lib/roster-engine";

export async function GET(
  request: Request,
  { params }: { params: { slotId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const slotId = params.slotId;
  const user = auth.session?.user;

  // Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.assign") &&
      !hasPermission(user, "manpower.schedule.unassign") &&
      user?.role !== "ADMIN" &&
      user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden: Insufficient permissions to view slot details." }, { status: 403 });
  }

  try {
    const slot: any = await prisma.rosterRequirementSlot.findUnique({
      where: { id: slotId },
      include: {
        contract: {
          include: { client: true }
        },
        project: true,
        site: true,
        assignments: {
          orderBy: { createdAt: "desc" },
          include: {
            employee: {
              include: {
                positionCategory: true,
                designation: true
              }
            },
            assignedBy: true,
            unassignedBy: true,
            bulkOperation: true
          }
        }
      }
    });

    if (!slot) {
      return NextResponse.json({ error: "Requirement slot not found." }, { status: 404 });
    }

    // Isolate Scope
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      if (user?.operationType && user.operationType !== slot.operationType) {
        return NextResponse.json({ error: "Forbidden: Scope mismatch." }, { status: 403 });
      }
    }

    const activeAssignment = slot.assignments.find((a: any) => a.historyStatus === "ACTIVE");

    // Recheck Period Lock
    const yyyymm = getQatarDateString(slot.businessDate).substring(0, 7);
    const lock = await prisma.manpowerSchedulingPeriodLock.findUnique({
      where: {
        operationType_period: {
          operationType: slot.operationType,
          period: yyyymm
        }
      }
    });
    const isPeriodLocked = !!(lock && lock.locked);

    // Recheck Publication Status
    const pubSlot = await prisma.rosterPublicationSlot.findFirst({
      where: {
        slotId: slot.id,
        businessDate: slot.businessDate
      },
      include: { publication: true }
    });
    const isPublished = !!(pubSlot && pubSlot.publication?.status === "PUBLISHED");

    // Attendance Check
    let attendanceStatus = { hasActiveAttendance: false, hasCompletedAttendance: false };
    if (activeAssignment) {
      const slotStart = new Date(slot.businessDate);
      const slotEnd = new Date(slot.businessDate);
      slotEnd.setHours(23, 59, 59, 999);

      const attendance = await prisma.attendanceRecord.findFirst({
        where: {
          employeeId: activeAssignment.employeeId,
          checkIn: { gte: slotStart, lte: slotEnd }
        }
      });
      if (attendance) {
        attendanceStatus = {
          hasActiveAttendance: attendance.checkOut === null,
          hasCompletedAttendance: attendance.checkOut !== null
        };
      }
    }

    // Resolve Related Period Assignments
    let relatedPeriod: any = null;
    if (activeAssignment) {
      const groupKey = activeAssignment.assignmentGroupKey;
      const bulkOpId = activeAssignment.bulkOperationId;

      let relatedAsgs: any[] = [];
      if (groupKey) {
        relatedAsgs = await prisma.rosterSlotAssignment.findMany({
          where: { assignmentGroupKey: groupKey },
          include: { slot: true }
        });
      } else if (bulkOpId) {
        relatedAsgs = await prisma.rosterSlotAssignment.findMany({
          where: {
            bulkOperationId: bulkOpId,
            employeeId: activeAssignment.employeeId
          },
          include: { slot: true }
        });
      } else {
        // Attempt deterministic recovery matching same contract, site, shiftRequirement, slotIndex
        relatedAsgs = await prisma.rosterSlotAssignment.findMany({
          where: {
            employeeId: activeAssignment.employeeId,
            slot: {
              contractId: slot.contractId,
              siteId: slot.siteId,
              shiftRequirementId: slot.shiftRequirementId,
              slotIndex: slot.slotIndex
            }
          },
          include: { slot: true }
        });
      }

      if (relatedAsgs.length > 0) {
        const dates = relatedAsgs.map((a: any) => new Date(a.slot.businessDate).getTime()).sort((a: number, b: number) => a - b);
        const minDate = new Date(dates[0]).toISOString().split("T")[0];
        const maxDate = new Date(dates[dates.length - 1]).toISOString().split("T")[0];

        const activeCount = relatedAsgs.filter((a: any) => a.historyStatus === "ACTIVE").length;
        const unassignedCount = relatedAsgs.filter((a: any) => a.historyStatus === "CANCELLED" || a.historyStatus === "ENDED").length;

        relatedPeriod = {
          hasReliableGroupLink: !!(groupKey || bulkOpId || relatedAsgs.length > 1),
          assignmentGroupKey: groupKey || null,
          bulkOperationId: bulkOpId || null,
          originalFromDate: activeAssignment.bulkOperation?.fromDate ? activeAssignment.bulkOperation.fromDate.toISOString().split("T")[0] : minDate,
          originalToDate: activeAssignment.bulkOperation?.toDate ? activeAssignment.bulkOperation.toDate.toISOString().split("T")[0] : maxDate,
          totalExpectedCount: relatedAsgs.length,
          activeCount,
          unassignedCount,
          relatedAssignments: relatedAsgs.map((a: any) => ({
            id: a.id,
            slotId: a.slotId,
            businessDate: new Date(a.slot.businessDate).toISOString().split("T")[0],
            historyStatus: a.historyStatus,
            assignmentType: a.assignmentType
          }))
        };
      }
    }

    // Audit logs for slot
    const activityLogs = await prisma.userActivityLog.findMany({
      where: {
        entityType: "RosterSlotAssignment",
        entityId: { in: slot.assignments.map((a: any) => a.id) }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return NextResponse.json({
      slot: {
        id: slot.id,
        fulfillmentStatus: slot.fulfillmentStatus,
        businessDate: slot.businessDate.toISOString().split("T")[0],
        operationType: slot.operationType,
        snapshotPosition: slot.snapshotPosition,
        snapshotShiftName: slot.snapshotShiftName,
        snapshotStartTime: slot.snapshotStartTime,
        snapshotEndTime: slot.snapshotEndTime,
        slotIndex: slot.slotIndex,
        contract: {
          id: slot.contract.id,
          contractNumber: slot.contract.contractNumber,
          title: slot.contract.title,
          clientName: slot.contract.client.name,
          clientCode: slot.contract.client.code
        },
        project: {
          id: slot.project?.id,
          name: slot.project?.name,
          code: slot.project?.code
        },
        site: {
          id: slot.site?.id,
          name: slot.site?.name,
          code: slot.site?.code
        },
        locationUnit: slot.shiftRequirement?.locationUnit ? {
          id: slot.shiftRequirement.locationUnit.id,
          name: slot.shiftRequirement.locationUnit.name,
          code: slot.shiftRequirement.locationUnit.code,
          type: slot.shiftRequirement.locationUnit.type
        } : null,
        category: slot.shiftRequirement?.category ? {
          id: slot.shiftRequirement.category.id,
          name: slot.shiftRequirement.category.name,
          code: slot.shiftRequirement.category.code
        } : null
      },
      currentAssignment: activeAssignment ? {
        id: activeAssignment.id,
        assignmentType: activeAssignment.assignmentType,
        historyStatus: activeAssignment.historyStatus,
        assignedAt: activeAssignment.assignedAt,
        assignedBy: activeAssignment.assignedBy ? {
          id: activeAssignment.assignedBy.id,
          name: activeAssignment.assignedBy.name
        } : null,
        employee: {
          id: activeAssignment.employee.id,
          name: activeAssignment.employee.name,
          email: activeAssignment.employee.email,
          phone: activeAssignment.employee.phone,
          department: activeAssignment.employee.department,
          categoryName: activeAssignment.employee.employeeCategory,
          tradePosition: activeAssignment.employee.positionCategory?.name || activeAssignment.employee.designation?.name || "Security Guard"
        },
        bulkOperationId: activeAssignment.bulkOperationId,
        assignmentGroupKey: activeAssignment.assignmentGroupKey,
        bulkOperation: activeAssignment.bulkOperation ? {
          id: activeAssignment.bulkOperation.id,
          mode: activeAssignment.bulkOperation.mode,
          strategy: activeAssignment.bulkOperation.strategy,
          policy: activeAssignment.bulkOperation.policy,
          fromDate: activeAssignment.bulkOperation.fromDate.toISOString().split("T")[0],
          toDate: activeAssignment.bulkOperation.toDate.toISOString().split("T")[0]
        } : null
      } : null,
      history: slot.assignments.map((a: any) => ({
        id: a.id,
        assignmentType: a.assignmentType,
        historyStatus: a.historyStatus,
        employeeName: a.employee.name,
        assignedByName: a.assignedBy?.name || "System",
        assignedAt: a.assignedAt,
        unassignedByName: a.unassignedBy?.name || null,
        unassignedAt: a.unassignedAt || null,
        unassignmentReason: a.unassignmentReason || null
      })),
      activityLogs,
      governance: {
        isPeriodLocked,
        isPublished,
        publicationId: pubSlot?.publicationId || null,
        attendanceStatus
      },
      relatedPeriod
    });
  } catch (error: any) {
    console.error("GET SLOT DETAILS ERROR:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch slot details" }, { status: 500 });
  }
}
