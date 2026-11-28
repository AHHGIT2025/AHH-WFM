import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth, checkRecordCompanyAccess, resolveCompanyScope } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { isUserEligibleApprover } from "@/lib/workflow/approver-resolution";

function isOperationScopePermitted(user: any, operationScope: string | null | undefined): boolean {
  if (!operationScope) return true;
  if (isAdminUser(user) || hasPermission(user, "manpower.admin.full_access")) return true;
  const scope = operationScope.toUpperCase().trim();
  const allowedSG = user?.operationAccess?.allowedSecurityGuarding ?? user?.allowedSecurityGuarding ?? true;
  const allowedFM = user?.operationAccess?.allowedFacilityManagement ?? user?.allowedFacilityManagement ?? true;
  if (scope === "SECURITY_GUARDING" && !allowedSG) return false;
  if (scope === "FACILITY_MANAGEMENT" && !allowedFM) return false;
  return true;
}

function buildActorIdentityTokens(user: any): string[] {
  return Array.from(
    new Set(
      [user?.id, user?.employeeId, user?.email, user?.name]
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim())
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkApiAuth();
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const companyScope = resolveCompanyScope(user, { allowSuperAdminOnly: true });
    if (companyScope.error) return companyScope.error;

    // 1. Count Central Workflow Instances pending for this user
    const pendingInstances = await prisma.workflowInstance.findMany({
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
        }
      }
    });

    let pendingCount = 0;
    for (const inst of pendingInstances) {
      if (!isOperationScopePermitted(user, inst.operationScope)) continue;
      const activeLevel = inst.template?.levels?.find(l => l.levelNumber === inst.currentLevelNumber);
      if (activeLevel) {
        const eligibility = await isUserEligibleApprover(user, activeLevel.approvers, {
          instanceCompanyId: inst.companyId,
          approvalRule: activeLevel.approvalRule
        });
        if (eligibility.isEligible) {
          pendingCount++;
        }
      }
    }

    // 2. Count Clearance Steps pending for this user
    try {
      const canonicalEmployeeId = user.employeeId || user.id;
      const pendingClearanceSteps = await prisma.clearanceApprovalStep.count({
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
        }
      });
      pendingCount += pendingClearanceSteps;
    } catch (e) {
      // Ignore if clearance tables empty
    }

    // 3. Count Outbox actions taken by current user (deduplicated by instanceId to match outbox list)
    const actorTokens = buildActorIdentityTokens(user);
    const centralOutboxHistories = actorTokens.length === 0
      ? []
      : await prisma.workflowActionHistory.findMany({
          where: {
            actedBy: { in: actorTokens },
            action: { in: ["APPROVE", "REJECT", "RETURN", "MARK_NOT_APPLICABLE"] }
          },
          select: {
            instanceId: true,
            instance: {
              select: { id: true, companyId: true, operationScope: true }
            }
          }
        });
    const seenOutboxInstances = new Set<string>();
    for (const h of centralOutboxHistories) {
      if (!h.instance || seenOutboxInstances.has(h.instance.id)) continue;
      if (checkRecordCompanyAccess(user, h.instance.companyId, { allowSuperAdminOnly: true })) {
        continue;
      }
      if (!isOperationScopePermitted(user, h.instance.operationScope)) {
        continue;
      }
      seenOutboxInstances.add(h.instance.id);
    }
    const actionedCountCentral = seenOutboxInstances.size;

    let actionedCountClearance = 0;
    try {
      actionedCountClearance = actorTokens.length === 0
        ? 0
        : await prisma.clearanceApprovalResponse.count({
            where: {
              actorId: { in: actorTokens },
              actionType: { in: ["APPROVE", "REJECT", "RETURN", "MARK_NOT_APPLICABLE"] }
            }
          });
    } catch (e) {}

    const totalActioned = actionedCountCentral + actionedCountClearance;

    return NextResponse.json({
      success: true,
      data: {
        pendingCount,
        actionedCount: totalActioned
      }
    });
  } catch (error: any) {
    console.error("GET /api/v1/approvals/counts error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
