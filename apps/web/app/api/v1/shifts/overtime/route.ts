import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const records = await mockDb.getOvertimeRecords();
    return NextResponse.json(records);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch overtime records" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { recordId, status, approvedMinutes, reviewNotes } = payload;
    
    if (!recordId || (status !== "APPROVED" && status !== "REJECTED")) {
      return NextResponse.json({ error: "Missing required overtime action parameters" }, { status: 400 });
    }

    const record = await mockDb.actionOvertimeRecord(recordId, status, approvedMinutes, reviewNotes);
    return NextResponse.json(record);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to process overtime record action" }, { status: 400 });
  }
}
