import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { isAttendanceReconciliationEnabled } from "@/lib/attendance-reconciliation-engine";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAttendanceReconciliationEnabled()) {
    return NextResponse.json({ error: "Attendance Reconciliation module is disabled by feature flag." }, { status: 403 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  const { id: importBatchId } = await params;
  const url = new URL(request.url);
  const profile = url.searchParams.get("profile") || "DETAILED_TIMESHEET";
  const snapshotIdParam = url.searchParams.get("snapshotId");

  try {
    const importBatch = await prisma.attendanceImportBatch.findUnique({
      where: { id: importBatchId },
      include: { company: true }
    });

    if (!importBatch) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }

    const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
      where: { importBatchId },
      include: {
        snapshots: {
          orderBy: { approvalVersion: "desc" },
          take: 1
        }
      }
    });

    const isApproved = recBatch && recBatch.status === "APPROVED";
    const targetSnapshotId = snapshotIdParam || (isApproved && recBatch.snapshots.length > 0 ? recBatch.snapshots[0].id : null);

    if (targetSnapshotId) {
      const snapshot = await prisma.attendanceApprovedSnapshot.findUnique({
        where: { id: targetSnapshotId },
        include: {
          snapshotRows: {
            orderBy: { dutyDate: "asc" }
          }
        }
      });

      if (!snapshot) {
        return NextResponse.json({ error: "Approved snapshot not found." }, { status: 404 });
      }

      const rowsData = snapshot.snapshotRows.map(r => {
        const dutyDateStr = r.dutyDate instanceof Date ? r.dutyDate.toISOString().slice(0, 10) : String(r.dutyDate).slice(0, 10);
        const timeInStr = r.actualTimeIn ? (r.actualTimeIn instanceof Date ? r.actualTimeIn.toISOString().slice(11, 16) : String(r.actualTimeIn)) : "";
        const timeOutStr = r.actualTimeOut ? (r.actualTimeOut instanceof Date ? r.actualTimeOut.toISOString().slice(11, 16) : String(r.actualTimeOut)) : "";
        const regularHours = (r.approvedRegularMinutes / 60).toFixed(2);
        const otHours = (r.approvedOtMinutes / 60).toFixed(2);

        return {
          "Duty Date": dutyDateStr,
          "Employee Code": r.employeeCode,
          "Employee Name": r.employeeName,
          "Operation Scope": r.operationType,
          "Site / Location": r.siteName || "",
          "Contract Number": r.contractNumber || "",
          "Shift Code": r.shiftCode || "",
          "Time In": timeInStr,
          "Time Out": timeOutStr,
          "Approved Regular Hours": regularHours,
          "Approved OT Hours": otHours,
          "Approved Status": r.approvedStatus,
          "Leave Type": r.approvedLeaveType || "",
          "Decision Type": r.decisionType,
          "Reason Code": r.reasonCode || "",
          "Row Checksum": r.rowChecksum
        };
      });

      const headerAoa = [
        ["AHH WFM — APPROVED RECONCILIATION TIMESHEET — NOT POSTED"],
        [`Batch Number: ${snapshot.sourceImportBatchNumber} | Approval Version: ${snapshot.approvalVersion} | Rec Version: ${snapshot.reconciliationVersion}`],
        [`Snapshot Hash: ${snapshot.snapshotHash}`],
        [`Approved By: ${snapshot.approvedByName || snapshot.approvedById} | Approved At: ${snapshot.approvedAt.toISOString()} | Scope: ${snapshot.operationType}`],
        []
      ];

      const ws = XLSX.utils.aoa_to_sheet(headerAoa);
      XLSX.utils.sheet_add_json(ws, rowsData, { origin: "A6" });

      const wb = XLSX.utils.book_new();
      const sheetName = profile === "CLIENT_MUSTER" ? "Approved Client Muster" : "Approved Timesheet";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const filename = `${importBatch.batchNumber}_APPROVED_SNAPSHOT_V${snapshot.approvalVersion}.xlsx`;

      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      });
    }

    // Pre-approval DRAFT export
    const stagingRows = await prisma.attendanceImportRow.findMany({
      where: { batchId: importBatchId },
      include: { employee: true, site: true, contract: true },
      orderBy: { sourceRowNumber: "asc" }
    });

    const rowsData = stagingRows.map(r => ({
      "Duty Date": r.attendanceDate ? r.attendanceDate.toISOString().slice(0, 10) : r.rawAttendanceDate,
      "Employee Code": r.employee?.id || r.rawEmployeeCode,
      "Employee Name": r.employee ? r.employee.name : r.rawEmployeeName,
      "Operation Scope": importBatch.operationType,
      "Site": r.site?.name || r.rawSite,
      "Contract": r.contract?.contractNumber || r.rawContract,
      "Shift": r.rawShift,
      "Time In": r.actualTimeIn ? r.actualTimeIn.toISOString().slice(11, 16) : r.rawActualTimeIn,
      "Time Out": r.actualTimeOut ? r.actualTimeOut.toISOString().slice(11, 16) : r.rawActualTimeOut,
      "Worked Hours": r.workedHours || 0,
      "OT Hours": r.otHours || 0,
      "Status": r.normalizedStatus || r.rawAttendanceStatus,
      "Validation Status": r.validationStatus
    }));

    const draftHeaderAoa = [
      ["AHH WFM — RECONCILIATION TIMESHEET (DRAFT — NOT APPROVED)"],
      [`Batch Number: ${importBatch.batchNumber} | Scope: ${importBatch.operationType} | Status: ${recBatch?.status || "NOT_STARTED"}`],
      [`Notice: This document contains non-authoritative draft reconciliation data.`],
      []
    ];

    const ws = XLSX.utils.aoa_to_sheet(draftHeaderAoa);
    XLSX.utils.sheet_add_json(ws, rowsData, { origin: "A5" });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Draft Reconciliation");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${importBatch.batchNumber}_DRAFT_RECONCILIATION.xlsx"`
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate export." }, { status: 500 });
  }
}