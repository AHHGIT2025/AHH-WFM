import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { getQatarDate, getQatarDateString } from "@/lib/roster-engine";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  // Permission Check
  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "commercial.commandCenter.view") ||
    hasPermission(user, "commercial.commandCenter.exceptions") ||
    hasPermission(user, "manpower.admin.full_access") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.fm.view");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view Commercial Command Center escalations." },
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

  let companyId = searchParams.get("companyId") || undefined;
  let operationType = searchParams.get("operationType") || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const contractId = searchParams.get("contractId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const sourceType = searchParams.get("sourceType") || "ALL";
  const severity = searchParams.get("severity") || "ALL";
  const status = searchParams.get("status") || "ALL";
  const ownerId = searchParams.get("ownerId") || undefined;
  const overdueOnly = searchParams.get("overdueOnly") === "true";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  // Company Isolation — applied at user level
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
    const escalations: any[] = [];

    // Helper for site / project boundary check
    const isSiteAllowed = (targetSiteId: string | null | undefined, targetProjectId: string | null | undefined) => {
      if (isAdminUser(user) || hasPermission(user, "manpower.admin.full_access")) return true;
      if (siteId && targetSiteId && targetSiteId !== siteId) return false;
      if (projectId && targetProjectId && targetProjectId !== projectId) return false;
      if (user?.siteId && targetSiteId && targetSiteId !== user.siteId) return false;
      return true;
    };

    // Helper: check company filter (in-memory, since many models have no companyId)
    const isCompanyAllowed = (recordCompanyId: string | null | undefined) => {
      if (!companyId) return true;
      if (!recordCompanyId) return true; // no company restriction on the record — allow through
      return recordCompanyId === companyId;
    };

    // 1. UNCOVERED ROSTER SLOT Category
    // RosterRequirementSlot has a direct companyId field — filter at query level
    if (sourceType === "ALL" || sourceType === "UNCOVERED_ROSTER_SLOT") {
      const slotWhere: any = {
        businessDate: targetDate,
        fulfillmentStatus: { in: ["VACANT", "UNCOVERED"] }
      };
      if (operationType && operationType !== "ALL") slotWhere.operationType = operationType;
      if (contractId) slotWhere.contractId = contractId;
      if (siteId) slotWhere.siteId = siteId;
      if (projectId) slotWhere.projectId = projectId;
      if (companyId) slotWhere.companyId = companyId;

      const uncoveredSlots = await prisma.rosterRequirementSlot.findMany({
        where: slotWhere,
        include: {
          contract: { include: { client: true } },
          site: true
        },
        take: 100,
        orderBy: { createdAt: "desc" }
      });

      for (const slot of uncoveredSlots) {
        if (!isSiteAllowed(slot.siteId, slot.site?.projectId)) continue;

        const sourceKey = `UNCOVERED_ROSTER_SLOT:${slot.id}:${businessDateStr}`;
        const openedAt = slot.createdAt;
        const dueAt = new Date(openedAt.getTime() + 4 * 60 * 60 * 1000); // 4 hours SLA

        escalations.push({
          id: sourceKey,
          sourceKey,
          sourceType: "UNCOVERED_ROSTER_SLOT",
          sourceId: slot.id,
          severity: "CRITICAL",
          title: `Uncovered Roster Slot: ${slot.snapshotShiftName || "Shift"}`,
          description: `Unfilled slot at ${slot.site?.name || "Site"}.`,
          companyId: slot.companyId || null,
          operationType: slot.operationType,
          clientName: slot.contract?.client?.name || "Client",
          contractId: slot.contractId,
          contractTitle: slot.contract?.title || "Contract",
          siteId: slot.siteId,
          siteName: slot.site?.name || "Site",
          openedAt: openedAt.toISOString(),
          dueAt: dueAt.toISOString(),
          ageMinutes: Math.round((new Date().getTime() - openedAt.getTime()) / (1000 * 60)),
          isOverdue: new Date() > dueAt,
          status: "OPEN",
          ownerId: null,
          ownerName: "Unassigned",
          workflowInstanceId: null,
          drillDownUrl: `/commercial/command-center/roster-coverage?businessDate=${businessDateStr}`,
          authoritativeModule: "Roster Planner",
          requiresAuthoritativeModuleApproval: false
        });
      }
    }

    // 2. RELIEVER DEFICIT Category
    if (sourceType === "ALL" || sourceType === "RELIEVER_DEFICIT") {
      const relWhere: any = {};
      // ContractRelieverRequirement has no operationType column — filter via the nested contract relation
      if (operationType && operationType !== "ALL") relWhere.contract = { operationType };

      const relieverReqs = await prisma.contractRelieverRequirement.findMany({
        where: relWhere
      });

      // ContractRelieverRequirement uses field: quantity (not requiredRelievers)
      const requiredRelieversCount = relieverReqs.reduce((sum, r) => sum + r.quantity, 0);

      const availableStandbyCount = await prisma.employee.count({
        where: {
          dutyStatus: "OFF_DUTY",
          ...(companyId && { companyId })
        }
      });

      if (requiredRelieversCount > availableStandbyCount) {
        const uncoveredDemand = requiredRelieversCount - availableStandbyCount;
        const deficitSeverity = uncoveredDemand >= 5 ? "CRITICAL" : "HIGH";
        const sourceKey = `RELIEVER_DEFICIT:DEFICIT-${businessDateStr}`;
        const openedAt = targetDateStart;
        const dueAt = new Date(openedAt.getTime() + 8 * 60 * 60 * 1000); // 8 hours SLA

        escalations.push({
          id: sourceKey,
          sourceKey,
          sourceType: "RELIEVER_DEFICIT",
          sourceId: `DEFICIT-${businessDateStr}`,
          severity: deficitSeverity,
          title: `Reliever Deficit: ${uncoveredDemand} Standby Reliever(s) Needed`,
          description: `${uncoveredDemand} required reliever position(s) unfilled for ${businessDateStr}. Available standby pool: ${availableStandbyCount}.`,
          companyId: companyId || null,
          operationType: operationType || "ALL",
          clientName: "Multiple Clients",
          contractId: contractId || null,
          contractTitle: "Reliever Pool Management",
          siteId: null,
          siteName: "All Operational Sites",
          openedAt: openedAt.toISOString(),
          dueAt: dueAt.toISOString(),
          ageMinutes: Math.round((new Date().getTime() - openedAt.getTime()) / (1000 * 60)),
          isOverdue: new Date() > dueAt,
          status: "OPEN",
          ownerId: null,
          ownerName: "Unassigned",
          workflowInstanceId: null,
          drillDownUrl: `/manpower/security-guarding/reliever-pools`,
          authoritativeModule: "Reliever Pool Management",
          requiresAuthoritativeModuleApproval: false
        });
      }
    }

    // 3. ROSTER PLANNING EXCEPTIONS Category
    // RosterPlanningException has no companyId — filter in-memory via slot.companyId
    if (sourceType === "ALL" || sourceType === "ROSTER_PLANNING_EXCEPTION") {
      const excWhere: any = {
        status: { in: ["OPEN", "COVERAGE_REQUIRED", "RELIEVER_ASSIGNED"] }
      };
      if (operationType && operationType !== "ALL") excWhere.operationType = operationType;
      if (contractId) excWhere.contractId = contractId;
      if (siteId) excWhere.siteId = siteId;

      const planningExceptions = await prisma.rosterPlanningException.findMany({
        where: excWhere,
        include: {
          contract: { include: { client: true } },
          site: true,
          employee: true,
          slot: true
        },
        orderBy: { createdAt: "desc" }
      });

      for (const exc of planningExceptions) {
        // Company filter: use slot.companyId if available
        const excCompanyId = exc.slot?.companyId || null;
        if (!isCompanyAllowed(excCompanyId)) continue;
        if (!isSiteAllowed(exc.siteId, exc.site?.projectId)) continue;

        const sourceKey = `ROSTER_PLANNING_EXCEPTION:${exc.id}`;
        const openedAt = exc.createdAt;
        const dueAt = new Date(openedAt.getTime() + 6 * 60 * 60 * 1000); // 6 hours SLA
        const mappedSeverity = exc.severity === "CRITICAL" ? "CRITICAL" : "HIGH";

        // Fetch workflow instance if bound
        const wfInstance = await prisma.workflowInstance.findFirst({
          where: { referenceId: exc.id, moduleType: "ROSTER_PLANNING_EXCEPTION" }
        });

        escalations.push({
          id: sourceKey,
          sourceKey,
          sourceType: "ROSTER_PLANNING_EXCEPTION",
          sourceId: exc.id,
          severity: mappedSeverity,
          title: `Roster Exception: ${exc.exceptionType}`,
          description: exc.message,
          companyId: excCompanyId,
          operationType: exc.operationType,
          clientName: exc.contract?.client?.name || "Client",
          contractId: exc.contractId,
          contractTitle: exc.contract?.title || "Contract",
          siteId: exc.siteId,
          siteName: exc.site?.name || "Site",
          openedAt: openedAt.toISOString(),
          dueAt: dueAt.toISOString(),
          ageMinutes: Math.round((new Date().getTime() - openedAt.getTime()) / (1000 * 60)),
          isOverdue: new Date() > dueAt,
          status: exc.status,
          ownerId: exc.resolvedById || null,
          ownerName: exc.employee?.name || "Unassigned",
          workflowInstanceId: wfInstance?.id || null,
          drillDownUrl: `/manpower/security-guarding/exceptions`,
          authoritativeModule: "Roster Planner",
          requiresAuthoritativeModuleApproval: false
        });
      }
    }

    // 4. UNEXCUSED RECONCILIATION Category
    // AttendanceRosterReconciliation has no companyId — pass all (scoped by operationType)
    if (sourceType === "ALL" || sourceType === "UNEXCUSED_RECONCILIATION") {
      const reconWhere: any = {
        workflowStatus: { in: ["OPEN", "PENDING_REVIEW", "UNDER_REVIEW"] }
      };
      if (operationType && operationType !== "ALL") reconWhere.operationType = operationType;
      if (contractId) reconWhere.contractId = contractId;
      if (siteId) reconWhere.siteId = siteId;

      const reconciliations = await prisma.attendanceRosterReconciliation.findMany({
        where: reconWhere,
        include: {
          contract: { include: { client: true } },
          site: true,
          expectedEmployee: true
        },
        orderBy: { createdAt: "desc" }
      });

      for (const recon of reconciliations) {
        if (!isSiteAllowed(recon.siteId, recon.site?.projectId)) continue;

        const sourceKey = `UNEXCUSED_RECONCILIATION:${recon.id}`;
        const openedAt = recon.createdAt;
        const dueAt = new Date(openedAt.getTime() + 12 * 60 * 60 * 1000); // 12 hours SLA

        escalations.push({
          id: sourceKey,
          sourceKey,
          sourceType: "UNEXCUSED_RECONCILIATION",
          sourceId: recon.id,
          severity: "HIGH",
          title: `Unexcused Discrepancy: ${recon.expectedEmployeeName || recon.expectedEmployee?.name || "Employee"}`,
          description: `Discrepancy recorded for business date ${businessDateStr}. Expected at ${recon.siteName || recon.site?.name || "Site"}.`,
          companyId: null,
          operationType: recon.operationType,
          clientName: recon.contract?.client?.name || "Client",
          contractId: recon.contractId,
          contractTitle: recon.contractTitle || recon.contract?.title || "Contract",
          siteId: recon.siteId,
          siteName: recon.siteName || recon.site?.name || "Site",
          openedAt: openedAt.toISOString(),
          dueAt: dueAt.toISOString(),
          ageMinutes: Math.round((new Date().getTime() - openedAt.getTime()) / (1000 * 60)),
          isOverdue: new Date() > dueAt,
          status: recon.workflowStatus,
          ownerId: recon.reviewedById || null,
          ownerName: "Unassigned",
          workflowInstanceId: null,
          drillDownUrl: `/manpower/security-guarding/reconciliation`,
          authoritativeModule: "Attendance Reconciliation",
          requiresAuthoritativeModuleApproval: false
        });
      }
    }

    // 5. PENDING ATTENDANCE CORRECTION Category
    // AttendanceCorrection → attendanceRecord.companyId for company filter
    if (sourceType === "ALL" || sourceType === "ATTENDANCE_CORRECTION_PENDING") {
      const corrections = await prisma.attendanceCorrection.findMany({
        where: { status: "Pending" },
        include: {
          attendanceRecord: {
            include: {
              employee: true,
              worksite: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      for (const corr of corrections) {
        const emp = corr.attendanceRecord?.employee;
        const corrCompId = corr.attendanceRecord?.companyId || emp?.companyId || null;
        const corrOpType = "SECURITY_GUARDING";

        if (!isCompanyAllowed(corrCompId)) continue;
        if (operationType && operationType !== "ALL" && operationType !== corrOpType) continue;

        const sourceKey = `ATTENDANCE_CORRECTION_PENDING:${corr.id}`;
        const openedAt = corr.createdAt;
        const dueAt = new Date(openedAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours SLA

        escalations.push({
          id: sourceKey,
          sourceKey,
          sourceType: "ATTENDANCE_CORRECTION_PENDING",
          sourceId: corr.id,
          severity: "MEDIUM",
          title: `Attendance Correction Pending: ${emp?.name || "Employee"}`,
          description: `Correction request submitted for punch adjustment. Reason: ${corr.reason || "Punch Adjustment"}.`,
          companyId: corrCompId,
          operationType: corrOpType,
          clientName: "Employee Self-Service",
          contractId: null,
          contractTitle: "Attendance Review",
          siteId: corr.attendanceRecord?.worksite?.id || null,
          siteName: corr.attendanceRecord?.worksite?.name || "Worksite",
          openedAt: openedAt.toISOString(),
          dueAt: dueAt.toISOString(),
          ageMinutes: Math.round((new Date().getTime() - openedAt.getTime()) / (1000 * 60)),
          isOverdue: new Date() > dueAt,
          status: "OPEN",
          ownerId: corr.reviewedById || null,
          ownerName: "Unassigned Supervisor",
          workflowInstanceId: null,
          drillDownUrl: `/attendance/corrections`,
          authoritativeModule: "Attendance",
          requiresAuthoritativeModuleApproval: true
        });
      }
    }

    // 6. CONTRACT SLA RISK Category
    // ManpowerContract has no companyId — no company filter at query level
    if (sourceType === "ALL" || sourceType === "CONTRACT_SLA_RISK") {
      const contractWhere: any = { status: "ACTIVE" };
      if (operationType && operationType !== "ALL") contractWhere.operationType = operationType;
      if (clientId) contractWhere.clientId = clientId;
      if (contractId) contractWhere.id = contractId;

      const activeContracts = await prisma.manpowerContract.findMany({
        where: contractWhere,
        include: {
          client: true,
          rosterSlots: { where: { businessDate: targetDate } }
        }
      });

      for (const cont of activeContracts) {
        // Company filter: look at the rosterSlots' companyId (first available)
        const slotCompanyId = cont.rosterSlots.length > 0 ? cont.rosterSlots[0].companyId || null : null;
        if (!isCompanyAllowed(slotCompanyId)) continue;

        const required = cont.rosterSlots.length;
        if (required > 0) {
          const slotIds = cont.rosterSlots.map((s) => s.id);
          const assignedCount = await prisma.rosterSlotAssignment.count({
            where: { slotId: { in: slotIds } }
          });

          const coverageRatio = assignedCount / required;
          if (coverageRatio < 0.90 || assignedCount < required) {
            const riskSeverity = coverageRatio < 0.80 ? "CRITICAL" : "HIGH";
            const sourceKey = `CONTRACT_SLA_RISK:${cont.id}:${businessDateStr}`;
            const openedAt = targetDateStart;
            const dueAt = new Date(openedAt.getTime() + 8 * 60 * 60 * 1000); // 8 hours SLA

            escalations.push({
              id: sourceKey,
              sourceKey,
              sourceType: "CONTRACT_SLA_RISK",
              sourceId: cont.id,
              severity: riskSeverity,
              title: `Contract SLA Risk: ${cont.title}`,
              description: `Manpower allocation at ${Math.round(coverageRatio * 100)}% (${assignedCount}/${required} posts assigned). Below contractual baseline.`,
              companyId: slotCompanyId,
              operationType: cont.operationType,
              clientName: cont.client?.name || "Client",
              contractId: cont.id,
              contractTitle: cont.title,
              siteId: null,
              siteName: "Contract Wide",
              openedAt: openedAt.toISOString(),
              dueAt: dueAt.toISOString(),
              ageMinutes: Math.round((new Date().getTime() - openedAt.getTime()) / (1000 * 60)),
              isOverdue: new Date() > dueAt,
              status: "OPEN",
              ownerId: null,
              ownerName: "Unassigned",
              workflowInstanceId: null,
              drillDownUrl: `/manpower/contracts/${cont.id}`,
              authoritativeModule: "Contract Lifecycle",
              requiresAuthoritativeModuleApproval: false
            });
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // UserActivityLog Action-State Overlay
    // For synthetic escalation types (UNCOVERED_ROSTER_SLOT, RELIEVER_DEFICIT,
    // ATTENDANCE_CORRECTION_PENDING, CONTRACT_SLA_RISK), no native model carries
    // the CCC-3 action state (ACKNOWLEDGED / ASSIGNED). Derive it here by
    // batch-reading the latest UserActivityLog entry per sourceKey.
    // Native types (ROSTER_PLANNING_EXCEPTION, UNEXCUSED_RECONCILIATION) already
    // carry source-model status; only ownerId is overlaid from ASSIGN logs.
    // -------------------------------------------------------------------------
    const SYNTHETIC_TYPES = new Set([
      "UNCOVERED_ROSTER_SLOT",
      "RELIEVER_DEFICIT",
      "ATTENDANCE_CORRECTION_PENDING",
      "CONTRACT_SLA_RISK"
    ]);
    if (escalations.length > 0) {
      const allSourceKeys = escalations.map((e) => e.sourceKey);
      const latestActionLogs = await prisma.userActivityLog.findMany({
        where: {
          entityType: "COMMAND_CENTER_ESCALATION",
          entityId: { in: allSourceKeys }
        },
        orderBy: { createdAt: "desc" }
      });
      // Map: sourceKey → latest log entry (first occurrence = most recent due to desc order)
      const latestLogMap = new Map<string, any>();
      for (const log of latestActionLogs) {
        if (!latestLogMap.has(log.entityId)) {
          latestLogMap.set(log.entityId, log);
        }
      }
      for (const item of escalations) {
        const latestLog = latestLogMap.get(item.sourceKey);
        if (!latestLog) continue;
        const loggedAction: string = latestLog.action || "";
        let logData: any = {};
        try {
          logData = JSON.parse(latestLog.afterJson || "{}");
        } catch { /* invalid JSON — ignore */ }
        // Overlay status for synthetic types from latest CCC action
        if (SYNTHETIC_TYPES.has(item.sourceType)) {
          if (loggedAction === "ESCALATION_ACKNOWLEDGE") item.status = "ACKNOWLEDGED";
          else if (loggedAction === "ESCALATION_ASSIGN") item.status = "ASSIGNED";
          else if (loggedAction === "ESCALATION_RESOLVE") item.status = "RESOLVED";
          else if (loggedAction === "ESCALATION_CANCEL") item.status = "CANCELLED";
          // ESCALATION_COMMENT leaves status unchanged; ESCALATION_WORKFLOW_ACTION leaves status unchanged
        }
        // Overlay ownerId from latest ASSIGN action across all types
        if (loggedAction === "ESCALATION_ASSIGN" && logData.ownerId) {
          item.ownerId = logData.ownerId;
        }
      }
    }

    // Post-fetch Filters
    let filtered = escalations;
    if (severity !== "ALL") {
      filtered = filtered.filter((item) => item.severity === severity);
    }
    if (status !== "ALL") {
      filtered = filtered.filter((item) => item.status === status);
    }
    if (ownerId) {
      filtered = filtered.filter((item) => item.ownerId === ownerId);
    }
    if (overdueOnly) {
      filtered = filtered.filter((item) => item.isOverdue === true);
    }

    // Compute Summary Metrics Scorecard
    const summaryMetrics = {
      totalOpen: filtered.filter((i) => i.status !== "RESOLVED" && i.status !== "CANCELLED").length,
      criticalCount: filtered.filter((i) => i.severity === "CRITICAL" && i.status !== "RESOLVED").length,
      highCount: filtered.filter((i) => i.severity === "HIGH" && i.status !== "RESOLVED").length,
      overdueCount: filtered.filter((i) => i.isOverdue && i.status !== "RESOLVED").length,
      unassignedCount: filtered.filter((i) => !i.ownerId && i.status !== "RESOLVED").length,
      resolvedTodayCount: filtered.filter((i) => i.status === "RESOLVED").length
    };

    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedEscalations = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      context: {
        businessDate: businessDateStr,
        operationType: operationType || "ALL",
        companyId: companyId || null,
        scopeIsolation: {
          userRole: user?.role || "USER",
          companyBound: Boolean(user?.companyId)
        }
      },
      summaryMetrics,
      pagination: {
        page,
        limit,
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / limit)
      },
      escalations: paginatedEscalations,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("COMMERCIAL ESCALATIONS LIST API ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch Commercial Command Center escalations." },
      { status: 500 }
    );
  }
}
