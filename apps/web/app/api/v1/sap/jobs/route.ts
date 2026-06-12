import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const jobs = await mockDb.getSapSyncJobs();
    return NextResponse.json(jobs);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch sync jobs" }, { status: 500 });
  }
}
