import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const assignments = await mockDb.getShiftAssignments();
    return NextResponse.json(assignments);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch shift assignments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { employeeId, shiftTemplateId, date } = payload;
    if (!employeeId || !shiftTemplateId || !date) {
      return NextResponse.json({ error: "Missing required fields (employeeId, shiftTemplateId, date)" }, { status: 400 });
    }

    const result = await mockDb.createShiftAssignment(employeeId, shiftTemplateId, date);
    if (!result.success) {
      return NextResponse.json({ error: "Conflict detected", conflicts: result.errors }, { status: 409 });
    }

    return NextResponse.json(result.assignment);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to assign shift" }, { status: 500 });
  }
}
