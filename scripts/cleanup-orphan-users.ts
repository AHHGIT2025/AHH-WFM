import { prisma } from "../packages/database/src/index.ts";
import * as readline from "readline";

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function main() {
  console.log("==================================================");
  console.log("AHH WFM: Database User & Account Cleanup");
  console.log("==================================================\n");

  try {
    // 1. Fetch data
    const roleAssignments = await prisma.userRoleAssignment.findMany();
    const employees = await prisma.employee.findMany();
    const employeeMap = new Map(employees.map((e: any) => [e.id.toLowerCase(), e]));

    // Find orphans
    const orphanAssignments = roleAssignments.filter(
      (a: any) => !employeeMap.has(a.employeeId.toLowerCase())
    );

    if (orphanAssignments.length === 0) {
      console.log("✅ No orphan role assignments to clean up.");
      return;
    }

    console.log(`Found ${orphanAssignments.length} orphan role assignment(s):`);
    for (const a of orphanAssignments) {
      console.log(`- RoleAssignment ID: ${a.id}, Referenced Employee ID: "${a.employeeId}"`);
    }

    const confirm = await askQuestion(
      "\n⚠️ WARNING: This will permanently delete these orphan role assignments. Proceed? (type 'yes' to confirm): "
    );

    if (confirm.trim().toLowerCase() !== "yes") {
      console.log("❌ Cleanup cancelled by admin.");
      return;
    }

    console.log("\nExecuting cleanup...");
    const orphanIds = orphanAssignments.map((a) => a.id);
    const deleteResult = await prisma.userRoleAssignment.deleteMany({
      where: {
        id: { in: orphanIds }
      }
    });

    console.log(`✅ Successfully deleted ${deleteResult.count} orphan role assignment(s).`);

  } catch (error) {
    console.error("Fatal error during database cleanup:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
