import { prisma } from "../packages/database/src/index.ts";

async function main() {
  console.log("==================================================");
  console.log("AHH WFM: Database User & Account Diagnostics");
  console.log("==================================================\n");

  try {
    // 1. Fetch data
    console.log("Fetching database records...");
    const roleAssignments = await prisma.userRoleAssignment.findMany();
    const employees = await prisma.employee.findMany();
    const systemRoles = await prisma.systemRole.findMany();
    
    console.log(`Loaded ${employees.length} Employee records.`);
    console.log(`Loaded ${roleAssignments.length} UserRoleAssignment records.`);
    console.log(`Loaded ${systemRoles.length} SystemRole records.\n`);

    const employeeMap = new Map(employees.map((e: any) => [e.id.toLowerCase(), e]));
    const roleMap = new Map(systemRoles.map((r: any) => [r.id, r]));

    // 2. Diagnose Orphan UserRoleAssignments
    console.log("--- 1. Checking Orphan Role Assignments ---");
    let orphanCount = 0;
    for (const assignment of roleAssignments) {
      const empExists = employeeMap.has(assignment.employeeId.toLowerCase());
      if (!empExists) {
        orphanCount++;
        console.log(`[ORPHAN ROLE ASSIGNMENT] ID: ${assignment.id}`);
        console.log(`  - Employee ID referenced: "${assignment.employeeId}" (Does NOT exist in Employee table)`);
        const role = roleMap.get(assignment.roleId) as any;
        console.log(`  - Role: ${role ? role.name : assignment.roleId}`);
        console.log(`  - Assigned At: ${assignment.assignedAt}`);
        console.log("-----------------------------------------");
      }
    }
    if (orphanCount === 0) {
      console.log("✅ No orphan role assignments found.\n");
    } else {
      console.log(`❌ Found ${orphanCount} orphan role assignment(s).\n`);
    }

    // 3. Diagnose Incomplete Employees with Login Accounts
    console.log("--- 2. Checking Incomplete Employee Accounts ---");
    let incompleteCount = 0;
    for (const emp of employees) {
      const hasLogin = emp.isLoginEnabled || emp.webAccessEnabled || emp.mobileAccessEnabled || emp.username;
      
      const missingDetails: string[] = [];
      if (!emp.name || emp.name.trim() === "") missingDetails.push("Name is empty");
      if (!emp.email || emp.email.trim() === "") missingDetails.push("Email is empty");
      if (!emp.companyId) missingDetails.push("Company ID is missing");
      if (!emp.role || emp.role.trim() === "") missingDetails.push("Role is missing");

      if (hasLogin && missingDetails.length > 0) {
        incompleteCount++;
        console.log(`[INCOMPLETE ACCOUNT] Employee ID: "${emp.id}"`);
        console.log(`  - Username: "${emp.username || '(None)'}"`);
        console.log(`  - Email: "${emp.email || '(None)'}"`);
        console.log(`  - Missing Details: ${missingDetails.join(", ")}`);
        console.log(`  - Status: ${emp.employmentStatus} / ${emp.dutyStatus}`);
        console.log("-----------------------------------------");
      }
    }
    if (incompleteCount === 0) {
      console.log("✅ No incomplete accounts found.\n");
    } else {
      console.log(`❌ Found ${incompleteCount} incomplete account(s).\n`);
    }

    // 4. Diagnose Duplicate Usernames / Emails
    console.log("--- 3. Checking Duplicate Usernames & Emails ---");
    let duplicateCount = 0;

    const emailGroups = new Map<string, string[]>();
    const usernameGroups = new Map<string, string[]>();

    for (const emp of employees) {
      if (emp.email) {
        const key = emp.email.toLowerCase().trim();
        const list = emailGroups.get(key) || [];
        list.push(emp.id);
        emailGroups.set(key, list);
      }
      if (emp.username) {
        const key = emp.username.toLowerCase().trim();
        const list = usernameGroups.get(key) || [];
        list.push(emp.id);
        usernameGroups.set(key, list);
      }
    }

    for (const [email, ids] of emailGroups.entries()) {
      if (ids.length > 1) {
        duplicateCount++;
        console.log(`[DUPLICATE EMAIL] "${email}" is shared by:`);
        console.log(`  - Employee IDs: ${ids.map(id => `"${id}"`).join(", ")}`);
        console.log("-----------------------------------------");
      }
    }

    for (const [username, ids] of usernameGroups.entries()) {
      if (ids.length > 1) {
        duplicateCount++;
        console.log(`[DUPLICATE USERNAME] "${username}" is shared by:`);
        console.log(`  - Employee IDs: ${ids.map(id => `"${id}"`).join(", ")}`);
        console.log("-----------------------------------------");
      }
    }

    if (duplicateCount === 0) {
      console.log("✅ No duplicate usernames or emails found.\n");
    } else {
      console.log(`❌ Found ${duplicateCount} duplicate group(s).\n`);
    }

    console.log("==================================================");
    console.log("Diagnostics Complete.");
    console.log("==================================================");

  } catch (error) {
    console.error("Fatal error during database diagnostics:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
