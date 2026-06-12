import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const corrections = await mockDb.getCorrections();
    return NextResponse.json(corrections);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch correction requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.attendanceRecordId || !payload.reason) {
      return NextResponse.json({ error: "Attendance Record ID and Reason are required" }, { status: 400 });
    }
    const correction = await mockDb.submitCorrection(
      payload.attendanceRecordId,
      payload.requestedCheckIn || undefined,
      payload.requestedCheckOut || undefined,
      payload.reason
    );
    return NextResponse.json(correction);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to submit correction request" }, { status: 500 });
  }
}
