import { resolveEmployeeTradePosition } from "./roster-display-utils";

/**
 * Safely converts any date-like value to a YYYY-MM-DD string.
 * Handles strings (ISO or plain date), Date objects, and any other
 * value that can be parsed by `new Date()`. Returns "" for invalid input.
 */
export function toDateStr(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    return value.includes("T") ? value.split("T")[0] : value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().split("T")[0];
  }
  try {
    const parsed = new Date(value as any);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export interface SiteRequirements {
  requiresMoiLicense?: boolean;
  requiresGatePassCheck?: boolean;
  gatePassRequired?: boolean;
  gatePassValidationMode?: "STRICT" | "WARNING" | "INFO";
  clientApprovalRequired?: boolean;
  strictDesignationMatch?: boolean;
  requiredDesignation?: string;
  requiredGrade?: string;
  siteAllowance?: number;
}

export interface ValidationResult {
  canDeploy: boolean;
  severity: "OK" | "WARNING" | "BLOCKED";
  blockingIssues: string[];
  warnings: string[];
  payrollAdvisories: string[];
  checklistResult: { name: string; status: "PASS" | "WARN" | "FAIL" | "INFO"; details: string }[];
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

export function getShiftIntervals(start: string, end: string): { start: number; end: number }[] {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s < e) {
    return [{ start: s, end: e }];
  } else {
    return [
      { start: s, end: 1440 },
      { start: 0, end: e }
    ];
  }
}

export function intervalsOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function areShiftsOverlapping(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = start1 || "00:00";
  const e1 = end1 || "23:59";
  const s2 = start2 || "00:00";
  const e2 = end2 || "23:59";
  const ints1 = getShiftIntervals(s1, e1);
  const ints2 = getShiftIntervals(s2, e2);
  for (const i1 of ints1) {
    for (const i2 of ints2) {
      if (intervalsOverlap(i1, i2)) {
        return true;
      }
    }
  }
  return false;
}

export function normalizeComparableValue(value: unknown): string {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    value =
      record.name ??
      record.label ??
      record.designationName ??
      record.position ??
      "";
  }

  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function resolveEmployeeGrade(employee: any): string {
  return String(
    employee?.displayGrade ??
    employee?.grade ??
    employee?.salaryGrade ??
    employee?.gradeCode ??
    employee?.securityOperationalEmployee?.grade ??
    ""
  ).trim();
}

export function isGenericOrInvalidDesignation(val: string | undefined | null): boolean {
  if (!val || typeof val !== "string") return true;
  const clean = val.trim();
  if (!clean || clean === "null" || clean === "undefined") return true;

  // Raw IDs or codes like DES-001, UUIDs
  if (/^DES-[A-Z0-9]+$/i.test(clean) || /^[0-9a-f-]{30,}$/i.test(clean)) return true;

  const lower = clean.toLowerCase();
  return (
    lower === "general worker" ||
    lower === "worker" ||
    lower === "staff" ||
    lower === "employee" ||
    lower === "department"
  );
}

export function computeDisplayDesignation(opOrEmp: any, sourceEmp?: any): string {
  const op = opOrEmp;
  const emp = sourceEmp || opOrEmp;

  const cat = (emp?.employeeCategory || op?.employeeCategory || "").toUpperCase();
  if (cat === "BLUE_COLLAR") {
    const tradePos = resolveEmployeeTradePosition(emp) || resolveEmployeeTradePosition(op);
    if (tradePos && tradePos !== "Not specified" && !isGenericOrInvalidDesignation(tradePos)) {
      return tradePos;
    }
  }
  const empTrade = emp?.tradePosition || emp?.tradeClassification?.name || emp?.tradeClassification;
  if (empTrade && typeof empTrade === "string" && !isGenericOrInvalidDesignation(empTrade)) {
    return empTrade;
  }

  // Priority 2: employee.position / positionCategory
  const empPos = emp?.position || emp?.positionCategory;
  if (empPos && typeof empPos === "string" && !isGenericOrInvalidDesignation(empPos)) {
    return empPos;
  }

  // Priority 3: employee.jobTitle (only if operational and not white-collar/generic)
  const empJob = emp?.jobTitle;
  if (empJob && typeof empJob === "string" && !isGenericOrInvalidDesignation(empJob)) {
    return empJob;
  }

  // Priority 4: SecurityOperationalEmployee.tradePosition / position
  const opTrade = op?.tradePosition || op?.position;
  if (opTrade && typeof opTrade === "string" && !isGenericOrInvalidDesignation(opTrade)) {
    return opTrade;
  }

  // Priority 5 & 6: designation.name / designationName / designation string (if not generic/invalid)
  const desigObjName = op?.designation?.name || emp?.designation?.name;
  if (desigObjName && typeof desigObjName === "string" && !isGenericOrInvalidDesignation(desigObjName)) {
    return desigObjName;
  }

  const desigStr = (typeof op?.designation === "string" ? op.designation : null) || 
                   (typeof emp?.designation === "string" ? emp.designation : null) ||
                   op?.designationName || emp?.designationName;
  if (desigStr && typeof desigStr === "string" && !isGenericOrInvalidDesignation(desigStr)) {
    return desigStr;
  }

  // Priority 7: Fallback for Security Guarding blue collar
  return "Security Guard";
}

export function validateDeploymentEligibility(
  employee: any,
  deploymentSlot: any,
  siteRequirements: SiteRequirements,
  existingAssignments: any[],
  leaves: any[] = [],
  projectInstructions: any[] = []
): ValidationResult {
  const result: ValidationResult = {
    canDeploy: true,
    severity: "OK",
    blockingIssues: [],
    warnings: [],
    payrollAdvisories: [],
    checklistResult: []
  };

  if (!employee) {
    result.canDeploy = false;
    result.severity = "BLOCKED";
    result.blockingIssues.push("No employee specified.");
    return result;
  }

  const todayStr = new Date().toISOString().split("T")[0];

  // Helper to add checklist item
  const addChecklist = (name: string, status: "PASS" | "WARN" | "FAIL" | "INFO", details: string) => {
    result.checklistResult.push({ name, status, details });
  };

  // Rule 1: Active check
  const isEmpInactive = employee.isActive === false || employee.employmentStatus === "INACTIVE" || employee.employmentStatus === "DELETED";
  if (isEmpInactive) {
    result.canDeploy = false;
    result.severity = "BLOCKED";
    result.blockingIssues.push("Employee is inactive or deactivated in Workforce Directory.");
    addChecklist("Workforce Status", "FAIL", "Employee is inactive");
    return result;
  } else {
    addChecklist("Workforce Status", "PASS", "Active");
  }

  // Rule 2: Operation Type Check
  const masterOpType = employee.operationType;
  const snapOpType = employee.securityOperationalEmployee?.operationType || employee.securityOperationalEmployeeScope;
  const isHs01BlueCollar = (employee.companyCode === "HS01" || employee.company?.companyCode === "HS01" || employee.companyId === "COMP-002") && employee.employeeCategory === "BLUE_COLLAR";
  const targetOperationType = deploymentSlot.operationType || "SECURITY_GUARDING";
  const effectiveOperationType = snapOpType || masterOpType || (isHs01BlueCollar ? "SECURITY_GUARDING" : targetOperationType);

  if (masterOpType && snapOpType && masterOpType !== snapOpType) {
    console.warn(`Employee operational scope mismatch: master=${masterOpType}, securitySnapshot=${snapOpType}`);
  }

  if (effectiveOperationType !== targetOperationType) {
    result.canDeploy = false;
    result.severity = "BLOCKED";
    result.blockingIssues.push(`Employee operation type is '${effectiveOperationType}', not '${targetOperationType}'.`);
    addChecklist("Operational Scope", "FAIL", `Invalid scope (expected ${targetOperationType})`);
    return result;
  } else {
    addChecklist("Operational Scope", "PASS", targetOperationType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management");
  }

  // Rule 3: Leave overlap check
  const targetDateStr = deploymentSlot.date;
  const hasLeave = leaves.some(l => {
    if (l.employeeId !== employee.id || l.status !== "Approved" && l.status !== "APPROVED") return false;
    const startStr = toDateStr(l.startDate || l.from);
    const endStr = toDateStr(l.endDate || l.to);
    return targetDateStr >= startStr && targetDateStr <= endStr;
  });

  if (hasLeave) {
    result.canDeploy = false;
    result.severity = "BLOCKED";
    result.blockingIssues.push("Employee has an approved leave requisition on this date.");
    addChecklist("Leave Status", "FAIL", "On approved leave");
  } else {
    addChecklist("Leave Status", "PASS", "Available");
  }

  // Rule 4: Overlapping / Double booking shift check
  const targetStart = deploymentSlot.shiftStartTime || "00:00";
  const targetEnd = deploymentSlot.shiftEndTime || "23:59";
  let hasDoubleBooking = false;

  for (const asg of existingAssignments) {
    if (asg.employeeId === employee.id && asg.status !== "CANCELLED" && asg.status !== "unassigned") {
      const existingStart = asg.shiftStartTime || "00:00";
      const existingEnd = asg.shiftEndTime || "23:59";
      if (areShiftsOverlapping(targetStart, targetEnd, existingStart, existingEnd)) {
        hasDoubleBooking = true;
        result.canDeploy = false;
        result.severity = "BLOCKED";
        result.blockingIssues.push(`Double-booking: Already assigned on overlapping shift: ${asg.shiftCode || "Shift"} (${existingStart} - ${existingEnd}) at ${asg.siteName || "another site"}.`);
        addChecklist("Schedule Conflict", "FAIL", `Overlaps with shift ${asg.shiftCode}`);
        break;
      }
    }
  }

  if (!hasDoubleBooking) {
    addChecklist("Schedule Conflict", "PASS", "No overlaps detected");
  }

  // Rule 5: MOI License Validation
  if (siteRequirements.requiresMoiLicense) {
    const licExpiry = employee.securityLicenseExpiry || (employee.securityLicense && employee.securityLicense.expiryDate);
    if (!licExpiry) {
      result.canDeploy = false;
      result.severity = "BLOCKED";
      result.blockingIssues.push("Employee lacks an MOI security guarding license, which is mandatory for this site.");
      addChecklist("MOI License Requirement", "FAIL", "Missing MOI license");
    } else {
      const expiryDate = new Date(licExpiry);
      const today = new Date(todayStr);
      if (expiryDate < today) {
        result.canDeploy = false;
        result.severity = "BLOCKED";
        result.blockingIssues.push(`MOI License is expired since ${licExpiry}.`);
        addChecklist("MOI License Requirement", "FAIL", "Expired MOI license");
      } else {
        const diffTime = expiryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
          result.warnings.push(`MOI License is expiring soon in ${diffDays} days (${licExpiry}).`);
          addChecklist("MOI License Requirement", "WARN", `Expiring in ${diffDays} days`);
        } else {
          addChecklist("MOI License Requirement", "PASS", `Valid until ${licExpiry}`);
        }
      }
    }
  } else {
    addChecklist("MOI License Requirement", "INFO", "Not required for this site");
  }

  // Rule 6: Gate Pass Check
  const gatePassReq = siteRequirements.requiresGatePassCheck || siteRequirements.gatePassRequired;
  if (gatePassReq) {
    const gps = employee.securityGatePasses || employee.gatePasses || [];
    const siteGp = gps.find((g: any) => g.siteId === deploymentSlot.siteId) || gps[0];
    const gpExpiry = employee.siteGatePassExpiry || (siteGp && siteGp.expiryDate) || (employee.gatePass && employee.gatePass.expiryDate);
    const mode = siteRequirements.gatePassValidationMode || "WARNING";
    
    if (!gpExpiry) {
      if (mode === "STRICT") {
        result.canDeploy = false;
        result.severity = "BLOCKED";
        result.blockingIssues.push(`Site Gate Pass is strictly required, but employee is missing a Gate Pass record for site '${deploymentSlot.siteName || "this site"}'.`);
        addChecklist("Site Gate Pass Requirement", "FAIL", "Missing Gate Pass");
      } else {
        result.warnings.push(`Missing Gate Pass record for site '${deploymentSlot.siteName || "this site"}' (Warning only).`);
        addChecklist("Site Gate Pass Requirement", "WARN", "Missing Gate Pass (Warning)");
      }
    } else {
      const expiryDate = new Date(gpExpiry);
      const today = new Date(todayStr);
      if (expiryDate < today) {
        if (mode === "STRICT") {
          result.canDeploy = false;
          result.severity = "BLOCKED";
          result.blockingIssues.push(`Site Gate Pass is expired since ${gpExpiry}.`);
          addChecklist("Site Gate Pass Requirement", "FAIL", "Expired Gate Pass");
        } else {
          result.warnings.push(`Gate Pass expired on ${gpExpiry} (Warning only).`);
          addChecklist("Site Gate Pass Requirement", "WARN", "Expired Gate Pass (Warning)");
        }
      } else {
        const diffTime = expiryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
          result.warnings.push(`Gate Pass is expiring soon in ${diffDays} days (${gpExpiry}).`);
          addChecklist("Site Gate Pass Requirement", "WARN", `Expiring in ${diffDays} days`);
        } else {
          addChecklist("Site Gate Pass Requirement", "PASS", `Valid until ${gpExpiry}`);
        }
      }
    }
  } else {
    addChecklist("Site Gate Pass Requirement", "INFO", "Not required for this site");
  }

  // Rule 7: Position / Designation match / Acting Duty Advisory
  const reqDesig = siteRequirements?.requiredDesignation || deploymentSlot?.snapshotPosition || deploymentSlot?.requiredPosition;
  if (reqDesig && reqDesig !== "any" && reqDesig !== "ANY") {
    const reqNorm = normalizeComparableValue(reqDesig);
    const empCategory = (employee?.employeeCategory || "").toUpperCase();
    const isBlueCollar = empCategory === "BLUE_COLLAR" || (!empCategory && Boolean(employee?.positionCategory));

    const empPosRaw = isBlueCollar
      ? resolveEmployeeTradePosition(employee)
      : (employee.displayDesignation || computeDisplayDesignation(employee));
    const empNorm = normalizeComparableValue(empPosRaw);

    if (reqNorm && empNorm && reqNorm !== empNorm) {
      const termLabel = isBlueCollar ? "Trade/Position" : "Designation";
      if (siteRequirements.strictDesignationMatch) {
        result.canDeploy = false;
        result.severity = "BLOCKED";
        result.blockingIssues.push(`Strict Match failure: Site requires ${termLabel.toLowerCase()} '${reqDesig}', but employee has '${empPosRaw}'.`);
        addChecklist(`${termLabel} Matching`, "FAIL", `Required: ${reqDesig}, Got: ${empPosRaw}`);
      } else {
        result.warnings.push(`${termLabel} mismatch: Site requires '${reqDesig}', employee ${termLabel.toLowerCase()} is '${empPosRaw}'.`);
        result.payrollAdvisories.push(`Acting duty advisory may apply. Employee ${termLabel.toLowerCase()} differs from required post.`);
        addChecklist(`${termLabel} Matching`, "WARN", `${termLabel} mismatch (Acting Duty)`);
      }
    } else {
      const termLabel = isBlueCollar ? "Trade/Position" : "Designation";
      addChecklist(`${termLabel} Matching`, "PASS", "Matched");
    }
  } else {
    addChecklist("Position / Designation Matching", "INFO", "No position/designation requirement");
  }

  // Rule 8: Salary Grade mismatch / Grade advisory
  const reqGrade = siteRequirements.requiredGrade;
  if (reqGrade && reqGrade !== "any" && reqGrade !== "ANY") {
    const reqNorm = normalizeComparableValue(reqGrade);
    const empGradeRaw = resolveEmployeeGrade(employee);
    const empNorm = normalizeComparableValue(empGradeRaw);

    if (!empNorm) {
      result.warnings.push(`Salary Grade missing: Post requires '${reqGrade}', but the employee has no grade configured.`);
      result.payrollAdvisories.push("Salary grade missing. Payroll team should review advisory report.");
      addChecklist("Salary Grade Matching", "WARN", `Required: ${reqGrade}, Got: Unconfigured`);
    } else if (reqNorm !== empNorm) {
      result.warnings.push(`Salary Grade mismatch: Post requires '${reqGrade}', employee grade is '${empGradeRaw}'.`);
      result.payrollAdvisories.push("Salary grade mismatch detected. Payroll team should review advisory report.");
      addChecklist("Salary Grade Matching", "WARN", `Required: ${reqGrade}, Got: ${empGradeRaw}`);
    } else {
      addChecklist("Salary Grade Matching", "PASS", "Matched");
    }
  } else {
    addChecklist("Salary Grade Matching", "INFO", "No grade requirement");
  }

  // Rule 9: Site Allowance Advisory
  if (siteRequirements.siteAllowance && siteRequirements.siteAllowance > 0) {
    // Check if the site is the employee's regular site
    const regularSiteId = employee.defaultLocationId || employee.regularSiteId;
    if (regularSiteId !== deploymentSlot.siteId) {
      result.warnings.push(`Temporary assignment to site '${deploymentSlot.siteName || "Target"}' with site allowance.`);
      result.payrollAdvisories.push(`Site allowance advisory may apply. Site allowance reference: QAR ${siteRequirements.siteAllowance} / month.`);
      result.payrollAdvisories.push("Allowance should be considered only for selected deployment days.");
      addChecklist("Site Allowance Advisory", "WARN", `Target site has QAR ${siteRequirements.siteAllowance}/month allowance`);
    } else {
      addChecklist("Site Allowance Advisory", "PASS", `Employee regular site`);
    }
  } else {
    addChecklist("Site Allowance Advisory", "INFO", "No site allowance configured");
  }

  // Rule 10: Reliever check
  if (deploymentSlot.isReliever || deploymentSlot.deploymentMode === "RELIEVER") {
    result.payrollAdvisories.push("Reliever duty advisory may apply. Temporary reliever incentive calculations should be reviewed.");
    addChecklist("Reliever Check", "INFO", "Assigned as reliever");
  }

  // Rule 11: Project-level Site Instructions check
  if (projectInstructions && projectInstructions.length > 0) {
    for (const pi of projectInstructions) {
      if (pi.isActive === false) continue;
      
      const type = pi.requirementType;
      const sev = pi.severity || "WARNING_ONLY";
      const title = pi.instructionTitle;

      let triggered = false;
      let reasonMsg = "";

      if (type === "LICENSE") {
        const licExpiry = employee.securityLicenseExpiry || (employee.securityLicense && employee.securityLicense.expiryDate);
        if (!licExpiry) {
          triggered = true;
          reasonMsg = `Missing mandatory license specified by instruction: '${title}'`;
        } else if (new Date(licExpiry) < new Date(todayStr)) {
          triggered = true;
          reasonMsg = `Expired license (${licExpiry}) specified by instruction: '${title}'`;
        }
      } else if (type === "GATE_PASS") {
        const gps = employee.securityGatePasses || employee.gatePasses || [];
        const siteGp = gps.find((g: any) => g.siteId === deploymentSlot.siteId) || gps[0];
        const gpExpiry = employee.siteGatePassExpiry || (siteGp && siteGp.expiryDate) || (employee.gatePass && employee.gatePass.expiryDate);
        if (!gpExpiry) {
          triggered = true;
          reasonMsg = `Missing mandatory site gate pass specified by instruction: '${title}'`;
        } else if (new Date(gpExpiry) < new Date(todayStr)) {
          triggered = true;
          reasonMsg = `Expired gate pass (${gpExpiry}) specified by instruction: '${title}'`;
        }
      } else if (type === "DOCUMENT") {
        const qidExpiry = employee.qidExpiryDate;
        if (qidExpiry && new Date(qidExpiry) < new Date(todayStr)) {
          triggered = true;
          reasonMsg = `QID expired (${new Date(qidExpiry).toISOString().split("T")[0]}) specified by instruction: '${title}'`;
        }
      } else if (type === "DESIGNATION") {
        const empCategory = (employee?.employeeCategory || "").toUpperCase();
        const isBlueCollar = empCategory === "BLUE_COLLAR";
        const empPos = isBlueCollar
          ? resolveEmployeeTradePosition(employee)
          : (employee.designationName || (employee.designation && employee.designation.name) || employee.designationId);
        const reqDesig = siteRequirements.requiredDesignation;
        if (reqDesig && empPos !== reqDesig) {
          triggered = true;
          const termLabel = isBlueCollar ? "Trade/Position" : "Designation";
          reasonMsg = `${termLabel} mismatch: post requires '${reqDesig}', guard has '${empPos}' ('${title}')`;
        }
      } else if (type === "GRADE") {
        const empGrade = employee.salaryGrade || employee.grade;
        const reqGrade = siteRequirements.requiredGrade;
        if (reqGrade && empGrade !== reqGrade) {
          triggered = true;
          reasonMsg = `Grade mismatch: post requires '${reqGrade}', guard has '${empGrade}' ('${title}')`;
        }
      } else if (type === "CLIENT_APPROVAL") {
        triggered = true;
        reasonMsg = `Verify client approval status: '${title}'`;
      } else {
        triggered = true;
        reasonMsg = `Roster policy compliance check required: '${title}'`;
      }

      if (triggered) {
        if (sev === "HARD_BLOCK") {
          result.canDeploy = false;
          result.blockingIssues.push(`Project Instruction Policy Block: ${reasonMsg}`);
          addChecklist(`Instr: ${title}`, "FAIL", reasonMsg);
        } else if (sev === "WARNING_ONLY") {
          result.warnings.push(`Project Instruction Policy Warning: ${reasonMsg}`);
          addChecklist(`Instr: ${title}`, "WARN", reasonMsg);
        } else {
          addChecklist(`Instr: ${title}`, "INFO", reasonMsg);
        }
      } else {
        addChecklist(`Instr: ${title}`, "PASS", "Policy compliant");
      }
    }
  }

  // Override overall severity if blocked
  if (result.blockingIssues.length > 0) {
    result.severity = "BLOCKED";
  } else if (result.warnings.length > 0) {
    result.severity = "WARNING";
  }

  return result;
}
