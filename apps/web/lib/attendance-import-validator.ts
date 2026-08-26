import { prisma } from "@ahh-wfm/database";
import { getQatarDate, getQatarDateString } from "@/lib/roster-engine";

export interface ValidationMessage {
  code: string;
  severity: "INFO" | "WARNING" | "ERROR";
  field?: string;
  message: string;
  details?: Record<string, any>;
}

export interface RowValidationResult {
  rowId: string;
  sourceRowNumber: number;
  validationStatus: "VALID" | "WARNING" | "ERROR" | "DUPLICATE" | "UNMATCHED";
  validationMessages: ValidationMessage[];
  isDuplicate: boolean;
  duplicateReason?: string | null;
  existingAttendanceSource?: string | null;
  // Normalized & Resolved References
  attendanceDate?: Date | null;
  actualTimeIn?: Date | null;
  actualTimeOut?: Date | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  workedHours?: number | null;
  otHours?: number | null;
  normalizedStatus?: string | null;
  employeeId?: string | null;
  companyId?: string | null;
  siteId?: string | null;
  contractId?: string | null;
  rosterRequirementSlotId?: string | null;
  rosterSlotAssignmentId?: string | null;
  existingAttendanceId?: string | null;
}

export interface BatchValidationSummary {
  batchId: string;
  recordCount: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  duplicateCount: number;
  unmatchedCount: number;
  validationStartedAt: Date;
  validationCompletedAt: Date;
  status: "VALIDATED" | "ERROR";
  rowResults: RowValidationResult[];
}

/**
 * Helper to parse time strings with overnight shift support
 */
function parseTimeStamps(
  dutyDateStr: string,
  rawIn: string,
  rawOut: string,
  rawPlannedStart: string,
  rawPlannedEnd: string
): {
  dutyDate: Date | null;
  timeIn: Date | null;
  timeOut: Date | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  workedHours: number | null;
  timeErrors: ValidationMessage[];
} {
  const timeErrors: ValidationMessage[] = [];
  if (!dutyDateStr || dutyDateStr.trim() === "") {
    timeErrors.push({
      code: "MISSING_DUTY_DATE",
      severity: "ERROR",
      field: "rawAttendanceDate",
      message: "Attendance duty date is required."
    });
    return {
      dutyDate: null,
      timeIn: null,
      timeOut: null,
      plannedStart: null,
      plannedEnd: null,
      workedHours: null,
      timeErrors
    };
  }

  let dutyDate: Date | null = null;
  try {
    dutyDate = getQatarDate(dutyDateStr.trim());
    if (isNaN(dutyDate.getTime())) {
      timeErrors.push({
        code: "INVALID_DUTY_DATE",
        severity: "ERROR",
        field: "rawAttendanceDate",
        message: `Invalid duty date format: ${dutyDateStr}`
      });
      dutyDate = null;
    }
  } catch (e) {
    timeErrors.push({
      code: "INVALID_DUTY_DATE",
      severity: "ERROR",
      field: "rawAttendanceDate",
      message: `Failed to parse duty date: ${dutyDateStr}`
    });
  }

  if (!dutyDate) {
    return {
      dutyDate: null,
      timeIn: null,
      timeOut: null,
      plannedStart: null,
      plannedEnd: null,
      workedHours: null,
      timeErrors
    };
  }

  const baseDateStr = getQatarDateString(dutyDate);
  let timeIn: Date | null = null;
  let timeOut: Date | null = null;

  // Helper to parse individual timestamp
  const parseSingleTime = (raw: string, isEnd = false): Date | null => {
    if (!raw || raw.trim() === "") return null;
    const trimmed = raw.trim();

    // Full ISO / DateTime format (e.g. 2026-08-25 07:00:00 or 2026-08-25T07:00:00)
    if (trimmed.includes("-") || trimmed.includes("/")) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // HH:mm or HH:mm:ss format
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const d = new Date(`${baseDateStr}T00:00:00Z`);
        d.setUTCHours(hours, minutes, seconds, 0);
        return d;
      }
    }
    return null;
  };

  if (rawIn && rawIn.trim()) {
    timeIn = parseSingleTime(rawIn, false);
    if (!timeIn) {
      timeErrors.push({
        code: "INVALID_TIME_IN",
        severity: "ERROR",
        field: "rawActualTimeIn",
        message: `Invalid format for actual clock in: ${rawIn}`
      });
    }
  }

  if (rawOut && rawOut.trim()) {
    timeOut = parseSingleTime(rawOut, true);
    if (!timeOut) {
      timeErrors.push({
        code: "INVALID_TIME_OUT",
        severity: "ERROR",
        field: "rawActualTimeOut",
        message: `Invalid format for actual clock out: ${rawOut}`
      });
    }
  }

  // Handle overnight shift if times were provided as HH:mm and timeOut is earlier than timeIn
  if (timeIn && timeOut && timeOut.getTime() < timeIn.getTime()) {
    // If user provided times as simple HH:mm on the same base date, roll timeOut forward by 24h for overnight shift
    const diffHours = (timeIn.getTime() - timeOut.getTime()) / (1000 * 60 * 60);
    if (diffHours > 0 && diffHours < 18) {
      // Valid overnight shift crossing midnight
      timeOut = new Date(timeOut.getTime() + 24 * 60 * 60 * 1000);
    } else {
      timeErrors.push({
        code: "INVALID_TIME_RANGE",
        severity: "ERROR",
        field: "rawActualTimeOut",
        message: "Actual clock out time is prior to clock in time."
      });
    }
  }

  let workedHours: number | null = null;
  if (timeIn && timeOut) {
    const diffMs = timeOut.getTime() - timeIn.getTime();
    if (diffMs > 0) {
      workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      if (workedHours > 16) {
        timeErrors.push({
          code: "EXCESSIVE_DURATION",
          severity: "WARNING",
          field: "rawWorkedHours",
          message: `Recorded working duration of ${workedHours} hours exceeds standard 16-hour operational limit.`
        });
      }
    }
  } else if (timeIn && !timeOut) {
    timeErrors.push({
      code: "MISSING_CLOCK_OUT",
      severity: "WARNING",
      field: "rawActualTimeOut",
      message: "Actual clock out time is missing."
    });
  } else if (!timeIn && timeOut) {
    timeErrors.push({
      code: "MISSING_CLOCK_IN",
      severity: "ERROR",
      field: "rawActualTimeIn",
      message: "Actual clock in time is missing while clock out is present."
    });
  }

  return {
    dutyDate,
    timeIn,
    timeOut,
    plannedStart: rawPlannedStart?.trim() || null,
    plannedEnd: rawPlannedEnd?.trim() || null,
    workedHours,
    timeErrors
  };
}

/**
 * Validates a single import batch completely without mutating authoritative data
 */
export async function validateAttendanceImportBatch(
  batchId: string,
  executedByUserId?: string
): Promise<BatchValidationSummary> {
  const validationStartedAt = new Date();

  // Load batch with all rows
  const batch = await prisma.attendanceImportBatch.findUnique({
    where: { id: batchId },
    include: {
      rows: {
        orderBy: { sourceRowNumber: "asc" }
      }
    }
  });

  if (!batch) {
    throw new Error(`Attendance Import Batch ${batchId} not found`);
  }

  // Set batch status to VALIDATING to prevent concurrent executions
  await prisma.attendanceImportBatch.update({
    where: { id: batchId },
    data: {
      status: "VALIDATING",
      validationStartedAt
    }
  });

  const batchCompanyId = batch.companyId;
  const batchScope = batch.operationType; // "SECURITY_GUARDING" | "FACILITY_MANAGEMENT" | "WHITE_COLLAR" | "ALL"

  // Pre-load reference entities for fast lookups
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      name: true,
      companyId: true,
      isActive: true,
      employmentStatus: true,
      employeeCategory: true,
      qidNumber: true,
      email: true
    }
  });

  const companies = await prisma.company.findMany({
    select: { id: true, companyCode: true, companyName: true, isActive: true }
  });

  const sites = await prisma.manpowerSite.findMany({
    select: { id: true, code: true, name: true, operationType: true, isActive: true, projectId: true }
  });

  const contracts = await prisma.manpowerContract.findMany({
    select: { id: true, contractNumber: true, status: true, operationType: true, startDate: true, endDate: true }
  });

  // Track intra-batch duplicates
  const seenBatchKeys = new Map<string, number>(); // key -> first sourceRowNumber

  const rowResults: RowValidationResult[] = [];

  for (const row of batch.rows) {
    const messages: ValidationMessage[] = [];
    let validationStatus: "VALID" | "WARNING" | "ERROR" | "DUPLICATE" | "UNMATCHED" = "VALID";
    let isDuplicate = false;
    let duplicateReason: string | null = null;
    let existingAttendanceSource: string | null = null;

    // 1. Time & Date Parsing
    const timeParsed = parseTimeStamps(
      row.rawAttendanceDate || "",
      row.rawActualTimeIn || "",
      row.rawActualTimeOut || "",
      row.rawPlannedStart || "",
      row.rawPlannedEnd || ""
    );
    messages.push(...timeParsed.timeErrors);

    const attendanceDate = timeParsed.dutyDate;
    const actualTimeIn = timeParsed.timeIn;
    const actualTimeOut = timeParsed.timeOut;
    let workedHours = timeParsed.workedHours;
    if (!workedHours && row.rawWorkedHours) {
      const parsedWh = parseFloat(row.rawWorkedHours);
      if (!isNaN(parsedWh)) workedHours = parsedWh;
    }
    let otHours: number | null = null;
    if (row.rawOtHours) {
      const parsedOt = parseFloat(row.rawOtHours);
      if (!isNaN(parsedOt)) otHours = parsedOt;
    }

    // 2. Employee Lookup & Resolution
    let resolvedEmployeeId: string | null = null;
    const rawEmpCode = (row.rawEmployeeCode || "").trim().toLowerCase();

    if (!rawEmpCode) {
      messages.push({
        code: "EMPLOYEE_CODE_MISSING",
        severity: "ERROR",
        field: "rawEmployeeCode",
        message: "Employee Code is required."
      });
    } else {
      const matchedEmp = employees.find(
        (e) =>
          e.id.toLowerCase() === rawEmpCode ||
          (e.qidNumber && e.qidNumber.toLowerCase() === rawEmpCode) ||
          e.name.toLowerCase() === rawEmpCode ||
          e.email.toLowerCase() === rawEmpCode
      );

      if (!matchedEmp) {
        messages.push({
          code: "EMPLOYEE_NOT_FOUND",
          severity: "ERROR",
          field: "rawEmployeeCode",
          message: `Employee not found in Workforce Directory for code '${row.rawEmployeeCode}'.`
        });
      } else {
        resolvedEmployeeId = matchedEmp.id;

        // Check if employee is active
        const isActiveEmp = matchedEmp.isActive && matchedEmp.employmentStatus === "ACTIVE";
        if (!isActiveEmp) {
          messages.push({
            code: "EMPLOYEE_INACTIVE",
            severity: "ERROR",
            field: "rawEmployeeCode",
            message: `Employee '${matchedEmp.name}' is inactive or deactivated.`
          });
        }

        // Check Company Alignment
        if (batchCompanyId && matchedEmp.companyId && matchedEmp.companyId !== batchCompanyId) {
          messages.push({
            code: "EMPLOYEE_COMPANY_MISMATCH",
            severity: "ERROR",
            field: "rawCompany",
            message: `Employee belongs to a different company than the batch company.`
          });
        }

        // Check Scope / Division Isolation
        if (batchScope && batchScope !== "ALL") {
          const empCat = matchedEmp.employeeCategory;
          if (batchScope === "SECURITY_GUARDING" && empCat === "FACILITY_MANAGEMENT") {
            messages.push({
              code: "EMPLOYEE_SCOPE_MISMATCH",
              severity: "ERROR",
              field: "rawEmployeeCode",
              message: `Facility Management employee found in Security Guarding intake batch.`
            });
          } else if (batchScope === "FACILITY_MANAGEMENT" && empCat === "SECURITY_GUARDING") {
            messages.push({
              code: "EMPLOYEE_SCOPE_MISMATCH",
              severity: "ERROR",
              field: "rawEmployeeCode",
              message: `Security Guarding employee found in Facility Management intake batch.`
            });
          }
        }

        // Check Employee Name Discrepancy against Master
        if (row.rawEmployeeName) {
          const cleanRaw = row.rawEmployeeName.trim().toLowerCase();
          const cleanDb = matchedEmp.name.trim().toLowerCase();
          if (cleanRaw && cleanDb && !cleanDb.includes(cleanRaw) && !cleanRaw.includes(cleanDb)) {
            messages.push({
              code: "EMPLOYEE_NAME_MISMATCH",
              severity: "WARNING",
              field: "rawEmployeeName",
              message: `Uploaded name '${row.rawEmployeeName}' differs from employee master name '${matchedEmp.name}'. Master name will be preserved.`
            });
          }
        }
      }
    }

    // 2.1 Matrix Attendance Code & Status Validation
    const rawStatus = (row.rawAttendanceStatus || "").trim().toUpperCase();
    if (rawStatus === "UNKNOWN" || rawStatus.startsWith("UNKNOWN_")) {
      messages.push({
        code: "UNKNOWN_ATTENDANCE_CODE",
        severity: "WARNING",
        field: "rawAttendanceStatus",
        message: `Unknown or unmapped attendance status code '${row.rawRemarks || row.rawAttendanceStatus}'.`
      });
    }

    // 2.2 OT Without Base Attendance Validation
    if (otHours && otHours > 0) {
      const isNonWorking = rawStatus === "WEEKLY_OFF" || rawStatus === "OFF" || rawStatus === "ABSENT" || rawStatus === "AB" || rawStatus === "SICK_LEAVE" || rawStatus === "SL" || rawStatus === "ANNUAL_LEAVE" || rawStatus === "AL" || (workedHours === 0 && rawStatus !== "PRESENT" && rawStatus !== "PRESENT_MOBILIZED");
      if (isNonWorking) {
        messages.push({
          code: "OT_WITHOUT_BASE_ATTENDANCE",
          severity: "WARNING",
          field: "rawOtHours",
          message: `Overtime hours (${otHours}h) reported on a non-working or absent day (${rawStatus}).`
        });
      }
    }

    // 3. Company Lookup & Resolution
    let resolvedCompanyId: string | null = batchCompanyId || null;
    const rawComp = (row.rawCompany || "").trim().toLowerCase();
    if (rawComp) {
      const matchComp = companies.find(
        (c) => c.id.toLowerCase() === rawComp || c.companyCode.toLowerCase() === rawComp || c.companyName.toLowerCase() === rawComp
      );
      if (matchComp) {
        resolvedCompanyId = matchComp.id;
      } else if (!batchCompanyId) {
        messages.push({
          code: "COMPANY_NOT_FOUND",
          severity: "WARNING",
          field: "rawCompany",
          message: `Company '${row.rawCompany}' could not be resolved.`
        });
      }
    }

    // 4. Site Lookup & Resolution
    let resolvedSiteId: string | null = null;
    const rawSite = (row.rawSite || "").trim().toLowerCase();
    if (rawSite) {
      const matchSite = sites.find(
        (s) => s.id.toLowerCase() === rawSite || (s.code && s.code.toLowerCase() === rawSite) || s.name.toLowerCase() === rawSite
      );
      if (matchSite) {
        resolvedSiteId = matchSite.id;
        if (!matchSite.isActive) {
          messages.push({
            code: "SITE_INACTIVE",
            severity: "WARNING",
            field: "rawSite",
            message: `Site '${matchSite.name}' is marked inactive.`
          });
        }
        if (batchScope && batchScope !== "ALL" && matchSite.operationType !== batchScope) {
          messages.push({
            code: "SITE_SCOPE_MISMATCH",
            severity: "ERROR",
            field: "rawSite",
            message: `Site scope '${matchSite.operationType}' does not match batch scope '${batchScope}'.`
          });
        }
      } else {
        messages.push({
          code: "SITE_NOT_FOUND",
          severity: "WARNING",
          field: "rawSite",
          message: `Site '${row.rawSite}' could not be resolved against master sites.`
        });
      }
    }

    // 5. Contract Lookup & Resolution
    let resolvedContractId: string | null = null;
    const rawContract = (row.rawContract || "").trim().toLowerCase();
    if (rawContract) {
      const matchContract = contracts.find(
        (c) => c.id.toLowerCase() === rawContract || c.contractNumber.toLowerCase() === rawContract
      );
      if (matchContract) {
        resolvedContractId = matchContract.id;
        if (matchContract.status !== "ACTIVE") {
          messages.push({
            code: "CONTRACT_NOT_ACTIVE",
            severity: "WARNING",
            field: "rawContract",
            message: `Contract '${matchContract.contractNumber}' is currently ${matchContract.status}.`
          });
        }
        if (attendanceDate) {
          if (attendanceDate < matchContract.startDate || attendanceDate > matchContract.endDate) {
            messages.push({
              code: "CONTRACT_DATE_OUT_OF_RANGE",
              severity: "WARNING",
              field: "rawContract",
              message: `Attendance date is outside the contract active validity range.`
            });
          }
        }
      } else {
        messages.push({
          code: "CONTRACT_NOT_FOUND",
          severity: "WARNING",
          field: "rawContract",
          message: `Contract '${row.rawContract}' could not be resolved.`
        });
      }
    }

    // 6. Roster Alignment Lookup
    let resolvedRosterSlotId: string | null = null;
    let resolvedRosterAssignmentId: string | null = null;
    if (resolvedEmployeeId && attendanceDate) {
      const startOfDay = new Date(attendanceDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(attendanceDate);
      endOfDay.setHours(23, 59, 59, 999);

      const rosterAssignment = await prisma.rosterSlotAssignment.findFirst({
        where: {
          employeeId: resolvedEmployeeId,
          historyStatus: "ACTIVE",
          slot: {
            businessDate: {
              gte: startOfDay,
              lte: endOfDay
            },
            ...(resolvedSiteId ? { siteId: resolvedSiteId } : {})
          }
        },
        include: { slot: true }
      });

      if (rosterAssignment) {
        resolvedRosterAssignmentId = rosterAssignment.id;
        resolvedRosterSlotId = rosterAssignment.slotId;
        const isWorkingStatus = (workedHours && workedHours > 0) || rawStatus === "PRESENT" || rawStatus === "PRESENT_MOBILIZED" || rawStatus === "OJT" || rawStatus === "IDLE";
        if (isWorkingStatus) {
          messages.push({
            code: "ROSTER_MATCH",
            severity: "INFO",
            field: "rawShift",
            message: `Matched published roster slot assignment.`
          });
        } else if (rawStatus === "ABSENT" || rawStatus === "ABSENT_NOT_MOBILIZED" || rawStatus === "AB") {
          messages.push({
            code: "PLANNED_NOT_MOBILIZED",
            severity: "WARNING",
            field: "rawAttendanceStatus",
            message: `Employee was scheduled in published roster but source indicates absent / not mobilized.`
          });
        }

        if (resolvedSiteId && rosterAssignment.slot.siteId && rosterAssignment.slot.siteId !== resolvedSiteId) {
          messages.push({
            code: "ROSTER_SITE_MISMATCH",
            severity: "WARNING",
            field: "rawSite",
            message: `Matrix site differs from roster scheduled site.`
          });
        }
      } else {
        const isWorkingStatus = (workedHours && workedHours > 0) || rawStatus === "PRESENT" || rawStatus === "PRESENT_MOBILIZED" || rawStatus === "OJT" || rawStatus === "IDLE";
        if (isWorkingStatus) {
          messages.push({
            code: "UNROSTERED_MOBILIZATION",
            severity: "INFO",
            field: "rawShift",
            message: `Employee mobilized for duty without a published roster slot assignment.`
          });
        } else {
          messages.push({
            code: "ROSTER_NOT_FOUND",
            severity: "INFO",
            field: "rawShift",
            message: "No scheduled roster slot assignment found for employee on this duty date."
          });
        }
      }
    }

    // 7. Duplicate Checks
    // A. Intra-Batch Duplicate Detection
    const intraBatchKey = `${(row.rawEmployeeCode || "").trim().toUpperCase()}|${row.rawAttendanceDate || ""}|${(row.rawShift || "").trim().toUpperCase()}`;
    if (seenBatchKeys.has(intraBatchKey)) {
      const priorLine = seenBatchKeys.get(intraBatchKey);
      isDuplicate = true;
      duplicateReason = `Duplicate attendance row within the same file (matches Row ${priorLine}).`;
      messages.push({
        code: "DUPLICATE_IMPORT_ROW",
        severity: "ERROR",
        message: duplicateReason
      });
    } else {
      seenBatchKeys.set(intraBatchKey, row.sourceRowNumber);
    }

    // B. Cross-Batch Duplicate Detection (Prior active batches)
    if (resolvedEmployeeId && attendanceDate && !isDuplicate) {
      const priorStagedRow = await prisma.attendanceImportRow.findFirst({
        where: {
          employeeId: resolvedEmployeeId,
          attendanceDate,
          batchId: { not: batchId },
          batch: {
            status: { in: ["UPLOADED", "VALIDATING", "VALIDATED", "UNDER_REVIEW"] }
          }
        },
        include: { batch: true }
      });

      if (priorStagedRow) {
        isDuplicate = true;
        duplicateReason = `Potential duplicate with prior intake batch ${priorStagedRow.batch.batchNumber} (Row ${priorStagedRow.sourceRowNumber}).`;
        messages.push({
          code: "DUPLICATE_CROSS_BATCH",
          severity: "WARNING",
          message: duplicateReason
        });
      }
    }

    // C. Authoritative Attendance & Mobile Check (ZERO Overwrites)
    let resolvedExistingAttendanceId: string | null = null;
    if (resolvedEmployeeId && attendanceDate) {
      const startOfDay = new Date(attendanceDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(attendanceDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingRecord = await prisma.attendanceRecord.findFirst({
        where: {
          employeeId: resolvedEmployeeId,
          checkIn: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });

      if (existingRecord) {
        resolvedExistingAttendanceId = existingRecord.id;
        isDuplicate = true;
        existingAttendanceSource = existingRecord.device?.toUpperCase().includes("MOBILE") ? "MOBILE" : "AUTHORITATIVE_ATTENDANCE";
        duplicateReason = `Existing authoritative attendance found (ID: ${existingRecord.id}, Source: ${existingAttendanceSource}, Status: ${existingRecord.status}). Import will NOT overwrite.`;
        messages.push({
          code: "EXISTING_ATTENDANCE_FOUND",
          severity: "WARNING",
          message: duplicateReason
        });
      }
    }

    // 8. Leave Collision Check
    if (resolvedEmployeeId && attendanceDate) {
      const leave = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: resolvedEmployeeId,
          status: { in: ["Approved", "APPROVED"] },
          startDate: { lte: attendanceDate },
          endDate: { gte: attendanceDate }
        }
      });

      if (leave) {
        messages.push({
          code: "LEAVE_COLLISION",
          severity: "WARNING",
          field: "rawAttendanceStatus",
          message: `Employee has approved ${leave.type || "leave"} on this attendance date (${leave.dateRange || "active"}).`
        });
      }
    }

    // 9. Assign Overall Row Validation Status
    if (!resolvedEmployeeId) {
      validationStatus = "UNMATCHED";
    } else if (isDuplicate) {
      validationStatus = "DUPLICATE";
    } else if (messages.some((m) => m.severity === "ERROR")) {
      validationStatus = "ERROR";
    } else if (messages.some((m) => m.severity === "WARNING")) {
      validationStatus = "WARNING";
    } else {
      validationStatus = "VALID";
    }

    const rowResult: RowValidationResult = {
      rowId: row.id,
      sourceRowNumber: row.sourceRowNumber,
      validationStatus,
      validationMessages: messages,
      isDuplicate,
      duplicateReason,
      existingAttendanceSource,
      attendanceDate,
      actualTimeIn,
      actualTimeOut,
      plannedStartTime: timeParsed.plannedStart,
      plannedEndTime: timeParsed.plannedEnd,
      workedHours,
      otHours,
      normalizedStatus: row.rawAttendanceStatus?.toUpperCase() || (actualTimeIn ? "PRESENT" : "ABSENT"),
      employeeId: resolvedEmployeeId,
      companyId: resolvedCompanyId,
      siteId: resolvedSiteId,
      contractId: resolvedContractId,
      rosterRequirementSlotId: resolvedRosterSlotId,
      rosterSlotAssignmentId: resolvedRosterAssignmentId,
      existingAttendanceId: resolvedExistingAttendanceId
    };

    rowResults.push(rowResult);

    // Update row in database
    await prisma.attendanceImportRow.update({
      where: { id: row.id },
      data: {
        attendanceDate: rowResult.attendanceDate,
        actualTimeIn: rowResult.actualTimeIn,
        actualTimeOut: rowResult.actualTimeOut,
        plannedStartTime: rowResult.plannedStartTime,
        plannedEndTime: rowResult.plannedEndTime,
        workedHours: rowResult.workedHours,
        otHours: rowResult.otHours,
        normalizedStatus: rowResult.normalizedStatus,
        employeeId: rowResult.employeeId,
        companyId: rowResult.companyId,
        siteId: rowResult.siteId,
        contractId: rowResult.contractId,
        rosterRequirementSlotId: rowResult.rosterRequirementSlotId,
        rosterSlotAssignmentId: rowResult.rosterSlotAssignmentId,
        existingAttendanceId: rowResult.existingAttendanceId,
        validationStatus: rowResult.validationStatus,
        validationMessages: rowResult.validationMessages as any,
        isDuplicate: rowResult.isDuplicate,
        duplicateReason: rowResult.duplicateReason,
        existingAttendanceSource: rowResult.existingAttendanceSource
      }
    });
  }

  // Calculate Aggregations
  const recordCount = rowResults.length;
  const validCount = rowResults.filter((r) => r.validationStatus === "VALID").length;
  const warningCount = rowResults.filter((r) => r.validationStatus === "WARNING").length;
  const errorCount = rowResults.filter((r) => r.validationStatus === "ERROR").length;
  const duplicateCount = rowResults.filter((r) => r.isDuplicate || r.validationStatus === "DUPLICATE").length;
  const unmatchedCount = rowResults.filter((r) => r.validationStatus === "UNMATCHED").length;

  const validationCompletedAt = new Date();

  // Compute Matrix KPIs for Batch Metadata
  const existingMeta = (batch.metadata || {}) as Record<string, any>;
  const employeeSet = new Set(rowResults.map((r) => r.employeeId || r.rowId));
  const normalDutyEntries = rowResults.filter((r) => (r.workedHours && r.workedHours > 0) || r.normalizedStatus === "PRESENT" || r.normalizedStatus === "PRESENT_MOBILIZED").length;
  const otEntries = rowResults.filter((r) => (r.otHours && r.otHours > 0)).length;
  const leaveEntries = rowResults.filter((r) => r.normalizedStatus?.includes("LEAVE") || r.normalizedStatus === "SICK_LEAVE" || r.normalizedStatus === "ANNUAL_LEAVE" || r.normalizedStatus === "PUBLIC_HOLIDAY").length;
  const rosterMatches = rowResults.filter((r) => r.validationMessages.some((m) => m.code === "ROSTER_MATCH")).length;
  const attendanceConflicts = rowResults.filter((r) => r.validationMessages.some((m) => m.code === "EXISTING_ATTENDANCE_FOUND")).length;

  const updatedMetadata = {
    ...existingMeta,
    totalEmployees: employeeSet.size,
    normalDutyEntries,
    otEntries,
    leaveEntries,
    rosterMatches,
    attendanceConflicts,
    unmatchedEmployees: unmatchedCount,
    lastValidatedAt: validationCompletedAt.toISOString()
  };

  // Update Batch Aggregations and Transition State to VALIDATED
  await prisma.attendanceImportBatch.update({
    where: { id: batchId },
    data: {
      status: "VALIDATED",
      recordCount,
      validCount,
      warningCount,
      errorCount,
      duplicateCount,
      unmatchedCount,
      validationCompletedAt,
      metadata: updatedMetadata as any
    }
  });

  return {
    batchId,
    recordCount,
    validCount,
    warningCount,
    errorCount,
    duplicateCount,
    unmatchedCount,
    validationStartedAt,
    validationCompletedAt,
    status: "VALIDATED",
    rowResults
  };
}
