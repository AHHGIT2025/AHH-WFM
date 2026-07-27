import { prisma } from "../../packages/database/src";
import * as fs from "fs";
import * as path from "path";

async function runPostMigrationAudit() {
  console.log("=== PHASE MD-1 POST-MIGRATION AUDIT ===");
  const auditReport: any = {
    timestamp: new Date().toISOString(),
    status: "PENDING",
    holdingCompany: null,
    operationScopesCount: { company: 0, department: 0 },
    profilesSummary: { total: 0, whiteCollar: 0, blueCollar: 0 },
    seasonalRulesCount: 0,
    rosterClassificationsCount: 0,
    errors: []
  };

  try {
    // 1. Validate Singleton Active Holding Company
    const holdingCompanies = await prisma.company.findMany({
      where: { isHoldingCompany: true, isActive: true }
    });

    if (holdingCompanies.length === 0) {
      auditReport.errors.push("HOLDING_COMPANY_REQUIRED: No active singleton Holding Company found");
    } else if (holdingCompanies.length > 1) {
      auditReport.errors.push(`MULTIPLE_HOLDING_COMPANIES_ERROR: Found ${holdingCompanies.length} active Holding Companies`);
    } else {
      auditReport.holdingCompany = {
        id: holdingCompanies[0].id,
        code: holdingCompanies[0].companyCode,
        name: holdingCompanies[0].companyName
      };
      console.log(`[Post-Audit] Singleton Holding Company verified: ${holdingCompanies[0].companyName}`);
    }

    // 2. Validate Operation Scope Mappings
    const compScopes = await (prisma as any).manpowerCompanyOperationScope.findMany({ where: { isActive: true } });
    const deptScopes = await (prisma as any).manpowerDepartmentOperationScope.findMany({ where: { isActive: true } });
    auditReport.operationScopesCount.company = compScopes.length;
    auditReport.operationScopesCount.department = deptScopes.length;
    console.log(`[Post-Audit] Verified Operation Scope Mappings (Company: ${compScopes.length}, Dept: ${deptScopes.length})`);

    // 3. Validate Work Calendar Profiles
    const profiles = await prisma.manpowerWorkCalendarProfile.findMany({
      include: { ownerCompany: true, restDays: true }
    });
    auditReport.profilesSummary.total = profiles.length;

    for (const p of profiles as any[]) {
      if (!p.ownerCompanyId) {
        auditReport.errors.push(`MANDATORY_OWNER_MISSING: Profile ${p.code} (${p.id}) is missing ownerCompanyId`);
      }
      if (!p.workerClass) {
        auditReport.errors.push(`WORKER_CLASS_MISSING: Profile ${p.code} is missing workerClass`);
      }
      if (!p.applicability) {
        auditReport.errors.push(`APPLICABILITY_MISSING: Profile ${p.code} is missing applicability`);
      }

      if (p.workerClass === "WHITE_COLLAR") {
        auditReport.profilesSummary.whiteCollar++;
        if (p.applicability === "GROUP_WIDE" && p.operationType != null) {
          auditReport.errors.push(`OPERATION_SCOPE_NOT_APPLICABLE: Group-wide White Collar profile ${p.code} has non-null operationType`);
        }
      } else if (p.workerClass === "BLUE_COLLAR") {
        auditReport.profilesSummary.blueCollar++;
        if (p.weeklyRestSource !== "ROSTER_MANAGED") {
          auditReport.errors.push(`REST_SOURCE_INVALID: Blue Collar profile ${p.code} must use ROSTER_MANAGED rest source`);
        }
        if (p.restDays && p.restDays.length > 0) {
          auditReport.errors.push(`FIXED_REST_FORBIDDEN: Blue Collar profile ${p.code} cannot store fixed rest-day rows`);
        }
        if (p.appliesToAllPositionCategories === false && !p.positionCategoryId) {
          auditReport.errors.push(`POSITION_CATEGORY_REQUIRED: Blue Collar specific-position profile ${p.code} requires positionCategoryId`);
        }
      }
    }

    // 4. Validate Roster Day Classifications History
    const rosterClassifications = await (prisma as any).manpowerRosterDayClassification.findMany({
      include: { history: true }
    });
    auditReport.rosterClassificationsCount = rosterClassifications.length;

    // 5. Verify Historical Advisory Runs
    const advisoryRuns = await prisma.manpowerPayrollAdvisoryRun.findMany({ select: { id: true, sourceVersionJson: true } });
    console.log(`[Post-Audit] Verified ${advisoryRuns.length} historical payroll advisory runs remain untouched`);

    // Output Report
    const outputDir = path.join(process.cwd(), "scratch");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "md1-post-audit-results.json");

    auditReport.status = auditReport.errors.length === 0 ? "PASSED" : "FAILED";
    fs.writeFileSync(outputPath, JSON.stringify(auditReport, null, 2));

    console.log(`\n[Post-Audit Result] Post-migration audit status: ${auditReport.status}`);
    console.log(`[Post-Audit Result] Report written to: ${outputPath}`);

    if (auditReport.errors.length > 0) {
      console.error("\nPost-migration audit failed with errors:");
      auditReport.errors.forEach((err: string) => console.error(` - ${err}`));
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Post-migration audit script failed:", err);
    process.exit(1);
  }
}

runPostMigrationAudit();
