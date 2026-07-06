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
  const siteId = searchParams.get("siteId") || undefined;

  try {
    const list = await (mockDb as any).getPatrolVisits(operationType, coordinatorId, siteId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch patrol visits" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    const created = await (mockDb as any).createPatrolVisit(data);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to save patrol visit" }, { status: 500 });
  }
}
