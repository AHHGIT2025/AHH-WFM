import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import {
  isAttendanceImportEnabled,
  parseAttendanceImportContent,
  MAX_FILE_SIZE_BYTES
} from "@/lib/attendance-import-parser";
import { validateAttendanceImportBatch } from "@/lib/attendance-import-validator";

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const operationType = searchParams.get("operationType");
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (companyId) {
      where.companyId = companyId;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    // Tenancy and Scope Isolation: Attendance Intake is strictly for Security Guarding and Facility Management
    if (!isAdmin) {
      if (operationAccess.allowedCompanyIds && operationAccess.allowedCompanyIds.length > 0) {
        where.companyId = { in: operationAccess.allowedCompanyIds };
      }

      const allowedScopes: string[] = [];
      if (operationAccess.allowedSecurityGuarding) allowedScopes.push("SECURITY_GUARDING");
      if (operationAccess.allowedFacilityManagement) allowedScopes.push("FACILITY_MANAGEMENT");

      if (allowedScopes.length === 0) {
        return NextResponse.json({ error: "Forbidden: Attendance Intake is restricted to Security Guarding and Facility Management users." }, { status: 403 });
      }

      if (operationType && operationType !== "ALL") {
        if (!allowedScopes.includes(operationType)) {
          return NextResponse.json({ error: "Forbidden: Restricted operational scope." }, { status: 403 });
        }
        where.operationType = operationType;
      } else {
        where.operationType = { in: allowedScopes };
      }
    } else if (operationType && operationType !== "ALL") {
      if (operationType !== "SECURITY_GUARDING" && operationType !== "FACILITY_MANAGEMENT") {
        return NextResponse.json({ error: "Invalid operational scope. Must be SECURITY_GUARDING or FACILITY_MANAGEMENT." }, { status: 400 });
      }
      where.operationType = operationType;
    } else {
      where.operationType = { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] };
    }

    const [total, batches] = await Promise.all([
      prisma.attendanceImportBatch.count({ where }),
      prisma.attendanceImportBatch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          company: { select: { id: true, companyCode: true, companyName: true } },
          uploadedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } }
        }
      })
    ]);

    return NextResponse.json({
      batches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error("Failed to list attendance import batches:", error);
    return NextResponse.json({ error: error.message || "Failed to retrieve batches." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAttendanceImportEnabled()) {
    return NextResponse.json({ error: "Attendance Import module is disabled by feature flag." }, { status: 403 });
  }

  const auth = await checkApiAuth(undefined, { requiredPermission: "attendance.import.create" });
  if (auth.error) return auth.error;

  const session = auth.session;
  const user = session?.user as any;
  const userId = user?.id || "system-user";
  const userName = user?.name || "System User";
  const operationAccess = user?.operationAccess || {};
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.permissions?.includes("manpower.admin.full_access");

  try {
    let fileName = "attendance_import.csv";
    let companyId: string | null = null;
    let operationType: string = "SECURITY_GUARDING";
    let attendancePeriodFrom: Date | null = null;
    let attendancePeriodTo: Date | null = null;
    let autoValidate = true;
    let rawContent: string | Buffer = "";
    let importProfile: "NORMALIZED_ROW_UPLOAD" | "MONTHLY_MUSTER_MATRIX" = "NORMALIZED_ROW_UPLOAD";
    let periodYear: number | undefined = undefined;
    let periodMonth: number | undefined = undefined;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      companyId = formData.get("companyId") as string | null;
      operationType = formData.has("operationType") ? (formData.get("operationType") as string) : "SECURITY_GUARDING";
      const fromStr = formData.get("attendancePeriodFrom") as string | null;
      const toStr = formData.get("attendancePeriodTo") as string | null;
      const profStr = formData.get("importProfile") as string | null;
      const yStr = formData.get("year") as string | null;
      const mStr = formData.get("month") as string | null;
      autoValidate = formData.get("autoValidate") !== "false";

      if (profStr === "MONTHLY_MUSTER_MATRIX") importProfile = "MONTHLY_MUSTER_MATRIX";
      if (yStr) periodYear = parseInt(yStr, 10);
      if (mStr) periodMonth = parseInt(mStr, 10);

      if (fromStr) attendancePeriodFrom = new Date(fromStr);
      if (toStr) attendancePeriodTo = new Date(toStr);

      if (!file) {
        return NextResponse.json({ error: "Missing required file parameter in form data." }, { status: 400 });
      }

      fileName = file.name;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "File size exceeds the 10MB maximum limit." }, { status: 400 });
      }

      if (fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls")) {
        const arrayBuf = await file.arrayBuffer();
        rawContent = Buffer.from(arrayBuf);
      } else {
        rawContent = await file.text();
      }
    } else {
      const body = await request.json();
      fileName = body.fileName || "attendance_import.csv";
      companyId = body.companyId || null;
      operationType = body.operationType !== undefined ? body.operationType : "SECURITY_GUARDING";
      if (body.attendancePeriodFrom) attendancePeriodFrom = new Date(body.attendancePeriodFrom);
      if (body.attendancePeriodTo) attendancePeriodTo = new Date(body.attendancePeriodTo);
      if (body.importProfile === "MONTHLY_MUSTER_MATRIX") importProfile = "MONTHLY_MUSTER_MATRIX";
      if (body.year) periodYear = parseInt(body.year, 10);
      if (body.month) periodMonth = parseInt(body.month, 10);
      autoValidate = body.autoValidate !== false;
      rawContent = body.fileContent || "";

      if (!rawContent && body.rows && Array.isArray(body.rows)) {
        // Pre-formatted rows payload support
        const headerLine = Object.keys(body.rows[0] || {}).join(",");
        const dataLines = body.rows.map((r: any) => Object.values(r).join(","));
        rawContent = [headerLine, ...dataLines].join("\n");
      }
    }

    // Verify Valid Operational Scope (Strictly SECURITY_GUARDING or FACILITY_MANAGEMENT)
    if (operationType !== "SECURITY_GUARDING" && operationType !== "FACILITY_MANAGEMENT") {
      return NextResponse.json({
        error: "Invalid operational scope. Attendance intake is permitted only for SECURITY_GUARDING and FACILITY_MANAGEMENT."
      }, { status: 400 });
    }

    // Verify Scope Access
    if (!isAdmin) {
      if (operationType === "SECURITY_GUARDING" && !operationAccess.allowedSecurityGuarding) {
        return NextResponse.json({ error: "Forbidden: No access to Security Guarding scope." }, { status: 403 });
      }
      if (operationType === "FACILITY_MANAGEMENT" && !operationAccess.allowedFacilityManagement) {
        return NextResponse.json({ error: "Forbidden: No access to Facility Management scope." }, { status: 403 });
      }
      if (companyId && operationAccess.allowedCompanyIds && !operationAccess.allowedCompanyIds.includes(companyId)) {
        return NextResponse.json({ error: "Forbidden: No access to selected company." }, { status: 403 });
      }
    }

    // Parse the uploaded content safely
    const parseResult = parseAttendanceImportContent(rawContent, fileName, {
      importProfile,
      year: periodYear,
      month: periodMonth,
      companyId: companyId || undefined
    });

    if (!parseResult.success) {
      return NextResponse.json({
        error: parseResult.errors.join("; "),
        details: parseResult.errors
      }, { status: 400 });
    }

    // Generate unique batch number: AIB-YYYYMM-XXXX
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const countThisMonth = await prisma.attendanceImportBatch.count({
      where: {
        batchNumber: { startsWith: `AIB-${yearMonth}` }
      }
    });
    let seq = countThisMonth + 1;
    let batchNumber = `AIB-${yearMonth}-${String(seq).padStart(4, "0")}`;
    let exists = await prisma.attendanceImportBatch.findUnique({ where: { batchNumber } });
    while (exists) {
      seq++;
      batchNumber = `AIB-${yearMonth}-${String(seq).padStart(4, "0")}`;
      exists = await prisma.attendanceImportBatch.findUnique({ where: { batchNumber } });
    }

    const initialMetadata = {
      importProfile: parseResult.matrixMetadata?.importProfile || importProfile,
      clientName: parseResult.matrixMetadata?.clientName,
      siteName: parseResult.matrixMetadata?.siteName,
      contractNumber: parseResult.matrixMetadata?.contractNumber,
      periodYear: parseResult.matrixMetadata?.periodYear || periodYear,
      periodMonth: parseResult.matrixMetadata?.periodMonth || periodMonth,
      daysInMonth: parseResult.matrixMetadata?.daysInMonth,
      totalEmployeesInMatrix: parseResult.matrixMetadata?.totalEmployeesInMatrix,
      totalExpandedRows: parseResult.rows.length
    };

    const fileSize = Buffer.isBuffer(rawContent) ? rawContent.length : Buffer.byteLength(rawContent, "utf-8");

    // Transactional Batch & Staging Rows Creation with Chunking
    const createdBatch = await prisma.$transaction(async (tx) => {
      const batch = await tx.attendanceImportBatch.create({
        data: {
          batchNumber,
          companyId,
          operationType,
          attendancePeriodFrom,
          attendancePeriodTo,
          sourceType: "FILE_UPLOAD",
          originalFileName: fileName,
          fileSize,
          fileHash: parseResult.fileHash,
          recordCount: parseResult.rows.length,
          status: "UPLOADED",
          uploadedById: userId,
          uploadedByName: userName,
          metadata: initialMetadata as any
        }
      });

      // Insert Staging Rows in chunks for transaction safety
      const chunkSize = 200;
      for (let i = 0; i < parseResult.rows.length; i += chunkSize) {
        const chunk = parseResult.rows.slice(i, i + chunkSize);
        await tx.attendanceImportRow.createMany({
          data: chunk.map((r) => ({
            batchId: batch.id,
            sourceRowNumber: r.sourceRowNumber,
            rawPayload: r.rawPayload as any,
            rowFingerprint: r.rowFingerprint,
            rawAttendanceDate: r.rawAttendanceDate,
            rawEmployeeCode: r.rawEmployeeCode,
            rawEmployeeName: r.rawEmployeeName,
            rawCompany: r.rawCompany,
            rawSite: r.rawSite,
            rawContract: r.rawContract,
            rawShift: r.rawShift,
            rawPlannedStart: r.rawPlannedStart,
            rawPlannedEnd: r.rawPlannedEnd,
            rawActualTimeIn: r.rawActualTimeIn,
            rawActualTimeOut: r.rawActualTimeOut,
            rawWorkedHours: r.rawWorkedHours,
            rawOtHours: r.rawOtHours,
            rawAttendanceStatus: r.rawAttendanceStatus,
            rawLeaveType: r.rawLeaveType,
            rawReplacementEmployeeCode: r.rawReplacementEmployeeCode,
            rawAssignmentType: r.rawAssignmentType,
            rawRemarks: r.rawRemarks,
            validationStatus: "PENDING"
          }))
        });
      }

      return batch;
    });

    // Execute validation immediately if requested
    if (autoValidate) {
      const valResult = await validateAttendanceImportBatch(createdBatch.id, userId);
      const updatedBatch = await prisma.attendanceImportBatch.findUnique({
        where: { id: createdBatch.id },
        include: {
          company: { select: { id: true, companyCode: true, companyName: true } }
        }
      });
      return NextResponse.json({
        batch: updatedBatch,
        validationSummary: valResult,
        message: "Attendance file staged and validated successfully."
      }, { status: 201 });
    }

    return NextResponse.json({
      batch: createdBatch,
      message: "Attendance file staged successfully. Ready for validation."
    }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to process attendance upload:", error);
    return NextResponse.json({ error: error.message || "Failed to process attendance intake file." }, { status: 500 });
  }
}
