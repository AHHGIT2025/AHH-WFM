import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const records = await mockDb.getAttendance();
    return NextResponse.json(records);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 });
  }
}
