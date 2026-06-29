import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const poolId = searchParams.get("poolId") || undefined;
  const relieverEmployeeId = searchParams.get("relieverEmployeeId") || undefined;

  try {
    const list = await mockDb.getSecurityProjectRelieverAssignments(poolId, relieverEmployeeId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch pool assignments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    if (!data.poolId || !data.relieverEmployeeId) {
      return NextResponse.json({ error: "Missing required fields (poolId, relieverEmployeeId)" }, { status: 400 });
    }
    const created = await mockDb.createSecurityProjectRelieverAssignment(data);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create pool assignment" }, { status: 500 });
  }
}
