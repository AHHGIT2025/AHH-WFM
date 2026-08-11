import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../../../lib/api-guards";

export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string; addendumId: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.addendum.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const addendum = await prisma.manpowerContractAddendum.findUnique({
      where: { id: params.addendumId },
      include: {
        contract: true,
        lineItems: true
      }
    });

    if (!addendum || addendum.contractId !== params.contractId) {
      return NextResponse.json({ error: "Contract addendum not found." }, { status: 404 });
    }

    // Idempotency check: if already approved, return existing state cleanly
    if (addendum.status === "APPROVED") {
      return NextResponse.json({
        success: true,
        alreadyApproved: true,
        addendum
      });
    }

    // GATE 2: Enforce Centralized Workflow Configuration (Settings > Workflow Setup)
    const workflowTemplate = await prisma.workflowTemplate.findFirst({
      where: {
        moduleType: "COMMERCIAL_ADDENDUM",
        isActive: true
      }
    });

    // WORKFLOW_CONFIGURATION_REQUIRED_BEFORE_SUBMISSION: Block silent local fallback if no central workflow template exists
    if (!workflowTemplate) {
      return NextResponse.json(
        { error: "WORKFLOW_CONFIGURATION_REQUIRED_BEFORE_SUBMISSION: No active COMMERCIAL_ADDENDUM workflow definition is configured under Settings > Workflow Setup." },
        { status: 400 }
      );
    }

    // Retrieve active WorkflowInstance
    let workflowInstance = await prisma.workflowInstance.findFirst({
      where: {
        referenceId: addendum.id,
        moduleType: "COMMERCIAL_ADDENDUM"
      }
    });

    // If workflow instance is not in APPROVED state, check for authorized workflow approval action
    if (!workflowInstance || workflowInstance.status !== "APPROVED") {
      const isApprover = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
      if (!isApprover) {
        return NextResponse.json(
          { error: "Direct approval blocked. Centralized workflow approval under Settings > Workflow Setup is required." },
          { status: 403 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const approvedAddendum = await tx.manpowerContractAddendum.update({
        where: { id: addendum.id },
        data: {
          status: "APPROVED"
        },
        include: {
          lineItems: true
        }
      });

      // GATE 1: totalContractValue / Commercial Impact Safety
      // Preserve endDate if effectiveTo is provided and later than contract endDate
      let updatedEndDate = addendum.contract.endDate;
      if (addendum.effectiveTo && addendum.effectiveTo > addendum.contract.endDate) {
        updatedEndDate = addendum.effectiveTo;
      }

      // Preserve totalContractValue if base contract total is null; do not force 0 without explicit full-term authority
      let updatedTotalValue = addendum.contract.totalContractValue;
      if (addendum.contract.totalContractValue !== null && addendum.calculatedCommercialImpact !== null && addendum.calculatedCommercialImpact !== undefined) {
        // Apply explicit full-term commercial impact delta (supports ADD, REMOVE, MODIFY)
        const impactDelta = Number(addendum.calculatedCommercialImpact);
        updatedTotalValue = addendum.contract.totalContractValue + impactDelta;
      }

      const updatedContract = await tx.manpowerContract.update({
        where: { id: params.contractId },
        data: {
          endDate: updatedEndDate,
          totalContractValue: updatedTotalValue
        }
      });

      // Update or create WorkflowInstance to APPROVED status
      if (!workflowInstance && workflowTemplate) {
        workflowInstance = await tx.workflowInstance.create({
          data: {
            templateId: workflowTemplate.id,
            moduleType: "COMMERCIAL_ADDENDUM",
            referenceId: addendum.id,
            status: "APPROVED",
            currentLevelNumber: 1
          }
        });
      } else if (workflowInstance && workflowInstance.status !== "APPROVED") {
        workflowInstance = await tx.workflowInstance.update({
          where: { id: workflowInstance.id },
          data: { status: "APPROVED" }
        });
      }

      // Record WorkflowActionHistory log
      if (workflowInstance) {
        await tx.workflowActionHistory.create({
          data: {
            instanceId: workflowInstance.id,
            levelNumber: workflowInstance.currentLevelNumber || 1,
            action: "APPROVE",
            actedBy: user.id || "system",
            remarks: "Addendum approved and commercial impact applied to contract."
          }
        }).catch(() => null);
      }

      return { approvedAddendum, updatedContract };
    });

    return NextResponse.json({
      success: true,
      alreadyApproved: false,
      addendum: result.approvedAddendum,
      contract: {
        id: result.updatedContract.id,
        endDate: result.updatedContract.endDate,
        totalContractValue: result.updatedContract.totalContractValue
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to approve contract addendum." },
      { status: 400 }
    );
  }
}
