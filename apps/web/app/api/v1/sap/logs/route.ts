import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId") || undefined;
    const logs = await mockDb.getSapSyncLogs(jobId);
    return NextResponse.json(logs);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch sync logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const log = await mockDb.createSapSyncLog(body);
    return NextResponse.json(log, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create sync log" }, { status: 500 });
  }
}
