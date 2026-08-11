import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";

export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.contract.terminate"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const contract = await prisma.manpowerContract.findUnique({
      where: { id: params.contractId }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    if (contract.status === "TERMINATED" || contract.status === "CLOSED") {
      return NextResponse.json({
        success: true,
        alreadyTerminated: true,
        contractStatus: contract.status
      });
    }

    const body = await req.json();
    const { terminationReason, noticeDate, effectiveDate, settlementNotes } = body;

    if (!terminationReason) {
      return NextResponse.json({ error: "terminationReason is required." }, { status: 400 });
    }

    const updatedContract = await prisma.manpowerContract.update({
      where: { id: contract.id },
      data: {
        status: "TERMINATED",
        mobilisationStatus: "CLOSED"
      }
    });

    return NextResponse.json({
      success: true,
      alreadyTerminated: false,
      contractStatus: updatedContract.status,
      termination: {
        contractId: updatedContract.id,
        contractNumber: updatedContract.contractNumber,
        terminationReason,
        noticeDate: noticeDate ? new Date(noticeDate) : new Date(),
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        settlementNotes: settlementNotes || null,
        terminatedBy: user.id || "user"
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to terminate contract." },
      { status: 400 }
    );
  }
}
