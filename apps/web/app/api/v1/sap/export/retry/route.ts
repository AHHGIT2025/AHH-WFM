import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const success = await mockDb.triggerSapExportRetry();
    return NextResponse.json({ success, message: "Processed pending/failed items in the export queue." });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to process export retry queue" }, { status: 500 });
  }
}
