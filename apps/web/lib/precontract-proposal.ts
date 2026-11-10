import crypto from "crypto";
import type { PrismaClient } from "@ahh-wfm/database";

export const ACTIVE_PROPOSAL_STATUSES = [
  "DRAFT",
  "IN_WORKFLOW",
  "APPROVED_INTERNAL",
  "APPROVED",
  "ISSUED_TO_CLIENT"
] as const;

export interface ActiveProposalSummary {
  id: string;
  proposalCode: string | null;
  title: string;
  status: string;
  currentVersionNumber: number;
  caseId: string;
  costEstimateVersionId: string;
  url: string;
}

type ProposalQueryClient = Pick<PrismaClient, "preContractProposal" | "preContractProposalVersion">;

export function buildActiveProposalSummary(
  proposal: {
    id: string;
    proposalCode: string | null;
    status: string;
    currentVersionNumber: number;
    caseId: string;
    versions?: Array<{ title?: string | null; costEstimateVersionId: string }>;
  },
  fallbackCostEstimateVersionId?: string
): ActiveProposalSummary {
  const latestVersion = proposal.versions?.[0];
  return {
    id: proposal.id,
    proposalCode: proposal.proposalCode || null,
    title: latestVersion?.title || proposal.proposalCode || `Quotation ${proposal.id.slice(0, 8)}`,
    status: proposal.status,
    currentVersionNumber: proposal.currentVersionNumber,
    caseId: proposal.caseId,
    costEstimateVersionId: latestVersion?.costEstimateVersionId || fallbackCostEstimateVersionId || "",
    url: `/commercial/proposals/${proposal.id}`
  };
}

export async function findActiveProposalForBaseline(
  db: Pick<ProposalQueryClient, "preContractProposal">,
  params: {
    caseId: string;
    costEstimateVersionId: string;
    excludeProposalId?: string;
  }
): Promise<ActiveProposalSummary | null> {
  const existing = await db.preContractProposal.findFirst({
    where: {
      caseId: params.caseId,
      ...(params.excludeProposalId ? { id: { not: params.excludeProposalId } } : {}),
      status: { in: [...ACTIVE_PROPOSAL_STATUSES] },
      versions: {
        some: {
          costEstimateVersionId: params.costEstimateVersionId,
          status: { in: [...ACTIVE_PROPOSAL_STATUSES] }
        }
      }
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      versions: {
        where: {
          costEstimateVersionId: params.costEstimateVersionId,
          status: { in: [...ACTIVE_PROPOSAL_STATUSES] }
        },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          title: true,
          costEstimateVersionId: true
        }
      }
    }
  });

  if (!existing) {
    return null;
  }

  return buildActiveProposalSummary(existing, params.costEstimateVersionId);
}

export async function findActiveProposalsByCostingVersionIds(
  db: Pick<ProposalQueryClient, "preContractProposalVersion">,
  costEstimateVersionIds: string[]
): Promise<Map<string, ActiveProposalSummary>> {
  const map = new Map<string, ActiveProposalSummary>();
  const uniqueIds = Array.from(new Set(costEstimateVersionIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return map;
  }

  const activeVersions = await db.preContractProposalVersion.findMany({
    where: {
      costEstimateVersionId: { in: uniqueIds },
      status: { in: [...ACTIVE_PROPOSAL_STATUSES] },
      proposal: {
        status: { in: [...ACTIVE_PROPOSAL_STATUSES] }
      }
    },
    orderBy: [{ createdAt: "asc" }, { proposalId: "asc" }, { versionNumber: "desc" }],
    include: {
      proposal: {
        select: {
          id: true,
          proposalCode: true,
          status: true,
          currentVersionNumber: true,
          caseId: true
        }
      }
    }
  });

  for (const ver of activeVersions) {
    if (!ver.proposal || map.has(ver.costEstimateVersionId)) {
      continue;
    }
    map.set(
      ver.costEstimateVersionId,
      buildActiveProposalSummary(
        {
          ...ver.proposal,
          versions: [{ title: ver.title, costEstimateVersionId: ver.costEstimateVersionId }]
        },
        ver.costEstimateVersionId
      )
    );
  }

  return map;
}

export function buildDuplicateQuotationConflictPayload(existingProposal: ActiveProposalSummary) {
  const label = existingProposal.proposalCode || existingProposal.title || existingProposal.id.slice(0, 8);
  return {
    error: `Duplicate Quotation Blocked: An active quotation (${label}, ${existingProposal.status} v${existingProposal.currentVersionNumber}.0) already exists for this opportunity case and approved costing baseline. Open the existing quotation to edit or create a revision instead.`,
    code: "DUPLICATE_QUOTATION_BASELINE",
    existingProposal
  };
}

export interface ClientSafeProposalDTO {
  id: string;
  proposalCode: string | null;
  caseId: string;
  companyId: string | null;
  operationType: string | null;
  status: string;
  versionNumber: number;
  title: string;
  sellingPrice: number;
  currency: string;
  validityDays: number | null;
  validUntil: string | null;
  isExpired: boolean;
  scopeSummary: string | null;
  assumptions: string | null;
  exclusions: string | null;
  termsAndConditions: string | null;
  issuedAt: string | null;
  issuedBy: string | null;
  snapshotChecksum: string | null;
  createdAt: string;
  updatedAt: string;
  client?: {
    name: string | null;
    companyId: string | null;
  } | null;
  opportunity?: {
    title: string;
    companyId: string;
    operationType: string;
  } | null;
}

export function isProposalExpired(status: string, validUntil?: Date | string | null): boolean {
  if (status !== "ISSUED_TO_CLIENT" || !validUntil) {
    return false;
  }
  const expiryDate = new Date(validUntil);
  return new Date() > expiryDate;
}

export function toClientSafeProposalDTO(proposal: any, version?: any): ClientSafeProposalDTO {
  const ver = version || (proposal.versions && proposal.versions[0]) || {};
  const validUntilStr = ver.validUntil ? new Date(ver.validUntil).toISOString() : null;
  const status = ver.status || proposal.status || "DRAFT";

  return {
    id: proposal.id,
    proposalCode: proposal.proposalCode || null,
    caseId: proposal.caseId,
    companyId: proposal.companyId || null,
    operationType: proposal.operationType || null,
    status: status,
    versionNumber: ver.versionNumber || 1,
    title: ver.title || "Commercial Proposal",
    sellingPrice: Number(ver.sellingPrice || 0),
    currency: ver.currency || "QAR",
    validityDays: ver.validityDays !== undefined && ver.validityDays !== null ? Number(ver.validityDays) : null,
    validUntil: validUntilStr,
    isExpired: isProposalExpired(status, ver.validUntil),
    scopeSummary: ver.scopeSummary || null,
    assumptions: ver.assumptions || null,
    exclusions: ver.exclusions || null,
    termsAndConditions: ver.termsAndConditions || null,
    issuedAt: ver.issuedAt ? new Date(ver.issuedAt).toISOString() : null,
    issuedBy: ver.issuedBy || null,
    snapshotChecksum: ver.snapshotChecksum || null,
    createdAt: new Date(proposal.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(proposal.updatedAt || Date.now()).toISOString(),
    client: proposal.case && proposal.case.prospectClient ? {
      name: proposal.case.prospectClient.name,
      companyId: proposal.case.prospectClient.companyId
    } : null,
    opportunity: proposal.case ? {
      title: proposal.case.title,
      companyId: proposal.case.companyId,
      operationType: proposal.case.operationType
    } : null
  };
}

export function generateProposalSnapshot(proposal: any, version: any) {
  const clientSafeDTO = toClientSafeProposalDTO(proposal, version);
  const payload = {
    snapshotType: "PRE_CONTRACT_PROPOSAL_VERSION",
    generatedAt: new Date().toISOString(),
    proposalId: proposal.id,
    proposalCode: proposal.proposalCode,
    versionNumber: version.versionNumber,
    costEstimateVersionId: version.costEstimateVersionId,
    costEstimateChecksum: version.costEstimateChecksum,
    clientFacingContent: clientSafeDTO
  };

  const snapshotJson = JSON.stringify(payload);
  const checksum = crypto.createHash("sha256").update(snapshotJson).digest("hex");

  return { snapshotJson, checksum };
}
