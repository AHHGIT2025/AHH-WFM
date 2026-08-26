import * as XLSX from "xlsx";
import { prisma } from "@ahh-wfm/database";
import { sanitizeSpreadsheetFormula } from "./attendance-import-parser";

export interface ExportOptions {
  watermarkText?: string;
  isDraft?: boolean;
}

/**
 * Generates Detailed Monthly Attendance Timesheet Workbook (DRAFT)
 */
export async function generateDetailedTimesheetWorkbook(
  batchId: string,
  options?: ExportOptions
): Promise<Buffer> {
  const batch = await prisma.attendanceImportBatch.findUnique({
    where: { id: batchId },
    include: {
      company: true,
      uploadedBy: true,
      reviewedBy: true,
      rows: {
        orderBy: [{ sourceRowNumber: "asc" }, { rawAttendanceDate: "asc" }]
      }
    }
  });

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  const wb = XLSX.utils.book_new();

  // Extract Metadata
  const metadata = (batch.metadata || {}) as Record<string, any>;
  const clientName = metadata.clientName || batch.company?.companyName || "Al Hattab Holding";
  const siteName = metadata.siteName || "Authoritative Site Operations";
  const contractNumber = metadata.contractNumber || "Authoritative Contract";
  const year = metadata.periodYear || (batch.attendancePeriodFrom ? new Date(batch.attendancePeriodFrom).getFullYear() : 2026);
  const month = metadata.periodMonth || (batch.attendancePeriodFrom ? new Date(batch.attendancePeriodFrom).getMonth() + 1 : 8);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Group Staging Rows by Employee
  const employeeMap = new Map<string, {
    employeeCode: string;
    employeeName: string;
    designation: string;
    dailyRows: Map<number, any>;
  }>();

  for (const row of batch.rows) {
    const rawP = (row.rawPayload || {}) as Record<string, any>;
    const empCode = row.rawEmployeeCode || rawP.employeeCode || "UNKNOWN";
    const empName = row.rawEmployeeName || rawP.employeeName || "Employee";
    const designation = rawP.designation || "Security Officer";

    if (!employeeMap.has(empCode)) {
      employeeMap.set(empCode, {
        employeeCode: empCode,
        employeeName: empName,
        designation,
        dailyRows: new Map()
      });
    }

    const empData = employeeMap.get(empCode)!;
    let dayNum = rawP.day;
    if (!dayNum && row.rawAttendanceDate) {
      const parts = row.rawAttendanceDate.split("-");
      if (parts.length === 3) dayNum = parseInt(parts[2], 10);
    }

    if (dayNum && dayNum >= 1 && dayNum <= daysInMonth) {
      empData.dailyRows.set(dayNum, row);
    }
  }

  // Build Sheet Rows
  const sheetData: any[][] = [];

  // 1. Header Banner & DRAFT Status
  sheetData.push(["AHH WFM — DETAILED MONTHLY ATTENDANCE TIMESHEET"]);
  sheetData.push(["STATUS: DRAFT — NOT APPROVED (FOR PRE-RECONCILIATION REVIEW ONLY)"]);
  sheetData.push([""]);
  sheetData.push(["Company:", sanitizeSpreadsheetFormula(batch.company?.companyName || "AHH"), "Client:", sanitizeSpreadsheetFormula(clientName), "Location / Site:", sanitizeSpreadsheetFormula(siteName)]);
  sheetData.push(["Contract:", sanitizeSpreadsheetFormula(contractNumber), "Month:", `${month} / ${year}`, "Batch Reference:", sanitizeSpreadsheetFormula(batch.batchNumber)]);
  sheetData.push([""]);

  // 2. Table Header
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));
  const tableHeader = [
    "S/N",
    "PF No",
    "Employee Name",
    "Designation",
    "Row Type",
    ...dayHeaders,
    "Normal Hours",
    "OT Hours",
    "Total Hours",
    "Duty Days",
    "OJT Hours",
    "Idle Hours",
    "Leave Days"
  ];
  sheetData.push(tableHeader);

  // Daily Accumulators
  const dailyMobilizedCount = new Array(daysInMonth).fill(0);
  const dailySuppliedHours = new Array(daysInMonth).fill(0);

  let serial = 1;

  // 3. Populate 2 Rows Per Employee (DUTY & OT)
  for (const [empCode, empData] of employeeMap.entries()) {
    let empNormalHours = 0;
    let empOtHours = 0;
    let empDutyDays = 0;
    let empOjtHours = 0;
    let empIdleHours = 0;
    let empLeaveDays = 0;

    const dutyRowCells: any[] = [
      serial,
      sanitizeSpreadsheetFormula(empCode),
      sanitizeSpreadsheetFormula(empData.employeeName),
      sanitizeSpreadsheetFormula(empData.designation),
      "DUTY"
    ];

    const otRowCells: any[] = [
      "",
      sanitizeSpreadsheetFormula(empCode),
      sanitizeSpreadsheetFormula(empData.employeeName),
      sanitizeSpreadsheetFormula(empData.designation),
      "OT"
    ];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayRecord = empData.dailyRows.get(d);
      const rawP = (dayRecord?.rawPayload || {}) as Record<string, any>;
      const rawStatus = rawP.rawStatus || dayRecord?.rawAttendanceStatus || "";
      const workedH = dayRecord?.workedHours !== undefined && dayRecord?.workedHours !== null
        ? Number(dayRecord.workedHours)
        : parseFloat(dayRecord?.rawWorkedHours || "0") || 0;
      const otH = dayRecord?.otHours !== undefined && dayRecord?.otHours !== null
        ? Number(dayRecord.otHours)
        : parseFloat(dayRecord?.rawOtHours || "0") || 0;

      // Status classification
      const statusUpper = (rawStatus || "").toUpperCase();
      const isWorking = workedH > 0 || statusUpper === "P" || statusUpper === "PRESENT" || statusUpper === "OJT" || statusUpper === "IDLE" || /^\d+$/.test(statusUpper);

      if (isWorking) {
        empNormalHours += workedH;
        empDutyDays += 1;
        dailyMobilizedCount[d - 1] += 1;
        dailySuppliedHours[d - 1] += workedH;
      }

      if (statusUpper === "OJT") empOjtHours += workedH || 8;
      if (statusUpper === "IDLE") empIdleHours += workedH || 8;
      if (statusUpper === "SL" || statusUpper === "AL" || statusUpper === "HL" || dayRecord?.rawLeaveType) empLeaveDays += 1;

      if (otH > 0) {
        empOtHours += otH;
        dailySuppliedHours[d - 1] += otH;
      }

      dutyRowCells.push(sanitizeSpreadsheetFormula(rawStatus || ""));
      otRowCells.push(otH > 0 ? String(otH) : "0");
    }

    const totalHours = empNormalHours + empOtHours;

    dutyRowCells.push(
      empNormalHours,
      empOtHours,
      totalHours,
      empDutyDays,
      empOjtHours,
      empIdleHours,
      empLeaveDays
    );

    otRowCells.push("", "", "", "", "", "", "");

    sheetData.push(dutyRowCells);
    sheetData.push(otRowCells);
    serial++;
  }

  // 4. Daily Summary Footers
  sheetData.push([""]);
  sheetData.push(["DAILY SUMMARY"]);

  // Daily Actual Mobilized
  sheetData.push([
    "",
    "",
    "Daily Actual Mobilized",
    "",
    "",
    ...dailyMobilizedCount,
    "",
    "",
    dailyMobilizedCount.reduce((a, b) => a + b, 0)
  ]);

  // Daily Required Manpower (Estimated baseline from active batch)
  const defaultRequired = employeeMap.size > 0 ? Math.max(1, Math.round(employeeMap.size * 0.9)) : 0;
  const dailyRequired = new Array(daysInMonth).fill(defaultRequired);
  sheetData.push([
    "",
    "",
    "Daily Required Manpower",
    "",
    "",
    ...dailyRequired,
    "",
    "",
    dailyRequired.reduce((a, b) => a + b, 0)
  ]);

  // Daily Variance
  const dailyVariance = dailyMobilizedCount.map((act, idx) => act - dailyRequired[idx]);
  sheetData.push([
    "",
    "",
    "Daily Variance (Shortfall / Excess)",
    "",
    "",
    ...dailyVariance,
    "",
    "",
    dailyVariance.reduce((a, b) => a + b, 0)
  ]);

  // Supplied Hours
  sheetData.push([
    "",
    "",
    "Daily Supplied Hours",
    "",
    "",
    ...dailySuppliedHours,
    "",
    "",
    dailySuppliedHours.reduce((a, b) => a + b, 0)
  ]);

  // 5. Sign-off Footer Blocks
  sheetData.push([""]);
  sheetData.push(["SIGN-OFF & VERIFICATION"]);
  sheetData.push([
    "Prepared By:",
    sanitizeSpreadsheetFormula(batch.uploadedByName || batch.uploadedBy?.name || "Operations Supervisor"),
    "Verified By:",
    sanitizeSpreadsheetFormula(batch.reviewedByName || batch.reviewedBy?.name || "Operations Manager"),
    "Approved By:",
    "DRAFT — PENDING AT-2 APPROVAL",
    "Client Representative:",
    "DRAFT — CLIENT SIGN-OFF PENDING"
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, "Detailed_Timesheet");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Generates Client Monthly Muster / Mobilization Sheet (DRAFT)
 */
export async function generateClientMusterWorkbook(
  batchId: string,
  options?: ExportOptions
): Promise<Buffer> {
  const batch = await prisma.attendanceImportBatch.findUnique({
    where: { id: batchId },
    include: {
      company: true,
      uploadedBy: true,
      reviewedBy: true,
      rows: {
        orderBy: [{ sourceRowNumber: "asc" }, { rawAttendanceDate: "asc" }]
      }
    }
  });

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  const wb = XLSX.utils.book_new();

  const metadata = (batch.metadata || {}) as Record<string, any>;
  const clientName = metadata.clientName || batch.company?.companyName || "Al Hattab Holding";
  const siteName = metadata.siteName || "Authoritative Site Operations";
  const contractNumber = metadata.contractNumber || "Authoritative Contract";
  const year = metadata.periodYear || (batch.attendancePeriodFrom ? new Date(batch.attendancePeriodFrom).getFullYear() : 2026);
  const month = metadata.periodMonth || (batch.attendancePeriodFrom ? new Date(batch.attendancePeriodFrom).getMonth() + 1 : 8);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Group Staging Rows by Employee
  const employeeMap = new Map<string, {
    employeeCode: string;
    employeeName: string;
    designation: string;
    shiftHours: number;
    dailyRows: Map<number, any>;
  }>();

  for (const row of batch.rows) {
    const rawP = (row.rawPayload || {}) as Record<string, any>;
    const empCode = row.rawEmployeeCode || rawP.employeeCode || "UNKNOWN";
    const empName = row.rawEmployeeName || rawP.employeeName || "Employee";
    const designation = rawP.designation || "Security Guard";
    const shiftHours = rawP.shiftHours || 12;

    if (!employeeMap.has(empCode)) {
      employeeMap.set(empCode, {
        employeeCode: empCode,
        employeeName: empName,
        designation,
        shiftHours,
        dailyRows: new Map()
      });
    }

    const empData = employeeMap.get(empCode)!;
    let dayNum = rawP.day;
    if (!dayNum && row.rawAttendanceDate) {
      const parts = row.rawAttendanceDate.split("-");
      if (parts.length === 3) dayNum = parseInt(parts[2], 10);
    }

    if (dayNum && dayNum >= 1 && dayNum <= daysInMonth) {
      empData.dailyRows.set(dayNum, row);
    }
  }

  const sheetData: any[][] = [];

  // 1. Header Banner & DRAFT
  sheetData.push(["AHH WFM — CLIENT MONTHLY MUSTER & MOBILIZATION SHEET"]);
  sheetData.push(["STATUS: DRAFT — FOR CLIENT PRESENTATION & REVIEW ONLY"]);
  sheetData.push([""]);
  sheetData.push(["Client:", sanitizeSpreadsheetFormula(clientName), "Project / Site:", sanitizeSpreadsheetFormula(siteName), "Contract No:", sanitizeSpreadsheetFormula(contractNumber)]);
  sheetData.push(["Month & Year:", `${month} / ${year}`, "Batch Ref:", sanitizeSpreadsheetFormula(batch.batchNumber), "Scope:", sanitizeSpreadsheetFormula(batch.operationType || "SECURITY_GUARDING")]);
  sheetData.push([""]);

  // 2. Table Header
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));
  const tableHeader = [
    "S/N",
    "PF No",
    "Employee Name",
    "Designation",
    "Shift Hours",
    ...dayHeaders,
    "Present Days (P)",
    "Absent Days (A)",
    "Mobilized Hours"
  ];
  sheetData.push(tableHeader);

  const dailyMobilizedCount = new Array(daysInMonth).fill(0);
  let serial = 1;

  for (const [empCode, empData] of employeeMap.entries()) {
    let presentDays = 0;
    let absentDays = 0;
    let totalMobilizedHours = 0;

    const rowCells: any[] = [
      serial,
      sanitizeSpreadsheetFormula(empCode),
      sanitizeSpreadsheetFormula(empData.employeeName),
      sanitizeSpreadsheetFormula(empData.designation),
      empData.shiftHours
    ];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayRecord = empData.dailyRows.get(d);
      const rawP = (dayRecord?.rawPayload || {}) as Record<string, any>;
      const rawStatus = rawP.rawStatus || dayRecord?.rawAttendanceStatus || "";
      const statusUpper = (rawStatus || "").toUpperCase();
      const workedH = dayRecord?.workedHours !== undefined && dayRecord?.workedHours !== null
        ? Number(dayRecord.workedHours)
        : parseFloat(dayRecord?.rawWorkedHours || "0") || 0;

      // Controlled Mapping: P / A / NA
      let musterCode: "P" | "A" | "NA" = "NA";
      if (rawP.clientMusterCode) {
        musterCode = rawP.clientMusterCode;
      } else if (workedH > 0 || statusUpper === "P" || statusUpper === "PRESENT" || statusUpper === "OJT" || statusUpper === "IDLE" || /^\d+$/.test(statusUpper)) {
        musterCode = "P";
      } else if (statusUpper === "A" || statusUpper === "ABSENT" || statusUpper === "AB" || statusUpper === "SL" || statusUpper === "AL") {
        musterCode = "A";
      } else {
        musterCode = "NA";
      }

      if (musterCode === "P") {
        presentDays++;
        const h = workedH > 0 ? workedH : empData.shiftHours;
        totalMobilizedHours += h;
        dailyMobilizedCount[d - 1]++;
      } else if (musterCode === "A") {
        absentDays++;
      }

      rowCells.push(musterCode);
    }

    rowCells.push(presentDays, absentDays, totalMobilizedHours);
    sheetData.push(rowCells);
    serial++;
  }

  // 3. Daily Summary
  sheetData.push([""]);
  sheetData.push(["MOBILIZATION SUMMARY"]);

  sheetData.push([
    "",
    "",
    "Daily Actual Mobilized",
    "",
    "",
    ...dailyMobilizedCount,
    dailyMobilizedCount.reduce((a, b) => a + b, 0)
  ]);

  const defaultRequired = employeeMap.size > 0 ? Math.max(1, Math.round(employeeMap.size * 0.9)) : 0;
  const dailyRequired = new Array(daysInMonth).fill(defaultRequired);
  sheetData.push([
    "",
    "",
    "Required Quantity",
    "",
    "",
    ...dailyRequired,
    dailyRequired.reduce((a, b) => a + b, 0)
  ]);

  const dailyVariance = dailyMobilizedCount.map((act, idx) => act - dailyRequired[idx]);
  sheetData.push([
    "",
    "",
    "Daily Variance",
    "",
    "",
    ...dailyVariance,
    dailyVariance.reduce((a, b) => a + b, 0)
  ]);

  // 4. Sign-off Footer
  sheetData.push([""]);
  sheetData.push(["CLIENT ACCEPTANCE (DRAFT)"]);
  sheetData.push([
    "Operations Representative:",
    sanitizeSpreadsheetFormula(batch.uploadedByName || "Operations Manager"),
    "Client Representative:",
    "DRAFT — PENDING CLIENT VERIFICATION"
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, "Client_Muster");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
