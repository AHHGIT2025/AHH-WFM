import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { getQatarDateString } from "@/lib/roster-engine";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { id } = params;
  const user = auth.session?.user;

  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        company: true,
        departmentRef: true,
        designation: true,
        positionCategory: true,
        defaultLocation: true
      }
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // RBAC & Operational scope isolation check
    const userRole = (user?.role || "").toUpperCase();
    const isGlobalAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
    const isHrOrAdmin = isGlobalAdmin || userRole === "HR" || userRole === "HR_ADMIN";

    if (!isGlobalAdmin) {
      if (userRole === "SECURITY_ADMIN" && employee.operationType === "FACILITY_MANAGEMENT") {
        return NextResponse.json({ error: "Forbidden: Security Guarding administrators cannot view Facility Management employee assignments." }, { status: 403 });
      }
      if (userRole === "FM_ADMIN" && employee.operationType === "SECURITY_GUARDING") {
        return NextResponse.json({ error: "Forbidden: Facility Management administrators cannot view Security Guarding employee assignments." }, { status: 403 });
      }
    }

    const todayStr = getQatarDateString(new Date());
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);
    const lookbackDate = new Date(todayDate.getTime() - 7 * 24 * 60 * 60 * 1000); // past 7 days
    const lookaheadDate = new Date(todayDate.getTime() + 30 * 24 * 60 * 60 * 1000); // next 30 days

    // 1. Fetch Roster Slot Assignments
    const rosterAssignments = await prisma.rosterSlotAssignment.findMany({
      where: {
        employeeId: id,
        historyStatus: "ACTIVE",
        slot: {
          businessDate: { gte: lookbackDate, lte: lookaheadDate },
          fulfillmentStatus: { not: "CANCELLED" }
        }
      },
      include: {
        slot: {
          include: {
            site: true,
            project: true,
            contract: true
          }
        }
      },
      orderBy: {
        slot: {
          businessDate: "asc"
        }
      }
    });

    // 2. Format assignments
    const formattedAssignments = (rosterAssignments as any[]).map((asg) => {
      const slot = asg.slot;
      const bDateStr = getQatarDateString(slot.businessDate);
      const isPast = slot.businessDate < todayDate;
      const isToday = bDateStr === todayStr;

      return {
        id: asg.id,
        slotId: slot.id,
        businessDate: bDateStr,
        shiftName: slot.snapshotShiftName || "Shift",
        startTime: slot.snapshotStartTime,
        endTime: slot.snapshotEndTime,
        siteId: slot.siteId,
        siteName: slot.site?.name || "Unspecified Site",
        projectId: slot.projectId,
        projectName: slot.project?.name || "Unspecified Project",
        contractId: slot.contractId,
        companyName: employee.company?.companyName || "AHH",
        postOrRequirement: slot.snapshotPosition || "General Post",
        operationType: slot.operationType,
        assignmentType: asg.assignmentType, // "PRIMARY" | "RELIEVER" | "TEMPORARY_COVER"
        historyStatus: asg.historyStatus,
        isToday,
        isPast,
        isUpcoming: !isPast && !isToday
      };
    });

    // 3. Current Active Duty / Assignment
    const todayAssignments = formattedAssignments.filter((a) => a.isToday);
    const currentAssignment = todayAssignments.length > 0 ? todayAssignments[0] : null;

    // 4. Leave info with field privacy masking
    const activeLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: id,
        status: { in: ["Approved", "APPROVED"] },
        endDate: { gte: todayDate }
      },
      orderBy: { startDate: "asc" },
      take: 3
    });

    const safeActiveLeaves = activeLeaves.map((l) => ({
      id: l.id,
      type: l.type,
      startDate: l.startDate ? getQatarDateString(l.startDate) : "",
      endDate: l.endDate ? getQatarDateString(l.endDate) : "",
      reason: isHrOrAdmin ? l.reason : undefined
    }));

    // Privacy masking for contacts
    const maskedEmail = isHrOrAdmin
      ? employee.email
      : employee.email
      ? employee.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
      : null;

    const maskedPhone = isHrOrAdmin
      ? employee.phone
      : employee.phone
      ? employee.phone.replace(/(\+?\d{3})\d+(.{2})/, "$1****$2")
      : null;

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
        email: maskedEmail,
        phone: maskedPhone,
        role: employee.role,
        employeeCategory: employee.employeeCategory,
        employmentStatus: employee.employmentStatus || (employee.isActive ? "ACTIVE" : "INACTIVE"),
        dutyStatus: employee.dutyStatus || "OFF_DUTY",
        operationType: employee.operationType,
        company: employee.company ? {
          id: employee.company.id,
          code: employee.company.companyCode,
          name: employee.company.companyName
        } : null,
        department: employee.departmentRef?.name || employee.department || "Unassigned",
        designation: employee.designation?.name || "Not specified",
        tradePosition: (employee as any).positionCategory?.name || (employee as any).tradeClassification?.name || "Not specified",
        defaultLocation: employee.defaultLocation?.locationName || "Default Office"
      },
      currentDuty: {
        dutyStatus: employee.dutyStatus || "OFF_DUTY",
        currentLocation: currentAssignment ? currentAssignment.siteName : (employee.defaultLocation?.locationName || "Default Location"),
        currentAssignment: currentAssignment
      },
      assignments: formattedAssignments,
      upcomingAssignments: formattedAssignments.filter((a) => a.isUpcoming || a.isToday),
      relieverAssignments: formattedAssignments.filter((a) => a.assignmentType === "RELIEVER"),
      activeLeaves: safeActiveLeaves
    });
  } catch (error: any) {
    console.error(`[GET /api/v1/employees/${id}/assignments] Error:`, error);
    return NextResponse.json({ error: error.message || "Failed to fetch employee assignments" }, { status: 500 });
  }
}
