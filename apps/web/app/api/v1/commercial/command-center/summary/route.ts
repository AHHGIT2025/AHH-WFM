import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { getQatarDate, getQatarDateString } from "@/lib/roster-engine";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  // Permission check
  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "commercial.commandCenter.view") ||
    hasPermission(user, "manpower.admin.full_access") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.fm.view") ||
    hasPermission(user, "reports.executive.view");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view the Commercial Command Center." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);

  // Parse filters
  const dateParam = searchParams.get("businessDate");
  const businessDateStr = dateParam ? dateParam.trim() : getQatarDateString(new Date());
  const targetDate = getQatarDate(businessDateStr);

  let companyId = searchParams.get("companyId") || undefined;
  let operationType = searchParams.get("operationType") || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const contractId = searchParams.get("contractId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;

  // Company isolation
  if (user?.companyId && !isAdminUser(user) && !hasPermission(user, "commercial.commandCenter.crossCompany")) {
    companyId = user.companyId;
  }

  // SG / FM Scope Isolation check
  if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
    const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
    const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

    if (operationType === "SECURITY_GUARDING" && !userAllowedSG) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to Security Guarding operational data." },
        { status: 403 }
      );
    }
    if (operationType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to Facility Management operational data." },
        { status: 403 }
      );
    }

    if (!operationType) {
      if (userAllowedSG && !userAllowedFM) {
        operationType = "SECURITY_GUARDING";
      } else if (!userAllowedSG && userAllowedFM) {
        operationType = "FACILITY_MANAGEMENT";
      }
    }
  }

  try {
    // 1. Manpower Coverage Queries (RosterRequirementSlot & RosterSlotAssignment)
    const slotWhere: any = {
      businessDate: targetDate
    };
    if (companyId) slotWhere.companyId = companyId;
    if (operationType) slotWhere.operationType = operationType;
    if (contractId) slotWhere.contractId = contractId;
    if (siteId) slotWhere.siteId = siteId;

    const slots = await prisma.rosterRequirementSlot.findMany({
      where: slotWhere,
      include: {
        assignments: {
          where: { historyStatus: "ACTIVE" },
          select: { id: true, employeeId: true }
        },
        contract: { select: { id: true, title: true, clientId: true } }
      }
    });

    let requiredManpower = 0;
    let assignedManpower = 0;
    let uncoveredSlots = 0;
    let underCoverageCount = 0;
    let overCoverageCount = 0;
    const contractsWithSlotsMap = new Map<string, { required: number; assigned: number }>();

    for (const slot of slots) {
      requiredManpower += 1;
      const activeAssignments = slot.assignments.length;
      assignedManpower += activeAssignments;

      if (activeAssignments === 0) {
        uncoveredSlots += 1;
        underCoverageCount += 1;
      } else if (activeAssignments > 1) {
        overCoverageCount += activeAssignments - 1;
      }

      if (slot.contractId) {
        const current = contractsWithSlotsMap.get(slot.contractId) || { required: 0, assigned: 0 };
        current.required += 1;
        current.assigned += activeAssignments;
        contractsWithSlotsMap.set(slot.contractId, current);
      }
    }

    const coveragePercentage =
      requiredManpower > 0
        ? Math.round((assignedManpower / requiredManpower) * 10000) / 100
        : 100;

    // 2. Attendance & Duty Queries
    const empWhere: any = {};
    if (companyId) empWhere.companyId = companyId;
    if (operationType) empWhere.operationType = operationType;

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        checkIn: {
          gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0),
          lte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59)
        },
        ...(companyId ? { companyId } : {})
      },
      select: {
        id: true,
        employeeId: true,
        status: true,
        lateMinutes: true,
        checkIn: true,
        checkOut: true
      }
    });

    const presentToday = attendanceRecords.filter(
      (a) => a.status === "ON_TIME" || a.status === "CORRECTED" || a.checkIn !== null
    ).length;
    const absentToday = attendanceRecords.filter((a) => a.status === "ABSENT").length;
    const lateToday = attendanceRecords.filter((a) => a.status === "LATE" || a.lateMinutes > 0).length;
    const missingPunch = attendanceRecords.filter((a) => a.checkIn !== null && a.checkOut === null).length;

    // Active approved leaves today
    const leavesToday = await prisma.leaveRequest.count({
      where: {
        status: "APPROVED",
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
        employee: empWhere
      }
    });

    // Unresolved attendance corrections
    const unresolvedCorrections = await prisma.attendanceCorrection.count({
      where: {
        status: "Pending"
      }
    });

    // 3. Reliever Readiness Queries
    const relieverReqs = await prisma.contractRelieverRequirement.count({
      where: {
        contract: {
          status: "ACTIVE",
          ...(operationType ? { operationType } : {})
        }
      }
    });

    const assignedRelieversCount = await prisma.shiftRelieverAssignment.count({
      where: {
        date: businessDateStr
      }
    });

    const availableStandbyCount = await prisma.employee.count({
      where: {
        isActive: true,
        employmentStatus: "ACTIVE",
        dutyStatus: "OFF_DUTY",
        OR: [{ isRelieverEligible: true }, { isStandbyEligible: true }],
        ...(companyId ? { companyId } : {}),
        ...(operationType ? { operationType } : {})
      }
    });

    const uncoveredRelieverDemand = Math.max(0, relieverReqs - assignedRelieversCount);
    let readinessStatus = "READY";
    if (uncoveredRelieverDemand > 0) {
      readinessStatus = availableStandbyCount >= uncoveredRelieverDemand ? "ATTENTION" : "CRITICAL";
    }

    // 4. Operational Exceptions Queries
    const excWhere: any = {
      status: { in: ["OPEN", "COVERAGE_REQUIRED"] }
    };
    if (operationType) excWhere.operationType = operationType;
    if (contractId) excWhere.contractId = contractId;
    if (siteId) excWhere.siteId = siteId;

    const rosterPlanningExceptions = await prisma.rosterPlanningException.count({
      where: excWhere
    });

    const unexcusedReconciliations = await prisma.attendanceRosterReconciliation.count({
      where: {
        workflowStatus: { in: ["OPEN", "PENDING_REVIEW", "UNDER_REVIEW"] },
        resolution: "UNEXCUSED_ABSENCE"
      }
    });

    const totalOperationalExceptions = rosterPlanningExceptions + unexcusedReconciliations;

    // 5. Contract & SLA Exposure Queries
    const contractWhere: any = {
      status: "ACTIVE"
    };
    if (operationType) contractWhere.operationType = operationType;
    if (clientId) contractWhere.clientId = clientId;
    if (contractId) contractWhere.id = contractId;

    const activeContractsCount = await prisma.manpowerContract.count({
      where: contractWhere
    });

    let contractsBelowRequirementCount = 0;
    let potentialSlaRiskCount = 0;

    for (const [cId, data] of Array.from(contractsWithSlotsMap.entries())) {
      if (data.assigned < data.required) {
        contractsBelowRequirementCount += 1;
      }
      const contractCoverage = data.required > 0 ? (data.assigned / data.required) * 100 : 100;
      if (contractCoverage < 90) {
        potentialSlaRiskCount += 1;
      }
    }

    const extraDeploymentCount = await prisma.employeeDeployment.count({
      where: {
        status: "ACTIVE",
        deploymentDate: {
          gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0),
          lte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59)
        }
      }
    });

    // 6. Deterministic Operational Health Calculation
    const healthReasons: string[] = [];

    if (coveragePercentage < 80) {
      healthReasons.push(`Manpower coverage is critically low at ${coveragePercentage}% (target: 100%).`);
    } else if (coveragePercentage < 95) {
      healthReasons.push(`Manpower coverage requires attention at ${coveragePercentage}%.`);
    }

    if (uncoveredSlots > 0) {
      healthReasons.push(`${uncoveredSlots} roster requirement slot(s) remain unfilled for ${businessDateStr}.`);
    }

    if (uncoveredRelieverDemand > 0 && availableStandbyCount < uncoveredRelieverDemand) {
      healthReasons.push(`Reliever deficit: ${uncoveredRelieverDemand} reliever(s) needed but only ${availableStandbyCount} standby employee(s) available.`);
    }

    if (rosterPlanningExceptions > 0) {
      healthReasons.push(`${rosterPlanningExceptions} active roster planning exception(s) require supervisor review.`);
    }

    if (unexcusedReconciliations > 0) {
      healthReasons.push(`${unexcusedReconciliations} unexcused attendance/roster reconciliation discrepancy(ies) logged.`);
    }

    if (contractsBelowRequirementCount > 0) {
      healthReasons.push(`${contractsBelowRequirementCount} active contract(s) currently operate below required manpower allocation.`);
    }

    let overallStatus: "HEALTHY" | "ATTENTION" | "CRITICAL" = "HEALTHY";
    if (
      coveragePercentage < 80 ||
      uncoveredSlots >= 5 ||
      (uncoveredRelieverDemand > 0 && availableStandbyCount === 0) ||
      rosterPlanningExceptions >= 5
    ) {
      overallStatus = "CRITICAL";
    } else if (
      coveragePercentage < 95 ||
      uncoveredSlots > 0 ||
      lateToday > 3 ||
      unresolvedCorrections > 0 ||
      unexcusedReconciliations > 0 ||
      contractsBelowRequirementCount > 0
    ) {
      overallStatus = "ATTENTION";
    }

    let healthScore = 100;
    if (overallStatus === "CRITICAL") {
      healthScore = Math.max(40, Math.round(coveragePercentage * 0.7));
    } else if (overallStatus === "ATTENTION") {
      healthScore = Math.max(70, Math.round(coveragePercentage * 0.9));
    }

    // 7. Structured Response
    return NextResponse.json({
      context: {
        businessDate: businessDateStr,
        operationType: operationType || "ALL",
        companyId: companyId || null,
        clientId: clientId || null,
        contractId: contractId || null,
        siteId: siteId || null,
        scopeIsolation: {
          userRole: user?.role || "UNKNOWN",
          companyBound: Boolean(user?.companyId),
          allowedSecurityGuarding: user?.operationAccess?.allowedSecurityGuarding ?? true,
          allowedFacilityManagement: user?.operationAccess?.allowedFacilityManagement ?? true
        }
      },
      operationalHealth: {
        status: overallStatus,
        score: healthScore,
        reasons: healthReasons
      },
      manpowerCoverage: {
        requiredManpower,
        assignedManpower,
        activeOnDuty: presentToday,
        uncoveredSlots,
        coveragePercentage,
        underCoverageCount,
        overCoverageCount
      },
      attendance: {
        presentToday,
        absentToday,
        lateToday,
        missingPunch,
        onLeaveToday: leavesToday,
        unresolvedCorrections
      },
      relieverReadiness: {
        requiredRelievers: relieverReqs,
        assignedRelievers: assignedRelieversCount,
        availableStandby: availableStandbyCount,
        uncoveredRelieverDemand,
        readinessStatus
      },
      exceptions: {
        rosterPlanningExceptions,
        unexcusedReconciliations,
        totalOperationalExceptions
      },
      contractExposure: {
        activeContractsCount,
        contractsBelowRequirementCount,
        potentialSlaRiskCount,
        extraDeploymentCount
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("COMMERCIAL COMMAND CENTER SUMMARY API ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to aggregate Commercial Command Center summary data" },
      { status: 500 }
    );
  }
}
