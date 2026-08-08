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

  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const rawLimit = parseInt(searchParams.get("limit") || "50", 10);

  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 100);

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
    // Single Contract Direct Access Protection Check
    if (contractId) {
      const existingContract = await prisma.manpowerContract.findUnique({
        where: { id: contractId },
        select: { id: true, operationType: true, clientId: true }
      });

      if (existingContract) {
        if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
          const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
          const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

          if (existingContract.operationType === "SECURITY_GUARDING" && !userAllowedSG) {
            return NextResponse.json(
              { error: "Forbidden: Direct access denied. You lack access to this contract's operation scope." },
              { status: 403 }
            );
          }
          if (existingContract.operationType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
            return NextResponse.json(
              { error: "Forbidden: Direct access denied. You lack access to this contract's operation scope." },
              { status: 403 }
            );
          }
        }
      }
    }

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
      // Calculate Effective Manpower Requirements (Base + Approved Addenda)
      const effectiveReqs = getEffectiveContractManpower(contract as any);
      
      const baseManpowerCount =
        effectiveReqs.effectiveManpower.reduce((sum: number, item: any) => sum + (item.originalQty || 0), 0) ||
        contract.defaultManpowerCount ||
        0;
      const addendaManpowerDelta = effectiveReqs.effectiveManpower.reduce(
        (sum: number, item: any) => sum + (item.addendumQty || 0),
        0
      );
      const effectiveManpowerCount = baseManpowerCount + addendaManpowerDelta;

      const baseRelieverCount =
        effectiveReqs.effectiveReliever.reduce((sum: number, item: any) => sum + (item.originalQty || 0), 0) ||
        contract.defaultRelieverCount ||
        0;
      const addendaRelieverDelta = effectiveReqs.effectiveReliever.reduce(
        (sum: number, item: any) => sum + (item.addendumQty || 0),
        0
      );
      const effectiveRelieverCount = baseRelieverCount + addendaRelieverDelta;

      // Authoritative Roster Coverage Slots & Assignments
      const slots = await prisma.rosterRequirementSlot.findMany({
        where: {
          contractId: contract.id
        },
        include: {
          assignments: true
        }
      });

      const requiredSlots = slots.length > 0 ? slots.length : effectiveManpowerCount;
      let assignedSlots = 0;
      let uncoveredSlots = 0;
      let overCoveredSlots = 0;

      if (slots.length > 0) {
        slots.forEach((slot: any) => {
          const count = slot.assignments.length;
          if (count === 1) assignedSlots++;
          else if (count === 0) uncoveredSlots++;
          else if (count > 1) {
            assignedSlots++;
            overCoveredSlots += count - 1;
          }
        });
      } else {
        assignedSlots = 0;
        uncoveredSlots = effectiveManpowerCount;
      }

      const coveragePercentage =
        requiredSlots > 0 ? Math.min(100, Math.round((assignedSlots / requiredSlots) * 100)) : 100;

      // Reliever Readiness for Contract (CCC-2 Reuse)
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
          ...(companyId ? { companyId } : {})
        }
      });

      const uncoveredRelieverDemand = Math.max(0, effectiveRelieverCount - assignedRelievers);
      let relieverReadinessStatus: "OPTIMAL" | "ATTENTION" | "DEFICIT" = "OPTIMAL";
      if (uncoveredRelieverDemand > 0) {
        relieverReadinessStatus = availableStandby >= uncoveredRelieverDemand ? "ATTENTION" : "DEFICIT";
      }

      // Attendance & Exception Exposure
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          checkIn: {
            gte: targetDateStart,
            lte: targetDateEnd
          },
          ...(companyId ? { companyId } : {})
        },
        select: {
          id: true,
          employeeId: true,
          status: true,
          checkIn: true,
          checkOut: true,
          lateMinutes: true
        }
      });

      const presentToday = attendanceRecords.filter((r: any) => r.status === "ON_TIME" || r.status === "PRESENT").length;
      const absentToday = attendanceRecords.filter((r: any) => r.status === "ABSENT").length;
      const lateToday = attendanceRecords.filter((r: any) => r.status === "LATE" || (r.lateMinutes && r.lateMinutes > 0)).length;
      const missingPunch = attendanceRecords.filter(
        (r: any) => (r.status === "ON_TIME" || r.status === "PRESENT") && (!r.checkIn || !r.checkOut)
      ).length;

      const unresolvedCorrections = await prisma.attendanceCorrection.count({
        where: {
          status: "PENDING"
        }
      });

      // Attendance & Roster Reconciliation Exposure
      const reconciliations = await prisma.attendanceRosterReconciliation.findMany({
        where: {
          contractId: contract.id,
          workflowStatus: { in: ["OPEN", "PENDING_REVIEW", "UNDER_REVIEW"] }
        },
        select: {
          id: true,
          resolution: true
        }
      });

      const unresolvedReconciliations = reconciliations.length;
      const unexcusedAbsences = reconciliations.filter(
        (r: any) => r.resolution === "UNEXCUSED_ABSENCE"
      ).length;

      // Deduplicated Attendance Exposure Policy (Unique Employee Incidents)
      const affectedEmployeeIds = new Set<string>();
      attendanceRecords.filter((r: any) => r.status === "ABSENT" || (!r.checkIn || !r.checkOut)).forEach((r: any) => affectedEmployeeIds.add(r.employeeId));
      const totalUniqueAttendanceIncidents = affectedEmployeeIds.size;

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

      // SLA Authority & Risk Advisory Evaluation
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

      const hasCustomSlaConfig = false; // Standard contract baseline applies unless custom SLA model defined
      const isSlaBreach = hasCustomSlaConfig && isSlaRisk; // Only true when formal custom SLA exists
      const isOperationalRiskAdvisory = isSlaRisk; // Operational/commercial risk advisory indicator

      // Option A — Deterministic Health Score & Status Deduction Formula
      // Starting score: 100
      let healthScore = 100;

      // Deduction weights:
      const coverageDeduction = requiredSlots > 0 ? Math.round((100 - coveragePercentage) * 0.4) : 0;
      const uncoveredSlotsDeduction = uncoveredSlots * 5;
      const escalationsDeduction = openEscalationCount * 8;
      const reconciliationsDeduction = unresolvedReconciliations * 5;
      const correctionsDeduction = unresolvedCorrections * 3;
      const relieverDeduction = uncoveredRelieverDemand > 0 ? 5 : 0;
      const expiryDeduction = expiryStatus === "EXPIRED" ? 50 : expiryStatus === "EXPIRING_SOON" ? 15 : 0;

      const totalDeductions =
        coverageDeduction +
        uncoveredSlotsDeduction +
        escalationsDeduction +
        reconciliationsDeduction +
        correctionsDeduction +
        relieverDeduction +
        expiryDeduction;

      healthScore = Math.max(0, Math.min(100, 100 - totalDeductions));

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

      if (isCritical) {
        healthStatus = "CRITICAL";
        healthScore = Math.min(69, healthScore);
      } else if (isAttention) {
        healthStatus = "ATTENTION";
        healthScore = Math.max(70, Math.min(89, healthScore));
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
          unresolvedCorrections,
          totalUniqueAttendanceIncidents
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
          isSlaBreach,
          isOperationalRiskAdvisory,
          hasCustomSlaConfig,
          slaRiskReasons,
          openEscalationCount
        },
        health: {
          status: healthStatus,
          score: healthScore,
          deductions: totalDeductions,
          reasons: healthReasons
        },
        drillDownUrls
      });
    }

    // -------------------------------------------------------------------------
    // 3. Filter Items by Health / SLA / Expiry Status
    // -------------------------------------------------------------------------
    let filteredContracts = contractHealthItems;

    if (healthStatusFilter !== "ALL") {
      filteredContracts = filteredContracts.filter(c => c.health.status === healthStatusFilter);
    }
    if (slaRiskFilter === "AT_RISK") {
      filteredContracts = filteredContracts.filter(c => c.slaExposure.isSlaRisk);
    } else if (slaRiskFilter === "NORMAL") {
      filteredContracts = filteredContracts.filter(c => !c.slaExposure.isSlaRisk);
    }
    if (expiryStatusFilter !== "ALL") {
      filteredContracts = filteredContracts.filter(c => c.expiryStatus === expiryStatusFilter);
    }

    // -------------------------------------------------------------------------
    // 4. Aggregate Portfolio Summary Metrics (Scoped)
    // -------------------------------------------------------------------------
    const totalActiveContracts = contractHealthItems.length;
    const healthyContractsCount = contractHealthItems.filter(c => c.health.status === "HEALTHY").length;
    const attentionContractsCount = contractHealthItems.filter(c => c.health.status === "ATTENTION").length;
    const criticalContractsCount = contractHealthItems.filter(c => c.health.status === "CRITICAL").length;

    const sumCoverage = contractHealthItems.reduce((sum, c) => sum + c.coverage.coveragePercentage, 0);
    const averageCoveragePercentage =
      totalActiveContracts > 0 ? Math.round(sumCoverage / totalActiveContracts) : 100;

    const totalRequiredManpower = contractHealthItems.reduce(
      (sum, c) => sum + c.effectiveRequirements.effectiveManpowerCount,
      0
    );
    const totalAssignedManpower = contractHealthItems.reduce((sum, c) => sum + c.coverage.assignedSlots, 0);
    const totalUncoveredSlots = contractHealthItems.reduce((sum, c) => sum + c.coverage.uncoveredSlots, 0);
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
        },
        trends: "DEFERRED_NO_EFFICIENT_AUTHORITATIVE_SOURCE"
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
