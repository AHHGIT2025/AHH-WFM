import { prisma } from "@ahh-wfm/database";
import { getQatarDate, getQatarDateString } from "@/lib/roster-engine";
import { getEffectiveContractManpower, getRelieverEligibilityWhere } from "@/lib/contract-helpers";

export interface CommercialHealthAggregationsParams {
  companyId?: string;
  operationType?: string;
  businessDateStr?: string;
  dateFromStr?: string;
  dateToStr?: string;
  clientId?: string;
  contractId?: string;
  siteId?: string;
  projectId?: string;
  healthStatusFilter?: string;
  slaRiskFilter?: string;
  expiryStatusFilter?: string;
  page?: number;
  limit?: number;
  user?: any;
}

export interface ContractHealthItem {
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  clientId: string;
  clientName: string;
  companyId: string | null;
  operationType: string;
  contractType: string;
  status: string;
  startDate: string;
  endDate: string;
  daysToExpiry: number;
  expiryStatus: "EXPIRED" | "EXPIRING_SOON" | "ACTIVE";
  effectiveRequirements: {
    baseManpowerCount: number;
    addendaManpowerDelta: number;
    effectiveManpowerCount: number;
    baseRelieverCount: number;
    addendaRelieverDelta: number;
    effectiveRelieverCount: number;
  };
  coverage: {
    requiredSlots: number;
    assignedSlots: number;
    uncoveredSlots: number;
    overCoveredSlots: number;
    coveragePercentage: number;
  };
  relieverReadiness: {
    requiredRelievers: number;
    assignedRelievers: number;
    availableStandby: number;
    uncoveredDemand: number;
    readinessStatus: "OPTIMAL" | "ATTENTION" | "DEFICIT";
  };
  attendanceExposure: {
    presentToday: number;
    absentToday: number;
    lateToday: number;
    missingPunch: number;
    unresolvedCorrections: number;
    totalUniqueAttendanceIncidents: number;
  };
  reconciliationExposure: {
    unresolvedReconciliations: number;
    unexcusedAbsences: number;
  };
  billingSupport: {
    billableAdvisoryManpower: number;
    varianceVsRequired: number;
    unresolvedBillingExceptions: number;
  };
  slaExposure: {
    isSlaRisk: boolean;
    isSlaBreach: boolean;
    isOperationalRiskAdvisory: boolean;
    hasCustomSlaConfig: boolean;
    slaTargetCoverage: number | null;
    slaConfigurationSource: string;
    slaRiskReasons: string[];
    openEscalationCount: number;
  };
  health: {
    status: "HEALTHY" | "ATTENTION" | "CRITICAL";
    score: number;
    deductions: number;
    reasons: string[];
  };
  drillDownUrls: {
    contractMaster: string;
    rosterCoverage: string;
    escalationQueue: string;
    reconciliation: string;
  };
}

export interface CommercialHealthAggregationsResult {
  businessDate: string;
  dateFrom: string;
  dateTo: string;
  rangeLengthDays: number;
  portfolioMetrics: {
    totalActiveContracts: number;
    healthyContractsCount: number;
    attentionContractsCount: number;
    criticalContractsCount: number;
    averageCoveragePercentage: number;
    totalRequiredManpower: number;
    totalAssignedManpower: number;
    totalUncoveredSlots: number;
    contractsWithSlaRiskCount: number;
    contractsWithEscalationsCount: number;
    contractsExpiringSoonCount: number;
    contractsExpiredCount: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  contracts: ContractHealthItem[];
}

export async function getCommercialHealthAggregations(
  params: CommercialHealthAggregationsParams,
  prismaClient?: any
): Promise<CommercialHealthAggregationsResult> {
  const db = prismaClient || prisma;
  const {
    companyId,
    operationType,
    businessDateStr: rawBusinessDate,
    dateFromStr: rawDateFrom,
    dateToStr: rawDateTo,
    clientId,
    contractId,
    siteId,
    projectId,
    healthStatusFilter = "ALL",
    slaRiskFilter = "ALL",
    expiryStatusFilter = "ALL",
    page = 1,
    limit = 50
  } = params;

  const businessDateStr = rawBusinessDate ? rawBusinessDate.trim() : getQatarDateString(new Date());
  const dateFromStr = rawDateFrom ? rawDateFrom.trim() : businessDateStr;
  const dateToStr = rawDateTo ? rawDateTo.trim() : businessDateStr;

  const dateFromObj = getQatarDate(dateFromStr);
  const dateToObj = getQatarDate(dateToStr);

  const diffMs = dateToObj.getTime() - dateFromObj.getTime();
  const rangeLengthDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

  const targetDateStart = new Date(dateFromObj.getFullYear(), dateFromObj.getMonth(), dateFromObj.getDate(), 0, 0, 0);
  const targetDateEnd = new Date(dateToObj.getFullYear(), dateToObj.getMonth(), dateToObj.getDate(), 23, 59, 59);

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

  const contracts = await db.manpowerContract.findMany({
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

  const contractHealthItems: ContractHealthItem[] = [];

  for (const contract of contracts) {
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

    const slots = await db.rosterRequirementSlot.findMany({
      where: { contractId: contract.id },
      include: { assignments: true }
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

    const assignedRelievers = await db.shiftRelieverAssignment.count({
      where: {
        date: businessDateStr,
        ...(contract.projects && contract.projects.length > 0
          ? { projectId: { in: contract.projects.map((p: any) => p.id) } }
          : {})
      }
    });

    const availableStandby = await db.employee.count({
      where: getRelieverEligibilityWhere({ companyId, operationType: contract.operationType })
    });

    const uncoveredRelieverDemand = Math.max(0, effectiveRelieverCount - assignedRelievers);
    let relieverReadinessStatus: "OPTIMAL" | "ATTENTION" | "DEFICIT" = "OPTIMAL";
    if (uncoveredRelieverDemand > 0) {
      relieverReadinessStatus = availableStandby >= uncoveredRelieverDemand ? "ATTENTION" : "DEFICIT";
    }

    const attendanceRecords = await db.attendanceRecord.findMany({
      where: {
        checkIn: { gte: targetDateStart, lte: targetDateEnd },
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

    const unresolvedCorrections = await db.attendanceCorrection.count({
      where: { status: "Pending" }
    });

    const reconciliations = await db.attendanceRosterReconciliation.findMany({
      where: {
        contractId: contract.id,
        workflowStatus: { in: ["OPEN", "PENDING_REVIEW", "UNDER_REVIEW"] }
      },
      select: { id: true, resolution: true }
    });

    const unresolvedReconciliations = reconciliations.length;
    const unexcusedAbsences = reconciliations.filter((r: any) => r.resolution === "UNEXCUSED_ABSENCE").length;

    const affectedEmployeeIds = new Set<string>();
    attendanceRecords.filter((r: any) => r.status === "ABSENT" || (!r.checkIn || !r.checkOut)).forEach((r: any) => affectedEmployeeIds.add(r.employeeId));
    const totalUniqueAttendanceIncidents = affectedEmployeeIds.size;

    const openPlanningExceptions = await db.rosterPlanningException.count({
      where: {
        contractId: contract.id,
        status: { in: ["OPEN", "COVERAGE_REQUIRED"] }
      }
    });
    const openEscalationCount = openPlanningExceptions + unresolvedReconciliations;

    const endDate = new Date(contract.endDate);
    const diffMsExpiry = endDate.getTime() - dateToObj.getTime();
    const daysToExpiry = Math.ceil(diffMsExpiry / (1000 * 60 * 60 * 24));

    let expiryStatus: "EXPIRED" | "EXPIRING_SOON" | "ACTIVE" = "ACTIVE";
    if (daysToExpiry <= 0 || contract.status === "EXPIRED") {
      expiryStatus = "EXPIRED";
    } else if (daysToExpiry <= 30) {
      expiryStatus = "EXPIRING_SOON";
    }

    const slaRiskReasons: string[] = [];
    let isOperationalRiskAdvisory = false;

    if (coveragePercentage < 90 && requiredSlots > 0) {
      isOperationalRiskAdvisory = true;
      slaRiskReasons.push(`Coverage below operational baseline of 90% (${coveragePercentage}%).`);
    }
    if (openEscalationCount > 0) {
      isOperationalRiskAdvisory = true;
      slaRiskReasons.push(`${openEscalationCount} unresolved escalation(s) active on contract.`);
    }
    if (uncoveredSlots >= 2) {
      isOperationalRiskAdvisory = true;
      slaRiskReasons.push(`${uncoveredSlots} unfilled requirement slot(s) for business date.`);
    }
    if (unexcusedAbsences > 0) {
      isOperationalRiskAdvisory = true;
      slaRiskReasons.push(`${unexcusedAbsences} unexcused absence discrepancy(ies) logged.`);
    }

    const hasCustomSlaConfig = false;
    const contractSlaTargetCoverage: number | null = null;
    const isSlaBreach = false;
    const isSlaRisk = isOperationalRiskAdvisory;

    let healthScore = 100;
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
      healthScore = Math.max(70, Math.min(99, healthScore));
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

    const billableAdvisoryManpower = assignedSlots;
    const varianceVsRequired = assignedSlots - requiredSlots;
    const unresolvedBillingExceptions = unexcusedAbsences;

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
        isSlaBreach: false,
        isOperationalRiskAdvisory,
        hasCustomSlaConfig: false,
        slaTargetCoverage: null,
        slaConfigurationSource: "FORMAL_CONTRACT_COVERAGE_SLA_NOT_CONFIGURED",
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

  let filteredContracts = contractHealthItems;

  if (healthStatusFilter !== "ALL") {
    filteredContracts = filteredContracts.filter((c) => c.health.status === healthStatusFilter);
  }
  if (slaRiskFilter === "AT_RISK") {
    filteredContracts = filteredContracts.filter((c) => c.slaExposure.isSlaRisk);
  } else if (slaRiskFilter === "NORMAL") {
    filteredContracts = filteredContracts.filter((c) => !c.slaExposure.isSlaRisk);
  }
  if (expiryStatusFilter !== "ALL") {
    filteredContracts = filteredContracts.filter((c) => c.expiryStatus === expiryStatusFilter);
  }

  const totalActiveContracts = contractHealthItems.length;
  const healthyContractsCount = contractHealthItems.filter((c) => c.health.status === "HEALTHY").length;
  const attentionContractsCount = contractHealthItems.filter((c) => c.health.status === "ATTENTION").length;
  const criticalContractsCount = contractHealthItems.filter((c) => c.health.status === "CRITICAL").length;

  const sumCoverage = contractHealthItems.reduce((sum, c) => sum + c.coverage.coveragePercentage, 0);
  const averageCoveragePercentage =
    totalActiveContracts > 0 ? Math.round(sumCoverage / totalActiveContracts) : 100;

  const totalRequiredManpower = contractHealthItems.reduce(
    (sum, c) => sum + c.effectiveRequirements.effectiveManpowerCount,
    0
  );
  const totalAssignedManpower = contractHealthItems.reduce((sum, c) => sum + c.coverage.assignedSlots, 0);
  const totalUncoveredSlots = contractHealthItems.reduce((sum, c) => sum + c.coverage.uncoveredSlots, 0);
  const contractsWithSlaRiskCount = contractHealthItems.filter((c) => c.slaExposure.isSlaRisk).length;
  const contractsWithEscalationsCount = contractHealthItems.filter((c) => c.slaExposure.openEscalationCount > 0).length;
  const contractsExpiringSoonCount = contractHealthItems.filter((c) => c.expiryStatus === "EXPIRING_SOON").length;
  const contractsExpiredCount = contractHealthItems.filter((c) => c.expiryStatus === "EXPIRED").length;

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

  const startIndex = (page - 1) * limit;
  const paginatedContracts = filteredContracts.slice(startIndex, startIndex + limit);

  return {
    businessDate: businessDateStr,
    dateFrom: dateFromStr,
    dateTo: dateToStr,
    rangeLengthDays,
    portfolioMetrics,
    pagination: {
      page,
      limit,
      totalItems: filteredContracts.length,
      totalPages: Math.ceil(filteredContracts.length / limit)
    },
    contracts: paginatedContracts
  };
}
