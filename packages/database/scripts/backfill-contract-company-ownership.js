const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { PrismaClient } = require("../src/generated/client");
const prisma = new PrismaClient();

function parseApprovedMappings(mappingFile) {
  if (!mappingFile) return new Map();
  const abs = path.isAbsolute(mappingFile) ? mappingFile : path.resolve(process.cwd(), mappingFile);
  const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  const map = new Map();
  const entries = Array.isArray(raw) ? raw : Object.entries(raw).map(([contractId, v]) => ({ contractId, ...(typeof v === "string" ? { companyId: v } : v) }));
  for (const item of entries) {
    if (!item || !item.contractId || !item.companyId || !item.approvedBy) {
      throw new Error(`Invalid mapping entry in ${mappingFile}: contractId, companyId, and approvedBy are required.`);
    }
    if (map.has(item.contractId) && map.get(item.contractId).companyId !== item.companyId) {
      throw new Error(`Conflicting duplicate mapping in ${mappingFile} for contract ${item.contractId}.`);
    }
    map.set(item.contractId, { companyId: item.companyId, approvedBy: item.approvedBy });
  }
  return map;
}

async function classifyAndBackfill({
  apply = false,
  confirmApply = false,
  allowProductionBackfill = false,
  mappingFile = null,
  contractIdsFilter = null,
} = {}) {
  if (apply && !confirmApply) {
    throw new Error("Refusing --apply without explicit --confirm-apply authorization flag.");
  }
  if (apply && process.env.NODE_ENV === "production" && !allowProductionBackfill) {
    throw new Error("Refusing --apply in NODE_ENV=production without explicit --allow-production-backfill.");
  }

  const approvedMappings = parseApprovedMappings(mappingFile);
  const validCompanies = new Set(
    (await prisma.company.findMany({ select: { id: true } })).map((c) => c.id)
  );
  for (const [cid, m] of approvedMappings.entries()) {
    if (!validCompanies.has(m.companyId)) {
      throw new Error(`Approved mapping for contract ${cid} references nonexistent companyId ${m.companyId}.`);
    }
  }

  const contracts = await prisma.manpowerContract.findMany({
    where: Array.isArray(contractIdsFilter) && contractIdsFilter.length > 0 ? { id: { in: contractIdsFilter } } : undefined,
    include: {
      client: { select: { id: true, name: true, code: true, companyId: true, isSharedClient: true } },
      projects: { select: { id: true, name: true, code: true, companyId: true } },
      workflows: { select: { id: true, companyId: true, status: true } },
      sourceProposalVersion: {
        select: {
          id: true,
          costEstimate: { select: { case: { select: { id: true, companyId: true } } } },
        },
      },
      sourceClientResponse: {
        select: {
          id: true,
          proposalVersion: {
            select: {
              costEstimate: { select: { case: { select: { id: true, companyId: true } } } },
            },
          },
        },
      },
    },
  });

  const summary = {
    mode: apply ? "APPLY" : "DRY_RUN",
    totalContracts: contracts.length,
    alreadyOwned: 0,
    categoryA_authoritative: 0,
    categoryB_conflicting: 0,
    categoryC_unmapped: 0,
    categoryD_requiresConfirmation: 0,
    updatedContracts: 0,
    updatedProjects: 0,
    updatedWorkflows: 0,
  };

  const exceptionRegister = [];

  for (const c of contracts) {
    const candidates = new Set();
    const sources = [];

    const propCaseComp = c.sourceProposalVersion?.costEstimate?.case?.companyId;
    if (propCaseComp && validCompanies.has(propCaseComp)) {
      candidates.add(propCaseComp);
      sources.push(`PreContractCase(proposal):${propCaseComp}`);
    }

    const respCaseComp = c.sourceClientResponse?.proposalVersion?.costEstimate?.case?.companyId;
    if (respCaseComp && validCompanies.has(respCaseComp)) {
      candidates.add(respCaseComp);
      sources.push(`PreContractCase(clientResponse):${respCaseComp}`);
    }

    if (c.client && !c.client.isSharedClient && c.client.companyId && validCompanies.has(c.client.companyId)) {
      candidates.add(c.client.companyId);
      sources.push(`ManpowerClient:${c.client.companyId}`);
    }

    for (const p of c.projects || []) {
      if (p.companyId && validCompanies.has(p.companyId)) {
        candidates.add(p.companyId);
        sources.push(`ManpowerProject(${p.code}):${p.companyId}`);
      }
    }

    const manualMapping = approvedMappings.get(c.id);
    if (manualMapping) {
      candidates.add(manualMapping.companyId);
      sources.push(`ApprovedMapping(${manualMapping.approvedBy}):${manualMapping.companyId}`);
    }

    if (c.companyId) {
      summary.alreadyOwned += 1;
      if (candidates.size > 0 && (!candidates.has(c.companyId) || candidates.size > 1)) {
        summary.categoryB_conflicting += 1;
        exceptionRegister.push({
          recordId: c.id,
          entityType: "ManpowerContract",
          reference: c.contractNumber,
          status: c.status,
          candidateCompanies: Array.from(new Set([c.companyId, ...candidates])),
          evidenceSource: sources.join("; "),
          conflictReason: "Existing contract.companyId conflicts with lineage/mapping candidates",
          proposedOwnership: c.companyId,
          ownerRole: "Operations / Commercial Management",
          verificationStatus: "CONFLICTING_OWNERSHIP",
          approvalStatus: "PENDING_SIGN_OFF",
        });
      }
      continue;
    }

    if (candidates.size === 1) {
      const resolvedCompanyId = Array.from(candidates)[0];
      summary.categoryA_authoritative += 1;
      if (apply) {
        await prisma.$transaction(async (tx) => {
          await tx.manpowerContract.update({
            where: { id: c.id },
            data: { companyId: resolvedCompanyId },
          });
          summary.updatedContracts += 1;

          for (const p of c.projects || []) {
            if (!p.companyId) {
              await tx.manpowerProject.update({
                where: { id: p.id },
                data: { companyId: resolvedCompanyId },
              });
              summary.updatedProjects += 1;
            }
          }
          for (const wf of c.workflows || []) {
            if (!wf.companyId) {
              await tx.contractApprovalWorkflow.update({
                where: { id: wf.id },
                data: { companyId: resolvedCompanyId },
              });
              summary.updatedWorkflows += 1;
            }
          }
        });
      }
    } else if (candidates.size > 1) {
      summary.categoryB_conflicting += 1;
      exceptionRegister.push({
        recordId: c.id,
        entityType: "ManpowerContract",
        reference: c.contractNumber,
        status: c.status,
        candidateCompanies: Array.from(candidates),
        evidenceSource: sources.join("; "),
        conflictReason: "Multiple conflicting company associations across lineage",
        proposedOwnership: null,
        ownerRole: "Operations / Commercial Management",
        verificationStatus: "CONFLICTING_OWNERSHIP",
        approvalStatus: "PENDING_SIGN_OFF",
      });
    } else {
      summary.categoryC_unmapped += 1;
      exceptionRegister.push({
        recordId: c.id,
        entityType: "ManpowerContract",
        reference: c.contractNumber,
        status: c.status,
        candidateCompanies: [],
        evidenceSource: "NONE (no PreContractCase or subsidiary-owned client lineage)",
        conflictReason: "Unmapped legacy/seeded contract without authoritative company lineage",
        proposedOwnership: null,
        ownerRole: "Operations / Commercial Management",
        verificationStatus: "UNMAPPED",
        approvalStatus: "PENDING_SIGN_OFF",
      });
    }
  }

  return { summary, exceptionRegister };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const confirmApply = args.includes("--confirm-apply");
  const allowProductionBackfill = args.includes("--allow-production-backfill");
  const mapArg = args.find((a) => a.startsWith("--mapping-file="));
  const mappingFile = mapArg ? mapArg.slice("--mapping-file=".length) : null;

  classifyAndBackfill({ apply, confirmApply, allowProductionBackfill, mappingFile })
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error("Backfill error:", err.message || err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { classifyAndBackfill };
