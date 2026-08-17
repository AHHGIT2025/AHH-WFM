import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { WorkflowEngine } from "@/lib/workflow-engine";
import { WorkflowAdapterRegistry } from "@/lib/workflow/adapters/registry";
import { executeClearanceApprove, executeClearanceReject, executeClearanceReturn, executeClearanceMarkNotApplicable } from "@/lib/clearance-execution";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth();
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const approvalId = params.id;

    const body = await request.json().catch(() => ({}));
    const { action, remarks } = body; // "APPROVE" | "RETURN" | "REJECT" | "MARK_NOT_APPLICABLE"

    if (!action || !["APPROVE", "RETURN", "REJECT", "MARK_NOT_APPLICABLE"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action. Allowed: APPROVE, RETURN, REJECT, MARK_NOT_APPLICABLE" }, { status: 400 });
    }

    // 1. Check if ID is a WorkflowInstance
    let instance = await prisma.workflowInstance.findUnique({
      where: { id: approvalId }
    });

    if (!instance) {
      instance = await prisma.workflowInstance.findFirst({
        where: { referenceId: approvalId }
      });
    }

    if (instance) {
      // Fail closed if MARK_NOT_APPLICABLE is sent to central workflow
      if (action === "MARK_NOT_APPLICABLE") {
        return NextResponse.json({ success: false, error: "MARK_NOT_APPLICABLE is not supported for generic central workflows." }, { status: 400 });
      }

      // Company boundary check
      if (user.companyId && !isSuperAdmin && instance.companyId && instance.companyId !== user.companyId) {
        return NextResponse.json({ success: false, error: "Forbidden: Company boundary violation" }, { status: 403 });
      }

      if (instance.status !== "IN_PROGRESS") {
        return NextResponse.json({ success: false, error: `Workflow is no longer pending (Current status: ${instance.status})` }, { status: 409 });
      }

      // Execute action through authoritative central WorkflowEngine
      try {
        const updatedInstance = await WorkflowEngine.executeAction({
          instanceId: instance.id,
          action: action as any,
          user: {
            id: user.id,
            employeeId: user.employeeId,
            role: user.role,
            companyId: user.companyId
          },
          remarks
        });

        // Synchronize source record status via adapter
        const adapter = WorkflowAdapterRegistry.get(instance.moduleType);
        if (adapter && adapter.onWorkflowStatusChange) {
          await adapter.onWorkflowStatusChange(instance.referenceId, action as any, updatedInstance.status, remarks);
        }

        return NextResponse.json({
          success: true,
          message: `Action ${action} executed successfully.`,
          data: {
            instanceId: updatedInstance.id,
            status: updatedInstance.status,
            currentLevelNumber: updatedInstance.currentLevelNumber
          }
        });
      } catch (wfErr: any) {
        const isUnsupported = wfErr.message?.startsWith("UNSUPPORTED_WORKFLOW_RULE");
        return NextResponse.json({ success: false, error: wfErr.message }, { status: isUnsupported ? 400 : 403 });
      }
    }

    // 2. Fallback: Check Clearance Request
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: approvalId },
      include: { approvalSteps: true }
    });

    if (clearance) {
      if (user.companyId && !isSuperAdmin && clearance.companyId && clearance.companyId !== user.companyId) {
        return NextResponse.json({ success: false, error: "Forbidden: Company boundary violation" }, { status: 403 });
      }

      let res;
      if (action === "APPROVE") {
        res = await executeClearanceApprove(clearance.id, user, { remarks, stepId: body.stepId });
      } else if (action === "REJECT") {
        res = await executeClearanceReject(clearance.id, user, { remarks, stepId: body.stepId });
      } else if (action === "RETURN") {
        res = await executeClearanceReturn(clearance.id, user, { remarks, stepId: body.stepId });
      } else if (action === "MARK_NOT_APPLICABLE") {
        res = await executeClearanceMarkNotApplicable(clearance.id, user, { remarks, stepId: body.stepId });
      }

      if (res && !res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: res.status || 400 });
      }

      return NextResponse.json({
        success: true,
        message: `Clearance action ${action} executed successfully.`
      });
    }

    return NextResponse.json({ success: false, error: "Approval item not found" }, { status: 404 });
  } catch (error: any) {
    console.error("POST /api/v1/approvals/[id]/action error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to execute action" }, { status: 500 });
  }
}
