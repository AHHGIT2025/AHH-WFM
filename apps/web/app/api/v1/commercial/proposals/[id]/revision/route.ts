import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { hasPermission, isAdminUser } from "../../../../../../../lib/permissions";
import {
  buildDuplicateQuotationConflictPayload,
  findActiveProposalForBaseline,
  toClientSafeProposalDTO
} from "../../../../../../../lib/precontract-proposal";

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

    const proposalMeta = await prisma.preContractProposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        caseId: true,
        companyId: true,
        operationType: true
      }
    });

    if (!proposalMeta) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const canCrossCompany =
      hasPermission(user, "precontract.proposal.crossCompany") ||
      isAdminUser(user) ||
      hasPermission(user, "manpower.admin.full_access");
    if (!canCrossCompany && proposalMeta.companyId) {
      if (user.allowedCompanyIds && user.allowedCompanyIds.length > 0 && !user.allowedCompanyIds.includes(proposalMeta.companyId)) {
        return NextResponse.json({ error: "Forbidden: You are not authorized to revise proposals for this company." }, { status: 403 });
      }
      if (user.companyId && proposalMeta.companyId !== user.companyId) {
        return NextResponse.json({ error: "Forbidden: You are not authorized to revise proposals for this company." }, { status: 403 });
      }
    }

    if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
      const allowedSG = user?.operationAccess?.allowedSecurityGuarding ?? user?.allowedSecurityGuarding ?? true;
      const allowedFM = user?.operationAccess?.allowedFacilityManagement ?? user?.allowedFacilityManagement ?? true;
      if (proposalMeta.operationType === "SECURITY_GUARDING" && !allowedSG) {
        return NextResponse.json({ error: "Forbidden: You do not have access to Security Guarding operational data." }, { status: 403 });
      }
      if (proposalMeta.operationType === "FACILITY_MANAGEMENT" && !allowedFM) {
        return NextResponse.json({ error: "Forbidden: You do not have access to Facility Management operational data." }, { status: 403 });
      }
    }

    const actorId = user.id || user.email || user.name || "SYSTEM";
    const actorDisplay = user.name || user.email || user.id || "SYSTEM";

    const txResult = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM \`PreContractProposal\` WHERE id = ${proposalId} FOR UPDATE
      `;

      const proposal = await tx.preContractProposal.findUnique({
        where: { id: proposalId },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1
          }
        }
      });

      if (!proposal) {
        return { kind: "proposal_not_found" as const };
      }

      const currentVersion = proposal.versions[0];
      if (!currentVersion) {
        return { kind: "version_not_found" as const };
      }

      const targetCostEstimateVersionId = costEstimateVersionId
        ? String(costEstimateVersionId).trim()
        : currentVersion.costEstimateVersionId;

      await tx.$queryRaw`
        SELECT id, status FROM \`PreContractCostEstimateVersion\` WHERE id = ${targetCostEstimateVersionId} FOR UPDATE
      `;

      const costingVersion = await tx.preContractCostEstimateVersion.findUnique({
        where: { id: targetCostEstimateVersionId },
        include: { estimate: true }
      });

      if (!costingVersion) {
        return {
          kind: "costing_not_found" as const,
          isExplicit: Boolean(costEstimateVersionId)
        };
      }

      if (!costingVersion.estimate || costingVersion.estimate.caseId !== proposal.caseId) {
        return { kind: "invalid_case" as const };
      }

      if (costEstimateVersionId && costingVersion.status !== "APPROVED") {
        return { kind: "not_approved" as const };
      }

      // If switching to a different approved baseline, ensure another active proposal does not already own it.
      if (targetCostEstimateVersionId !== currentVersion.costEstimateVersionId) {
        const conflictingProposal = await findActiveProposalForBaseline(tx, {
          caseId: proposal.caseId,
          costEstimateVersionId: costingVersion.id,
          excludeProposalId: proposal.id
        });
        if (conflictingProposal) {
          return { kind: "duplicate" as const, existingProposal: conflictingProposal };
        }
      }

      const nextVersionNumber = currentVersion.versionNumber + 1;

      let validUntil: Date | null = null;
      const vDays = validityDays !== undefined && validityDays !== null ? Number(validityDays) : currentVersion.validityDays;
      if (vDays && vDays > 0) {
        validUntil = new Date(Date.now() + vDays * 24 * 60 * 60 * 1000);
      }

      const newVersion = await tx.preContractProposalVersion.create({
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
          createdBy: actorDisplay
        }
      });

      const updatedProposal = await tx.preContractProposal.update({
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

      await tx.userActivityLog.create({
        data: {
          userId: actorId,
          action: "CREATE_PROPOSAL_REVISION",
          entityType: "PreContractProposal",
          entityId: proposal.id,
          afterJson: JSON.stringify({
            proposalId: proposal.id,
            previousVersionNumber: currentVersion.versionNumber,
            newVersionNumber: nextVersionNumber,
            costEstimateVersionId: costingVersion.id
          })
        }
      });

      return { kind: "created" as const, updatedProposal, newVersion };
    });

    if (txResult.kind === "proposal_not_found") {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }
    if (txResult.kind === "version_not_found") {
      return NextResponse.json({ error: "Current proposal version not found." }, { status: 404 });
    }
    if (txResult.kind === "costing_not_found") {
      return NextResponse.json(
        {
          error: txResult.isExplicit
            ? "Linked cost estimate version not found."
            : "Existing linked cost estimate version not found."
        },
        { status: 404 }
      );
    }
    if (txResult.kind === "invalid_case") {
      return NextResponse.json(
        { error: "Invalid Costing Baseline: Selected costing version does not belong to the proposal's opportunity case." },
        { status: 400 }
      );
    }
    if (txResult.kind === "not_approved") {
      return NextResponse.json(
        { error: "Invalid Costing Baseline: Proposal revision must link to an APPROVED costing version." },
        { status: 400 }
      );
    }
    if (txResult.kind === "duplicate") {
      return NextResponse.json(
        buildDuplicateQuotationConflictPayload(txResult.existingProposal),
        { status: 409 }
      );
    }

    const dto = toClientSafeProposalDTO(txResult.updatedProposal, txResult.newVersion);

    return NextResponse.json(
      { proposal: txResult.updatedProposal, newVersion: txResult.newVersion, dto },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create proposal revision." },
      { status: 500 }
    );
  }
}
