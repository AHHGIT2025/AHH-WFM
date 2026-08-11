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

    // Centralized Workflow Template check (Settings > Workflow Setup)
    const workflowTemplate = await prisma.workflowTemplate.findFirst({
      where: {
        moduleType: "COMMERCIAL_ADDENDUM",
        isActive: true
      }
    });

    let activeWorkflowInstance = null;
    if (workflowTemplate) {
      activeWorkflowInstance = await prisma.workflowInstance.findFirst({
        where: {
          referenceId: addendum.id,
          moduleType: "COMMERCIAL_ADDENDUM"
        }
      });

      if (!activeWorkflowInstance || activeWorkflowInstance.status !== "APPROVED") {
        const isApprover = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
        if (!isApprover) {
          return NextResponse.json(
            { error: "Direct approval blocked. Centralized workflow approval under Settings > Workflow Setup is required." },
            { status: 403 }
          );
        }
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

      // Update contract endDate and totalContractValue explicitly
      let updatedEndDate = addendum.contract.endDate;
      if (addendum.effectiveTo && addendum.effectiveTo > addendum.contract.endDate) {
        updatedEndDate = addendum.effectiveTo;
      }

      let updatedTotalValue = addendum.contract.totalContractValue;
      if (addendum.calculatedCommercialImpact && addendum.calculatedCommercialImpact !== 0) {
        const currentValue = addendum.contract.totalContractValue || 0;
        updatedTotalValue = currentValue + addendum.calculatedCommercialImpact;
      }

      const updatedContract = await tx.manpowerContract.update({
        where: { id: params.contractId },
        data: {
          endDate: updatedEndDate,
          totalContractValue: updatedTotalValue
        }
      });

      // Register action history if active workflow instance exists
      if (activeWorkflowInstance) {
        await tx.workflowActionHistory.create({
          data: {
            instanceId: activeWorkflowInstance.id,
            levelNumber: activeWorkflowInstance.currentLevelNumber || 1,
            action: "APPROVE",
            actedBy: user.id || "system",
            remarks: "Addendum approved and commercial terms applied."
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
