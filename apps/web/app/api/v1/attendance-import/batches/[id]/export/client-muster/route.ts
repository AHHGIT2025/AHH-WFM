import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { isAttendanceImportEnabled } from "@/lib/attendance-import-parser";
import { generateClientMusterWorkbook } from "@/lib/attendance-import-exporter";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAttendanceImportEnabled()) {
    return NextResponse.json({ error: "Attendance Import module is disabled by feature flag." }, { status: 403 });
  }

  const auth = await checkApiAuth(undefined, { requiredPermission: "attendance.import.view" });
  if (auth.error) return auth.error;

  const session = auth.session;
  const user = session?.user as any;
  const operationAccess = user?.operationAccess || {};
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.permissions?.includes("manpower.admin.full_access");

  try {
    const batch = await prisma.attendanceImportBatch.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        batchNumber: true,
        companyId: true,
        operationType: true,
        status: true
      }
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    // Tenancy & Scope Access Enforcement
    if (!isAdmin) {
      if (batch.companyId && operationAccess.allowedCompanyIds && !operationAccess.allowedCompanyIds.includes(batch.companyId)) {
        return NextResponse.json({ error: "Forbidden: Cross-company access restricted." }, { status: 403 });
      }
      if (batch.operationType === "SECURITY_GUARDING" && !operationAccess.allowedSecurityGuarding) {
        return NextResponse.json({ error: "Forbidden: Security Guarding scope restricted." }, { status: 403 });
      }
      if (batch.operationType === "FACILITY_MANAGEMENT" && !operationAccess.allowedFacilityManagement) {
        return NextResponse.json({ error: "Forbidden: Facility Management scope restricted." }, { status: 403 });
      }
    }

    const excelBuffer = await generateClientMusterWorkbook(batch.id);

    return new Response(excelBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Client_Muster_DRAFT_${batch.batchNumber}.xlsx"`
      }
    });
  } catch (error: any) {
    console.error("Failed to generate client muster export:", error);
    return NextResponse.json({ error: error.message || "Failed to generate client muster export." }, { status: 500 });
  }
}
