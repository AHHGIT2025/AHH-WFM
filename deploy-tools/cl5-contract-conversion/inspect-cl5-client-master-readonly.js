#!/usr/bin/env node
/**
 * RUN ON SERVER (READ-ONLY)
 * AHH WFM — CL-5 SERVER Client Master & Opportunity Dependency Read-Only Inspector
 * Searches existing ManpowerClient records for possible aliases (QatarEnergy, QP, Qatargas, etc.),
 * inspects PreContractProspectClient links, Opportunity 7288fa74-46e9-441c-94d7-9990a44ccdc0,
 * and Proposal ebf98ba2-fb41-4c17-830d-50d648dd0806 without performing ANY writes.
 */
"use strict";

const path = require("path");
const fs = require("fs");

function resolveRepoPath() {
  const arg = process.argv.find((a) => a.startsWith("--repo="));
  if (arg) return arg.slice("--repo=".length);
  return process.env.REPO_PATH || "D:\\Apps\\AHH-WFM\\dev";
}

function loadPrismaClient(repoPath) {
  const candidates = [
    path.join(repoPath, "packages", "database", "dist", "generated", "client"),
    path.join(repoPath, "packages", "database", "src", "generated", "client"),
    "@ahh-wfm/database"
  ];
  for (const modPath of candidates) {
    try {
      if (modPath === "@ahh-wfm/database" || fs.existsSync(modPath)) {
        const loaded = require(modPath);
        if (loaded && loaded.PrismaClient) {
          return { PrismaClient: loaded.PrismaClient, loadedFrom: modPath };
        }
        if (loaded && loaded.prisma) {
          return { existingInstance: loaded.prisma, loadedFrom: modPath };
        }
      }
    } catch (_) {
      // Try next candidate
    }
  }
  throw new Error(
    "Unable to resolve PrismaClient from deployed repository path: " + repoPath
  );
}

const ALIAS_TOKENS = [
  "qatar",
  "petroleum",
  "energy",
  "qatarenergy",
  "qatargas",
  "qp",
  "qe",
  "petro",
  "oil",
  "gas",
  "liquefied",
  "lng",
  "rasgas",
  "ras laffan",
  "mesaieed",
  "dukhan",
  "north field"
];

function scoreAliasMatch(record) {
  const haystack = [
    record.name,
    record.code,
    record.tradingName,
    record.businessType,
    record.mainEmail,
    record.billingEmail,
    record.crNumber,
    record.taxNumber
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matchedTokens = ALIAS_TOKENS.filter((token) => {
    if (token.length <= 2) {
      return new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`, "i").test(haystack);
    }
    return haystack.includes(token);
  });

  return matchedTokens;
}

async function main() {
  const repoPath = resolveRepoPath();
  const envFile = path.join(repoPath, ".env");
  if (fs.existsSync(envFile)) {
    try {
      require(path.join(repoPath, "node_modules", "dotenv")).config({ path: envFile });
    } catch (_) {
      // Rely on existing process.env if dotenv path differs
    }
  }

  const resolved = loadPrismaClient(repoPath);
  const prisma = resolved.existingInstance || new resolved.PrismaClient();

  const opportunityId = "7288fa74-46e9-441c-94d7-9990a44ccdc0";
  const proposalId = "ebf98ba2-fb41-4c17-830d-50d648dd0806";

  try {
    const allClients = await prisma.manpowerClient.findMany({
      orderBy: [{ operationType: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        tradingName: true,
        operationType: true,
        isActive: true,
        businessType: true,
        crNumber: true,
        taxNumber: true,
        mainEmail: true,
        billingEmail: true,
        createdAt: true
      }
    });

    const aliasCandidates = allClients
      .map((c) => ({ ...c, matchedTokens: scoreAliasMatch(c) }))
      .filter((c) => c.matchedTokens.length > 0);

    const prospects = await prisma.preContractProspectClient.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        crNumber: true,
        companyId: true,
        matchedClientMasterId: true,
        duplicateCheckStatus: true,
        isActive: true
      }
    });

    const prospectMatches = prospects.filter(
      (p) => scoreAliasMatch(p).length > 0 || (p.name || "").toLowerCase().includes("qatar")
    );

    const opportunity = await prisma.preContractCase.findUnique({
      where: { id: opportunityId },
      include: {
        prospectClient: true
      }
    });

    const proposal = await prisma.preContractProposal.findUnique({
      where: { id: proposalId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            clientResponse: true,
            costEstimateVersion: {
              include: { items: true }
            }
          }
        }
      }
    });

    const output = {
      evidenceLabel: "SERVER READ-ONLY",
      inspectedAt: new Date().toISOString(),
      prismaLoadedFrom: resolved.loadedFrom,
      totals: {
        manpowerClientsTotal: allClients.length,
        securityGuardingClients: allClients.filter((c) => c.operationType === "SECURITY_GUARDING").length,
        facilityManagementClients: allClients.filter((c) => c.operationType === "FACILITY_MANAGEMENT").length,
        aliasMatchesFound: aliasCandidates.length
      },
      aliasCandidates,
      allSecurityGuardingClients: allClients.filter((c) => c.operationType === "SECURITY_GUARDING"),
      allFacilityManagementClients: allClients.filter((c) => c.operationType === "FACILITY_MANAGEMENT"),
      prospectMatches,
      opportunity,
      proposalSummary: proposal
        ? {
            id: proposal.id,
            proposalCode: proposal.proposalCode,
            caseId: proposal.caseId,
            companyId: proposal.companyId,
            operationType: proposal.operationType,
            status: proposal.status,
            latestVersion: proposal.versions[0]
              ? {
                  id: proposal.versions[0].id,
                  versionNumber: proposal.versions[0].versionNumber,
                  status: proposal.versions[0].status,
                  clientResponse: proposal.versions[0].clientResponse,
                  costEstimateVersionId: proposal.versions[0].costEstimateVersionId,
                  costEstimateItems: (proposal.versions[0].costEstimateVersion?.items || []).map((i) => ({
                    elementCode: i.elementCode,
                    elementName: i.elementName,
                    categoryCode: i.categoryCode,
                    isDirect: i.isDirect,
                    quantity: i.quantity !== null && i.quantity !== undefined ? Number(i.quantity) : null
                  }))
                }
              : null
          }
        : null
    };

    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  process.stderr.write("[inspect-cl5-client-master-readonly] ERROR: " + (err && err.stack ? err.stack : String(err)) + "\n");
  process.exit(1);
});
