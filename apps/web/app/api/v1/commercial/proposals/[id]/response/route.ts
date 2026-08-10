import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../lib/permissions";
import { recordClientResponse } from "../../../../../../../lib/contract-conversion";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.acceptance.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const proposal = await prisma.preContractProposal.findUnique({
      where: { id: params.id },
      include: {
        case: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      }
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const canCrossCompany = hasPermission(user, "precontract.proposal.crossCompany") || user.role === "SUPER_ADMIN" || user.role === "ADMIN" || hasPermission(user, "manpower.admin.full_access");
    if (!canCrossCompany && proposal.companyId && user.companyId && proposal.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Access to this company proposal is restricted." }, { status: 403 });
    }

    const body = await req.json();
    const { proposalVersionId, responseType, clientContactName, clientReference, notes, snapshotChecksum } = body;

    const targetVersionId = proposalVersionId || (proposal.versions[0] ? proposal.versions[0].id : undefined);

    if (!targetVersionId) {
      return NextResponse.json({ error: "proposalVersionId is required." }, { status: 400 });
    }

    if (!["ACCEPTED", "REJECTED", "CHANGE_REQUESTED"].includes(responseType)) {
      return NextResponse.json({ error: "Invalid responseType. Must be ACCEPTED, REJECTED, or CHANGE_REQUESTED." }, { status: 400 });
    }

    const clientResponse = await recordClientResponse({
      proposalId: proposal.id,
      proposalVersionId: targetVersionId,
      responseType,
      clientContactName,
      clientReference,
      notes,
      snapshotChecksum,
      recordedById: user.id || "system"
    });

    return NextResponse.json({ success: true, clientResponse });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return NextResponse.json(
      { error: err.message || "Failed to record client response." },
      { status }
    );
  }
}
