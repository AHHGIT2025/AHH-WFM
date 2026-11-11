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

export interface ResolvedClientMasterSummary {
  id: string;
  code: string;
  name: string;
  operationType: string;
  isActive: boolean;
}

export interface DerivedManpowerItem {
  sourceElementCode: string | null;
  position: string;
  quantity: number;
  deploymentType: string;
  costingBasis: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  isValid: boolean;
  validationError?: string;
}

export interface ConvertToContractInput {
  proposalVersionId: string;
  contractNumber: string;
  startDate: Date | string;
  endDate: Date | string;
  noticePeriodDays?: number | null;
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

export function deriveManpowerItemsFromCosting(costEstimateVersion?: {
  items?: Array<{
    elementCode?: string | null;
    elementName?: string | null;
    categoryCode?: string | null;
    isDirect?: boolean | null;
    quantity?: any;
  }>;
} | null): DerivedManpowerItem[] {
  const items = costEstimateVersion?.items || [];
  const hasPrimaryDirectStaffing = items.some(
    (item) =>
      item.isDirect !== false &&
      item.categoryCode !== "INDIRECT_OVERHEAD" &&
      item.elementCode !== "SITE_OVERHEAD" &&
      item.elementCode !== "ALLOWANCES"
  );

  return items
    .filter((item) => {
      if (item.isDirect === false) return false;
      if (item.categoryCode === "INDIRECT_OVERHEAD" || item.elementCode === "SITE_OVERHEAD") {
        return false;
      }
      if (item.elementCode === "ALLOWANCES" && hasPrimaryDirectStaffing) {
        return false;
      }
      return true;
    })
    .map((item) => {
      const position = (item.elementName || item.elementCode || "").trim();
      const rawQty = item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : NaN;
      const isPositiveInteger = Number.isInteger(rawQty) && rawQty > 0;
      const deploymentType =
        (item as any).deploymentType ||
        (item.categoryCode === "RELIEVER" || item.elementCode === "RELIEVER_COST" ? "RELIEVER" : "REGULAR");

      let validationError: string | undefined;
      if (!position) {
        validationError = "Position title is missing from costing baseline item.";
      } else if (!isPositiveInteger) {
        validationError = `Headcount must be a positive whole number for '${position}'.`;
      }

      return {
        sourceElementCode: item.elementCode || null,
        position,
        quantity: isPositiveInteger ? rawQty : 0,
        deploymentType,
        costingBasis: item.categoryCode || null,
        unitPrice: null,
        lineTotal: null,
        isValid: !validationError,
        ...(validationError ? { validationError } : {})
      };
    });
}

export async function linkClientMasterToCase(params: {
  caseId: string;
  clientId: string;
  expectedOperationType?: string | null;
}): Promise<{ resolvedClientId: string; resolvedClient: ResolvedClientMasterSummary }> {
  const normalizedClientId = (params.clientId || "").trim();
  if (!normalizedClientId) {
    throw new Error("Client Master ID is required.");
  }

  const client = await prisma.manpowerClient.findUnique({
    where: { id: normalizedClientId },
    select: { id: true, code: true, name: true, operationType: true, isActive: true }
  });

  if (!client) {
    throw new Error(`Client ID ${normalizedClientId} does not exist in Client Master.`);
  }
  if (!client.isActive) {
    throw new Error(`Client Master '${client.name}' is inactive and cannot be linked.`);
  }
  if (params.expectedOperationType && client.operationType !== params.expectedOperationType) {
    throw new Error(
      `Operation Scope Mismatch: Client Master '${client.name}' belongs to ${client.operationType}, expected ${params.expectedOperationType}.`
    );
  }

  await prisma.preContractCase.update({
    where: { id: params.caseId },
    data: { existingClientId: client.id }
  });

  return {
    resolvedClientId: client.id,
    resolvedClient: client
  };
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
  const opType = version.proposal?.operationType || caseRecord?.operationType || null;
  const candidateClientId = caseRecord?.existingClientId || caseRecord?.prospectClient?.matchedClientMasterId || null;

  let resolvedClient: ResolvedClientMasterSummary | null = null;
  let validResolvedClientId: string | null = null;

  if (!candidateClientId) {
    blockers.push("Client master is not linked or resolved. Prepare Client Master before conversion.");
  } else {
    resolvedClient = await prisma.manpowerClient.findUnique({
      where: { id: candidateClientId },
      select: { id: true, code: true, name: true, operationType: true, isActive: true }
    });
    if (!resolvedClient) {
      blockers.push(`Linked Client Master (${candidateClientId}) does not exist. Select a valid Client Master before conversion.`);
    } else if (!resolvedClient.isActive) {
      blockers.push(`Linked Client Master '${resolvedClient.name}' is inactive and cannot be converted.`);
    } else if (opType && resolvedClient.operationType !== opType) {
      blockers.push(
        `Client Master scope mismatch: '${resolvedClient.name}' belongs to ${resolvedClient.operationType}, expected ${opType}.`
      );
    } else {
      validResolvedClientId = resolvedClient.id;
    }
  }

  // Manpower Staffing readiness (authoritative direct lines only; no silent placeholders)
  const manpowerItems = deriveManpowerItemsFromCosting(version.costEstimateVersion);
  const invalidManpower = manpowerItems.filter((item) => !item.isValid);
  if (invalidManpower.length > 0) {
    blockers.push(invalidManpower[0].validationError || "One or more inherited staffing rows have incomplete position or headcount.");
  }

  return {
    ready: blockers.length === 0,
    version,
    clientResponse: version.clientResponse,
    existingContract,
    resolvedClientId: validResolvedClientId,
    rawLinkedClientId: candidateClientId,
    resolvedClient,
    manpowerItems,
    proposalStatus: version.status,
    clientAcceptanceStatus: version.clientResponse?.responseType || null,
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
  const { proposalVersionId, contractNumber, startDate, endDate, noticePeriodDays, clientId: explicitClientId, siteId, projectId, billingBasis, totalContractValue, manpowerItems, shiftItems, relieverItems, documentIds, userId } = input;

  const normalizedContractNumber = (contractNumber || "").trim();
  if (!normalizedContractNumber) {
    throw new Error("contractNumber is required.");
  }

  let parsedNoticePeriodDays: number | null = null;
  if (noticePeriodDays !== undefined && noticePeriodDays !== null && String(noticePeriodDays).trim() !== "") {
    const parsed = Number(noticePeriodDays);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error("noticePeriodDays must be a non-negative integer.");
    }
    parsedNoticePeriodDays = parsed;
  }

  const readiness = await getConversionReadiness(proposalVersionId);

  // Idempotency check: if contract already exists for this client response, return it cleanly
  if (readiness.existingContract) {
    return { contract: readiness.existingContract, alreadyConverted: true };
  }

  if (!readiness.clientResponse || readiness.clientResponse.responseType !== "ACCEPTED") {
    throw new Error("Cannot convert: Client response must be ACCEPTED.");
  }

  const version = readiness.version!;
  const opType = version.proposal.operationType || version.proposal.case.operationType || "SECURITY_GUARDING";
  const clientId = explicitClientId || readiness.resolvedClientId;

  if (!clientId) {
    throw new Error("Cannot convert: Authoritative Client Master ID is required.");
  }

  // Verify client exists, is active, and matches operational scope (SG vs FM isolation)
  const clientExists = await prisma.manpowerClient.findUnique({ where: { id: clientId } });
  if (!clientExists) {
    throw new Error(`Client ID ${clientId} does not exist in Client Master.`);
  }
  if (!clientExists.isActive) {
    throw new Error(`Client Master '${clientExists.name}' is inactive and cannot be converted.`);
  }
  if (clientExists.operationType !== opType) {
    throw new Error(
      `Forbidden Scope Mismatch: Client Master '${clientExists.name}' belongs to ${clientExists.operationType}, expected ${opType}.`
    );
  }

  if (siteId) {
    const siteExists = await prisma.manpowerSite.findUnique({ where: { id: siteId } });
    if (!siteExists) {
      throw new Error(`Site ID ${siteId} does not exist in Site Master.`);
    }
    if (siteExists.operationType !== opType) {
      throw new Error(`Forbidden Scope Mismatch: Site '${siteExists.name}' belongs to ${siteExists.operationType}, expected ${opType}.`);
    }
  }

  // Duplicate contractNumber check
  const existingNumber = await prisma.manpowerContract.findUnique({ where: { contractNumber: normalizedContractNumber } });
  if (existingNumber) {
    throw new Error(`Contract number '${normalizedContractNumber}' is already in use.`);
  }

  const startDt = new Date(startDate);
  const endDt = new Date(endDate);

  // Resolve manpower items from explicit input or authoritative costing baseline (no silent placeholders)
  const rawItems = manpowerItems && manpowerItems.length > 0
    ? manpowerItems.map((m) => ({
        position: (m.position || "").trim(),
        quantity: Number(m.quantity),
        deploymentType: m.deploymentType,
        unitPrice: m.unitPrice ?? null,
        lineTotal: m.lineTotal ?? null
      }))
    : deriveManpowerItemsFromCosting(version.costEstimateVersion);

  if (rawItems.length === 0) {
    throw new Error("At least one valid manpower staffing requirement is required for contract conversion.");
  }

  // Enforce strict staffing & USER_INPUT_REQUIRED validation
  const itemsToCreate = rawItems.map((item) => {
    if (!item.position) {
      throw new Error("Position title is required for every manpower requirement.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`Headcount must be a positive integer for manpower requirement '${item.position}'.`);
    }
    if (!item.deploymentType || !item.deploymentType.trim()) {
      throw new Error(`deploymentType is required for manpower requirement '${item.position}'.`);
    }
    return {
      ...item,
      deploymentType: item.deploymentType.trim()
    };
  });

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
        contractNumber: normalizedContractNumber,
        title: version.title || `Contract for ${version.proposal.case.title || "Proposal"}`,
        startDate: startDt,
        endDate: endDt,
        noticePeriodDays: parsedNoticePeriodDays,
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
            deploymentType: m.deploymentType,
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
