import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../../../lib/api-guards";
import { hasPermission, isAdminUser } from "../../../../../../../../../lib/permissions";

export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string; addendumId: string } }
) {
  const { session, error } = await checkApiAuth();

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body?.action || "APPROVE").toUpperCase();
  const remarks = body?.remarks ? String(body.remarks).trim() : undefined;

  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json(
      { error: "Invalid action. Allowed actions: APPROVE, REJECT." },
      { status: 400 }
    );
  }

  // Granular Checker Permission Check (commercial.addendum.approve / commercial.addendum.reject)
  const hasCheckerPermission =
    isAdminUser(user) ||
    (action === "APPROVE" && hasPermission(user, "commercial.addendum.approve")) ||
    (action === "REJECT" && (hasPermission(user, "commercial.addendum.reject") || hasPermission(user, "commercial.addendum.approve")));

  if (!hasCheckerPermission) {
    return NextResponse.json(
      {
        error: `Forbidden: You do not have permission (${action === "APPROVE" ? "commercial.addendum.approve" : "commercial.addendum.reject"}) to ${action.toLowerCase()} contract addendums.`
      },
      { status: 403 }
    );
  }

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

    // Idempotency check: if already approved and action is APPROVE, return existing state cleanly
    if (addendum.status === "APPROVED") {
      if (action === "REJECT") {
        return NextResponse.json(
          { error: "Approved addendums are locked and immutable and cannot be rejected." },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        alreadyApproved: true,
        addendum
      });
    }

    // GATE 2: Enforce Centralized Workflow Configuration (Settings > Workflow Setup)
    const workflowTemplate =
      (await prisma.workflowTemplate.findFirst({
        where: {
          moduleType: "CONTRACT_ADDENDUM",
          isActive: true
        }
      })) ||
      (await prisma.workflowTemplate.findFirst({
        where: {
          moduleType: "COMMERCIAL_ADDENDUM",
          isActive: true
        }
      }));

    // WORKFLOW_CONFIGURATION_REQUIRED_BEFORE_SUBMISSION: Block silent local fallback if no central workflow template exists
    if (!workflowTemplate) {
      return NextResponse.json(
        {
          error:
            "WORKFLOW_CONFIGURATION_REQUIRED_BEFORE_SUBMISSION: No active CONTRACT_ADDENDUM workflow definition is configured under Settings > Workflow Setup."
        },
        { status: 400 }
      );
    }

    // Retrieve active WorkflowInstance (supporting canonical CONTRACT_ADDENDUM and legacy COMMERCIAL_ADDENDUM)
    let workflowInstance = await prisma.workflowInstance.findFirst({
      where: {
        referenceId: addendum.id,
        moduleType: { in: ["CONTRACT_ADDENDUM", "COMMERCIAL_ADDENDUM"] }
      },
      include: {
        history: true
      }
    });

    // GATE 3: Strict Maker / Checker Segregation of Duties (creator !== approver)
    const makerLogs = await prisma.userActivityLog.findMany({
      where: {
        entityType: "CONTRACT_ADDENDUM",
        entityId: addendum.id,
        action: { in: ["ADDENDUM_CREATED", "ADDENDUM_SUBMITTED"] }
      }
    });

    const makerUserIds = new Set<string>();
    for (const log of makerLogs) {
      if (log.userId) makerUserIds.add(log.userId);
    }
    if (workflowInstance?.history) {
      for (const h of workflowInstance.history) {
        if ((h.action === "CREATE" || h.action === "SUBMIT") && h.actedBy) {
          makerUserIds.add(h.actedBy);
        }
      }
    }

    if (user.id && makerUserIds.has(user.id)) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Segregation of Duties (Maker/Checker) policy prohibits the creator or submitting user from approving or rejecting their own contract addendum."
        },
        { status: 403 }
      );
    }

    if (action === "REJECT") {
      const rejectedResult = await prisma.$transaction(async (tx) => {
        const rejectedAddendum = await tx.manpowerContractAddendum.update({
          where: { id: addendum.id },
          data: {
            status: "REJECTED"
          },
          include: {
            lineItems: true
          }
        });

        let wfInst = workflowInstance;
        if (!wfInst && workflowTemplate) {
          wfInst = await tx.workflowInstance.create({
            data: {
              templateId: workflowTemplate.id,
              moduleType: "CONTRACT_ADDENDUM",
              referenceId: addendum.id,
              status: "REJECTED",
              currentLevelNumber: 1
            },
            include: { history: true }
          });
        } else if (wfInst) {
          wfInst = await tx.workflowInstance.update({
            where: { id: wfInst.id },
            data: {
              moduleType: "CONTRACT_ADDENDUM",
              status: "REJECTED"
            },
            include: { history: true }
          });
        }

        if (wfInst) {
          await tx.workflowActionHistory.create({
            data: {
              instanceId: wfInst.id,
              levelNumber: wfInst.currentLevelNumber || 1,
              action: "REJECT",
              actedBy: user.id || "system",
              remarks: remarks || "Addendum rejected by Checker."
            }
          }).catch(() => null);
        }

        await tx.userActivityLog.create({
          data: {
            userId: user.id || "unknown",
            action: "ADDENDUM_REJECTED",
            entityType: "CONTRACT_ADDENDUM",
            entityId: addendum.id,
            afterJson: JSON.stringify({
              contractId: params.contractId,
              addendumId: addendum.id,
              rejectedBy: user.id,
              remarks: remarks || null
            })
          }
        }).catch(() => null);

        return { rejectedAddendum, wfInst };
      });

      return NextResponse.json({
        success: true,
        alreadyApproved: false,
        addendum: rejectedResult.rejectedAddendum
      });
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

      // Update or create WorkflowInstance to APPROVED status with canonical moduleType CONTRACT_ADDENDUM
      let wfInst = workflowInstance;
      if (!wfInst && workflowTemplate) {
        wfInst = await tx.workflowInstance.create({
          data: {
            templateId: workflowTemplate.id,
            moduleType: "CONTRACT_ADDENDUM",
            referenceId: addendum.id,
            status: "APPROVED",
            currentLevelNumber: 1
          },
          include: { history: true }
        });
      } else if (wfInst && wfInst.status !== "APPROVED") {
        wfInst = await tx.workflowInstance.update({
          where: { id: wfInst.id },
          data: {
            moduleType: "CONTRACT_ADDENDUM",
            status: "APPROVED"
          },
          include: { history: true }
        });
      }

      // Record WorkflowActionHistory log
      if (wfInst) {
        await tx.workflowActionHistory.create({
          data: {
            instanceId: wfInst.id,
            levelNumber: wfInst.currentLevelNumber || 1,
            action: "APPROVE",
            actedBy: user.id || "system",
            remarks: remarks || "Addendum approved and commercial impact applied to contract."
          }
        }).catch(() => null);
      }

      await tx.userActivityLog.create({
        data: {
          userId: user.id || "unknown",
          action: "ADDENDUM_APPROVED",
          entityType: "CONTRACT_ADDENDUM",
          entityId: addendum.id,
          afterJson: JSON.stringify({
            contractId: params.contractId,
            addendumId: addendum.id,
            approvedBy: user.id,
            remarks: remarks || null
          })
        }
      }).catch(() => null);

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
