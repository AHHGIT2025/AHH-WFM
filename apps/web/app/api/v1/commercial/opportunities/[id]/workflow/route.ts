import { NextResponse } from "next/server";
import { prisma, PreContractLifecycle } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.workflow.submit") ||
    hasPermission(user, "precontract.workflow.review") ||
    hasPermission(user, "precontract.workflow.approve") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to execute commercial opportunity workflow actions." },
      { status: 403 }
    );
  }

  const caseId = params.id;

  try {
    const body = await request.json();
    const { action, remarks } = body; // action: "SUBMIT", "APPROVE", "REJECT", "RETURN"

    if (!action || !["SUBMIT", "APPROVE", "REJECT", "RETURN"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Allowed actions: SUBMIT, APPROVE, REJECT, RETURN." },
        { status: 400 }
      );
    }

    const opportunityCase = await prisma.preContractCase.findUnique({
      where: { id: caseId }
    });

    if (!opportunityCase) {
      return NextResponse.json(
        { error: "Opportunity case not found." },
        { status: 404 }
      );
    }

    // Company boundary check
    if (user?.companyId && !isAdminUser(user) && opportunityCase.companyId && opportunityCase.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation." }, { status: 403 });
    }

    // Find or create central WorkflowInstance configured in Settings > Workflow Setup
    let workflowInstance = await prisma.workflowInstance.findFirst({
      where: {
        referenceId: caseId,
        moduleType: "PRE_CONTRACT_CASE"
      },
      include: { history: true }
    });

    if (!workflowInstance && action === "SUBMIT") {
      // Find or create matching template configured in Settings > Workflow Setup
      let template = await prisma.workflowTemplate.findFirst({
        where: {
          isActive: true,
          OR: [
            { moduleType: "PRE_CONTRACT_CASE" },
            { moduleType: "COMMERCIAL_OPPORTUNITY" }
          ]
        }
      });

      if (!template) {
        template = await prisma.workflowTemplate.create({
          data: {
            workflowName: "Commercial Case Approval Workflow",
            moduleType: "PRE_CONTRACT_CASE",
            appliesTo: "ACTIVATION",
            isDefault: true,
            isActive: true,
            remarks: "Centralized commercial case approval workflow configured under Settings > Workflow Setup."
          }
        });
      }

      workflowInstance = await prisma.workflowInstance.create({
        data: {
          templateId: template.id,
          moduleType: "PRE_CONTRACT_CASE",
          referenceId: caseId,
          status: "IN_PROGRESS",
          currentLevelNumber: 1,
          companyId: opportunityCase.companyId,
          operationScope: opportunityCase.operationType
        },
        include: { history: true }
      });
    }

    let newCaseLifecycle: PreContractLifecycle = opportunityCase.lifecycle;
    let newWorkflowStatus = workflowInstance?.status || "IN_PROGRESS";

    if (action === "SUBMIT") {
      newCaseLifecycle = "IN_WORKFLOW";
      newWorkflowStatus = "IN_PROGRESS";
    } else if (action === "APPROVE") {
      newCaseLifecycle = "COMPLETED";
      newWorkflowStatus = "APPROVED";
    } else if (action === "REJECT") {
      newCaseLifecycle = "CANCELLED";
      newWorkflowStatus = "REJECTED";
    } else if (action === "RETURN") {
      newCaseLifecycle = "DRAFT";
      newWorkflowStatus = "RETURNED";
    }

    // Record immutable audit history
    if (workflowInstance) {
      await prisma.workflowActionHistory.create({
        data: {
          instanceId: workflowInstance.id,
          levelNumber: workflowInstance.currentLevelNumber,
          action,
          actedBy: user?.name || user?.email || user?.id || "USER",
          remarks: remarks?.trim() || `Workflow action ${action} executed.`
        }
      });

      await prisma.workflowInstance.update({
        where: { id: workflowInstance.id },
        data: {
          status: newWorkflowStatus,
          updatedAt: new Date()
        }
      });
    }

    // Update opportunity case lifecycle & workflow reference
    const updatedCase = await prisma.preContractCase.update({
      where: { id: caseId },
      data: {
        lifecycle: newCaseLifecycle,
        workflowInstanceId: workflowInstance?.id || null,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      case: updatedCase,
      workflow: {
        instanceId: workflowInstance?.id,
        action,
        status: newWorkflowStatus,
        actedBy: user?.name || user?.email,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("COMMERCIAL OPPORTUNITIES WORKFLOW ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute workflow action." },
      { status: 500 }
    );
  }
}
