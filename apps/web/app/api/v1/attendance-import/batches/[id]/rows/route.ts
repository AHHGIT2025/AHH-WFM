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
      select: { id: true, companyId: true, operationType: true }
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    // Tenancy & Scope isolation
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

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "ALL"; // ALL | VALID | WARNINGS | ERRORS | DUPLICATES | UNMATCHED
    const query = searchParams.get("q") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: any = { batchId };

    if (filter === "VALID") {
      where.validationStatus = "VALID";
    } else if (filter === "WARNINGS" || filter === "WARNING") {
      where.validationStatus = "WARNING";
    } else if (filter === "ERRORS" || filter === "ERROR") {
      where.validationStatus = "ERROR";
    } else if (filter === "DUPLICATES" || filter === "DUPLICATE") {
      where.OR = [{ validationStatus: "DUPLICATE" }, { isDuplicate: true }];
    } else if (filter === "UNMATCHED") {
      where.OR = [{ validationStatus: "UNMATCHED" }, { employeeId: null }];
    }

    if (query && query.trim()) {
      const q = query.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { rawEmployeeCode: { contains: q } },
            { rawEmployeeName: { contains: q } },
            { rawSite: { contains: q } },
            { rawContract: { contains: q } }
          ]
        }
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.attendanceImportRow.count({ where }),
      prisma.attendanceImportRow.findMany({
        where,
        orderBy: { sourceRowNumber: "asc" },
        skip,
        take: limit,
        include: {
          employee: { select: { id: true, name: true, employeeCategory: true, employmentStatus: true } },
          site: { select: { id: true, code: true, name: true, operationType: true } },
          contract: { select: { id: true, contractNumber: true, status: true } },
          existingAttendance: { select: { id: true, checkIn: true, checkOut: true, status: true, device: true } }
        }
      })
    ]);

    return NextResponse.json({
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error("Failed to query staging rows:", error);
    return NextResponse.json({ error: error.message || "Failed to query staging rows." }, { status: 500 });
  }
}
