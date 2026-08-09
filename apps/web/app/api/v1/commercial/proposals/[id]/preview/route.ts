import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../lib/permissions";
import { toClientSafeProposalDTO } from "../../../../../../../lib/precontract-proposal";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.proposal.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const proposal = await prisma.preContractProposal.findUnique({
      where: { id: params.id },
      include: {
        case: { include: { prospectClient: true } },
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

    const version = proposal.versions[0];
    const dto = toClientSafeProposalDTO(proposal, version);

    return NextResponse.json({ preview: dto });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to generate proposal preview." },
      { status: 500 }
    );
  }
}
