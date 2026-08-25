import crypto from "crypto";

export interface ParsedImportRow {
  sourceRowNumber: number;
  rawPayload: Record<string, string>;
  rowFingerprint: string;
  rawAttendanceDate: string;
  rawEmployeeCode: string;
  rawEmployeeName: string;
  rawCompany: string;
  rawSite: string;
  rawContract: string;
  rawShift: string;
  rawPlannedStart: string;
  rawPlannedEnd: string;
  rawActualTimeIn: string;
  rawActualTimeOut: string;
  rawWorkedHours: string;
  rawOtHours: string;
  rawAttendanceStatus: string;
  rawLeaveType: string;
  rawReplacementEmployeeCode: string;
  rawAssignmentType: string;
  rawRemarks: string;
}

export interface ParseResult {
  success: boolean;
  rows: ParsedImportRow[];
  headers: string[];
  fileHash: string;
  recordCount: number;
  errors: string[];
  warnings: string[];
}

export const MAX_IMPORT_ROWS = 5000;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function isAttendanceImportEnabled(): boolean {
  return process.env.ATTENDANCE_IMPORT_ENABLED !== "false";
}

/**
 * Defends against CSV / Spreadsheet Formula Injection (CWE-1236)
 * Prepend single quote or strip dangerous formula execution triggers.
 */
export function sanitizeSpreadsheetFormula(val: string | null | undefined): string {
  if (!val) return "";
  const trimmed = String(val).trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    // If it starts with formula prefix, sanitize safely
    return `'${trimmed}`;
  }
  return trimmed;
}

export function computeFileHash(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function computeRowFingerprint(
  employeeCode: string,
  dutyDateStr: string,
  site: string,
  shiftOrTime: string
): string {
  const norm = [
    (employeeCode || "").trim().toUpperCase(),
    (dutyDateStr || "").trim(),
    (site || "").trim().toUpperCase(),
    (shiftOrTime || "").trim().toUpperCase()
  ].join("|");
  return crypto.createHash("sha256").update(norm).digest("hex");
}

export const STANDARD_TEMPLATE_HEADERS = [
  "Attendance Date",
  "Employee Code",
  "Employee Name",
  "Company Code",
  "Site / Location",
  "Contract Number",
  "Shift Code",
  "Planned Start",
  "Planned End",
  "Actual Time In",
  "Actual Time Out",
  "Worked Hours",
  "OT Hours",
  "Attendance Status",
  "Leave Type",
  "Replacement Employee Code",
  "Assignment Type",
  "Remarks"
];

export function getStandardAttendanceTemplateCsv(): string {
  const headerLine = STANDARD_TEMPLATE_HEADERS.join(",");
  const sample1 = [
    "2026-08-25",
    "EMP001",
    "Ahmed Al-Kuwari",
    "AHH-SEC",
    "Lusail Tower Alpha",
    "CNT-2026-001",
    "DAY-12H",
    "07:00",
    "19:00",
    "2026-08-25 06:55",
    "2026-08-25 19:05",
    "12.0",
    "0.0",
    "PRESENT",
    "",
    "",
    "PRIMARY",
    "Normal operational shift"
  ].join(",");
  const sample2 = [
    "2026-08-25",
    "EMP002",
    "Mohammed Hassan",
    "AHH-SEC",
    "Lusail Tower Alpha",
    "CNT-2026-001",
    "NIGHT-12H",
    "19:00",
    "07:00",
    "2026-08-25 18:50",
    "2026-08-26 07:10",
    "12.0",
    "0.0",
    "PRESENT",
    "",
    "",
    "PRIMARY",
    "Overnight shift spanning across midnight"
  ].join(",");

  return `${headerLine}\n${sample1}\n${sample2}\n`;
}

/**
 * Normalizes header keys to standard internal field names
 */
function normalizeHeaderKey(rawHeader: string): string {
  const h = rawHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (h === "attendancedate" || h === "date" || h === "dutydate") return "attendanceDate";
  if (h === "employeecode" || h === "employeeid" || h === "empcode" || h === "empid" || h === "badgenumber" || h === "badge") return "employeeCode";
  if (h === "employeename" || h === "name" || h === "fullname") return "employeeName";
  if (h === "companycode" || h === "company" || h === "companyname") return "company";
  if (h === "sitelocation" || h === "site" || h === "sitecode" || h === "sitename" || h === "worklocation" || h === "worksite" || h === "location") return "site";
  if (h === "contractnumber" || h === "contract" || h === "contractcode") return "contract";
  if (h === "shiftcode" || h === "shift" || h === "shiftname") return "shift";
  if (h === "plannedstart" || h === "plannedstarttime" || h === "planstart") return "plannedStart";
  if (h === "plannedend" || h === "plannedendtime" || h === "planend") return "plannedEnd";
  if (h === "actualtimein" || h === "timein" || h === "checkin" || h === "clockin" || h === "intime" || h === "actualin") return "actualTimeIn";
  if (h === "actualtimeout" || h === "timeout" || h === "checkout" || h === "clockout" || h === "outtime" || h === "actualout") return "actualTimeOut";
  if (h === "workedhours" || h === "hoursworked" || h === "hours" || h === "totalhours") return "workedHours";
  if (h === "othours" || h === "overtimehours" || h === "overtime") return "otHours";
  if (h === "attendancestatus" || h === "status") return "attendanceStatus";
  if (h === "leavetype" || h === "leave") return "leaveType";
  if (h === "replacementemployeecode" || h === "replacementempcode" || h === "replacement" || h === "relievercode" || h === "reliever") return "replacementEmployeeCode";
  if (h === "assignmenttype" || h === "assignment") return "assignmentType";
  if (h === "remarks" || h === "comments" || h === "notes" || h === "remark") return "remarks";
  return rawHeader.trim();
}

/**
 * Robust RFC 4180 CSV parser supporting quotes, commas, multiline cells, and CRLF
 */
export function parseCsvString(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  const text = csvText.replace(/^\uFEFF/, ""); // Remove UTF-8 BOM if present

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // skip LF after CR
      }
      currentRow.push(currentCell.trim());
      currentCell = "";
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Main parse entry point for attendance intake files
 */
export function parseAttendanceImportContent(
  rawContent: string | Buffer,
  fileName: string,
  options?: { maxRows?: number }
): ParseResult {
  const maxRows = options?.maxRows || MAX_IMPORT_ROWS;
  const contentStr = typeof rawContent === "string" ? rawContent : rawContent.toString("utf-8");
  const fileHash = computeFileHash(rawContent);

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file content size
  if (contentStr.length === 0) {
    return {
      success: false,
      rows: [],
      headers: [],
      fileHash,
      recordCount: 0,
      errors: ["File is empty. Please upload a valid attendance CSV file."],
      warnings: []
    };
  }

  const rawRows = parseCsvString(contentStr);

  if (rawRows.length < 2) {
    return {
      success: false,
      rows: [],
      headers: rawRows.length > 0 ? rawRows[0] : [],
      fileHash,
      recordCount: 0,
      errors: ["File must contain a header row and at least one data row."],
      warnings: []
    };
  }

  const rawHeaders = rawRows[0];
  const headerKeys = rawHeaders.map(normalizeHeaderKey);

  // Check required columns: at minimum Employee Code and Attendance Date or Site
  const hasEmployeeCode = headerKeys.includes("employeeCode");
  const hasAttendanceDate = headerKeys.includes("attendanceDate");

  if (!hasEmployeeCode || !hasAttendanceDate) {
    const missing: string[] = [];
    if (!hasEmployeeCode) missing.push("Employee Code");
    if (!hasAttendanceDate) missing.push("Attendance Date");
    return {
      success: false,
      rows: [],
      headers: rawHeaders,
      fileHash,
      recordCount: 0,
      errors: [`Missing required column(s): ${missing.join(", ")}. Standard template headers are recommended.`],
      warnings: []
    };
  }

  if (rawRows.length - 1 > maxRows) {
    return {
      success: false,
      rows: [],
      headers: rawHeaders,
      fileHash,
      recordCount: rawRows.length - 1,
      errors: [`File exceeds the maximum allowable limit of ${maxRows} rows per batch. Found ${rawRows.length - 1} data rows.`],
      warnings: []
    };
  }

  const parsedRows: ParsedImportRow[] = [];

  for (let r = 1; r < rawRows.length; r++) {
    const rowValues = rawRows[r];
    const sourceRowNumber = r + 1; // 1-based line number including header

    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headerKeys.length; c++) {
      const key = headerKeys[c];
      const val = c < rowValues.length ? rowValues[c] : "";
      rowObj[key] = sanitizeSpreadsheetFormula(val);
    }

    const rawEmployeeCode = rowObj.employeeCode || "";
    const rawAttendanceDate = rowObj.attendanceDate || "";
    const rawEmployeeName = rowObj.employeeName || "";
    const rawCompany = rowObj.company || "";
    const rawSite = rowObj.site || "";
    const rawContract = rowObj.contract || "";
    const rawShift = rowObj.shift || "";
    const rawPlannedStart = rowObj.plannedStart || "";
    const rawPlannedEnd = rowObj.plannedEnd || "";
    const rawActualTimeIn = rowObj.actualTimeIn || "";
    const rawActualTimeOut = rowObj.actualTimeOut || "";
    const rawWorkedHours = rowObj.workedHours || "";
    const rawOtHours = rowObj.otHours || "";
    const rawAttendanceStatus = rowObj.attendanceStatus || "";
    const rawLeaveType = rowObj.leaveType || "";
    const rawReplacementEmployeeCode = rowObj.replacementEmployeeCode || "";
    const rawAssignmentType = rowObj.assignmentType || "";
    const rawRemarks = rowObj.remarks || "";

    const rowFingerprint = computeRowFingerprint(
      rawEmployeeCode,
      rawAttendanceDate,
      rawSite,
      rawShift || `${rawActualTimeIn}-${rawActualTimeOut}`
    );

    parsedRows.push({
      sourceRowNumber,
      rawPayload: rowObj,
      rowFingerprint,
      rawAttendanceDate,
      rawEmployeeCode,
      rawEmployeeName,
      rawCompany,
      rawSite,
      rawContract,
      rawShift,
      rawPlannedStart,
      rawPlannedEnd,
      rawActualTimeIn,
      rawActualTimeOut,
      rawWorkedHours,
      rawOtHours,
      rawAttendanceStatus,
      rawLeaveType,
      rawReplacementEmployeeCode,
      rawAssignmentType,
      rawRemarks
    });
  }

  return {
    success: true,
    rows: parsedRows,
    headers: rawHeaders,
    fileHash,
    recordCount: parsedRows.length,
    errors,
    warnings
  };
}
