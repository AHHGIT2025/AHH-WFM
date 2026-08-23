import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";
import { checkEmployeeSchedulingEligibility } from "../../../../../../lib/roster-engine";
import {
  resolveEmployeeTradePosition,
  resolveEmployeeTradePositionSource
} from "../../../../../../lib/roster-display-utils";

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
        designation: true,
        positionCategory: true
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
              designation: emp.designation ? { id: emp.designation.id, code: emp.designation.code, name: emp.designation.name } : null,
              positionCategory: emp.positionCategory ? { id: emp.positionCategory.id, code: emp.positionCategory.code, name: emp.positionCategory.name } : null
            },
            // Authoritative employee Trade/Position (Workforce Directory aligned)
            employeeTradePosition: resolveEmployeeTradePosition(emp),
            employeeTradePositionSource: resolveEmployeeTradePositionSource(emp),
            // HR Designation (separate from Trade/Position — for White Collar/HR display only)
            employeeDesignation: emp.designation?.name ?? null,
            // Required position from the roster slot (NOT employee master data)
            requiredPosition: slot.snapshotPosition ?? null,
            canDeploy: check.canDeploy,
            errors: check.errors,
            warnings: check.warnings,
            checklist: check.checklist,
            conflicts: (check as any).conflicts || []
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
