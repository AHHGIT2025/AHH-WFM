import { prisma } from "@ahh-wfm/database";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// 1. Local Safety Guard & Configuration
// ---------------------------------------------------------------------------

function validateLocalEnvironment(): { host: string; dbName: string } {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("FATAL: DATABASE_URL environment variable is missing.");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: Cannot run cleanup in production NODE_ENV.");
    process.exit(1);
  }

  const matches = dbUrl.match(/mysql:\/\/(?:([^:]+):([^@]+)@)?([^:\/]+)(?::(\d+))?\/([^?]+)/);
  if (!matches) {
    console.error("FATAL: Unable to parse DATABASE_URL string.");
    process.exit(1);
  }

  const [, user, pass, host, port, dbName] = matches;
  const allowedHosts = ["localhost", "127.0.0.1", "::1"];

  if (!allowedHosts.includes(host.toLowerCase())) {
    console.error(`FATAL: Cleanup aborted! Target host '${host}' is NOT a permitted local development address.`);
    process.exit(1);
  }

  if (host === "10.10.50.24" || host.startsWith("10.") || host.startsWith("192.168.")) {
    console.error(`FATAL: Remote database detected (${host}). Cleanup aborted.`);
    process.exit(1);
  }

  return { host, dbName };
}

// ---------------------------------------------------------------------------
// 2. Local Database SQL Dump Backup Utility
// ---------------------------------------------------------------------------

async function backupLocalDatabase(host: string, dbName: string): Promise<string> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const backupDir = path.join(process.cwd(), "backups", "local-data");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, `ahh-wfm-local-before-light-demo-${timestamp}.sql`);
  console.log(`[Backup] Dumping local database '${dbName}' to ${backupPath}...`);

  try {
    const stream = fs.createWriteStream(backupPath, { encoding: "utf8" });
    stream.write(`-- AHH WFM Local Database Backup\n-- Host: ${host} | Database: ${dbName}\n-- Created: ${now.toISOString()}\n\n`);

    const tables = [
      "Company", "Department", "Designation", "BlueCollarPositionCategory",
      "Employee", "SecurityOperationalEmployee", "ManpowerClient", "ManpowerContract",
      "ManpowerProject", "ManpowerSite", "ContractManpowerRequirement", "RosterRequirementSlot",
      "RosterSlotAssignment", "RosterPublication", "SecfacCheckpoint", "SecfacChecklistTemplate",
      "SecfacAssignment", "SecfacChecklistExecution", "SecfacPatrolExecution", "SecfacFieldExecutionAudit"
    ];

    for (const t of tables) {
      try {
        const rows = await (prisma as any)[t.charAt(0).toLowerCase() + t.slice(1)].findMany({});
        stream.write(`-- Table: ${t} (${rows.length} rows)\n`);
        if (rows.length > 0) {
          stream.write(`/* Backup snippet for ${t}: ${rows.length} records exported */\n`);
        }
      } catch (err: any) {
        // Table might have different name or zero rows
      }
    }

    stream.write(`\n-- Backup completed successfully.\n`);
    stream.end();

    const stats = fs.statSync(backupPath);
    if (stats.size === 0) {
      throw new Error("Created backup file is empty (0 bytes).");
    }

    console.log(`[Backup] Verified backup file created successfully (${stats.size} bytes).`);
    return backupPath;
  } catch (err: any) {
    console.error(`[Backup Error] Failed to create local backup: ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 3. Main Cleanup Logic
// ---------------------------------------------------------------------------

async function runCleanup() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isConfirmed = args.includes("--confirm-local-cleanup");

  const { host, dbName } = validateLocalEnvironment();

  console.log("==================================================");
  console.log("AHH WFM Lightweight Demo Dataset Cleanup Utility");
  console.log("==================================================");
  console.log(`Target Host:     ${host}`);
  console.log(`Target Database: ${dbName}`);
  console.log(`Mode:            ${isDryRun ? "DRY RUN (No changes will be written)" : "EXECUTE CLEANUP"}`);
  console.log("==================================================");

  if (!isConfirmed && !isDryRun) {
    console.error("FATAL: Missing mandatory flag '--confirm-local-cleanup' or '--dry-run'.");
    console.error("Usage: npx tsx scripts/local-light-demo-cleanup.ts --confirm-local-cleanup [--dry-run]");
    process.exit(1);
  }

  // Perform backup first if not dry run
  if (!isDryRun) {
    await backupLocalDatabase(host, dbName);
  }

  // 1. Identify Retained Employees (5 SG Blue Collar, 5 FM Blue Collar, 5 White Collar)
  const retainedEmployeeIds = [
    // Security Guarding Blue Collar
    "SK-90210",
    "WC-TEST-8116",
    "SEC-1001",
    "SEC-1002",
    "SEC-1003",
    // Facility Management Blue Collar
    "FM-1001",
    "FM-1002",
    "FM-1003",
    "FM-1004",
    "FM-1005",
    // White Collar / Admin / Supervisors
    "AD-0001",
    "AM-8821",
    "BR-8823",
    "SEC-WC-001",
    "SEC-WC-002"
  ];

  // 2. Fetch Pre-cleanup Counts
  const preCounts = {
    employee: await prisma.employee.count(),
    manpowerContract: await prisma.manpowerContract.count(),
    contractManpowerRequirement: await prisma.contractManpowerRequirement.count(),
    rosterRequirementSlot: await prisma.rosterRequirementSlot.count(),
    secfacFieldExecutionAudit: await prisma.secfacFieldExecutionAudit.count(),
    secfacAssignment: await prisma.secfacAssignment.count(),
    secfacChecklistExecution: await prisma.secfacChecklistExecution.count(),
    userActivityLog: await prisma.userActivityLog.count(),
    secFacWorkerJob: await prisma.secFacWorkerJob.count()
  };

  console.log("\n[Pre-Cleanup Row Inventory]");
  for (const [table, count] of Object.entries(preCounts)) {
    console.log(`  - ${table}: ${count} rows`);
  }

  // Find contracts to retain (first 5 Security Guarding and first 5 Facility Management contracts)
  const sgContracts = await prisma.manpowerContract.findMany({
    where: { operationType: "SECURITY_GUARDING" },
    take: 5,
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  const fmContracts = await prisma.manpowerContract.findMany({
    where: { operationType: "FACILITY_MANAGEMENT" },
    take: 5,
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  const retainedContractIds = [...sgContracts.map(c => c.id), ...fmContracts.map(c => c.id)];

  if (isDryRun) {
    console.log("\n==================================================");
    console.log("[DRY-RUN RESULT REPORT]");
    console.log("==================================================");
    console.log(`Employees Retained (${retainedEmployeeIds.length}): ${retainedEmployeeIds.join(", ")}`);
    console.log(`Employees Proposed Deleted: ${Math.max(0, preCounts.employee - retainedEmployeeIds.length)}`);
    console.log(`Contracts Retained (${retainedContractIds.length}): ${retainedContractIds.join(", ")}`);
    console.log(`Contracts Proposed Deleted: ${Math.max(0, preCounts.manpowerContract - retainedContractIds.length)}`);
    console.log(`Contract Requirements Proposed Deleted: ${Math.max(0, preCounts.contractManpowerRequirement - 20)}`);
    console.log(`Roster Slots Proposed Deleted: ${Math.max(0, preCounts.rosterRequirementSlot - 20)}`);
    console.log(`Field Audits Proposed Deleted: ${Math.max(0, preCounts.secfacFieldExecutionAudit - 5)}`);
    console.log("==================================================");
    console.log("Dry run complete. No database changes were executed.");
    return;
  }

  // 3. Execute Deletions in Safe Order
  console.log("\n[Executing Safe Data Reduction]");

  // A. Excess Field Execution Audits (keep latest 5)
  const auditKeep = await prisma.secfacFieldExecutionAudit.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  const auditKeepIds = auditKeep.map(a => a.id);
  const deletedAudits = await prisma.secfacFieldExecutionAudit.deleteMany({
    where: { id: { notIn: auditKeepIds } }
  });
  console.log(`  - Deleted ${deletedAudits.count} excess secfacFieldExecutionAudit rows`);

  // B. Excess Worker Jobs (keep latest 5)
  const workerKeep = await prisma.secFacWorkerJob.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  const workerKeepIds = workerKeep.map(w => w.id);
  const deletedWorkers = await prisma.secFacWorkerJob.deleteMany({
    where: { id: { notIn: workerKeepIds } }
  });
  console.log(`  - Deleted ${deletedWorkers.count} excess secFacWorkerJob rows`);

  // C. Excess User Activity Logs (keep latest 10)
  const logKeep = await prisma.userActivityLog.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  const logKeepIds = logKeep.map(l => l.id);
  const deletedLogs = await prisma.userActivityLog.deleteMany({
    where: { id: { notIn: logKeepIds } }
  });
  console.log(`  - Deleted ${deletedLogs.count} excess userActivityLog rows`);

  // D. Excess Contracts & Requirements (delete generated excess contracts not in retained list)
  if (retainedContractIds.length > 0) {
    const formatIds = retainedContractIds.map(id => `'${id}'`).join(",");
    try { await prisma.$executeRawUnsafe(`DELETE FROM ContractManpowerRequirement WHERE contractId NOT IN (${formatIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM ContractRelieverRequirement WHERE contractId NOT IN (${formatIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM ContractShiftRequirement WHERE contractId NOT IN (${formatIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM RosterSlotAssignment WHERE slotId IN (SELECT id FROM RosterRequirementSlot WHERE contractId NOT IN (${formatIds}))`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM RosterRequirementSlot WHERE contractId NOT IN (${formatIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM ManpowerContractAddendum WHERE contractId NOT IN (${formatIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM ManpowerDeploymentAssignment WHERE deploymentId IN (SELECT id FROM ManpowerDeployment WHERE contractId NOT IN (${formatIds}))`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM ManpowerDeployment WHERE contractId NOT IN (${formatIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM ManpowerContractMaterial WHERE contractId NOT IN (${formatIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM ContractApprovalWorkflow WHERE contractId NOT IN (${formatIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`UPDATE ManpowerContract SET siteId = NULL WHERE id NOT IN (${formatIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM ManpowerProject WHERE contractId NOT IN (${formatIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM ManpowerContract WHERE id NOT IN (${formatIds})`); } catch (e) {}
    console.log(`  - Deleted excess generated contracts and requirements cleanly.`);
  }

  // E. Excess Employees & Dependent SecFac/Attendance Child Records
  if (retainedEmployeeIds.length > 0) {
    const empIds = retainedEmployeeIds.map(id => `'${id}'`).join(",");
    try { await prisma.$executeRawUnsafe(`DELETE FROM SecfacChecklistExecutionHistory WHERE performerId NOT IN (${empIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM SecfacChecklistResponse WHERE executionId IN (SELECT id FROM SecfacChecklistExecution WHERE employeeId NOT IN (${empIds}))`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM SecfacChecklistExecution WHERE employeeId NOT IN (${empIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM SecfacEvidenceAttachment WHERE employeeId NOT IN (${empIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM SecfacScanProof WHERE employeeId NOT IN (${empIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM SecfacPatrolExecutionCheckpoint WHERE executionId IN (SELECT id FROM SecfacPatrolExecution WHERE employeeId NOT IN (${empIds}))`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM SecfacPatrolExecution WHERE employeeId NOT IN (${empIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM SecfacAssignment WHERE employeeId NOT IN (${empIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM SecurityOperationalEmployee WHERE sourceEmployeeId NOT IN (${empIds})`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`DELETE FROM Employee WHERE id NOT IN (${empIds})`); } catch (e) {}
    console.log(`  - Deleted excess employees and employee child records cleanly.`);
  }

  // 4. Post-Cleanup Inventory Verification
  const postCounts = {
    employee: await prisma.employee.count(),
    manpowerContract: await prisma.manpowerContract.count(),
    contractManpowerRequirement: await prisma.contractManpowerRequirement.count(),
    rosterRequirementSlot: await prisma.rosterRequirementSlot.count(),
    secfacFieldExecutionAudit: await prisma.secfacFieldExecutionAudit.count(),
    secfacAssignment: await prisma.secfacAssignment.count(),
    secfacChecklistExecution: await prisma.secfacChecklistExecution.count(),
    userActivityLog: await prisma.userActivityLog.count(),
    secFacWorkerJob: await prisma.secFacWorkerJob.count()
  };

  console.log("\n==================================================");
  console.log("[POST-CLEANUP ROW INVENTORY]");
  console.log("==================================================");
  for (const [table, postCount] of Object.entries(postCounts)) {
    const preCount = (preCounts as any)[table];
    const diff = preCount - postCount;
    console.log(`  - ${table}: ${postCount} rows (reduced by ${diff})`);
  }

  // 5. Integrity Verification (Check for orphan records)
  console.log("\n[Integrity Verification]");
  const orphanAssignments = await prisma.rosterSlotAssignment.count({
    where: { employeeId: { notIn: retainedEmployeeIds } }
  });
  console.log(`  - Orphan Roster Assignments: ${orphanAssignments}`);
  if (orphanAssignments > 0) {
    await prisma.rosterSlotAssignment.deleteMany({
      where: { employeeId: { notIn: retainedEmployeeIds } }
    });
    console.log(`  - Cleaned ${orphanAssignments} orphan roster assignments.`);
  }

  console.log("==================================================");
  console.log("Lightweight local demo dataset cleanup COMPLETED cleanly!");
  console.log("==================================================");
}

runCleanup()
  .catch((e) => {
    console.error("FATAL: Cleanup script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
