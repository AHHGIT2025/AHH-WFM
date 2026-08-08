import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { getQatarDate, getQatarDateString } from "@/lib/roster-engine";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  // 1. Centralized Authorization Check
  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "commercial.commandCenter.view") ||
    hasPermission(user, "commercial.commandCenter.rosterCoverage") ||
    hasPermission(user, "manpower.admin.full_access") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.fm.view") ||
    hasPermission(user, "reports.executive.view");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to access the Roster Coverage Console." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);

  // 2. Filter Extraction & Validation
  const dateParam = searchParams.get("businessDate");
  const businessDateStr = dateParam ? dateParam.trim() : getQatarDateString(new Date());

  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam.trim())) {
    return NextResponse.json(
      { error: "Invalid businessDate filter format. Expected format: YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const targetDate = getQatarDate(businessDateStr);

  let companyId = searchParams.get("companyId") || undefined;
  let operationType = searchParams.get("operationType") || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const contractId = searchParams.get("contractId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  const locationKey = searchParams.get("locationKey") || undefined;
  const shiftKey = searchParams.get("shiftKey") || undefined;
  const coverageStatusFilter = searchParams.get("coverageStatus") || "ALL";
  const relieverReadinessFilter = searchParams.get("relieverReadiness") || "ALL";

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

  // Operation Scope (SG / FM) Isolation
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

  // Site / Project Supervisor Scope Isolation
  let authorizedSiteIds: string[] | undefined = undefined;
  if (user?.siteAccess && Array.isArray(user.siteAccess) && user.siteAccess.length > 0 && !isAdminUser(user)) {
    authorizedSiteIds = user.siteAccess;
  }

  try {
    // 3. Authoritative Roster Slot Queries
    const slotWhere: any = {
      businessDate: targetDate,
      scheduleStatus: { notIn: ["CANCELLED"] }
    };

    if (companyId) slotWhere.companyId = companyId;
    if (operationType && operationType !== "ALL") slotWhere.operationType = operationType;
    if (contractId) slotWhere.contractId = contractId;
    if (siteId) {
      slotWhere.siteId = siteId;
    } else if (authorizedSiteIds) {
      slotWhere.siteId = { in: authorizedSiteIds };
    }
    if (locationKey) slotWhere.locationKey = locationKey;
    if (shiftKey) slotWhere.shiftKey = shiftKey;

    const slots = await prisma.rosterRequirementSlot.findMany({
      where: slotWhere,
      include: {
        assignments: {
          where: { historyStatus: "ACTIVE" },
          include: {
            employee: {
              select: { id: true, name: true, email: true, status: true }
            }
          }
        },
        company: { select: { id: true, companyName: true, companyCode: true } },
        contract: {
          select: {
            id: true,
            title: true,
            contractNumber: true,
            client: { select: { id: true, name: true, code: true } }
          }
        },
        project: { select: { id: true, name: true, code: true } },
        site: { select: { id: true, name: true, code: true } }
      },
      orderBy: [{ siteId: "asc" }, { shiftKey: "asc" }, { slotIndex: "asc" }]
    });

    // 4. Reliever Demand & Available Standby Queries
    const contractWhere: any = { status: "ACTIVE" };
    if (operationType && operationType !== "ALL") contractWhere.operationType = operationType;
    if (contractId) contractWhere.id = contractId;

    const relieverReqsCount = await prisma.contractRelieverRequirement.count({
      where: { contract: contractWhere }
    });

    const assignedRelieversCount = await prisma.shiftRelieverAssignment.count({
      where: { date: businessDateStr }
    });

    // Authoritative Reliever Eligibility (Off Duty + Active + Reliever/Standby Eligible)
    const empWhere: any = {
      isActive: true,
      employmentStatus: "ACTIVE",
      dutyStatus: "OFF_DUTY",
      OR: [{ isRelieverEligible: true }, { isStandbyEligible: true }]
    };
    if (companyId) empWhere.companyId = companyId;
    if (operationType && operationType !== "ALL") empWhere.operationType = operationType;

    const availableStandbyCount = await prisma.employee.count({ where: empWhere });
    const uncoveredRelieverDemand = Math.max(0, relieverReqsCount - assignedRelieversCount);

    let overallReadinessStatus: "READY" | "ATTENTION" | "CRITICAL" = "READY";
    const readinessReasons: string[] = [];

    if (uncoveredRelieverDemand > 0) {
      if (availableStandbyCount === 0) {
        overallReadinessStatus = "CRITICAL";
        readinessReasons.push(`Critical reliever deficit: ${uncoveredRelieverDemand} reliever(s) needed but 0 standby employees available.`);
      } else if (availableStandbyCount < uncoveredRelieverDemand) {
        overallReadinessStatus = "ATTENTION";
        readinessReasons.push(`Reliever deficit: ${uncoveredRelieverDemand} reliever(s) needed with only ${availableStandbyCount} standby employee(s) available.`);
      } else {
        overallReadinessStatus = "ATTENTION";
        readinessReasons.push(`${uncoveredRelieverDemand} reliever requirement(s) pending assignment today.`);
      }
    }

    // 5. Construct Hierarchy and Item Matrix
    let totalRequiredSlots = 0;
    let filledSlotsCount = 0;
    let uncoveredSlotsCount = 0;
    let overCoveredSlotsCount = 0;

    const items: any[] = [];
    const hierarchyMap = new Map<string, any>();

    for (const slot of slots) {
      totalRequiredSlots += 1;
      const activeAssignments = slot.assignments || [];
      const count = activeAssignments.length;

      let status: "FILLED" | "UNCOVERED" | "OVER_COVERED" = "FILLED";
      if (count === 0) {
        status = "UNCOVERED";
        uncoveredSlotsCount += 1;
      } else if (count > 1) {
        status = "OVER_COVERED";
        overCoveredSlotsCount += 1;
      } else {
        filledSlotsCount += 1;
      }

      // Filter by coverageStatus if specified
      if (coverageStatusFilter !== "ALL" && status !== coverageStatusFilter) {
        continue;
      }

      const assignedEmployees = activeAssignments.map((a: any) => ({
        id: a.employee?.id || a.employeeId,
        name: a.employee?.name || "Assigned Employee",
        code: a.employee?.email || "N/A",
        status: a.employee?.status || "On Duty",
        assignmentType: a.assignmentType || "PRIMARY"
      }));

      const opSlug = slot.operationType === "FACILITY_MANAGEMENT" ? "facility-management" : "security-guarding";
      const drillDownLinks = {
        rosterPlanner: `/manpower/${opSlug}/deployment-calendar?contractId=${slot.contractId}&siteId=${slot.siteId}`,
        reconciliation: `/manpower/${opSlug}/reconciliation`,
        workforceProfile: `/workforce`
      };

      const item = {
        slotId: slot.id,
        businessDate: businessDateStr,
        operationType: slot.operationType,
        companyId: slot.companyId,
        companyName: slot.company?.companyName || "Default Company",
        clientId: slot.contract?.client?.id || null,
        clientName: slot.contract?.client?.name || "N/A",
        contractId: slot.contractId,
        contractTitle: slot.contract?.title || "N/A",
        contractNumber: slot.contract?.contractNumber || "N/A",
        projectId: slot.projectId,
        projectName: slot.project?.name || "N/A",
        siteId: slot.siteId,
        siteName: slot.site?.name || "N/A",
        locationKey: slot.locationKey,
        shiftKey: slot.shiftKey,
        slotIndex: slot.slotIndex,
        snapshotPosition: slot.snapshotPosition,
        snapshotShiftName: slot.snapshotShiftName,
        snapshotStartTime: slot.snapshotStartTime,
        snapshotEndTime: slot.snapshotEndTime,
        fulfillmentStatus: slot.fulfillmentStatus,
        requiredQuantity: 1,
        assignedCount: count,
        coverageStatus: status,
        assignedEmployees,
        drillDownLinks
      };

      items.push(item);

      // Build hierarchy node
      const companyKey = slot.companyId || "COMP-DEFAULT";
      if (!hierarchyMap.has(companyKey)) {
        hierarchyMap.set(companyKey, {
          companyId: companyKey,
          companyName: slot.company?.companyName || "Default Company",
          contracts: new Map<string, any>()
        });
      }
      const companyNode = hierarchyMap.get(companyKey);

      const contractKey = slot.contractId || "CON-DEFAULT";
      if (!companyNode.contracts.has(contractKey)) {
        companyNode.contracts.set(contractKey, {
          contractId: contractKey,
          contractTitle: slot.contract?.title || "N/A",
          sites: new Map<string, any>()
        });
      }
      const contractNode = companyNode.contracts.get(contractKey);

      const siteKey = slot.siteId || "SITE-DEFAULT";
      if (!contractNode.sites.has(siteKey)) {
        contractNode.sites.set(siteKey, {
          siteId: siteKey,
          siteName: slot.site?.name || "N/A",
          slots: []
        });
      }
      contractNode.sites.get(siteKey).slots.push(item);
    }

    const coveragePercentage =
      totalRequiredSlots > 0
        ? Math.round((filledSlotsCount / totalRequiredSlots) * 10000) / 100
        : 100;

    // Convert hierarchy maps to serializable array
    const hierarchy = Array.from(hierarchyMap.values()).map((comp) => ({
      companyId: comp.companyId,
      companyName: comp.companyName,
      contracts: Array.from(comp.contracts.values()).map((con: any) => ({
        contractId: con.contractId,
        contractTitle: con.contractTitle,
        sites: Array.from(con.sites.values())
      }))
    }));

    return NextResponse.json({
      context: {
        businessDate: businessDateStr,
        operationType: operationType || "ALL",
        companyId: companyId || null,
        clientId: clientId || null,
        contractId: contractId || null,
        siteId: siteId || null,
        locationKey: locationKey || null,
        shiftKey: shiftKey || null,
        coverageStatus: coverageStatusFilter,
        relieverReadiness: relieverReadinessFilter,
        scopeIsolation: {
          userRole: user?.role || "UNKNOWN",
          companyBound: Boolean(user?.companyId),
          allowedSecurityGuarding: user?.operationAccess?.allowedSecurityGuarding ?? true,
          allowedFacilityManagement: user?.operationAccess?.allowedFacilityManagement ?? true,
          siteRestricted: Boolean(authorizedSiteIds)
        }
      },
      summary: {
        totalRequiredSlots,
        filledSlotsCount,
        uncoveredSlotsCount,
        overCoveredSlotsCount,
        coveragePercentage,
        relieverReadiness: {
          requiredRelieversCount: relieverReqsCount,
          assignedRelieversCount,
          availableStandbyRelieversCount: availableStandbyCount,
          uncoveredRelieverDemand,
          overallReadinessStatus,
          readinessReasons
        }
      },
      items,
      hierarchy,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("COMMERCIAL COMMAND CENTER ROSTER COVERAGE API ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to aggregate roster coverage and reliever readiness data." },
      { status: 500 }
    );
  }
}
