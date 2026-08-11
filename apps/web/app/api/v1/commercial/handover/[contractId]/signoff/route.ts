import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";

export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.handover.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const contract = await prisma.manpowerContract.findUnique({
      where: { id: params.contractId },
      include: {
        handoverLogs: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    // Idempotency check: if contract is already MOBILISED or has a sign-off log, return existing state cleanly
    if (contract.mobilisationStatus === "MOBILISED" && contract.handoverLogs.length > 0) {
      return NextResponse.json({
        success: true,
        alreadySignedOff: true,
        handoverLog: contract.handoverLogs[0],
        contractStatus: contract.mobilisationStatus
      });
    }

    const body = await req.json();
    const { clientSignoffName, clientSignoffDate, clientRemarks } = body;

    if (!clientSignoffName) {
      return NextResponse.json({ error: "clientSignoffName is required." }, { status: 400 });
    }

    // Execute atomic sign-off and update contract mobilisation status
    const result = await prisma.$transaction(async (tx) => {
      const handoverLog = await tx.contractHandoverLog.create({
        data: {
          contractId: contract.id,
          clientSignoffName,
          clientSignoffDate: clientSignoffDate ? new Date(clientSignoffDate) : new Date(),
          clientRemarks: clientRemarks || null,
          handedOverBy: user.id || "system",
          status: "SIGNED_OFF"
        }
      });

      const updatedContract = await tx.manpowerContract.update({
        where: { id: contract.id },
        data: {
          mobilisationStatus: "MOBILISED"
        }
      });

      return { handoverLog, contract: updatedContract };
    });

    return NextResponse.json({
      success: true,
      alreadySignedOff: false,
      handoverLog: result.handoverLog,
      contractStatus: result.contract.mobilisationStatus
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to log client handover sign-off." },
      { status: 400 }
    );
  }
}
