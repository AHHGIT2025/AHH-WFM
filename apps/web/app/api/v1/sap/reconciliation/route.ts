import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const logs = await mockDb.getSapReconciliationLogs();
    return NextResponse.json(logs);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch reconciliation logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.period || !body.module) {
      return NextResponse.json({ error: "Missing required parameters: period and module" }, { status: 400 });
    }

    const logs = await mockDb.runSapReconciliation(body.period, body.module);
    return NextResponse.json({ success: true, count: logs.length, data: logs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to run SAP reconciliation" }, { status: 500 });
  }
}
