import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { getQatarDate, getQatarDateString } from "@/lib/roster-engine";
import { getEffectiveContractManpower } from "@/lib/contract-helpers";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  // Permission Check
  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "commercial.commandCenter.view") ||
    hasPermission(user, "manpower.admin.full_access") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.fm.view") ||
    hasPermission(user, "reports.executive.view");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view Commercial Health analytics." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);

  // Parse Filters
  const dateParam = searchParams.get("businessDate");
  const businessDateStr = dateParam ? dateParam.trim() : getQatarDateString(new Date());

  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam.trim())) {
    return NextResponse.json(
      { error: "Invalid businessDate filter format. Expected format: YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const targetDate = getQatarDate(businessDateStr);
  const targetDateStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
  const targetDateEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

  let companyId = searchParams.get("companyId") || undefined;
  let operationType = searchParams.get("operationType") || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const contractId = searchParams.get("contractId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const healthStatusFilter = searchParams.get("healthStatus") || "ALL";
  const slaRiskFilter = searchParams.get("slaRisk") || "ALL";
  const expiryStatusFilter = searchParams.get("expiryStatus") || "ALL";

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  // Validate operationType
  if (
    operationType &&
    !["ALL", "SECURITY_GUARDING", "FACILITY_MANAGEMENT", "WHITE_COLLAR"].includes(operationType)
  ) {
    return NextResponse.json(
      { error: "Invalid operationType filter. Expected SECURITY_GUARDING, FACILITY_MANAGEMENT, or WHITE_COLLAR." },
      { status: 400 }
    );
  }

  // Company Isolation
  if (user?.companyId && !isAdminUser(user) && !hasPermission(user, "commercial.commandCenter.crossCompany")) {
    companyId = user.companyId;
  }

  // SG / FM Scope Isolation Check
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

    if (!operationType || operationType === "ALL") {
      if (userAllowedSG && !userAllowedFM) {
        operationType = "SECURITY_GUARDING";
      } else if (!userAllowedSG && userAllowedFM) {
        operationType = "FACILITY_MANAGEMENT";
      }
    }
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Fetch Active Contracts matching filter criteria
    // -------------------------------------------------------------------------
    const contractWhere: any = {
      status: { in: ["ACTIVE", "EXPIRED"] }
    };
    if (operationType && operationType !== "ALL") contractWhere.operationType = operationType;
    if (clientId) contractWhere.clientId = clientId;
    if (contractId) contractWhere.id = contractId;
    if (projectId) {
      contractWhere.projects = { some: { id: projectId } };
    }
    if (siteId) {
      contractWhere.projects = { some: { sites: { some: { id: siteId } } } };
    }

    const contracts = await prisma.manpowerContract.findMany({
      where: contractWhere,
      include: {
        client: true,
        manpowerRequirements: true,
        relieverRequirements: true,
        shiftRequirements: true,
        addendums: {
          include: { lineItems: true }
        },
        projects: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // -------------------------------------------------------------------------
    // 2. Aggregate Data per Contract
    // -------------------------------------------------------------------------
    const contractHealthItems: any[] = [];

    for (const contract of contracts) {
      // Effective Manpower Breakdown (Base + Approved Addenda)
      const { effectiveManpower, effectiveReliever } = getEffectiveContractManpower(contract);

      const baseManpowerCount = (contract.manpowerRequirements || []).reduce(
        (sum: number, r: any) => sum + (r.quantity || 0),
        0
      );
      const effectiveManpowerCount = effectiveManpower.reduce(
        (sum: number, r: any) => sum + (r.quantity || 0),
        0
      );
      const addendaManpowerDelta = effectiveManpowerCount - baseManpowerCount;

      const baseRelieverCount = (contract.relieverRequirements || []).reduce(
        (sum: number, r: any) => sum + (r.quantity || 0),
        0
      );
      const effectiveRelieverCount = effectiveReliever.reduce(
        (sum: number, r: any) => sum + (r.quantity || 0),
        0
      );
      const addendaRelieverDelta = effectiveRelieverCount - baseRelieverCount;

      // Roster Coverage Query for target Date
      const slotWhere: any = {
        contractId: contract.id,
        businessDate: targetDate
      };
      if (companyId) slotWhere.companyId = companyId;
      if (siteId) slotWhere.siteId = siteId;

      const slots = await prisma.rosterRequirementSlot.findMany({
        where: slotWhere,
        include: {
          assignments: {
            where: { historyStatus: "ACTIVE" },
            select: { id: true, employeeId: true }
          }
        }
      });

      let requiredSlots = 0;
      let assignedSlots = 0;
      let uncoveredSlots = 0;
      let overCoveredSlots = 0;

      for (const slot of slots) {
        requiredSlots += 1;
        const activeAssignments = slot.assignments.length;
        assignedSlots += activeAssignments;
        if (activeAssignments === 0) {
          uncoveredSlots += 1;
        } else if (activeAssignments > 1) {
          overCoveredSlots += activeAssignments - 1;
        }
      }

      // Fallback: If no requirement slots exist for today's business date,
      // use effectiveManpowerCount as contractual benchmark
      if (requiredSlots === 0) {
        requiredSlots = effectiveManpowerCount;
        assignedSlots = Math.min(requiredSlots, baseManpowerCount);
        uncoveredSlots = Math.max(0, requiredSlots - assignedSlots);
      }

      const coveragePercentage =
        requiredSlots > 0
          ? Math.round((assignedSlots / requiredSlots) * 10000) / 100
          : 100;

      // Reliever Readiness for Contract
      const assignedRelievers = await prisma.shiftRelieverAssignment.count({
        where: {
          date: businessDateStr,
          ...(contract.projects && contract.projects.length > 0
            ? { projectId: { in: contract.projects.map((p: any) => p.id) } }
            : {})
        }
      });
      const availableStandby = await prisma.employee.count({
        where: {
          isActive: true,
          employmentStatus: "ACTIVE",
          dutyStatus: "OFF_DUTY",
          OR: [{ isRelieverEligible: true }, { isStandbyEligible: true }],
          ...(companyId ? { companyId } : {})
        }
      });
      const uncoveredRelieverDemand = Math.max(0, effectiveRelieverCount - assignedRelievers);
      let relieverReadinessStatus: "READY" | "ATTENTION" | "CRITICAL" = "READY";
      if (uncoveredRelieverDemand > 0) {
        relieverReadinessStatus = availableStandby >= uncoveredRelieverDemand ? "ATTENTION" : "CRITICAL";
      }

      // Attendance & Duty Exposure
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          checkIn: { gte: targetDateStart, lte: targetDateEnd },
          ...(companyId ? { companyId } : {})
        },
        select: { id: true, status: true, lateMinutes: true, checkIn: true, checkOut: true }
      });

      const presentToday = attendanceRecords.filter(
        (a) => a.status === "ON_TIME" || a.status === "CORRECTED" || a.checkIn !== null
      ).length;
      const absentToday = attendanceRecords.filter((a) => a.status === "ABSENT").length;
      const lateToday = attendanceRecords.filter((a) => a.status === "LATE" || a.lateMinutes > 0).length;
      const missingPunch = attendanceRecords.filter((a) => a.checkIn !== null && a.checkOut === null).length;

      const unresolvedCorrections = await prisma.attendanceCorrection.count({
        where: { status: "Pending" }
      });

      // Attendance Roster Reconciliation Exposure for Contract
      const unresolvedReconciliations = await prisma.attendanceRosterReconciliation.count({
        where: {
          contractId: contract.id,
          workflowStatus: { in: ["OPEN", "PENDING_REVIEW", "UNDER_REVIEW"] }
        }
      });
      const unexcusedAbsences = await prisma.attendanceRosterReconciliation.count({
        where: {
          contractId: contract.id,
          workflowStatus: { in: ["OPEN", "PENDING_REVIEW", "UNDER_REVIEW"] },
          resolution: "UNEXCUSED_ABSENCE"
        }
      });

      // CCC-3 Open Escalations Count
      const openPlanningExceptions = await prisma.rosterPlanningException.count({
        where: {
          contractId: contract.id,
          status: { in: ["OPEN", "COVERAGE_REQUIRED"] }
        }
      });
      const openEscalationCount = openPlanningExceptions + unresolvedReconciliations;

      // Contract Expiry Calculation
      const endDate = new Date(contract.endDate);
      const diffMs = endDate.getTime() - targetDate.getTime();
      const daysToExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let expiryStatus: "EXPIRED" | "EXPIRING_SOON" | "ACTIVE" = "ACTIVE";
      if (daysToExpiry <= 0 || contract.status === "EXPIRED") {
        expiryStatus = "EXPIRED";
      } else if (daysToExpiry <= 30) {
        expiryStatus = "EXPIRING_SOON";
      }

      // SLA Risk & Reasons Evaluation
      const slaRiskReasons: string[] = [];
      let isSlaRisk = false;

      if (coveragePercentage < 90 && requiredSlots > 0) {
        isSlaRisk = true;
        slaRiskReasons.push(`Coverage is below 90% threshold (${coveragePercentage}%).`);
      }
      if (openEscalationCount > 0) {
        isSlaRisk = true;
        slaRiskReasons.push(`${openEscalationCount} unresolved escalation(s) active on contract.`);
      }
      if (uncoveredSlots >= 2) {
        isSlaRisk = true;
        slaRiskReasons.push(`${uncoveredSlots} unfilled requirement slot(s) for business date.`);
      }
      if (unexcusedAbsences > 0) {
        isSlaRisk = true;
        slaRiskReasons.push(`${unexcusedAbsences} unexcused absence discrepancy(ies) logged.`);
      }

      // Overall Contract Health Status & Reasons
      const healthReasons: string[] = [];

      const isCritical =
        (requiredSlots > 0 && coveragePercentage < 80) ||
        uncoveredSlots >= 5 ||
        openEscalationCount >= 3 ||
        unresolvedReconciliations >= 5 ||
        expiryStatus === "EXPIRED";

      const isAttention =
        !isCritical &&
        ((requiredSlots > 0 && coveragePercentage < 95) ||
          uncoveredSlots > 0 ||
          openEscalationCount > 0 ||
          unresolvedCorrections > 0 ||
          unresolvedReconciliations > 0 ||
          expiryStatus === "EXPIRING_SOON" ||
          uncoveredRelieverDemand > 0);

      let healthStatus: "HEALTHY" | "ATTENTION" | "CRITICAL" = "HEALTHY";
      let healthScore = 100;

      if (isCritical) {
        healthStatus = "CRITICAL";
        healthScore = requiredSlots > 0 ? Math.max(40, Math.min(69, Math.round(coveragePercentage * 0.65))) : 50;
      } else if (isAttention) {
        healthStatus = "ATTENTION";
        healthScore = requiredSlots > 0 ? Math.max(70, Math.min(89, Math.round(coveragePercentage * 0.85))) : 80;
      } else {
        healthStatus = "HEALTHY";
        healthScore = 100;
      }

      if (requiredSlots > 0 && coveragePercentage < 80) {
        healthReasons.push(`Coverage critically low at ${coveragePercentage}% (target: 100%).`);
      } else if (requiredSlots > 0 && coveragePercentage < 95) {
        healthReasons.push(`Coverage below optimal standard at ${coveragePercentage}%.`);
      }

      if (uncoveredSlots > 0) {
        healthReasons.push(`${uncoveredSlots} requirement slot(s) unfilled.`);
      }

      if (openEscalationCount > 0) {
        healthReasons.push(`${openEscalationCount} active escalation(s) pending resolution.`);
      }

      if (unresolvedReconciliations > 0) {
        healthReasons.push(`${unresolvedReconciliations} roster reconciliation discrepancy(ies) under review.`);
      }

      if (expiryStatus === "EXPIRED") {
        healthReasons.push(`Contract expired on ${endDate.toISOString().split("T")[0]}.`);
      } else if (expiryStatus === "EXPIRING_SOON") {
        healthReasons.push(`Contract expiring in ${daysToExpiry} day(s) on ${endDate.toISOString().split("T")[0]}.`);
      }

      if (uncoveredRelieverDemand > 0) {
        healthReasons.push(`Reliever shortage: ${uncoveredRelieverDemand} reliever(s) needed.`);
      }

      // Billing Support Indicators (Advisory)
      const billableAdvisoryManpower = assignedSlots;
      const varianceVsRequired = assignedSlots - requiredSlots;
      const unresolvedBillingExceptions = unexcusedAbsences;

      // Corrective Drill-Down URLs
      const drillDownUrls = {
        contractMaster: `/manpower/${contract.operationType.toLowerCase()}/contracts?contractId=${contract.id}`,
        rosterCoverage: `/commercial/command-center/roster-coverage?contractId=${contract.id}`,
        escalationQueue: `/commercial/command-center/escalations?contractId=${contract.id}`,
        reconciliation: `/manpower/${contract.operationType.toLowerCase()}/reconciliation?contractId=${contract.id}`
      };

      contractHealthItems.push({
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        contractTitle: contract.title,
        clientId: contract.clientId,
        clientName: contract.client?.name || "Unknown Client",
        companyId: companyId || null,
        operationType: contract.operationType,
        contractType: contract.contractType || "PERMANENT",
        status: contract.status,
        startDate: contract.startDate.toISOString().split("T")[0],
        endDate: contract.endDate.toISOString().split("T")[0],
        daysToExpiry,
        expiryStatus,
        effectiveRequirements: {
          baseManpowerCount,
          addendaManpowerDelta,
          effectiveManpowerCount,
          baseRelieverCount,
          addendaRelieverDelta,
          effectiveRelieverCount
        },
        coverage: {
          requiredSlots,
          assignedSlots,
          uncoveredSlots,
          overCoveredSlots,
          coveragePercentage
        },
        relieverReadiness: {
          requiredRelievers: effectiveRelieverCount,
          assignedRelievers,
          availableStandby,
          uncoveredDemand: uncoveredRelieverDemand,
          readinessStatus: relieverReadinessStatus
        },
        attendanceExposure: {
          presentToday,
          absentToday,
          lateToday,
          missingPunch,
          unresolvedCorrections
        },
        reconciliationExposure: {
          unresolvedReconciliations,
          unexcusedAbsences
        },
        billingSupport: {
          billableAdvisoryManpower,
          varianceVsRequired,
          unresolvedBillingExceptions
        },
        slaExposure: {
          isSlaRisk,
          slaRiskReasons,
          openEscalationCount
        },
        health: {
          status: healthStatus,
          score: healthScore,
          reasons: healthReasons
        },
        drillDownUrls
      });
    }

    // -------------------------------------------------------------------------
    // 3. Post-fetch Filtering by Health, SLA Risk, and Expiry status
    // -------------------------------------------------------------------------
    let filteredContracts = contractHealthItems;

    if (healthStatusFilter !== "ALL") {
      filteredContracts = filteredContracts.filter(c => c.health.status === healthStatusFilter);
    }
    if (slaRiskFilter === "AT_RISK") {
      filteredContracts = filteredContracts.filter(c => c.slaExposure.isSlaRisk === true);
    } else if (slaRiskFilter === "NORMAL") {
      filteredContracts = filteredContracts.filter(c => c.slaExposure.isSlaRisk === false);
    }
    if (expiryStatusFilter !== "ALL") {
      filteredContracts = filteredContracts.filter(c => c.expiryStatus === expiryStatusFilter);
    }

    // -------------------------------------------------------------------------
    // 4. Compute Portfolio Summary Metrics across ALL scoped contracts
    // -------------------------------------------------------------------------
    const totalActiveContracts = contractHealthItems.length;
    const healthyContractsCount = contractHealthItems.filter(c => c.health.status === "HEALTHY").length;
    const attentionContractsCount = contractHealthItems.filter(c => c.health.status === "ATTENTION").length;
    const criticalContractsCount = contractHealthItems.filter(c => c.health.status === "CRITICAL").length;

    const totalRequiredManpower = contractHealthItems.reduce((sum, c) => sum + c.coverage.requiredSlots, 0);
    const totalAssignedManpower = contractHealthItems.reduce((sum, c) => sum + c.coverage.assignedSlots, 0);
    const totalUncoveredSlots = contractHealthItems.reduce((sum, c) => sum + c.coverage.uncoveredSlots, 0);

    const averageCoveragePercentage =
      totalRequiredManpower > 0
        ? Math.round((totalAssignedManpower / totalRequiredManpower) * 10000) / 100
        : 100;

    const contractsWithSlaRiskCount = contractHealthItems.filter(c => c.slaExposure.isSlaRisk).length;
    const contractsWithEscalationsCount = contractHealthItems.filter(c => c.slaExposure.openEscalationCount > 0).length;
    const contractsExpiringSoonCount = contractHealthItems.filter(c => c.expiryStatus === "EXPIRING_SOON").length;
    const contractsExpiredCount = contractHealthItems.filter(c => c.expiryStatus === "EXPIRED").length;

    const portfolioMetrics = {
      totalActiveContracts,
      healthyContractsCount,
      attentionContractsCount,
      criticalContractsCount,
      averageCoveragePercentage,
      totalRequiredManpower,
      totalAssignedManpower,
      totalUncoveredSlots,
      contractsWithSlaRiskCount,
      contractsWithEscalationsCount,
      contractsExpiringSoonCount,
      contractsExpiredCount
    };

    // -------------------------------------------------------------------------
    // 5. Pagination
    // -------------------------------------------------------------------------
    const startIndex = (page - 1) * limit;
    const paginatedContracts = filteredContracts.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      context: {
        businessDate: businessDateStr,
        operationType: operationType || "ALL",
        companyId: companyId || null,
        clientId: clientId || null,
        contractId: contractId || null,
        siteId: siteId || null,
        scopeIsolation: {
          userRole: user?.role || "USER",
          companyBound: Boolean(user?.companyId),
          allowedSecurityGuarding: user?.operationAccess?.allowedSecurityGuarding ?? true,
          allowedFacilityManagement: user?.operationAccess?.allowedFacilityManagement ?? true
        }
      },
      portfolioMetrics,
      pagination: {
        page,
        limit,
        totalItems: filteredContracts.length,
        totalPages: Math.ceil(filteredContracts.length / limit)
      },
      contracts: paginatedContracts,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("COMMERCIAL HEALTH ANALYTICS API ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to aggregate Commercial Health & SLA Analytics data." },
      { status: 500 }
    );
  }
}
