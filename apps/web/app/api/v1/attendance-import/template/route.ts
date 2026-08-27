import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import {
  isAttendanceImportEnabled,
  getStandardAttendanceTemplateCsv,
  getStandardMonthlyMatrixTemplateXlsx
} from "@/lib/attendance-import-parser";

export async function GET(request: Request) {
  if (!isAttendanceImportEnabled()) {
    return NextResponse.json({ error: "Attendance Import module is disabled by feature flag." }, { status: 403 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  const session = auth.session;
  const user = session?.user as any;
  const isAdmin = isAdminUser(user);

  if (!isAdmin) {
    const hasPerm = hasPermission(user, "attendance.import.view") || 
                    hasPermission(user, "attendance.import.create") || 
                    hasPermission(user, "attendance.view") ||
                    hasPermission(user, "manpower.security.view") ||
                    hasPermission(user, "manpower.fm.view");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden: Requires attendance import permissions." }, { status: 403 });
    }
  }

  const url = request?.url ? new URL(request.url) : null;
  const profile = url ? url.searchParams.get("profile") : null;

  if (profile === "MONTHLY_MUSTER_MATRIX") {
    const xlsxBuffer = getStandardMonthlyMatrixTemplateXlsx();
    return new Response(xlsxBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="AHH_WFM_Roster_Attendance_Upload_Template.xlsx"'
      }
    });
  }

  const csv = getStandardAttendanceTemplateCsv();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attendance_intake_template.csv"'
    }
  });
}

