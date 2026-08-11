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

      // Update contract endDate if addendum extends effectiveTo
      let updatedEndDate = addendum.contract.endDate;
      if (addendum.effectiveTo && addendum.effectiveTo > addendum.contract.endDate) {
        updatedEndDate = addendum.effectiveTo;
        await tx.manpowerContract.update({
          where: { id: params.contractId },
          data: {
            endDate: updatedEndDate
          }
        });
      }

      return { approvedAddendum, updatedEndDate };
    });

    return NextResponse.json({
      success: true,
      alreadyApproved: false,
      addendum: result.approvedAddendum,
      updatedEndDate: result.updatedEndDate
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to approve contract addendum." },
      { status: 400 }
    );
  }
}
