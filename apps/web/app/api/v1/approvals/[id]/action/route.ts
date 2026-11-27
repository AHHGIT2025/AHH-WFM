import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth, checkRecordCompanyAccess } from "@/lib/api-guards";
import { WorkflowEngine } from "@/lib/workflow-engine";
import { WorkflowAdapterRegistry } from "@/lib/workflow/adapters/registry";
import { executeClearanceApprove, executeClearanceReject, executeClearanceReturn, executeClearanceMarkNotApplicable } from "@/lib/clearance-execution";
import { assessCostingValidation, formatCostingValidationBlockError } from "@/lib/precontract-costing";
import { validateSurveyStaffingForSubmission } from "@/lib/survey-validation";
import { findConflictingActiveSurvey, formatDuplicateSurveyMessage } from "@/lib/survey-uniqueness";
import { checkOpportunityEligibilityForSurvey } from "@/lib/survey-eligibility";

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

      // Company boundary check (fail closed)
      const companyErr = checkRecordCompanyAccess(user, instance.companyId, { allowSuperAdminOnly: true });
      if (companyErr) {
        return companyErr;
      }

      if (instance.status !== "IN_PROGRESS") {
        return NextResponse.json({ success: false, error: `Workflow is no longer pending (Current status: ${instance.status})` }, { status: 409 });
      }

      // Resolve creatorId for SoD enforcement on pre-contract modules
      let creatorId: string | null = null;
      if (instance.moduleType === "PRE_CONTRACT_CASE" || instance.moduleType === "COMMERCIAL_OPPORTUNITY") {
        const opp = await prisma.preContractCase.findUnique({
          where: { id: instance.referenceId },
          select: { createdBy: true }
        });
        creatorId = opp?.createdBy || null;
      } else if (instance.moduleType === "SITE_SURVEY" || instance.moduleType === "PRE_CONTRACT_SURVEY") {
        const srv = await prisma.preContractSurvey.findUnique({
          where: { id: instance.referenceId },
          select: {
            conductedBy: true,
            caseId: true,
            prospectiveSiteId: true,
            responses: true,
            case: { select: { lifecycle: true, businessOutcome: true } }
          }
        });
        creatorId = srv?.conductedBy || null;
        if (action === "APPROVE" && srv) {
          const eligibility = checkOpportunityEligibilityForSurvey(srv.case);
          if (!eligibility.eligible) {
            return NextResponse.json(
              {
                success: false,
                error: eligibility.errorMessage
              },
              { status: 400 }
            );
          }

          const conflictingSurvey = await findConflictingActiveSurvey(prisma, {
            caseId: srv.caseId,
            prospectiveSiteId: srv.prospectiveSiteId,
            excludeSurveyId: instance.referenceId
          });
          if (conflictingSurvey) {
            return NextResponse.json(
              {
                success: false,
                error: formatDuplicateSurveyMessage(conflictingSurvey.lifecycle),
                existingSurveyId: conflictingSurvey.id,
                existingLifecycle: conflictingSurvey.lifecycle
              },
              { status: 409 }
            );
          }

          const staffingValidation = validateSurveyStaffingForSubmission(srv.responses);
          if (!staffingValidation.valid) {
            return NextResponse.json(
              {
                success: false,
                error: staffingValidation.errorMessage,
                missingFields: staffingValidation.missingFields
              },
              { status: 400 }
            );
          }
        }
      } else if (instance.moduleType === "PRE_CONTRACT_COSTING" || instance.moduleType === "COMMERCIAL_COSTING" || instance.moduleType === "COSTING") {
        const est = await prisma.preContractCostEstimate.findUnique({
          where: { id: instance.referenceId },
          select: {
            createdBy: true,
            survey: { select: { responses: true } },
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
              select: {
                createdBy: true,
                status: true,
                costConfigVersionId: true,
                items: true,
                overrides: true
              }
            }
          }
        });
        creatorId = est?.versions?.[0]?.createdBy || est?.createdBy || null;
        if (action === "APPROVE" && est?.versions?.[0]) {
          const validationSummary = assessCostingValidation(est.survey?.responses, est.versions[0]);
          if (validationSummary.blocksCommercialSubmission) {
            return NextResponse.json(
              {
                success: false,
                error: formatCostingValidationBlockError(validationSummary, "approval"),
                validationSummary
              },
              { status: 400 }
            );
          }
        }
      } else if (instance.moduleType === "COMMERCIAL_PROPOSAL" || instance.moduleType === "PRE_CONTRACT_PROPOSAL") {
        const prop = await prisma.preContractProposal.findUnique({
          where: { id: instance.referenceId },
          select: {
            createdBy: true,
            versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { createdBy: true } }
          }
        });
        creatorId = prop?.versions?.[0]?.createdBy || prop?.createdBy || null;
      }

      // Execute action + business lifecycle sync atomically inside a single transaction
      try {
        const updatedInstance = await prisma.$transaction(async (tx) => {
          const updated = await WorkflowEngine.executeAction({
            instanceId: instance!.id,
            action: action as any,
            user: {
              id: user.id,
              employeeId: user.employeeId,
              role: user.role,
              companyId: user.companyId
            },
            remarks,
            creatorId,
            tx
          });

          const adapter = WorkflowAdapterRegistry.get(instance!.moduleType);
          if (adapter && adapter.onWorkflowStatusChange) {
            await adapter.onWorkflowStatusChange(instance!.referenceId, action as any, updated.status, remarks, tx);
          }

          await tx.userActivityLog.create({
            data: {
              userId: user.id || "system",
              action: `WORKFLOW_${action}`,
              entityType: instance!.moduleType,
              entityId: instance!.referenceId,
              afterJson: JSON.stringify({
                instanceId: updated.id,
                action,
                status: updated.status,
                currentLevelNumber: updated.currentLevelNumber,
                remarks: remarks || null
              })
            }
          });

          return updated;
        });

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
        const isNotPending = wfErr.message?.includes("not pending") || wfErr.message?.includes("Invalid or closed");
        return NextResponse.json({ success: false, error: wfErr.message }, { status: isUnsupported ? 400 : isNotPending ? 409 : 403 });
      }
    }

    // 2. Fallback: Check Clearance Request
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: approvalId },
      include: { approvalSteps: true }
    });

    if (clearance) {
      const clearanceCompanyErr = checkRecordCompanyAccess(user, clearance.companyId, { allowSuperAdminOnly: true });
      if (clearanceCompanyErr) {
        return clearanceCompanyErr;
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
