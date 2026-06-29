import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;

  try {
    const list = await mockDb.getSecurityProjectRelieverPools(projectId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch security reliever pools" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    if (!data.projectId || !data.poolName) {
      return NextResponse.json({ error: "Missing required fields (projectId, poolName)" }, { status: 400 });
    }
    const created = await mockDb.createSecurityProjectRelieverPool(data);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create security reliever pool" }, { status: 500 });
  }
}
