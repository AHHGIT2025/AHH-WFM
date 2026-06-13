import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const assignments = await mockDb.getShiftRelieverAssignments();
    return NextResponse.json(assignments);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch shift reliever assignments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.originalEmployeeId || !payload.relieverEmployeeId || !payload.date || !payload.startTime || !payload.endTime) {
      return NextResponse.json(
        { error: "Original Employee, Reliever Employee, Date, Start Time, and End Time are required" },
        { status: 400 }
      );
    }
    const assignment = await mockDb.createShiftRelieverAssignment(payload);
    return NextResponse.json(assignment);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create shift reliever assignment" }, { status: 500 });
  }
}
