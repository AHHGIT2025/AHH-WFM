import { prisma } from "../../packages/database/src";
import * as fs from "fs";
import * as path from "path";

async function runPreMigrationAudit() {
  console.log("=== PHASE MD-1 PRE-MIGRATION AUDIT ===");
  const auditReport: any = {
    timestamp: new Date().toISOString(),
    status: "PENDING",
    holdingCompany: null,
    profileSummary: { total: 0, whiteCollar: 0, blueCollar: 0, ambiguous: 0 },
    profiles: [],
    errors: []
  };

  try {
    // 1. Identify Holding Company Candidate
    const companies = await prisma.company.findMany({ where: { isActive: true } });
    const holdingCandidates = companies.filter(c => 
      c.companyCode === "1000" || c.companyName.toLowerCase().includes("holding")
    );

    if (holdingCandidates.length === 0) {
      auditReport.errors.push("HOLDING_COMPANY_MISSING: No Company candidate found with code '1000' or name 'Holding'");
    } else if (holdingCandidates.length > 1) {
      auditReport.errors.push(`MULTIPLE_HOLDING_CANDIDATES: Found ${holdingCandidates.length} companies matching Holding criteria`);
    } else {
      auditReport.holdingCompany = {
        id: holdingCandidates[0].id,
        code: holdingCandidates[0].companyCode,
        name: holdingCandidates[0].companyName
      };
      console.log(`[Audit] Holding Company identified: ${holdingCandidates[0].companyName} (${holdingCandidates[0].id})`);
    }

    // 2. Scan & Classify Work Calendar Profiles
    const profiles = await prisma.manpowerWorkCalendarProfile.findMany({});
    auditReport.profileSummary.total = profiles.length;

    for (const p of profiles) {
      const isWC = (p as any).workerCategory === "WHITE_COLLAR" || (p as any).operationType === "WHITE_COLLAR";
      const isBC = ["SECURITY_GUARDING", "CLEANING", "OTHER_FACILITY_MANAGEMENT", "GENERAL"].includes((p as any).workerCategory) ||
                   ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes((p as any).operationType);

      let deterministicClass: "WHITE_COLLAR" | "BLUE_COLLAR" | "AMBIGUOUS" = "AMBIGUOUS";
      if (isWC && !isBC) deterministicClass = "WHITE_COLLAR";
      if (isBC && !isWC) deterministicClass = "BLUE_COLLAR";

      let ownerCompanyId = (p as any).companyId || (p as any).ownerCompanyId || (auditReport.holdingCompany ? auditReport.holdingCompany.id : null);
      let applicability = (p as any).companyId || (p as any).applicableCompanyId ? "COMPANY" : "GROUP_WIDE";
      let restSource = deterministicClass === "WHITE_COLLAR" ? "PROFILE_FIXED_DAYS" : "ROSTER_MANAGED";

      const profileAudit = {
        id: p.id,
        code: p.code,
        name: p.name,
        legacyCategory: (p as any).workerCategory,
        legacyOpType: (p as any).operationType,
        deterministicClass,
        ownerCompanyId,
        applicability,
        restSource,
        approvalStatus: p.approvalStatus,
        version: p.version
      };

      if (deterministicClass === "AMBIGUOUS") {
        auditReport.profileSummary.ambiguous++;
        auditReport.errors.push(`AMBIGUOUS_PROFILE: Profile ID ${p.id} (${p.code}) cannot be deterministically classified`);
      } else if (deterministicClass === "WHITE_COLLAR") {
        auditReport.profileSummary.whiteCollar++;
      } else {
        auditReport.profileSummary.blueCollar++;
      }

      auditReport.profiles.push(profileAudit);
    }

    // 3. Inspect Historical Advisory Runs
    const advisoryRuns = await prisma.manpowerPayrollAdvisoryRun.findMany({ select: { id: true, sourceVersionJson: true } });
    console.log(`[Audit] Verified ${advisoryRuns.length} historical payroll advisory runs`);

    // Write machine-readable JSON output
    const outputDir = path.join(process.cwd(), "scratch");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "md1-pre-audit-results.json");
    
    auditReport.status = auditReport.errors.length === 0 ? "PASSED" : "FAILED";
    fs.writeFileSync(outputPath, JSON.stringify(auditReport, null, 2));

    console.log(`\n[Audit Result] Pre-migration audit status: ${auditReport.status}`);
    console.log(`[Audit Result] Total Profiles: ${auditReport.profileSummary.total} (WC: ${auditReport.profileSummary.whiteCollar}, BC: ${auditReport.profileSummary.blueCollar}, Ambiguous: ${auditReport.profileSummary.ambiguous})`);
    console.log(`[Audit Result] Report written to: ${outputPath}`);

    if (auditReport.errors.length > 0) {
      console.error("\nPre-migration audit failed with errors:");
      auditReport.errors.forEach((err: string) => console.error(` - ${err}`));
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Pre-migration audit script failed:", err);
    process.exit(1);
  }
}

runPreMigrationAudit();
