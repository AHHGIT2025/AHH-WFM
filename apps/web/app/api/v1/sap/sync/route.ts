import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const jobs = await mockDb.getSapSyncJobs();
    const activeJob = jobs.find(j => j.status === "PROCESSING");
    return NextResponse.json({
      isSyncRunning: !!activeJob,
      activeJob: activeJob || null,
      lastJob: jobs[0] || null
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch sync status" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { connectionId, module, syncType } = body;
    if (!connectionId || !module || !syncType) {
      return NextResponse.json({ error: "Missing connectionId, module, or syncType parameters" }, { status: 400 });
    }

    // Trigger mock sync processing in background
    const job = await mockDb.triggerSapSync(connectionId, module, syncType);
    return NextResponse.json(job, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to trigger sync job" }, { status: 500 });
  }
}
