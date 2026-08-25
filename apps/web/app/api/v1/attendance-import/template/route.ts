import { NextResponse } from "next/server";
import { isAttendanceImportEnabled, getStandardAttendanceTemplateCsv } from "@/lib/attendance-import-parser";

export async function GET() {
  if (!isAttendanceImportEnabled()) {
    return NextResponse.json({ error: "Attendance Import module is disabled by feature flag." }, { status: 403 });
  }

  const csv = getStandardAttendanceTemplateCsv();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"attendance_intake_template.csv\""
    }
  });
}
