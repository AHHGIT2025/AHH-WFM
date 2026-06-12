import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { employeeIds, shiftTemplateId, dates } = payload;
    if (!employeeIds || !shiftTemplateId || !dates || !Array.isArray(employeeIds) || !Array.isArray(dates)) {
      return NextResponse.json({ error: "Missing required fields (employeeIds, shiftTemplateId, dates as arrays)" }, { status: 400 });
    }

    const result = await mockDb.createBulkShiftAssignments(employeeIds, shiftTemplateId, dates);
    if (!result.success) {
      return NextResponse.json({ error: "Conflict detected in bulk batch", conflicts: result.errors }, { status: 409 });
    }

    return NextResponse.json({ success: true, count: result.createdCount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to execute bulk shift assignment" }, { status: 500 });
  }
}
