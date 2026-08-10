import { prisma } from "@ahh-wfm/database";
import { isProposalExpired } from "./precontract-proposal";

export interface RecordClientResponseInput {
  proposalId: string;
  proposalVersionId: string;
  responseType: "ACCEPTED" | "REJECTED" | "CHANGE_REQUESTED";
  clientContactName?: string;
  clientReference?: string;
  notes?: string;
  snapshotChecksum: string;
  recordedById: string;
}

export interface ConvertToContractInput {
  proposalVersionId: string;
  contractNumber: string;
  startDate: Date | string;
  endDate: Date | string;
  clientId?: string;
  siteId?: string;
  projectId?: string;
  billingBasis?: string;
  totalContractValue?: number | null;
  manpowerItems?: Array<{
    position: string;
    quantity: number;
    deploymentType?: string;
    unitPrice?: number | null;
    lineTotal?: number | null;
  }>;
  shiftItems?: Array<{
    shiftName: string;
    startTime: string;
    endTime: string;
    postsCovered: number;
    daysPattern: string;
  }>;
  relieverItems?: Array<{
    position: string;
    quantity: number;
    sourcePreference: string;
  }>;
  documentIds?: string[];
  userId: string;
}

/**
 * 1. Record Client Response for an ISSUED_TO_CLIENT Proposal Version.
 * Enforces:
 * - ProposalVersion must be ISSUED_TO_CLIENT.
 * - ProposalVersion must not be dynamically expired.
 * - Exactly 1 terminal ClientResponse per ProposalVersion (@unique proposalVersionId).
 * - Checksum match.
 * - Preserves ProposalVersion.status = "ISSUED_TO_CLIENT".
 */
export async function recordClientResponse(input: RecordClientResponseInput) {
  const { proposalId, proposalVersionId, responseType, clientContactName, clientReference, notes, snapshotChecksum, recordedById } = input;

  const version = await prisma.preContractProposalVersion.findUnique({
    where: { id: proposalVersionId },
    include: { proposal: true, clientResponse: true }
  });

  if (!version) {
    throw new Error("Proposal version not found.");
  }

  if (version.proposalId !== proposalId) {
    throw new Error("Proposal version does not belong to specified proposal.");
  }

  if (version.status !== "ISSUED_TO_CLIENT") {
    throw new Error(`Client response can only be recorded for ISSUED_TO_CLIENT proposals. Current status: ${version.status}`);
  }

  if (isProposalExpired(version.status, version.validUntil)) {
    throw new Error("Cannot record client response: Proposal version has expired.");
  }

  if (version.clientResponse) {
    throw new Error("A terminal client response has already been recorded for this proposal version.");
  }

  // Verify checksum
  if (version.snapshotChecksum && version.snapshotChecksum !== snapshotChecksum) {
    const error = new Error("Snapshot integrity checksum mismatch.");
    (error as any).statusCode = 409;
    throw error;
  }

  // Create immutable client response log
  const clientResponse = await prisma.preContractClientResponse.create({
    data: {
      proposalId,
      proposalVersionId,
      responseType,
      clientContactName: clientContactName || null,
      clientReference: clientReference || null,
      notes: notes || null,
      snapshotChecksum: snapshotChecksum || version.snapshotChecksum || "",
      recordedById
    }
  });

  return clientResponse;
}

/**
 * 2. Check Conversion Readiness for a Proposal Version.
 */
export async function getConversionReadiness(proposalVersionId: string) {
  const version = await prisma.preContractProposalVersion.findUnique({
    where: { id: proposalVersionId },
    include: {
      proposal: {
        include: {
          case: {
            include: { prospectClient: true }
          }
        }
      },
      clientResponse: true,
      costEstimateVersion: {
        include: { items: true }
      }
    }
  });

  if (!version) {
    return { ready: false, blockers: ["Proposal version not found."] };
  }

  const blockers: string[] = [];

  if (version.status !== "ISSUED_TO_CLIENT") {
    blockers.push(`Proposal version status must be ISSUED_TO_CLIENT. Current: ${version.status}`);
  }

  if (isProposalExpired(version.status, version.validUntil)) {
    blockers.push(`Proposal version has expired (valid until ${version.validUntil}).`);
  }

  if (!version.clientResponse) {
    blockers.push("No client response recorded for this proposal version.");
  } else if (version.clientResponse.responseType !== "ACCEPTED") {
    blockers.push(`Client response is ${version.clientResponse.responseType}. Must be ACCEPTED.`);
  }

  // Check if contract already converted
  let existingContract: any = null;
  if (version.clientResponse) {
    existingContract = await prisma.manpowerContract.findUnique({
      where: { sourceClientResponseId: version.clientResponse.id }
    });
    if (existingContract) {
      blockers.push(`Contract already converted (Contract Number: ${existingContract.contractNumber}).`);
    }
  }

  // Client Master readiness
  const caseRecord = version.proposal?.case;
  const clientId = caseRecord?.existingClientId || caseRecord?.prospectClient?.matchedClientMasterId || null;
  if (!clientId) {
    blockers.push("Client master is not linked or resolved. Prepare Client Master before conversion.");
  }

  return {
    ready: blockers.length === 0,
    version,
    clientResponse: version.clientResponse,
    existingContract,
    resolvedClientId: clientId,
    blockers
  };
}

/**
 * 3. Convert Accepted Proposal Version to DRAFT ManpowerContract.
 * Enforces:
 * - Readiness checks.
 * - Idempotency: Returns existing contract (200 OK) if sourceClientResponseId already converted.
 * - Contract created in DRAFT status, approvalStatus = DRAFT. Zero auto-activation.
 * - Proposal sellingPrice preserved as provenance. totalContractValue is NULL unless explicitly provided.
 * - Proposal currency inherited exact. No hardcoded QAR default.
 * - Internal cost leakage prevented.
 * - Requirement mapping using Prisma model defaults.
 * - Atomic $transaction.
 */
export async function convertToContract(input: ConvertToContractInput) {
  const { proposalVersionId, contractNumber, startDate, endDate, clientId: explicitClientId, siteId, projectId, billingBasis, totalContractValue, manpowerItems, shiftItems, relieverItems, documentIds, userId } = input;

  const readiness = await getConversionReadiness(proposalVersionId);

  // Idempotency check: if contract already exists for this client response, return it cleanly
  if (readiness.existingContract) {
    return { contract: readiness.existingContract, alreadyConverted: true };
  }

  if (!readiness.clientResponse || readiness.clientResponse.responseType !== "ACCEPTED") {
    throw new Error("Cannot convert: Client response must be ACCEPTED.");
  }

  const version = readiness.version!;
  const clientId = explicitClientId || readiness.resolvedClientId;

  if (!clientId) {
    throw new Error("Cannot convert: Authoritative Client Master ID is required.");
  }

  // Verify client exists
  const clientExists = await prisma.manpowerClient.findUnique({ where: { id: clientId } });
  if (!clientExists) {
    throw new Error(`Client ID ${clientId} does not exist in Client Master.`);
  }

  // Duplicate contractNumber check
  const existingNumber = await prisma.manpowerContract.findUnique({ where: { contractNumber } });
  if (existingNumber) {
    throw new Error(`Contract number '${contractNumber}' is already in use.`);
  }

  const opType = version.proposal.operationType || version.proposal.case.operationType || "SECURITY_GUARDING";
  const startDt = new Date(startDate);
  const endDt = new Date(endDate);

  // Resolve manpower items to inherit from cost estimate items if not explicitly provided
  const itemsToCreate = manpowerItems && manpowerItems.length > 0
    ? manpowerItems
    : (version.costEstimateVersion?.items || []).map(item => ({
        position: item.elementName || item.elementCode || "General Staff",
        quantity: Number(item.quantity) || 1,
        deploymentType: "REGULAR",
        unitPrice: null,
        lineTotal: null
      }));

  // Execute in single atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Idempotency re-verify inside transaction lock
    const existingTx = await tx.manpowerContract.findUnique({
      where: { sourceClientResponseId: readiness.clientResponse!.id }
    });
    if (existingTx) {
      return { contract: existingTx, alreadyConverted: true };
    }

    // 2. Create DRAFT ManpowerContract
    const contract = await tx.manpowerContract.create({
      data: {
        clientId,
        contractNumber,
        title: version.title || `Contract for ${version.proposal.case.title || "Proposal"}`,
        startDate: startDt,
        endDate: endDt,
        operationType: opType,
        status: "DRAFT",
        approvalStatus: "DRAFT",
        billingBasis: billingBasis || null,
        totalContractValue: totalContractValue !== undefined ? totalContractValue : null,
        currency: version.currency || null,
        sourceClientResponseId: readiness.clientResponse!.id,
        sourceProposalVersionId: version.id,
        sourceSnapshotChecksum: readiness.clientResponse!.snapshotChecksum,
        siteId: siteId || null,
        projects: projectId ? { connect: [{ id: projectId }] } : undefined,
        manpowerRequirements: {
          create: itemsToCreate.map(m => ({
            position: m.position,
            quantity: m.quantity,
            deploymentType: m.deploymentType || "REGULAR",
            unitPrice: m.unitPrice !== undefined ? m.unitPrice : null,
            lineTotal: m.lineTotal !== undefined ? m.lineTotal : null
            // billingEligible and focStatus intentionally omitted to use Prisma model defaults
          }))
        },
        shiftRequirements: shiftItems && shiftItems.length > 0 ? {
          create: shiftItems.map(s => ({
            shiftName: s.shiftName,
            startTime: s.startTime,
            endTime: s.endTime,
            postsCovered: s.postsCovered,
            daysPattern: s.daysPattern
          }))
        } : undefined,
        relieverRequirements: relieverItems && relieverItems.length > 0 ? {
          create: relieverItems.map(r => ({
            position: r.position,
            quantity: r.quantity,
            sourcePreference: r.sourcePreference
          }))
        } : undefined
      },
      include: {
        manpowerRequirements: true,
        shiftRequirements: true,
        relieverRequirements: true,
        client: true
      }
    });

    // 3. Link Award Documents if provided or attached to client response
    if (documentIds && documentIds.length > 0) {
      await tx.manpowerClientDocument.updateMany({
        where: { id: { in: documentIds } },
        data: { contractId: contract.id }
      });
    } else if (readiness.clientResponse) {
      await tx.manpowerClientDocument.updateMany({
        where: { clientResponseId: readiness.clientResponse.id },
        data: { contractId: contract.id }
      });
    }

    return { contract, alreadyConverted: false };
  });

  return result;
}
