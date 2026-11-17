import { prisma } from "@ahh-wfm/database";

export async function applyAddendumWorkflowTransition(
  addendumId: string,
  action: "APPROVE" | "REJECT" | "RETURN",
  newStatus: string,
  tx?: any,
  actorUserId?: string | null,
  remarks?: string
) {
  const db = tx || prisma;

  const addendum = await db.manpowerContractAddendum.findUnique({
    where: { id: addendumId },
    include: {
      contract: true,
      lineItems: true
    }
  });

  if (!addendum) {
    throw new Error("Contract addendum not found.");
  }

  if (action === "APPROVE" && newStatus === "APPROVED") {
    // Atomic idempotency guard: apply contract impact at most once
    const claimed = await db.manpowerContractAddendum.updateMany({
      where: {
        id: addendum.id,
        status: { not: "APPROVED" }
      },
      data: {
        status: "APPROVED"
      }
    });

    if (claimed.count === 0) {
      return {
        alreadyApproved: true,
        addendum,
        contract: addendum.contract
      };
    }

    const approvedAddendum = await db.manpowerContractAddendum.findUnique({
      where: { id: addendum.id },
      include: { lineItems: true }
    });

    // Preserve endDate if effectiveTo is provided and later than contract endDate
    let updatedEndDate = addendum.contract.endDate;
    if (addendum.effectiveTo && addendum.effectiveTo > addendum.contract.endDate) {
      updatedEndDate = addendum.effectiveTo;
    }

    // Preserve totalContractValue if base contract total is null; apply full-term impact delta once
    let updatedTotalValue = addendum.contract.totalContractValue;
    if (
      addendum.contract.totalContractValue !== null &&
      addendum.calculatedCommercialImpact !== null &&
      addendum.calculatedCommercialImpact !== undefined
    ) {
      const impactDelta = Number(addendum.calculatedCommercialImpact);
      updatedTotalValue = addendum.contract.totalContractValue + impactDelta;
    }

    const updatedContract = await db.manpowerContract.update({
      where: { id: addendum.contractId },
      data: {
        endDate: updatedEndDate,
        totalContractValue: updatedTotalValue
      }
    });

    if (actorUserId) {
      await db.userActivityLog.create({
        data: {
          userId: actorUserId,
          action: "ADDENDUM_APPROVED",
          entityType: "CONTRACT_ADDENDUM",
          entityId: addendum.id,
          afterJson: JSON.stringify({
            contractId: addendum.contractId,
            addendumId: addendum.id,
            approvedBy: actorUserId,
            remarks: remarks || null
          })
        }
      }).catch(() => null);
    }

    return {
      alreadyApproved: false,
      addendum: approvedAddendum,
      contract: updatedContract
    };
  }

  if (action === "REJECT") {
    if (addendum.status === "APPROVED") {
      throw new Error("Approved addendums are locked and immutable and cannot be rejected.");
    }
    const rejectedAddendum = await db.manpowerContractAddendum.update({
      where: { id: addendum.id },
      data: { status: "REJECTED" },
      include: { lineItems: true }
    });
    if (actorUserId) {
      await db.userActivityLog.create({
        data: {
          userId: actorUserId,
          action: "ADDENDUM_REJECTED",
          entityType: "CONTRACT_ADDENDUM",
          entityId: addendum.id,
          afterJson: JSON.stringify({
            contractId: addendum.contractId,
            addendumId: addendum.id,
            rejectedBy: actorUserId,
            remarks: remarks || null
          })
        }
      }).catch(() => null);
    }
    return {
      alreadyApproved: false,
      addendum: rejectedAddendum,
      contract: addendum.contract
    };
  }

  if (action === "RETURN") {
    if (addendum.status === "APPROVED") {
      throw new Error("Approved addendums are locked and immutable and cannot be returned.");
    }
    const returnedAddendum = await db.manpowerContractAddendum.update({
      where: { id: addendum.id },
      data: { status: "DRAFT" },
      include: { lineItems: true }
    });
    return {
      alreadyApproved: false,
      addendum: returnedAddendum,
      contract: addendum.contract
    };
  }

  return {
    alreadyApproved: false,
    addendum,
    contract: addendum.contract
  };
}
