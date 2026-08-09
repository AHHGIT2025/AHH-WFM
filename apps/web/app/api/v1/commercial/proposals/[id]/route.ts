import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";
import { toClientSafeProposalDTO } from "../../../../../../lib/precontract-proposal";

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
          include: {
            costEstimate: true,
            costEstimateVersion: true,
            issuanceLogs: { orderBy: { createdAt: "desc" } }
          }
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

    const dto = toClientSafeProposalDTO(proposal, proposal.versions[0]);

    return NextResponse.json({ proposal, dto });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch proposal detail." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.proposal.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      proposalCode,
      title,
      validityDays,
      scopeSummary,
      assumptions,
      exclusions,
      termsAndConditions
    } = body;

    if (body.sellingPrice !== undefined || body.currency !== undefined) {
      return NextResponse.json(
        { error: "Prohibited Action: Proposal-level direct selling price or currency edits are prohibited. Selling price modifications require an approved CL-3 costing revision." },
        { status: 400 }
      );
    }

    const proposal = await prisma.preContractProposal.findUnique({
      where: { id: params.id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
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

    if (currentVersion.status !== "DRAFT") {
      return NextResponse.json(
        { error: `Immutability Guard: Proposal version v${currentVersion.versionNumber} is in ${currentVersion.status} status and cannot be edited. Edits require creating a new revision.` },
        { status: 400 }
      );
    }

    let validUntil = currentVersion.validUntil;
    const vDays = validityDays !== undefined && validityDays !== null ? Number(validityDays) : currentVersion.validityDays;
    if (vDays && vDays > 0) {
      validUntil = new Date(Date.now() + vDays * 24 * 60 * 60 * 1000);
    }

    await prisma.preContractProposalVersion.update({
      where: { id: currentVersion.id },
      data: {
        title: title !== undefined ? title.trim() : currentVersion.title,
        validityDays: vDays,
        validUntil,
        scopeSummary: scopeSummary !== undefined ? scopeSummary?.trim() || null : currentVersion.scopeSummary,
        assumptions: assumptions !== undefined ? assumptions?.trim() || null : currentVersion.assumptions,
        exclusions: exclusions !== undefined ? exclusions?.trim() || null : currentVersion.exclusions,
        termsAndConditions: termsAndConditions !== undefined ? termsAndConditions?.trim() || null : currentVersion.termsAndConditions,
        updatedAt: new Date()
      }
    });

    const updatedProposal = await prisma.preContractProposal.update({
      where: { id: proposal.id },
      data: {
        proposalCode: proposalCode !== undefined ? proposalCode?.trim() || null : proposal.proposalCode,
        updatedAt: new Date()
      },
      include: {
        case: { include: { prospectClient: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 }
      }
    });

    const dto = toClientSafeProposalDTO(updatedProposal, updatedProposal.versions[0]);

    return NextResponse.json({ proposal: updatedProposal, dto });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update proposal." },
      { status: 500 }
    );
  }
}
