import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";
import { checkEmployeeSchedulingEligibility } from "../../../../../../lib/roster-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slotId = searchParams.get("slotId");

  if (!slotId) {
    return NextResponse.json({ error: "Missing slotId query parameter" }, { status: 400 });
  }

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;

  // Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.view")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to view eligible employees." }, { status: 403 });
  }

  try {
    const slot = await prisma.rosterRequirementSlot.findUnique({
      where: { id: slotId }
    });

    if (!slot) {
      return NextResponse.json({ error: "Roster requirement slot not found" }, { status: 404 });
    }

    // Load active employees matching operationType
    const employees = await prisma.employee.findMany({
      where: {
        operationType: slot.operationType,
        isActive: true
      },
      include: {
        designation: true
      }
    });

    // Run eligibility checks for each employee
    const results = await Promise.all(
      employees.map(async (emp) => {
        try {
          const check = await checkEmployeeSchedulingEligibility(emp.id, slotId);
          return {
            employee: {
              id: emp.id,
              name: emp.name,
              email: emp.email,
              phone: emp.phone,
              employeeCategory: emp.employeeCategory,
              designation: emp.designation ? { code: emp.designation.code, name: emp.designation.name } : null
            },
            canDeploy: check.canDeploy,
            errors: check.errors,
            warnings: check.warnings,
            checklist: check.checklist
          };
        } catch (e) {
          return null;
        }
      })
    );

    // Filter out nulls and sort (eligible first)
    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);
    validResults.sort((a, b) => (a.canDeploy === b.canDeploy ? 0 : a.canDeploy ? -1 : 1));

    return NextResponse.json({ success: true, employees: validResults });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch eligible employees" }, { status: 500 });
  }
}
