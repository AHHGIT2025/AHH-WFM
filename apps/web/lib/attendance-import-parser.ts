import crypto from "crypto";
import * as XLSX from "xlsx";

export type ImportProfile = "NORMALIZED_ROW_UPLOAD" | "MONTHLY_MUSTER_MATRIX";

export interface ParsedImportRow {
  sourceRowNumber: number;
  rawPayload: Record<string, any>;
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

export interface MatrixMetadata {
  importProfile: ImportProfile;
  clientName?: string;
  siteName?: string;
  contractNumber?: string;
  assignment?: string;
  periodYear?: number;
  periodMonth?: number;
  daysInMonth?: number;
  totalEmployeesInMatrix?: number;
  totalExpandedRows?: number;
}

export interface ParseResult {
  success: boolean;
  rows: ParsedImportRow[];
  headers: string[];
  fileHash: string;
  recordCount: number;
  errors: string[];
  warnings: string[];
  matrixMetadata?: MatrixMetadata;
}

export const MAX_IMPORT_ROWS = 5000;
export const MAX_SOURCE_EMPLOYEE_ROWS = 500;
export const MAX_EXPANDED_RECORDS = 16000;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function isAttendanceImportEnabled(): boolean {
  return process.env.ATTENDANCE_IMPORT_ENABLED !== "false";
}

/**
 * Defends against CSV / Spreadsheet Formula Injection (CWE-1236)
 * Prepend single quote or strip dangerous formula execution triggers.
 */
export function sanitizeSpreadsheetFormula(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
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
 * Generates standard XLSX template workbook for Monthly Muster Matrix
 */
export function getStandardMonthlyMatrixTemplateXlsx(): Buffer {
  const wb = XLSX.utils.book_new();

  // 1. Monthly_Matrix_Input Sheet
  const matrixData: any[][] = [
    ["AHH WFM — Monthly Roster / Attendance Matrix Upload Template", "", "", "", "", ""],
    ["Client:", "Al Hattab Real Estate", "Location / Site:", "Lusail Commercial Tower", "Contract:", "CNT-LUS-2026-01"],
    ["Month:", "8", "Year:", "2026", "Operational Scope:", "SECURITY_GUARDING"],
    [""],
    [
      "S/N",
      "Employee Code",
      "Employee Name",
      "Designation",
      "Shift Hours",
      "Row Type",
      ...Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"))
    ],
    // Sample Employee 1 (Day Shift + OT)
    [
      1,
      "EMP001",
      "Ahmed Al-Kuwari",
      "Security Officer",
      12,
      "DUTY",
      "12", "12", "12", "12", "OFF", "12", "12", "12", "12", "OFF",
      "12", "12", "12", "12", "OFF", "12", "12", "12", "12", "OFF",
      "12", "12", "12", "12", "OFF", "12", "12", "12", "12", "12", "OFF"
    ],
    [
      "",
      "EMP001",
      "Ahmed Al-Kuwari",
      "Security Officer",
      12,
      "OT",
      "0", "2", "0", "0", "0", "0", "0", "2", "0", "0",
      "0", "0", "0", "0", "0", "2", "0", "0", "0", "0",
      "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"
    ],
    // Sample Employee 2 (Night Shift + Leave)
    [
      2,
      "EMP002",
      "Mohammed Hassan",
      "Security Guard",
      12,
      "DUTY",
      "12", "12", "OFF", "12", "12", "12", "12", "SL", "SL", "OFF",
      "12", "12", "12", "12", "OFF", "12", "12", "12", "12", "OFF",
      "12", "12", "12", "12", "OFF", "12", "12", "12", "12", "12", "OFF"
    ],
    [
      "",
      "EMP002",
      "Mohammed Hassan",
      "Security Guard",
      12,
      "OT",
      "0", "0", "0", "0", "0", "0", "0", "0", "0", "0",
      "0", "0", "0", "0", "0", "0", "0", "0", "0", "0",
      "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"
    ],
    // Sample Employee 3 (OJT / Mobilized)
    [
      3,
      "EMP003",
      "Tariq Mansoor",
      "CCTV Operator",
      8,
      "DUTY",
      "OJT", "OJT", "OFF", "8", "8", "8", "8", "8", "8", "OFF",
      "8", "8", "8", "8", "OFF", "8", "8", "8", "8", "OFF",
      "8", "8", "8", "8", "OFF", "8", "8", "8", "8", "8", "OFF"
    ]
  ];

  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixData);
  XLSX.utils.book_append_sheet(wb, wsMatrix, "Monthly_Matrix_Input");

  // 2. Codes Sheet
  const codesData: any[][] = [
    ["Attendance Code", "Description", "Mobilization Mapping (Client Muster)", "Worked Hours Equivalent", "Category"],
    ["[Numeric]", "Normal Duty Hours (e.g. 8, 10, 12)", "P (Present / Mobilized)", "As stated", "Working Duty"],
    ["P", "Present / Mobilized", "P (Present / Mobilized)", "Standard Shift Hours", "Working Duty"],
    ["A", "Absent / Not Mobilized", "A (Absent / Not Mobilized)", "0", "Absence"],
    ["NA", "Not Applicable / Not Required", "NA (Not Applicable)", "0", "Neutral"],
    ["OFF", "Scheduled Weekly Off", "NA", "0", "Rest"],
    ["AB", "Unapproved Absence", "A", "0", "Absence"],
    ["SL", "Sick Leave (Approved)", "A", "0", "Leave"],
    ["AL", "Annual Leave (Approved)", "A", "0", "Leave"],
    ["HL", "Public / Official Holiday", "P or NA (as per contract)", "0 or Shift", "Holiday"],
    ["OJT", "On the Job Training", "P", "Standard Shift Hours", "Training"],
    ["IDLE", "Standby / Idle Deployment", "P", "Standard Shift Hours", "Standby"]
  ];
  const wsCodes = XLSX.utils.aoa_to_sheet(codesData);
  XLSX.utils.book_append_sheet(wb, wsCodes, "Codes");

  // 3. Instructions Sheet
  const instructionsData: any[][] = [
    ["AHH WFM — Monthly Matrix Upload Instructions"],
    ["1. Use the 'Monthly_Matrix_Input' sheet to fill monthly attendance for employees."],
    ["2. Enter the Client Name, Site/Location, Month, and Year in the header block."],
    ["3. For each employee, enter Employee Code, Name, Designation, and daily attendance codes."],
    ["4. To report overtime (OT), add an 'OT' row immediately below the employee's 'DUTY' row with numeric OT hours."],
    ["5. Upload the completed Excel file via Web Console (Attendance Intake & Reconciliation)."],
    ["6. Staging and validation are strictly non-authoritative until certified."]
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Normalizes header keys to standard internal field names
 */
function normalizeHeaderKey(rawHeader: string): string {
  const h = rawHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (h === "attendancedate" || h === "date" || h === "dutydate") return "attendanceDate";
  if (h === "employeecode" || h === "employeeid" || h === "empcode" || h === "empid" || h === "badgenumber" || h === "badge" || h === "pfno" || h === "pfnumber") return "employeeCode";
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
 * Standard Operational Attendance Codes Dictionary & Normalized Statuses
 */
export interface AttendanceCodeDetail {
  code: string;
  normalizedStatus: string;
  clientMusterCode: "P" | "A" | "NA";
  isWorking: boolean;
  defaultWorkedHours?: number;
  leaveType?: string;
}

export function classifyAttendanceCode(rawCode: string, defaultShiftHours: number = 12): AttendanceCodeDetail {
  const code = (rawCode || "").trim().toUpperCase();

  // Numeric duty hours: "8", "10", "12", "12.0", etc.
  const num = parseFloat(code);
  if (!isNaN(num) && num > 0 && /^\d+(\.\d+)?$/.test(code)) {
    return {
      code,
      normalizedStatus: "PRESENT",
      clientMusterCode: "P",
      isWorking: true,
      defaultWorkedHours: num
    };
  }

  switch (code) {
    case "P":
    case "PRESENT":
      return { code: "P", normalizedStatus: "PRESENT_MOBILIZED", clientMusterCode: "P", isWorking: true, defaultWorkedHours: defaultShiftHours };
    case "A":
    case "ABSENT":
      return { code: "A", normalizedStatus: "ABSENT_NOT_MOBILIZED", clientMusterCode: "A", isWorking: false, defaultWorkedHours: 0 };
    case "NA":
    case "NOT_APPLICABLE":
      return { code: "NA", normalizedStatus: "NOT_APPLICABLE", clientMusterCode: "NA", isWorking: false, defaultWorkedHours: 0 };
    case "OFF":
    case "WO":
    case "WEEKLY_OFF":
      return { code: "OFF", normalizedStatus: "WEEKLY_OFF", clientMusterCode: "NA", isWorking: false, defaultWorkedHours: 0 };
    case "AB":
      return { code: "AB", normalizedStatus: "ABSENT", clientMusterCode: "A", isWorking: false, defaultWorkedHours: 0 };
    case "SL":
    case "SICK":
      return { code: "SL", normalizedStatus: "SICK_LEAVE", clientMusterCode: "A", isWorking: false, defaultWorkedHours: 0, leaveType: "SICK_LEAVE" };
    case "AL":
    case "ANNUAL":
      return { code: "AL", normalizedStatus: "ANNUAL_LEAVE", clientMusterCode: "A", isWorking: false, defaultWorkedHours: 0, leaveType: "ANNUAL_LEAVE" };
    case "HL":
    case "HOLIDAY":
      return { code: "HL", normalizedStatus: "PUBLIC_HOLIDAY", clientMusterCode: "NA", isWorking: false, defaultWorkedHours: 0, leaveType: "PUBLIC_HOLIDAY" };
    case "OJT":
      return { code: "OJT", normalizedStatus: "OJT", clientMusterCode: "P", isWorking: true, defaultWorkedHours: defaultShiftHours };
    case "IDLE":
    case "STANDBY":
      return { code: "IDLE", normalizedStatus: "IDLE", clientMusterCode: "P", isWorking: true, defaultWorkedHours: defaultShiftHours };
    default:
      return { code, normalizedStatus: "UNKNOWN", clientMusterCode: "NA", isWorking: false, defaultWorkedHours: 0 };
  }
}

/**
 * Parses a monthly employee x day matrix sheet and expands it into standard AT-1 staging rows
 */
export function parseMonthlyMusterMatrix(
  matrixRows: any[][],
  fileName: string,
  options?: {
    fileHash?: string;
    year?: number;
    month?: number;
    companyId?: string;
    clientName?: string;
    siteName?: string;
    contractNumber?: string;
  }
): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fileHash = options?.fileHash || computeFileHash(JSON.stringify(matrixRows));

  if (!matrixRows || matrixRows.length < 3) {
    return {
      success: false,
      rows: [],
      headers: [],
      fileHash,
      recordCount: 0,
      errors: ["Monthly Matrix workbook is empty or missing required header structure."],
      warnings: []
    };
  }

  // 1. Extract Header Metadata (Client, Site, Contract, Month, Year)
  let extractedClient = options?.clientName || "";
  let extractedSite = options?.siteName || "";
  let extractedContract = options?.contractNumber || "";
  let extractedMonth = options?.month || 0;
  let extractedYear = options?.year || 0;

  // Scan top 6 rows for header key-values
  for (let r = 0; r < Math.min(6, matrixRows.length); r++) {
    const row = matrixRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || "").trim().toLowerCase();
      if (cellVal.includes("client:") && c + 1 < row.length && !extractedClient) extractedClient = String(row[c + 1] || "").trim();
      if ((cellVal.includes("location") || cellVal.includes("site:")) && c + 1 < row.length && !extractedSite) extractedSite = String(row[c + 1] || "").trim();
      if (cellVal.includes("contract:") && c + 1 < row.length && !extractedContract) extractedContract = String(row[c + 1] || "").trim();
      if (cellVal.includes("month:") && c + 1 < row.length && !extractedMonth) {
        const m = parseInt(String(row[c + 1] || "").trim(), 10);
        if (!isNaN(m) && m >= 1 && m <= 12) extractedMonth = m;
      }
      if (cellVal.includes("year:") && c + 1 < row.length && !extractedYear) {
        const y = parseInt(String(row[c + 1] || "").trim(), 10);
        if (!isNaN(y) && y >= 2020 && y <= 2050) extractedYear = y;
      }
    }
  }

  // Fallback date inference from filename or current year/month if not specified
  if (!extractedYear || !extractedMonth) {
    const match = fileName.match(/(\d{4})[-_](\d{1,2})/);
    if (match) {
      if (!extractedYear) extractedYear = parseInt(match[1], 10);
      if (!extractedMonth) extractedMonth = parseInt(match[2], 10);
    }
  }

  if (!extractedYear) extractedYear = 2026;
  if (!extractedMonth) extractedMonth = 8;

  if (extractedMonth < 1 || extractedMonth > 12) {
    return {
      success: false,
      rows: [],
      headers: [],
      fileHash,
      recordCount: 0,
      errors: ["Could not determine Month and Year for Monthly Matrix. Please specify valid Month (1-12) and Year (e.g. 2026)."],
      warnings: []
    };
  }

  // Calculate actual calendar days in month (handling leap years)
  const daysInMonth = new Date(extractedYear, extractedMonth, 0).getDate();

  // 2. Find Matrix Table Header Row (containing day numbers 1, 2, 3... or 01, 02...)
  let tableHeaderRowIndex = -1;
  let empCodeColIndex = -1;
  let empNameColIndex = -1;
  let designationColIndex = -1;
  let shiftHoursColIndex = -1;
  let rowTypeColIndex = -1;
  const dayColIndices: { day: number; colIndex: number }[] = [];

  for (let r = 0; r < Math.min(10, matrixRows.length); r++) {
    const row = matrixRows[r] || [];
    const foundDays: { day: number; colIndex: number }[] = [];

    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || "").trim();
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 1 && num <= 31 && (val === String(num) || val === String(num).padStart(2, "0"))) {
        foundDays.push({ day: num, colIndex: c });
      }
    }

    if (foundDays.length >= 20) {
      tableHeaderRowIndex = r;
      // Map columns with strict disambiguation between Employee Code and Employee Name
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || "").trim().toLowerCase();
        if (val.includes("name")) {
          empNameColIndex = c;
        } else if (val.includes("code") || val.includes("badge") || val.includes("pf") || val.includes("emp")) {
          empCodeColIndex = c;
        } else if (val.includes("desig") || val.includes("role") || val.includes("title")) {
          designationColIndex = c;
        } else if (val.includes("shift") || val.includes("hour")) {
          shiftHoursColIndex = c;
        } else if (val.includes("type") || val.includes("row")) {
          rowTypeColIndex = c;
        }
      }
      dayColIndices.push(...foundDays);
      break;
    }
  }

  if (tableHeaderRowIndex === -1 || dayColIndices.length === 0) {
    return {
      success: false,
      rows: [],
      headers: [],
      fileHash,
      recordCount: 0,
      errors: ["Invalid Monthly Matrix format: Could not locate calendar day columns (1..31)."],
      warnings: []
    };
  }

  if (empCodeColIndex === -1) {
    empCodeColIndex = 1; // Default fallback to col B
  }
  if (empNameColIndex === -1) {
    empNameColIndex = 2; // Default fallback to col C
  }

  // Verify calendar day count matches month (reject impossible days e.g. 31st for 30-day month)
  const validDayCols = dayColIndices.filter((d) => d.day <= daysInMonth);
  const invalidDayCols = dayColIndices.filter((d) => d.day > daysInMonth);
  if (invalidDayCols.length > 0) {
    warnings.push(
      `Matrix contains columns for days (${invalidDayCols.map((d) => d.day).join(", ")}) which do not exist in ${extractedYear}-${String(extractedMonth).padStart(2, "0")} (${daysInMonth} days). These will be ignored.`
    );
  }

  // 3. Process Employee Rows & Paired OT Rows
  const parsedRows: ParsedImportRow[] = [];
  let currentEmpCode = "";
  let currentEmpName = "";
  let currentDesignation = "";
  let currentShiftHours = 12;

  const distinctEmpCodes = new Set<string>();

  for (let r = tableHeaderRowIndex + 1; r < matrixRows.length; r++) {
    const row = matrixRows[r] || [];
    if (row.length === 0 || row.every((c: any) => c === null || c === undefined || String(c).trim() === "")) {
      continue; // Skip empty row
    }

    const rowEmpCode = sanitizeSpreadsheetFormula(row[empCodeColIndex]);
    const rowEmpName = sanitizeSpreadsheetFormula(row[empNameColIndex]);
    const rowDesignation = designationColIndex >= 0 ? sanitizeSpreadsheetFormula(row[designationColIndex]) : "";
    const rowShiftHoursVal = shiftHoursColIndex >= 0 ? parseFloat(String(row[shiftHoursColIndex])) : 12;
    const rowType = rowTypeColIndex >= 0 ? String(row[rowTypeColIndex] || "").trim().toUpperCase() : "DUTY";

    const isOtRow = rowType === "OT" || (!rowEmpCode && currentEmpCode && rowTypeColIndex < 0);

    if (rowEmpCode) {
      currentEmpCode = rowEmpCode;
      currentEmpName = rowEmpName;
      currentDesignation = rowDesignation;
      if (!isNaN(rowShiftHoursVal) && rowShiftHoursVal > 0) currentShiftHours = rowShiftHoursVal;
      distinctEmpCodes.add(currentEmpCode.toUpperCase());
    }

    if (!currentEmpCode) {
      continue; // Skip noise row before any employee
    }

    if (distinctEmpCodes.size > MAX_SOURCE_EMPLOYEE_ROWS) {
      return {
        success: false,
        rows: [],
        headers: [],
        fileHash,
        recordCount: 0,
        errors: [`Matrix exceeds maximum source employee limit of ${MAX_SOURCE_EMPLOYEE_ROWS} employees per batch. Found ${distinctEmpCodes.size} employees.`],
        warnings
      };
    }

    if (isOtRow) {
      // Merge OT into existing employee-day rows
      for (const d of validDayCols) {
        const dutyDateStr = `${extractedYear}-${String(extractedMonth).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
        const rawOtVal = sanitizeSpreadsheetFormula(row[d.colIndex]);
        const parsedOtNum = parseFloat(rawOtVal);

        if (!isNaN(parsedOtNum) && parsedOtNum > 0) {
          const targetRow = parsedRows.find(
            (pr) => pr.rawEmployeeCode.toLowerCase() === currentEmpCode.toLowerCase() && pr.rawAttendanceDate === dutyDateStr
          );
          if (targetRow) {
            targetRow.rawOtHours = String(parsedOtNum);
            targetRow.rawPayload.otHours = parsedOtNum;
            targetRow.rawPayload.rawOtStatus = rawOtVal;
          }
        }
      }
    } else {
      // Normal Duty / Status Row: Expand across each valid day of month
      for (const d of validDayCols) {
        const dutyDateStr = `${extractedYear}-${String(extractedMonth).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
        const rawCellVal = sanitizeSpreadsheetFormula(row[d.colIndex]);

        const codeDetail = classifyAttendanceCode(rawCellVal, currentShiftHours);
        const workedHoursStr = codeDetail.isWorking ? String(codeDetail.defaultWorkedHours || currentShiftHours) : "0";

        const rowPayload = {
          importProfile: "MONTHLY_MUSTER_MATRIX" as ImportProfile,
          sourceSheet: "Monthly_Matrix_Input",
          sourceRowNumber: r + 1,
          sourceDayColumn: d.colIndex + 1,
          day: d.day,
          dutyDate: dutyDateStr,
          employeeCode: currentEmpCode,
          employeeName: currentEmpName,
          designation: currentDesignation,
          shiftHours: currentShiftHours,
          rawStatus: rawCellVal,
          normalizedStatus: codeDetail.normalizedStatus,
          clientMusterCode: codeDetail.clientMusterCode,
          isWorking: codeDetail.isWorking,
          clientName: extractedClient,
          siteName: extractedSite,
          contractNumber: extractedContract
        };

        const rowFingerprint = computeRowFingerprint(
          currentEmpCode,
          dutyDateStr,
          extractedSite,
          codeDetail.normalizedStatus || "DUTY"
        );

        parsedRows.push({
          sourceRowNumber: r + 1,
          rawPayload: rowPayload,
          rowFingerprint,
          rawAttendanceDate: dutyDateStr,
          rawEmployeeCode: currentEmpCode,
          rawEmployeeName: currentEmpName,
          rawCompany: options?.companyId || "",
          rawSite: extractedSite,
          rawContract: extractedContract,
          rawShift: `SHIFT-${currentShiftHours}H`,
          rawPlannedStart: "",
          rawPlannedEnd: "",
          rawActualTimeIn: codeDetail.isWorking ? `${dutyDateStr} 07:00` : "",
          rawActualTimeOut: codeDetail.isWorking ? `${dutyDateStr} 19:00` : "",
          rawWorkedHours: workedHoursStr,
          rawOtHours: "0",
          rawAttendanceStatus: codeDetail.normalizedStatus,
          rawLeaveType: codeDetail.leaveType || "",
          rawReplacementEmployeeCode: "",
          rawAssignmentType: "PRIMARY",
          rawRemarks: rawCellVal ? `Matrix code: ${rawCellVal}` : ""
        });
      }
    }
  }

  if (parsedRows.length > MAX_EXPANDED_RECORDS) {
    return {
      success: false,
      rows: [],
      headers: [],
      fileHash,
      recordCount: parsedRows.length,
      errors: [`Matrix expanded into ${parsedRows.length} records, exceeding the maximum allowable staging limit of ${MAX_EXPANDED_RECORDS} records.`],
      warnings
    };
  }

  const matrixMetadata: MatrixMetadata = {
    importProfile: "MONTHLY_MUSTER_MATRIX",
    clientName: extractedClient,
    siteName: extractedSite,
    contractNumber: extractedContract,
    periodYear: extractedYear,
    periodMonth: extractedMonth,
    daysInMonth,
    totalEmployeesInMatrix: distinctEmpCodes.size,
    totalExpandedRows: parsedRows.length
  };

  return {
    success: true,
    rows: parsedRows,
    headers: ["Attendance Date", "Employee Code", "Employee Name", "Site", "Shift", "Status", "Worked Hours", "OT Hours"],
    fileHash,
    recordCount: parsedRows.length,
    errors,
    warnings,
    matrixMetadata
  };
}

/**
 * Universal attendance import parser supporting both CSV and XLSX, normalized row and monthly matrix profiles
 */
export function parseAttendanceImportContent(
  rawContent: string | Buffer,
  fileName: string,
  options?: {
    maxRows?: number;
    importProfile?: ImportProfile;
    year?: number;
    month?: number;
    companyId?: string;
  }
): ParseResult {
  const fileHash = computeFileHash(rawContent);
  const isXlsx = fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls") || Buffer.isBuffer(rawContent);

  // 1. XLSX Parsing via SheetJS
  if (isXlsx && Buffer.isBuffer(rawContent)) {
    try {
      const workbook = XLSX.read(rawContent, { type: "buffer" });
      const sheetNames = workbook.SheetNames;
      if (!sheetNames || sheetNames.length === 0) {
        return {
          success: false,
          rows: [],
          headers: [],
          fileHash,
          recordCount: 0,
          errors: ["Workbook contains no worksheets."],
          warnings: []
        };
      }

      // Check for Monthly Matrix sheet
      const matrixSheetName = sheetNames.find(
        (n) =>
          n.toLowerCase().includes("monthly_matrix") ||
          n.toLowerCase().includes("matrix") ||
          n.toLowerCase().includes("muster")
      );

      const targetProfile = options?.importProfile || (matrixSheetName ? "MONTHLY_MUSTER_MATRIX" : "NORMALIZED_ROW_UPLOAD");

      if (targetProfile === "MONTHLY_MUSTER_MATRIX") {
        const sheet = workbook.Sheets[matrixSheetName || sheetNames[0]];
        const sheetData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
        return parseMonthlyMusterMatrix(sheetData, fileName, {
          fileHash,
          year: options?.year,
          month: options?.month,
          companyId: options?.companyId
        });
      }

      // Default to normalized row sheet in XLSX
      const sheet = workbook.Sheets[sheetNames[0]];
      const sheetCsv = XLSX.utils.sheet_to_csv(sheet);
      return parseNormalizedRowCsv(sheetCsv, fileName, options?.maxRows || MAX_IMPORT_ROWS, fileHash);
    } catch (e: any) {
      return {
        success: false,
        rows: [],
        headers: [],
        fileHash,
        recordCount: 0,
        errors: [`Failed to parse Excel workbook: ${e.message || "Invalid or corrupt XLSX file."}`],
        warnings: []
      };
    }
  }

  // 2. CSV Parsing
  const contentStr = typeof rawContent === "string" ? rawContent : Buffer.isBuffer(rawContent) ? (rawContent as Buffer).toString("utf-8") : String(rawContent);
  if (options?.importProfile === "MONTHLY_MUSTER_MATRIX") {
    const rawRows = parseCsvString(contentStr);
    return parseMonthlyMusterMatrix(rawRows, fileName, {
      fileHash,
      year: options?.year,
      month: options?.month,
      companyId: options?.companyId
    });
  }

  return parseNormalizedRowCsv(contentStr, fileName, options?.maxRows || MAX_IMPORT_ROWS, fileHash);
}

/**
 * Normalized Row CSV parser (existing certified AT-1 engine)
 */
function parseNormalizedRowCsv(
  contentStr: string,
  fileName: string,
  maxRows: number,
  fileHash: string
): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

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
    const sourceRowNumber = r + 1;

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
    warnings,
    matrixMetadata: {
      importProfile: "NORMALIZED_ROW_UPLOAD",
      totalExpandedRows: parsedRows.length
    }
  };
}

