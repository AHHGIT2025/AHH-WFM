import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { isUserEligibleApprover } from "@/lib/workflow/approver-resolution";
import { WorkflowAdapterRegistry } from "@/lib/workflow/adapters/registry";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth();
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const approvalId = params.id;

    // 1. Check if ID is a WorkflowInstance.id or referenceId
    let instance = await prisma.workflowInstance.findUnique({
      where: { id: approvalId },
      include: {
        template: {
          include: {
            levels: {
              orderBy: { levelNumber: "asc" },
              include: { approvers: true }
            }
          }
        },
        history: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!instance) {
      instance = await prisma.workflowInstance.findFirst({
        where: { referenceId: approvalId },
        include: {
          template: {
            include: {
              levels: {
                orderBy: { levelNumber: "asc" },
                include: { approvers: true }
              }
            }
          },
          history: {
            orderBy: { createdAt: "asc" }
          }
        }
      });
    }

    if (instance) {
      if (user.companyId && !isSuperAdmin && instance.companyId && instance.companyId !== user.companyId) {
        return NextResponse.json({ success: false, error: "Forbidden: Company boundary violation" }, { status: 403 });
      }

      const adapter = WorkflowAdapterRegistry.getOrDefault(instance.moduleType);
      const businessSummary = await adapter.getBusinessSummary(instance.referenceId, instance.companyId);

      const levels = instance.template?.levels || [];
      const currentLevel = levels.find(l => l.levelNumber === instance.currentLevelNumber);
      const nextLevel = levels.find(l => l.levelNumber === instance.currentLevelNumber + 1);

      let canAct = false;
      if (instance.status === "IN_PROGRESS" && currentLevel) {
        const eligibility = await isUserEligibleApprover(user, currentLevel.approvers, {
          instanceCompanyId: instance.companyId,
          approvalRule: currentLevel.approvalRule
        });
        canAct = eligibility.isEligible;
      }

      const myHistories = instance.history.filter(h => h.actedBy === user.id);
      const latestMyAction = myHistories.length > 0 ? myHistories[myHistories.length - 1] : null;

      const lifecycle: any[] = [];
      const submitAction = instance.history.find(h => h.action === "SUBMIT");
      lifecycle.push({
        stepNumber: 0,
        title: "Request Submitted",
        actor: submitAction?.actedBy || businessSummary?.requesterName || "Requester",
        status: "COMPLETED",
        action: "SUBMIT",
        timestamp: submitAction?.createdAt?.toISOString() || instance.createdAt.toISOString(),
        remarks: submitAction?.remarks || "Submitted to workflow approval."
      });

      levels.forEach(lvl => {
        const historyForLevel = instance.history.filter(h => h.levelNumber === lvl.levelNumber && h.action !== "SUBMIT");
        const latestLevelAction = historyForLevel.length > 0 ? historyForLevel[historyForLevel.length - 1] : null;

        let status = "PENDING";
        if (instance.currentLevelNumber > lvl.levelNumber || instance.status === "APPROVED") {
          status = "APPROVED";
        } else if (instance.currentLevelNumber === lvl.levelNumber) {
          if (instance.status === "REJECTED") status = "REJECTED";
          else if (instance.status === "RETURNED") status = "RETURNED";
          else status = "CURRENT";
        } else {
          status = "NOT_STARTED";
        }

        const approversText = lvl.approvers.map(ap => ap.employeeName || ap.roleName || "Approver").join(", ");

        lifecycle.push({
          stepNumber: lvl.levelNumber,
          title: lvl.levelName || `Level ${lvl.levelNumber}`,
          actor: latestLevelAction?.actedBy || approversText,
          approvers: lvl.approvers.map(ap => ({ name: ap.employeeName || ap.roleName, role: ap.roleName })),
          status,
          action: latestLevelAction?.action || (status === "APPROVED" ? "APPROVE" : null),
          timestamp: latestLevelAction?.createdAt?.toISOString() || null,
          remarks: latestLevelAction?.remarks || (status === "CURRENT" ? "Pending review" : null)
        });
      });

      const currentApproverList = currentLevel?.approvers.map(ap => ({
        name: ap.employeeName || ap.roleName || "Approver",
        role: ap.roleName || "Approver",
        employeeId: ap.employeeId || undefined
      })) || [];

      return NextResponse.json({
        success: true,
        data: {
          instance: {
            id: instance.id,
            moduleType: instance.moduleType,
            referenceId: instance.referenceId,
            status: instance.status,
            currentLevelNumber: instance.currentLevelNumber,
            companyId: instance.companyId,
            createdAt: instance.createdAt.toISOString(),
            updatedAt: instance.updatedAt.toISOString(),
            workflowName: instance.template?.workflowName,
            versionInfo: `Template: ${instance.template?.workflowName || "Standard"}`
          },
          requestSummary: {
            reference: businessSummary?.reference || instance.referenceId,
            title: businessSummary?.title || `${instance.moduleType} #${instance.referenceId}`,
            subtitle: businessSummary?.subtitle,
            requesterName: businessSummary?.requesterName || "Requester",
            companyName: businessSummary?.companyName || "Al Hattab Holding",
            submittedAt: instance.createdAt.toISOString()
          },
          businessSummary: businessSummary?.keyFields || [],
          myAction: latestMyAction ? {
            action: latestMyAction.action,
            actionAt: latestMyAction.createdAt.toISOString(),
            remarks: latestMyAction.remarks,
            levelNumber: latestMyAction.levelNumber
          } : null,
          currentApproval: {
            status: instance.status,
            levelNumber: instance.currentLevelNumber,
            levelName: currentLevel?.levelName || `Level ${instance.currentLevelNumber}`,
            approvalRule: currentLevel?.approvalRule || "ANY_ONE",
            pendingSince: instance.createdAt.toISOString(),
            currentPendingApprover: currentLevel?.approvers.map(ap => ap.employeeName || ap.roleName).join(", ") || "Completed",
            currentPendingApprovers: currentApproverList
          },
          nextApproval: nextLevel ? {
            levelNumber: nextLevel.levelNumber,
            levelName: nextLevel.levelName,
            approver: nextLevel.approvers.map(ap => ap.employeeName || ap.roleName).join(", ")
          } : null,
          lifecycle,
          canAct,
          sourceDeepLink: adapter.getSourceDeepLink(instance.referenceId)
        }
      });
    }

    // 2. Fallback: Check Clearance Request by ID
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: approvalId },
      include: {
        approvalSteps: { orderBy: { stepOrder: "asc" } },
        employee: true
      }
    });

    if (clearance) {
      if (user.companyId && !isSuperAdmin && clearance.companyId && clearance.companyId !== user.companyId) {
        return NextResponse.json({ success: false, error: "Forbidden: Company boundary violation" }, { status: 403 });
      }

      const activeStep = clearance.approvalSteps.find(s => s.status === "PENDING");
      const canonicalEmployeeId = user.employeeId || user.id;
      const canAct = activeStep ? (
        activeStep.assignedApproverId === user.id ||
        activeStep.assignedApproverId === canonicalEmployeeId ||
        (!activeStep.assignedApproverId && activeStep.fallbackRole === user.role)
      ) : false;

      const clearanceHistory = await prisma.clearanceHistory.findMany({
        where: { clearanceRequestId: clearance.id },
        orderBy: { createdAt: "asc" }
      });

      const myHistory = clearanceHistory.filter(h => h.actorId === user.id);
      const latestMy = myHistory.length > 0 ? myHistory[myHistory.length - 1] : null;

      const empName = clearance.employeeNameSnapshot || clearance.employee?.name || clearance.employeeId;
      const empCode = clearance.employeeCodeSnapshot || "";

      const lifecycle = [
        {
          stepNumber: 0,
          title: "Clearance Created",
          actor: clearance.requestedById || "HR Officer",
          status: "COMPLETED",
          action: "SUBMIT",
          timestamp: clearance.requestDate.toISOString(),
          remarks: "Employee exit clearance initiated."
        },
        ...clearance.approvalSteps.map(s => ({
          stepNumber: s.stepOrder,
          title: s.sectionName,
          actor: s.actedById || s.assignedApproverId || s.fallbackRole || "Assigned Approver",
          status: s.status,
          action: s.status === "APPROVED" ? "APPROVE" : s.status === "REJECTED" ? "REJECT" : s.status === "RETURNED" ? "RETURN" : null,
          timestamp: s.actedAt ? s.actedAt.toISOString() : null,
          remarks: s.remarks || s.notes || null
        }))
      ];

      return NextResponse.json({
        success: true,
        data: {
          instance: {
            id: clearance.id,
            moduleType: "CLEARANCE",
            referenceId: clearance.id,
            status: clearance.status,
            currentLevelNumber: activeStep?.stepOrder || 1,
            companyId: clearance.companyId,
            createdAt: clearance.requestDate.toISOString(),
            updatedAt: clearance.requestDate.toISOString(),
            workflowName: "Employee Exit Clearance"
          },
          requestSummary: {
            reference: clearance.clearanceNumber || clearance.id,
            title: `Employee Clearance (${empName})`,
            subtitle: `${empCode} · ${clearance.clearanceType || "Exit Clearance"}`,
            requesterName: clearance.requestedById || "HR Officer",
            companyName: "Al Hattab Holding",
            submittedAt: clearance.requestDate.toISOString()
          },
          businessSummary: [
            { label: "Employee Name", value: empName },
            { label: "Employee Code", value: empCode },
            { label: "Clearance Type", value: clearance.clearanceType || "Exit" },
            { label: "Status", value: clearance.status, badge: clearance.status }
          ],
          myAction: latestMy ? {
            action: latestMy.actionType,
            actionAt: latestMy.createdAt.toISOString(),
            remarks: latestMy.details,
            levelNumber: 1
          } : null,
          currentApproval: {
            status: clearance.status,
            levelNumber: activeStep?.stepOrder || 1,
            levelName: activeStep?.sectionName || "Completed",
            approvalRule: "ANY_ONE",
            pendingSince: activeStep?.createdAt ? activeStep.createdAt.toISOString() : clearance.requestDate.toISOString(),
            currentPendingApprover: activeStep ? (activeStep.assignedApproverId || activeStep.fallbackRole || "Approver") : "Completed",
            currentPendingApprovers: activeStep ? [{ name: activeStep.assignedApproverId || activeStep.fallbackRole || "Approver", role: activeStep.fallbackRole || "Approver" }] : []
          },
          nextApproval: null,
          lifecycle,
          canAct,
          sourceDeepLink: `/clearance/${clearance.id}`
        }
      });
    }

    return NextResponse.json({ success: false, error: "Approval request not found" }, { status: 404 });
  } catch (error: any) {
    console.error("GET /api/v1/approvals/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
