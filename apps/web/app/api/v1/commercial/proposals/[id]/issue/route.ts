import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { toClientSafeProposalDTO } from "../../../../../../../lib/precontract-proposal";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.proposal.issue"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const proposalId = params.id;
    const body = await req.json().catch(() => ({}));
    const { recipientName, recipientEmail, deliveryMethod, remarks } = body;

    const proposal = await prisma.preContractProposal.findUnique({
      where: { id: proposalId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" }
        }
      }
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const currentVersion = proposal.versions[0];
    if (!currentVersion) {
      return NextResponse.json({ error: "Proposal version not found." }, { status: 404 });
    }

    if (currentVersion.status !== "APPROVED_INTERNAL" && currentVersion.status !== "ISSUED_TO_CLIENT") {
      return NextResponse.json(
        { error: `Issuance Guard: Proposal version v${currentVersion.versionNumber} is in ${currentVersion.status} status. Only APPROVED_INTERNAL proposals can be issued to client.` },
        { status: 400 }
      );
    }

    const issuedAt = new Date();
    const issuedBy = user.name || user.email || user.id;

    const issuanceLog = await prisma.proposalIssuanceLog.create({
      data: {
        proposalVersionId: currentVersion.id,
        issuedBy,
        issuedAt,
        recipientName: recipientName?.trim() || null,
        recipientEmail: recipientEmail?.trim() || null,
        deliveryMethod: deliveryMethod || "MANUAL",
        remarks: remarks?.trim() || null
      }
    });

    await prisma.preContractProposalVersion.update({
      where: { id: currentVersion.id },
      data: {
        status: "ISSUED_TO_CLIENT",
        issuedAt,
        issuedBy,
        updatedAt: new Date()
      }
    });

    if (proposal.versions.length > 1) {
      const priorVersionIds = proposal.versions
        .slice(1)
        .filter((v) => v.status === "ISSUED_TO_CLIENT" || v.status === "APPROVED_INTERNAL")
        .map((v) => v.id);

      if (priorVersionIds.length > 0) {
        await prisma.preContractProposalVersion.updateMany({
          where: { id: { in: priorVersionIds } },
          data: { status: "SUPERSEDED" }
        });
      }
    }

    const updatedProposal = await prisma.preContractProposal.update({
      where: { id: proposalId },
      data: {
        status: "ISSUED_TO_CLIENT",
        updatedAt: new Date()
      },
      include: {
        case: { include: { prospectClient: true } },
        versions: { orderBy: { versionNumber: "desc" } }
      }
    });

    const dto = toClientSafeProposalDTO(updatedProposal, updatedProposal.versions[0]);

    return NextResponse.json({
      proposal: updatedProposal,
      issuanceLog,
      dto
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to record proposal issuance." },
      { status: 500 }
    );
  }
}
