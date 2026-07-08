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

export function validateDeploymentEligibility(
  employee: any,
  deploymentSlot: any,
  siteRequirements: SiteRequirements,
  existingAssignments: any[],
  leaves: any[] = []
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
  if (employee.isActive === false || employee.employmentStatus !== "ACTIVE") {
    result.canDeploy = false;
    result.severity = "BLOCKED";
    result.blockingIssues.push("Employee is inactive or deactivated in Workforce Directory.");
    addChecklist("Workforce Status", "FAIL", "Employee is inactive");
    return result;
  } else {
    addChecklist("Workforce Status", "PASS", "Active");
  }

  // Rule 2: Operation Type Check
  if (employee.operationType !== "SECURITY_GUARDING") {
    result.canDeploy = false;
    result.severity = "BLOCKED";
    result.blockingIssues.push(`Employee operation type is '${employee.operationType}', not 'SECURITY_GUARDING'.`);
    addChecklist("Operational Scope", "FAIL", "Invalid scope");
    return result;
  } else {
    addChecklist("Operational Scope", "PASS", "Security Guarding");
  }

  // Rule 3: Leave overlap check
  const targetDateStr = deploymentSlot.date;
  const hasLeave = leaves.some(l => {
    if (l.employeeId !== employee.id || l.status !== "Approved" && l.status !== "APPROVED") return false;
    const startStr = (l.startDate || l.from || "").split("T")[0];
    const endStr = (l.endDate || l.to || "").split("T")[0];
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

  // Rule 7: Designation match / Acting Duty Advisory
  const reqDesig = siteRequirements.requiredDesignation;
  if (reqDesig && reqDesig !== "any" && reqDesig !== "ANY") {
    const empDesig = employee.designationName || (employee.designation && employee.designation.name) || employee.designationId;
    if (empDesig !== reqDesig) {
      if (siteRequirements.strictDesignationMatch) {
        result.canDeploy = false;
        result.severity = "BLOCKED";
        result.blockingIssues.push(`Strict Match failure: Site requires designation '${reqDesig}', but employee has '${empDesig}'.`);
        addChecklist("Designation Matching", "FAIL", `Required: ${reqDesig}, Got: ${empDesig}`);
      } else {
        result.warnings.push(`Designation mismatch: Site requires '${reqDesig}', employee designation is '${empDesig}'.`);
        result.payrollAdvisories.push("Acting duty advisory may apply. Employee designation differs from required post.");
        addChecklist("Designation Matching", "WARN", "Designation mismatch (Acting Duty)");
      }
    } else {
      addChecklist("Designation Matching", "PASS", "Matched");
    }
  } else {
    addChecklist("Designation Matching", "INFO", "No designation requirement");
  }

  // Rule 8: Salary Grade mismatch / Grade advisory
  const reqGrade = siteRequirements.requiredGrade;
  if (reqGrade && reqGrade !== "any" && reqGrade !== "ANY") {
    const empGrade = employee.salaryGrade || employee.grade;
    if (empGrade !== reqGrade) {
      result.warnings.push(`Salary Grade mismatch: Post requires '${reqGrade}', employee grade is '${empGrade}'.`);
      result.payrollAdvisories.push("Salary grade mismatch detected. Payroll team should review advisory report.");
      addChecklist("Salary Grade Matching", "WARN", `Required: ${reqGrade}, Got: ${empGrade}`);
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

  // Override overall severity if blocked
  if (result.blockingIssues.length > 0) {
    result.severity = "BLOCKED";
  } else if (result.warnings.length > 0) {
    result.severity = "WARNING";
  }

  return result;
}
