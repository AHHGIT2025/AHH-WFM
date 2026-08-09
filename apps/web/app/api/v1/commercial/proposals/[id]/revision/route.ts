import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { toClientSafeProposalDTO } from "../../../../../../../lib/precontract-proposal";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.proposal.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const proposalId = params.id;
    const body = await req.json().catch(() => ({}));
    const { costEstimateVersionId, title, validityDays, scopeSummary, assumptions, exclusions, termsAndConditions } = body;

    const proposal = await prisma.preContractProposal.findUnique({
      where: { id: proposalId },
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
      return NextResponse.json({ error: "Current proposal version not found." }, { status: 404 });
    }

    let costingVersion = null;
    if (costEstimateVersionId) {
      costingVersion = await prisma.preContractCostEstimateVersion.findUnique({
        where: { id: costEstimateVersionId },
        include: { estimate: true }
      });
      if (!costingVersion) {
        return NextResponse.json({ error: "Linked cost estimate version not found." }, { status: 404 });
      }
      if (costingVersion.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Invalid Costing Baseline: Proposal revision must link to an APPROVED costing version." },
          { status: 400 }
        );
      }
    } else {
      costingVersion = await prisma.preContractCostEstimateVersion.findUnique({
        where: { id: currentVersion.costEstimateVersionId }
      });
      if (!costingVersion) {
        return NextResponse.json({ error: "Existing linked cost estimate version not found." }, { status: 404 });
      }
    }

    const nextVersionNumber = currentVersion.versionNumber + 1;

    let validUntil: Date | null = null;
    const vDays = validityDays !== undefined && validityDays !== null ? Number(validityDays) : currentVersion.validityDays;
    if (vDays && vDays > 0) {
      validUntil = new Date(Date.now() + vDays * 24 * 60 * 60 * 1000);
    }

    const newVersion = await prisma.preContractProposalVersion.create({
      data: {
        proposalId: proposal.id,
        versionNumber: nextVersionNumber,
        clonedFromVersionId: currentVersion.id,
        costEstimateId: costingVersion.estimateId,
        costEstimateVersionId: costingVersion.id,
        costEstimateChecksum: costingVersion.checksum || null,
        status: "DRAFT",
        title: title?.trim() || currentVersion.title,
        sellingPrice: costingVersion.sellingPrice,
        currency: costingVersion.currency,
        validityDays: vDays,
        validUntil,
        scopeSummary: scopeSummary !== undefined ? scopeSummary?.trim() || null : currentVersion.scopeSummary,
        assumptions: assumptions !== undefined ? assumptions?.trim() || null : currentVersion.assumptions,
        exclusions: exclusions !== undefined ? exclusions?.trim() || null : currentVersion.exclusions,
        termsAndConditions: termsAndConditions !== undefined ? termsAndConditions?.trim() || null : currentVersion.termsAndConditions,
        createdBy: user.name || user.email || user.id
      }
    });

    const updatedProposal = await prisma.preContractProposal.update({
      where: { id: proposal.id },
      data: {
        currentVersionNumber: nextVersionNumber,
        status: "DRAFT",
        updatedAt: new Date()
      },
      include: {
        case: { include: { prospectClient: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 }
      }
    });

    const dto = toClientSafeProposalDTO(updatedProposal, newVersion);

    return NextResponse.json({ proposal: updatedProposal, newVersion, dto }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create proposal revision." },
      { status: 500 }
    );
  }
}
