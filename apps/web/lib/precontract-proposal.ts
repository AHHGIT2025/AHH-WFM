import crypto from "crypto";

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
