import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const type = url.searchParams.get("type"); // "rules" or "employees"

  try {
    if (type === "employees") {
      const employees = await mockDb.getEmployees();
      const rules = await mockDb.getRelieverStandbyRules();
      const standbyDesignationIds = new Set(
        rules.filter(r => r.isActive && r.standbyRequired && r.designationId).map(r => r.designationId)
      );
      const standbyTradeIds = new Set(
        rules.filter(r => r.isActive && r.standbyRequired && r.tradeClassificationId).map(r => r.tradeClassificationId)
      );

      const standbyEmployees = employees.filter(emp => {
        return (
          emp.isStandbyEligible === true ||
          (emp.designationId && standbyDesignationIds.has(emp.designationId)) ||
          (emp.tradeClassificationId && standbyTradeIds.has(emp.tradeClassificationId))
        );
      });
      return NextResponse.json(standbyEmployees);
    }

    const rules = await mockDb.getRelieverStandbyRules();
    return NextResponse.json(rules);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch standby pool data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.ruleName) {
      return NextResponse.json({ error: "Rule Name is required" }, { status: 400 });
    }
    const rule = await mockDb.createRelieverStandbyRule(payload);
    return NextResponse.json(rule);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create standby pool rule" }, { status: 500 });
  }
}
