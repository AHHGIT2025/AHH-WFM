import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { getEffectiveContractManpower } from "../../../../../../../lib/contract-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: { caseId: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.renewal.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const renewalCase = await prisma.manpowerContractRenewalCase.findUnique({
      where: { id: params.caseId },
      include: {
        contract: {
          include: {
            manpowerRequirements: true,
            relieverRequirements: true,
            shiftRequirements: true,
            addendums: { include: { lineItems: true } },
            projects: true
          }
        }
      }
    });

    if (!renewalCase) {
      return NextResponse.json({ error: "Renewal case not found." }, { status: 404 });
    }

    // Idempotency check: if already finalized as RENEWED or NOT_RENEWED, return existing state
    if (renewalCase.status === "RENEWED" || renewalCase.status === "NOT_RENEWED" || renewalCase.status === "DECLINED") {
      return NextResponse.json({
        success: true,
        alreadyFinalized: true,
        renewalCase
      });
    }

    // Centralized Workflow Governance check (Settings > Workflow Setup)
    const workflowTemplate = await prisma.workflowTemplate.findFirst({
      where: {
        moduleType: "CONTRACT_RENEWAL",
        isActive: true
      }
    });

    // WORKFLOW_CONFIGURATION_REQUIRED_BEFORE_SUBMISSION: Block silent local bypass if workflow template is not configured
    if (!workflowTemplate) {
      return NextResponse.json(
        { error: "WORKFLOW_CONFIGURATION_REQUIRED_BEFORE_SUBMISSION: No active CONTRACT_RENEWAL workflow definition is configured under Settings > Workflow Setup." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { decision, decisionReason, decisionNotes, newStartDate, newEndDate, explicitTotalContractValue, addenumTitle } = body;

    if (!decision || !["RENEW_NEW_TERM", "RENEW_ADDENDUM_EXTENSION", "NOT_RENEWED", "DECLINED"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be one of: RENEW_NEW_TERM, RENEW_ADDENDUM_EXTENSION, NOT_RENEWED, DECLINED" },
        { status: 400 }
      );
    }

    const sourceContract = renewalCase.contract;

    const result = await prisma.$transaction(async (tx) => {
      let resultingContractId: string | null = null;
      let resultingAddendumId: string | null = null;
      let newStatus: string = "UNDER_REVIEW";

      if (decision === "RENEW_NEW_TERM") {
        if (!newStartDate || !newEndDate) {
          throw new Error("newStartDate and newEndDate are required when creating a new renewed contract term.");
        }

        const count = await tx.manpowerContract.count({
          where: { clientId: sourceContract.clientId }
        });
        const contractNumber = `${sourceContract.contractNumber}-REN-${String(count + 1).padStart(2, "0")}`;

        // Get effective requirement baseline (base requirements + approved CL-7 Addenda deltas)
        const effective = getEffectiveContractManpower(sourceContract as any);

        // Calculate total contract value: EXPLICIT_USER_INPUT or NULL. No inferred multipliers.
        const totalValue = explicitTotalContractValue !== undefined && explicitTotalContractValue !== null
          ? Number(explicitTotalContractValue)
          : null;

        const newContract = await tx.manpowerContract.create({
          data: {
            clientId: sourceContract.clientId,
            contractNumber,
            title: `Renewed Term: ${sourceContract.title}`,
            startDate: new Date(newStartDate),
            endDate: new Date(newEndDate),
            operationType: sourceContract.operationType,
            status: "DRAFT",
            approvalStatus: "DRAFT",
            mobilisationStatus: "NOT_REQUIRED",
            currency: sourceContract.currency || null,
            billingBasis: sourceContract.billingBasis || null,
            totalContractValue: totalValue,
            noticePeriodDays: sourceContract.noticePeriodDays || null,
            renewalOfContractId: sourceContract.id,
            manpowerRequirements: {
              create: effective.effectiveManpower.map((req: any) => ({
                position: req.position || req.roleName || "Security Officer",
                quantity: req.totalQty || req.originalQty || 1,
                deploymentType: req.deploymentType || "REGULAR",
                unitPrice: req.billingRate || req.unitPrice || null,
                remarks: "Copied from effective requirements of previous contract term"
              }))
            }
          }
        });

        resultingContractId = newContract.id;
        newStatus = "RENEWED";
      } else if (decision === "RENEW_ADDENDUM_EXTENSION") {
        if (!newEndDate) {
          throw new Error("newEndDate is required for addendum duration extension.");
        }

        const addCount = await tx.manpowerContractAddendum.count({
          where: { contractId: sourceContract.id }
        });
        const addendumNumber = `${sourceContract.contractNumber}-ADD-${String(addCount + 1).padStart(2, "0")}`;

        const addendum = await tx.manpowerContractAddendum.create({
          data: {
            contractId: sourceContract.id,
            addendumNumber,
            title: addenumTitle || `Renewal Term Extension to ${newEndDate}`,
            addendumDate: new Date(),
            effectiveFrom: sourceContract.endDate,
            effectiveTo: new Date(newEndDate),
            addendumType: "SCOPE_CHANGE",
            status: "DRAFT",
            description: "Term extension addendum created via Contract Renewal management."
          }
        });

        resultingAddendumId = addendum.id;
        newStatus = "RENEWED";
      } else if (decision === "NOT_RENEWED" || decision === "DECLINED") {
        newStatus = decision === "NOT_RENEWED" ? "NOT_RENEWED" : "DECLINED";
      }

      const updatedCase = await tx.manpowerContractRenewalCase.update({
        where: { id: params.caseId },
        data: {
          status: newStatus,
          decision,
          decisionDate: new Date(),
          decisionReason: decisionReason || null,
          decisionNotes: decisionNotes || null,
          targetStartDate: newStartDate ? new Date(newStartDate) : null,
          targetEndDate: newEndDate ? new Date(newEndDate) : null,
          resultingContractId,
          resultingAddendumId
        },
        include: {
          contract: { include: { client: true } }
        }
      });

      // Record WorkflowActionHistory log
      let workflowInstance = await tx.workflowInstance.findFirst({
        where: { referenceId: params.caseId, moduleType: "CONTRACT_RENEWAL" }
      });

      if (!workflowInstance) {
        workflowInstance = await tx.workflowInstance.create({
          data: {
            templateId: workflowTemplate.id,
            moduleType: "CONTRACT_RENEWAL",
            referenceId: params.caseId,
            status: "APPROVED",
            currentLevelNumber: 1
          }
        });
      } else {
        await tx.workflowInstance.update({
          where: { id: workflowInstance.id },
          data: { status: "APPROVED" }
        });
      }

      await tx.workflowActionHistory.create({
        data: {
          instanceId: workflowInstance.id,
          levelNumber: 1,
          action: decision === "RENEW_NEW_TERM" || decision === "RENEW_ADDENDUM_EXTENSION" ? "APPROVE" : "REJECT",
          actedBy: user.id || "system",
          remarks: `Renewal decision finalized: ${decision}. ${decisionNotes || ""}`
        }
      });

      return { updatedCase, resultingContractId, resultingAddendumId };
    });

    return NextResponse.json({
      success: true,
      alreadyFinalized: false,
      renewalCase: result.updatedCase,
      resultingContractId: result.resultingContractId,
      resultingAddendumId: result.resultingAddendumId
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to finalize contract renewal decision." },
      { status: 400 }
    );
  }
}
