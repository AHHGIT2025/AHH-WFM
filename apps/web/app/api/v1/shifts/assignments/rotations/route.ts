import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { employeeIds, rotationTemplateId, startDate, occurrences } = payload;
    if (!employeeIds || !rotationTemplateId || !startDate || !occurrences || !Array.isArray(employeeIds)) {
      return NextResponse.json({ error: "Missing required fields (employeeIds, rotationTemplateId, startDate, occurrences)" }, { status: 400 });
    }

    const result = await mockDb.applyRotationAssignments(
      employeeIds,
      rotationTemplateId,
      startDate,
      parseInt(occurrences)
    );

    if (!result.success) {
      return NextResponse.json({ error: "Conflict detected in rotation pattern", conflicts: result.conflicts }, { status: 409 });
    }

    return NextResponse.json({ success: true, count: result.createdCount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to apply rotation template" }, { status: 500 });
  }
}
