import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const logs = await mockDb.getSyncLogs();
    return NextResponse.json(logs);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch sync logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const result = await mockDb.addSyncLog(payload);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Failed to add sync log" }, { status: 500 });
  }
}
