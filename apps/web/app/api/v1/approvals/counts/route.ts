import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { isUserEligibleApprover } from "@/lib/workflow/approver-resolution";

export async function GET(request: NextRequest) {
  try {
    const auth = await checkApiAuth();
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    // 1. Count Central Workflow Instances pending for this user
    const pendingInstances = await prisma.workflowInstance.findMany({
      where: {
        status: "IN_PROGRESS",
        ...(user.companyId && !isSuperAdmin ? { companyId: user.companyId } : {})
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
            ...(user.companyId && !isSuperAdmin ? { companyId: user.companyId } : {})
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
    const centralOutboxHistories = await prisma.workflowActionHistory.findMany({
      where: {
        actedBy: user.id,
        action: { in: ["APPROVE", "REJECT", "RETURN", "MARK_NOT_APPLICABLE"] }
      },
      select: {
        instanceId: true,
        instance: {
          select: { id: true, companyId: true }
        }
      }
    });
    const seenOutboxInstances = new Set<string>();
    for (const h of centralOutboxHistories) {
      if (!h.instance || seenOutboxInstances.has(h.instance.id)) continue;
      if (user.companyId && !isSuperAdmin && h.instance.companyId && h.instance.companyId !== user.companyId) {
        continue;
      }
      seenOutboxInstances.add(h.instance.id);
    }
    const actionedCountCentral = seenOutboxInstances.size;

    let actionedCountClearance = 0;
    try {
      actionedCountClearance = await prisma.clearanceApprovalResponse.count({
        where: {
          actorId: user.id,
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
