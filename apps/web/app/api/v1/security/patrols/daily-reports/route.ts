import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const operationType = searchParams.get("operationType") || undefined;
  const coordinatorId = searchParams.get("coordinatorId") || undefined;

  try {
    const list = await (mockDb as any).getDailyPatrolReports(operationType, coordinatorId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch daily patrol reports" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    const created = await (mockDb as any).createDailyPatrolReport(data);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to save daily patrol report" }, { status: 500 });
  }
}
