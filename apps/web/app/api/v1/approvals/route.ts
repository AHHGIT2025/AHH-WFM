import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth, checkRecordCompanyAccess, resolveCompanyScope } from "@/lib/api-guards";
import { isUserEligibleApprover } from "@/lib/workflow/approver-resolution";
import { WorkflowAdapterRegistry } from "@/lib/workflow/adapters/registry";
import { isOperationScopePermitted, resolveVerifiedActorTokens } from "@/lib/workflow/actor-identity";

const ARCHIVED_SOURCE_STATUSES = new Set(["CANCELLED", "SUPERSEDED", "ARCHIVED", "LOST"]);

function classifyOutboxSourceState(
  summary: any,
  workflowStatus: string
): { sourceState: "ACTIVE" | "HISTORICAL" | "ARCHIVED" | "MISSING_SOURCE"; sourceStateLabel: string } {
  if (!summary) {
    return { sourceState: "MISSING_SOURCE", sourceStateLabel: "Missing / Orphaned Source" };
  }
  const raw = summary.rawDetails || {};
  const candidateStatuses = [
    raw.c?.lifecycle,
    raw.c?.businessOutcome,
    raw.estimate?.status,
    raw.estimate?.case?.lifecycle,
    raw.estimate?.case?.businessOutcome,
    raw.proposal?.status,
    raw.proposal?.case?.lifecycle,
    raw.proposal?.case?.businessOutcome,
    raw.contract?.status
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.toUpperCase().trim());

  if (candidateStatuses.some((s) => ARCHIVED_SOURCE_STATUSES.has(s))) {
    return { sourceState: "ARCHIVED", sourceStateLabel: "Archived / Superseded Source" };
  }

  const wf = (workflowStatus || "").toUpperCase();
  if (wf === "APPROVED" || wf === "REJECTED" || wf === "COMPLETED") {
    return { sourceState: "HISTORICAL", sourceStateLabel: "Completed Historical Audit" };
  }

  return { sourceState: "ACTIVE", sourceStateLabel: "Active Workflow" };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkApiAuth();
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const companyScope = resolveCompanyScope(user, { allowSuperAdminOnly: true });
    if (companyScope.error) return companyScope.error;
    const { searchParams } = new URL(request.url);

    const tab = searchParams.get("tab") || "inbox"; // "inbox" | "outbox"
    const view = (searchParams.get("view") || "all").toLowerCase().trim(); // "all" | "active" | "history"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));
    const search = searchParams.get("search")?.toLowerCase().trim() || "";
    const moduleFilter = searchParams.get("module")?.toUpperCase().trim() || "";
    const statusFilter = searchParams.get("status")?.toUpperCase().trim() || "";

    if (tab === "outbox") {
      // =========================================================================
      // OUTBOX QUERY: Workflows where current user took an approval action
      // Preserves full immutable historical audit while classifying source state.
      // =========================================================================
      const outboxItems: any[] = [];
      const actorTokens = await resolveVerifiedActorTokens(user);

      // 1. Central Workflow Instances
      const centralHistories = actorTokens.length === 0
        ? []
        : await prisma.workflowActionHistory.findMany({
            where: {
              actedBy: { in: actorTokens },
              action: { in: ["APPROVE", "REJECT", "RETURN", "MARK_NOT_APPLICABLE"] }
            },
            include: {
              instance: {
                include: {
                  template: {
                    include: {
                      levels: {
                        orderBy: { levelNumber: "asc" },
                        include: { approvers: true }
                      }
                    }
                  }
                }
              }
            },
            orderBy: { createdAt: "desc" }
          });

      // Deduplicate by instanceId (take most recent action per instance)
      const seenInstances = new Set<string>();
      for (const h of centralHistories) {
        if (!h.instance || seenInstances.has(h.instance.id)) continue;
        seenInstances.add(h.instance.id);

        const inst = h.instance;
        if (checkRecordCompanyAccess(user, inst.companyId, { allowSuperAdminOnly: true })) {
          continue;
        }
        if (!isOperationScopePermitted(user, inst.operationScope)) {
          continue;
        }

        const adapter = WorkflowAdapterRegistry.getOrDefault(inst.moduleType);
        const summary = await adapter.getBusinessSummary(inst.referenceId, inst.companyId);
        const { sourceState, sourceStateLabel } = classifyOutboxSourceState(summary, inst.status);
        const hasValidSourceLink = sourceState !== "MISSING_SOURCE";

        const activeLevel = inst.template?.levels?.find(l => l.levelNumber === inst.currentLevelNumber);
        const pendingApproverNames = activeLevel?.approvers?.map(ap => ap.employeeName || ap.roleName || "Assigned Approver").join(", ") || "Completed / Terminal";

        outboxItems.push({
          approvalKey: `WI:${inst.id}`,
          id: inst.id,
          sourceModule: inst.moduleType,
          sourceId: inst.referenceId,
          reference: summary?.reference || inst.referenceId,
          subject: summary?.title || `${inst.moduleType} #${inst.referenceId}`,
          requesterName: summary?.requesterName || "Requester",
          companyName: summary?.companyName || "Al Hattab Holding",
          operationScope: inst.operationScope || null,
          sourceState,
          sourceStateLabel,
          hasValidSourceLink,
          myAction: h.action,
          myActionAt: h.createdAt.toISOString(),
          myActionRemarks: h.remarks,
          currentWorkflowStatus: inst.status,
          currentLevelNumber: inst.currentLevelNumber,
          currentPendingApprover: inst.status === "IN_PROGRESS" ? `Level ${inst.currentLevelNumber}: ${pendingApproverNames}` : "Completed",
          finalStatus: inst.status === "APPROVED" ? "Approved" : inst.status === "REJECTED" ? "Rejected" : inst.status === "RETURNED" ? "Returned" : "In Progress",
          deepLink: hasValidSourceLink ? adapter.getSourceDeepLink(inst.referenceId) : null,
          updatedAt: inst.updatedAt ? inst.updatedAt.toISOString() : h.createdAt.toISOString()
        });
      }

      // 2. Clearance Outbox Actions
      try {
        const clearanceResponses = actorTokens.length === 0
          ? []
          : await prisma.clearanceApprovalResponse.findMany({
              where: {
                actorId: { in: actorTokens },
                actionType: { in: ["APPROVE", "REJECT", "RETURN", "MARK_NOT_APPLICABLE"] }
              },
              include: {
                step: {
                  include: {
                    clearanceRequest: {
                      include: { approvalSteps: true }
                    }
                  }
                }
              },
              orderBy: { createdAt: "desc" }
            });

        const seenClearances = new Set<string>();
        for (const resp of clearanceResponses) {
          const req = resp.step?.clearanceRequest;
          if (!req || seenClearances.has(req.id)) continue;
          seenClearances.add(req.id);

          if (checkRecordCompanyAccess(user, req.companyId, { allowSuperAdminOnly: true })) {
            continue;
          }

          const adapter = WorkflowAdapterRegistry.getOrDefault("CLEARANCE");
          const summary = await adapter.getBusinessSummary(req.id, req.companyId);

          const pendingStep = req.approvalSteps?.find(s => s.status === "PENDING");
          const empName = req.employeeNameSnapshot || req.employeeId;
          const isTerminal = req.status === "COMPLETED" || req.status === "REJECTED";

          outboxItems.push({
            approvalKey: `CLEARANCE:${req.id}`,
            id: req.id,
            sourceModule: "CLEARANCE",
            sourceId: req.id,
            reference: req.clearanceNumber || req.id,
            subject: `Employee Clearance (${empName})`,
            requesterName: req.requestedById || "HR",
            companyName: "Al Hattab Holding",
            operationScope: null,
            sourceState: isTerminal ? "HISTORICAL" : "ACTIVE",
            sourceStateLabel: isTerminal ? "Completed Historical Audit" : "Active Workflow",
            hasValidSourceLink: true,
            myAction: resp.actionType,
            myActionAt: resp.createdAt.toISOString(),
            myActionRemarks: resp.remarks,
            currentWorkflowStatus: req.status,
            currentLevelNumber: resp.step?.stepOrder || 1,
            currentPendingApprover: pendingStep ? `Step: ${pendingStep.sectionName}` : "Completed",
            finalStatus: req.status === "COMPLETED" ? "Approved" : req.status === "REJECTED" ? "Rejected" : req.status === "RETURNED_FOR_CORRECTION" ? "Returned" : "In Progress",
            deepLink: `/clearance/${req.id}`,
            updatedAt: resp.createdAt.toISOString()
          });
        }
      } catch (e) {}

      // Apply filtering
      let filtered = outboxItems;
      if (view === "active") {
        filtered = filtered.filter(it => it.sourceState === "ACTIVE");
      } else if (view === "history") {
        filtered = filtered.filter(it => it.sourceState !== "ACTIVE");
      }
      if (search) {
        filtered = filtered.filter(it => 
          it.reference.toLowerCase().includes(search) ||
          it.subject.toLowerCase().includes(search) ||
          it.requesterName.toLowerCase().includes(search)
        );
      }
      if (moduleFilter && moduleFilter !== "ALL") {
        filtered = filtered.filter(it => it.sourceModule.includes(moduleFilter));
      }
      if (statusFilter && statusFilter !== "ALL") {
        filtered = filtered.filter(it => it.currentWorkflowStatus === statusFilter);
      }

      // Sort by most recent action desc
      filtered.sort((a, b) => new Date(b.myActionAt).getTime() - new Date(a.myActionAt).getTime());

      const total = filtered.length;
      const totalPages = Math.ceil(total / pageSize) || 1;
      const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

      return NextResponse.json({
        success: true,
        data: paginated,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        }
      });
    }

    // =========================================================================
    // INBOX QUERY: Active actionable tasks assigned to current user
    // =========================================================================
    const inboxItems: any[] = [];

    // 1. Central Workflow Instances
    const inProgressInstances = await prisma.workflowInstance.findMany({
      where: {
        status: "IN_PROGRESS",
        ...(companyScope.companyId ? { companyId: companyScope.companyId } : {})
      },
      include: {
        template: {
          include: {
            levels: {
              orderBy: { levelNumber: "asc" },
              include: { approvers: true }
            }
          }
        },
        history: true
      },
      orderBy: { createdAt: "desc" }
    });

    for (const inst of inProgressInstances) {
      if (!isOperationScopePermitted(user, inst.operationScope)) continue;
      const activeLevel = inst.template?.levels?.find(l => l.levelNumber === inst.currentLevelNumber);
      if (!activeLevel) continue;

      const eligibility = await isUserEligibleApprover(user, activeLevel.approvers, {
        instanceCompanyId: inst.companyId,
        approvalRule: activeLevel.approvalRule
      });

      if (eligibility.isEligible) {
        const adapter = WorkflowAdapterRegistry.getOrDefault(inst.moduleType);
        const summary = await adapter.getBusinessSummary(inst.referenceId, inst.companyId);

        const currentApproverList = activeLevel.approvers.map(ap => ({
          name: ap.employeeName || ap.roleName || "Approver",
          role: ap.roleName || "Approver",
          employeeId: ap.employeeId || undefined
        }));

        inboxItems.push({
          approvalKey: `WI:${inst.id}`,
          id: inst.id,
          sourceModule: inst.moduleType,
          sourceId: inst.referenceId,
          reference: summary?.reference || inst.referenceId,
          subject: summary?.title || `${inst.moduleType} #${inst.referenceId}`,
          subtitle: summary?.subtitle,
          requesterName: summary?.requesterName || "Requester",
          companyName: summary?.companyName || "Al Hattab Holding",
          currentLevelNumber: inst.currentLevelNumber,
          currentLevelName: activeLevel.levelName || `Level ${inst.currentLevelNumber}`,
          currentPendingApprover: activeLevel.approvers.map(ap => ap.employeeName || ap.roleName).join(", "),
          currentPendingApprovers: currentApproverList,
          pendingSince: inst.createdAt.toISOString(),
          status: "IN_PROGRESS",
          canAct: true,
          deepLink: adapter.getSourceDeepLink(inst.referenceId),
          createdAt: inst.createdAt.toISOString()
        });
      }
    }

    // 2. Clearance Pending Steps
    try {
      const canonicalEmployeeId = user.employeeId || user.id;
      const pendingClearanceSteps = await prisma.clearanceApprovalStep.findMany({
        where: {
          status: "PENDING",
          clearanceRequest: {
            status: "IN_PROGRESS",
            ...(companyScope.companyId ? { companyId: companyScope.companyId } : {})
          },
          OR: [
            { assignedApproverId: user.id },
            { assignedApproverId: canonicalEmployeeId },
            {
              assignedApproverId: null,
              fallbackRole: user.role
            }
          ]
        },
        include: {
          clearanceRequest: true
        },
        orderBy: { createdAt: "desc" }
      });

      for (const step of pendingClearanceSteps) {
        const req = step.clearanceRequest;
        if (!req) continue;

        const empName = req.employeeNameSnapshot || req.employeeId;
        const empCode = req.employeeCodeSnapshot || "";

        inboxItems.push({
          approvalKey: `CLEARANCE:${req.id}:${step.id}`,
          id: req.id,
          stepId: step.id,
          sourceModule: "CLEARANCE",
          sourceId: req.id,
          reference: req.clearanceNumber || req.id,
          subject: `Employee Clearance (${empName}) - Step: ${step.sectionName}`,
          subtitle: `${empCode} · ${req.clearanceType || "Exit Clearance"}`,
          requesterName: req.requestedById || "HR Officer",
          companyName: "Al Hattab Holding",
          currentLevelNumber: step.stepOrder,
          currentLevelName: step.sectionName,
          currentPendingApprover: user.name || user.role || "Assigned Approver",
          currentPendingApprovers: [{ name: user.name || "Assigned Approver", role: user.role || "Approver" }],
          pendingSince: step.createdAt ? step.createdAt.toISOString() : req.requestDate.toISOString(),
          status: "PENDING_APPROVAL",
          canAct: true,
          deepLink: `/clearance/${req.id}`,
          createdAt: req.requestDate ? req.requestDate.toISOString() : new Date().toISOString()
        });
      }
    } catch (e) {}

    // Apply filtering
    let filtered = inboxItems;
    if (search) {
      filtered = filtered.filter(it => 
        it.reference.toLowerCase().includes(search) ||
        it.subject.toLowerCase().includes(search) ||
        it.requesterName.toLowerCase().includes(search)
      );
    }
    if (moduleFilter && moduleFilter !== "ALL") {
      filtered = filtered.filter(it => it.sourceModule.includes(moduleFilter));
    }

    // Default Inbox Ordering: newest first
    filtered.sort((a, b) => new Date(b.pendingSince).getTime() - new Date(a.pendingSince).getTime());

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      success: true,
      data: paginated,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error: any) {
    console.error("GET /api/v1/approvals error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
