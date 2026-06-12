import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const queue = await mockDb.getSapRetryQueue();
    return NextResponse.json(queue);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch retry queue" }, { status: 500 });
  }
}

export async function POST() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const success = await mockDb.triggerSapRetry();
    return NextResponse.json({ success, message: "Processed pending items in the retry queue." });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to process retry queue" }, { status: 500 });
  }
}
