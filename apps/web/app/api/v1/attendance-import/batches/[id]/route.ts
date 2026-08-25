import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { isAttendanceImportEnabled } from "@/lib/attendance-import-parser";

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
    const batchId = params.id;
    const batch = await prisma.attendanceImportBatch.findUnique({
      where: { id: batchId },
      include: {
        company: { select: { id: true, companyCode: true, companyName: true } },
        uploadedBy: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true, role: true } }
      }
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    // Tenancy and Scope Isolation Check
    if (!isAdmin) {
      if (operationAccess.allowedCompanyIds && batch.companyId && !operationAccess.allowedCompanyIds.includes(batch.companyId)) {
        return NextResponse.json({ error: "Forbidden: Cross-company access restricted." }, { status: 403 });
      }
      if (batch.operationType === "SECURITY_GUARDING" && !operationAccess.allowedSecurityGuarding) {
        return NextResponse.json({ error: "Forbidden: Security Guarding scope restricted." }, { status: 403 });
      }
      if (batch.operationType === "FACILITY_MANAGEMENT" && !operationAccess.allowedFacilityManagement) {
        return NextResponse.json({ error: "Forbidden: Facility Management scope restricted." }, { status: 403 });
      }
    }

    return NextResponse.json({ batch });
  } catch (error: any) {
    console.error("Failed to retrieve batch:", error);
    return NextResponse.json({ error: error.message || "Failed to retrieve batch details." }, { status: 500 });
  }
}
