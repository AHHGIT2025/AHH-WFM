import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { hasPermission, isAdminUser } from "../../../../../../../lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.addendum.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contract = await prisma.manpowerContract.findUnique({
      where: { id: params.contractId },
      include: {
        client: true,
        addendums: {
          include: {
            lineItems: true
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    const addendumIds = contract.addendums.map((a) => a.id);
    const workflowInstances = addendumIds.length > 0
      ? await prisma.workflowInstance.findMany({
          where: {
            referenceId: { in: addendumIds },
            moduleType: { in: ["CONTRACT_ADDENDUM", "COMMERCIAL_ADDENDUM"] }
          },
          include: {
            history: {
              orderBy: { createdAt: "asc" }
            }
          }
        })
      : [];

    const activityLogs = addendumIds.length > 0
      ? await prisma.userActivityLog.findMany({
          where: {
            entityType: "CONTRACT_ADDENDUM",
            entityId: { in: addendumIds }
          },
          orderBy: { createdAt: "asc" }
        })
      : [];

    const enrichedAddendums = contract.addendums.map((addendum) => {
      const wf = workflowInstances.find((w) => w.referenceId === addendum.id) || null;
      const logs = activityLogs.filter((l) => l.entityId === addendum.id);
      const createdLog = logs.find((l) => l.action === "ADDENDUM_CREATED");
      const submittedLog = logs.find((l) => l.action === "ADDENDUM_SUBMITTED");
      return {
        ...addendum,
        createdBy: createdLog?.userId || null,
        submittedBy: submittedLog?.userId || createdLog?.userId || null,
        workflowInstance: wf
      };
    });

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        status: contract.status,
        operationType: contract.operationType,
        mobilisationStatus: contract.mobilisationStatus,
        startDate: contract.startDate,
        endDate: contract.endDate,
        totalContractValue: contract.totalContractValue,
        client: contract.client ? { id: contract.client.id, name: contract.client.name } : null
      },
      addendums: enrichedAddendums
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch contract addendums." },
      { status: 400 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  const { session, error } = await checkApiAuth();

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;

  try {
    const body = await req.json();
    const {
      addendumId,
      action,
      submit,
      title,
      addendumType,
      effectiveFrom,
      effectiveTo,
      description,
      commercialImpact,
      calculatedCommercialImpact,
      lineItems,
      remarks
    } = body;

    const isSubmitting = action === "SUBMIT" || submit === true;
    const isUpdatingExisting = Boolean(addendumId) && action !== "SUBMIT";

    // Granular Maker Permission Enforcement (Creation, Update, Submission)
    if (addendumId && action === "SUBMIT") {
      if (!isAdminUser(user) && !hasPermission(user, "commercial.addendum.submit")) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission (commercial.addendum.submit) to submit contract addendums." },
          { status: 403 }
        );
      }
    } else if (isUpdatingExisting) {
      if (!isAdminUser(user) && !hasPermission(user, "commercial.addendum.update") && !hasPermission(user, "commercial.addendum.create")) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission (commercial.addendum.update) to update contract addendums." },
          { status: 403 }
        );
      }
    } else {
      const canCreate = isAdminUser(user) || hasPermission(user, "commercial.addendum.create");
      const canSubmitIfRequested = !isSubmitting || isAdminUser(user) || hasPermission(user, "commercial.addendum.submit");
      if (!canCreate || !canSubmitIfRequested) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission (commercial.addendum.create) to create contract addendums." },
          { status: 403 }
        );
      }
    }

    const contract = await prisma.manpowerContract.findUnique({
      where: { id: params.contractId }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    // Business Rule: Addendums are only permitted for ACTIVE or APPROVED contracts
    if (contract.status !== "ACTIVE" && contract.status !== "APPROVED") {
      return NextResponse.json(
        { error: `Contract scope addendums are only permitted for ACTIVE contracts. Current status: ${contract.status}` },
        { status: 400 }
      );
    }

    // Check immutability & handle existing addendum update / submission
    if (addendumId) {
      const existingAddendum = await prisma.manpowerContractAddendum.findUnique({
        where: { id: addendumId },
        include: { lineItems: true }
      });

      if (!existingAddendum || existingAddendum.contractId !== contract.id) {
        return NextResponse.json({ error: "Contract addendum not found." }, { status: 404 });
      }

      if (existingAddendum.status === "APPROVED") {
        return NextResponse.json(
          { error: "Approved addendums are locked and immutable. Direct edits are prohibited." },
          { status: 400 }
        );
      }

      if (action === "SUBMIT") {
        const workflowTemplate =
          (await prisma.workflowTemplate.findFirst({
            where: { moduleType: "CONTRACT_ADDENDUM", isActive: true }
          })) ||
          (await prisma.workflowTemplate.findFirst({
            where: { moduleType: "COMMERCIAL_ADDENDUM", isActive: true }
          }));

        if (!workflowTemplate) {
          return NextResponse.json(
            {
              error:
                "WORKFLOW_CONFIGURATION_REQUIRED_BEFORE_SUBMISSION: No active CONTRACT_ADDENDUM workflow definition is configured under Settings > Workflow Setup."
            },
            { status: 400 }
          );
        }

        const updatedAddendum = await prisma.manpowerContractAddendum.update({
          where: { id: existingAddendum.id },
          data: {
            status: "PENDING_APPROVAL"
          },
          include: { lineItems: true }
        });

        let workflowInstance = await prisma.workflowInstance.findFirst({
          where: {
            referenceId: existingAddendum.id,
            moduleType: { in: ["CONTRACT_ADDENDUM", "COMMERCIAL_ADDENDUM"] }
          }
        });

        if (!workflowInstance) {
          workflowInstance = await prisma.workflowInstance.create({
            data: {
              templateId: workflowTemplate.id,
              moduleType: "CONTRACT_ADDENDUM",
              referenceId: existingAddendum.id,
              status: "IN_PROGRESS",
              currentLevelNumber: 1
            }
          });
        } else {
          workflowInstance = await prisma.workflowInstance.update({
            where: { id: workflowInstance.id },
            data: {
              templateId: workflowTemplate.id,
              moduleType: "CONTRACT_ADDENDUM",
              status: "IN_PROGRESS",
              currentLevelNumber: 1
            }
          });
        }

        await prisma.workflowActionHistory.create({
          data: {
            instanceId: workflowInstance.id,
            levelNumber: 1,
            action: "SUBMIT",
            actedBy: user.id || user.email || "USER",
            remarks: remarks || "Contract addendum submitted for approval."
          }
        });

        await prisma.userActivityLog.create({
          data: {
            userId: user.id || "unknown",
            action: "ADDENDUM_SUBMITTED",
            entityType: "CONTRACT_ADDENDUM",
            entityId: existingAddendum.id,
            afterJson: JSON.stringify({
              contractId: contract.id,
              addendumId: existingAddendum.id,
              submittedBy: user.id,
              status: "PENDING_APPROVAL"
            })
          }
        }).catch(() => null);

        return NextResponse.json({
          success: true,
          addendum: updatedAddendum,
          workflowInstance
        });
      }

      // Updating an existing DRAFT / REJECTED addendum
      const updatedAddendum = await prisma.manpowerContractAddendum.update({
        where: { id: existingAddendum.id },
        data: {
          title: title ?? existingAddendum.title,
          addendumType: addendumType ?? existingAddendum.addendumType,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : existingAddendum.effectiveFrom,
          effectiveTo: effectiveTo !== undefined ? (effectiveTo ? new Date(effectiveTo) : null) : existingAddendum.effectiveTo,
          description: description !== undefined ? description : existingAddendum.description,
          commercialImpact: commercialImpact !== undefined ? commercialImpact : existingAddendum.commercialImpact,
          calculatedCommercialImpact:
            calculatedCommercialImpact !== undefined
              ? (calculatedCommercialImpact !== null ? Number(calculatedCommercialImpact) : null)
              : existingAddendum.calculatedCommercialImpact
        },
        include: { lineItems: true }
      });

      await prisma.userActivityLog.create({
        data: {
          userId: user.id || "unknown",
          action: "ADDENDUM_UPDATED",
          entityType: "CONTRACT_ADDENDUM",
          entityId: existingAddendum.id,
          afterJson: JSON.stringify({
            contractId: contract.id,
            addendumId: existingAddendum.id,
            updatedBy: user.id
          })
        }
      }).catch(() => null);

      return NextResponse.json({
        success: true,
        addendum: updatedAddendum
      });
    }

    if (!title || !addendumType || !effectiveFrom) {
      return NextResponse.json(
        { error: "title, addendumType, and effectiveFrom are required fields." },
        { status: 400 }
      );
    }

    const count = await prisma.manpowerContractAddendum.count({
      where: { contractId: contract.id }
    });
    const addendumNumber = `${contract.contractNumber}-ADD-${String(count + 1).padStart(2, "0")}`;

    const initialStatus = isSubmitting ? "PENDING_APPROVAL" : "DRAFT";

    const addendum = await prisma.manpowerContractAddendum.create({
      data: {
        contractId: contract.id,
        addendumNumber,
        title,
        addendumDate: new Date(),
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        addendumType,
        description: description || null,
        commercialImpact: commercialImpact || null,
        calculatedCommercialImpact: calculatedCommercialImpact ? Number(calculatedCommercialImpact) : null,
        status: initialStatus,
        lineItems: Array.isArray(lineItems) && lineItems.length > 0 ? {
          create: lineItems.map((item: any) => ({
            itemType: item.itemType || "MANPOWER",
            changeType: item.changeType || "ADD",
            itemName: item.itemName,
            quantity: Number(item.quantity) || 1,
            unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
            billingFrequency: item.billingFrequency || "MONTHLY",
            isFoc: Boolean(item.isFoc),
            lineTotal: item.lineTotal ? Number(item.lineTotal) : ((Number(item.quantity) || 1) * (Number(item.unitPrice) || 0)),
            remarks: item.remarks || null
          }))
        } : undefined
      },
      include: {
        lineItems: true
      }
    });

    // Persist creator identity in UserActivityLog for strict Maker/Checker SoD validation
    await prisma.userActivityLog.create({
      data: {
        userId: user.id || "unknown",
        action: "ADDENDUM_CREATED",
        entityType: "CONTRACT_ADDENDUM",
        entityId: addendum.id,
        afterJson: JSON.stringify({
          contractId: contract.id,
          addendumNumber: addendum.addendumNumber,
          createdBy: user.id,
          status: addendum.status
        })
      }
    }).catch(() => null);

    // If an active CONTRACT_ADDENDUM (or legacy COMMERCIAL_ADDENDUM) template exists, bind WorkflowInstance
    const workflowTemplate =
      (await prisma.workflowTemplate.findFirst({
        where: { moduleType: "CONTRACT_ADDENDUM", isActive: true }
      })) ||
      (await prisma.workflowTemplate.findFirst({
        where: { moduleType: "COMMERCIAL_ADDENDUM", isActive: true }
      }));

    if (workflowTemplate) {
      const wfInstance = await prisma.workflowInstance.create({
        data: {
          templateId: workflowTemplate.id,
          moduleType: "CONTRACT_ADDENDUM",
          referenceId: addendum.id,
          status: isSubmitting ? "IN_PROGRESS" : "DRAFT",
          currentLevelNumber: 1
        }
      }).catch(() => null);

      if (wfInstance) {
        await prisma.workflowActionHistory.create({
          data: {
            instanceId: wfInstance.id,
            levelNumber: 1,
            action: isSubmitting ? "SUBMIT" : "CREATE",
            actedBy: user.id || user.email || "USER",
            remarks: isSubmitting
              ? "Addendum created and submitted for approval."
              : "Addendum draft created by Maker."
          }
        }).catch(() => null);
      }
    }

    return NextResponse.json({
      success: true,
      addendum: {
        ...addendum,
        createdBy: user.id || null
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create contract addendum." },
      { status: 400 }
    );
  }
}
