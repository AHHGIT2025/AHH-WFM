import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const costCenters = await mockDb.getCostCenters();
    return NextResponse.json(costCenters);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch cost centers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.costCenterCode || !payload.costCenterName) {
      return NextResponse.json({ error: "Cost Center Code and Cost Center Name are required" }, { status: 400 });
    }
    const costCenter = await mockDb.createCostCenter(payload);
    return NextResponse.json(costCenter);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create cost center" }, { status: 500 });
  }
}
