import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || !lines[0]) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });
    rows.push(rowObj);
  }
  return { headers, rows };
}

function isValidDate(val?: string) {
  if (!val || val.trim() === "") return true;
  const d = new Date(val);
  return d instanceof Date && !isNaN(d.getTime());
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { csvText, fileName, updateExisting } = body;
    if (!csvText) {
      return NextResponse.json({ error: "Missing csvText in payload" }, { status: 400 });
    }

    const { rows } = parseCSV(csvText);
    const existingEmployees = await mockDb.getEmployees();
    const depts = await mockDb.getDepartments();
    const companies = await mockDb.getCompanies();
    const locations = await mockDb.getLocations();

    const previewRows = [];
    let validCount = 0;
    let invalidCount = 0;

    const seenCodes = new Set<string>();
    const seenEmails = new Set<string>();

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const errors: string[] = [];
      const rowNum = idx + 2; // header is row 1

      // 1. Required fields
      // Use employeeCode as primary identifier
      const empCode = row.employeeCode || row.employeeId;
      if (!empCode) errors.push("employeeCode is required");
      if (!row.fullName) errors.push("fullName is required");
      if (!row.companyCode) errors.push("companyCode is required");
      if (!row.department) errors.push("department is required");
      if (!row.designation) errors.push("designation is required");
      if (!row.employeeCategory) errors.push("employeeCategory is required");
      if (!row.operationType) errors.push("operationType is required");
      if (!row.defaultLocation) errors.push("defaultLocation is required");
      if (!row.dateOfJoining) errors.push("dateOfJoining is required");

      // 2. Validate duplicates in payload
      if (empCode) {
        const normalizedCode = empCode.trim().toLowerCase();
        if (seenCodes.has(normalizedCode)) {
          errors.push(`Duplicate employeeCode/Id '${empCode}' in upload file`);
        } else {
          seenCodes.add(normalizedCode);
        }
      }

      if (row.email && row.email.trim() !== "") {
        const normalizedEmail = row.email.trim().toLowerCase();
        if (seenEmails.has(normalizedEmail)) {
          errors.push(`Duplicate email '${row.email}' in upload file`);
        } else {
          seenEmails.add(normalizedEmail);
        }
      }

      // 3. Validate duplicates against DB (unless updateExisting is true)
      if (empCode && !updateExisting) {
        const match = existingEmployees.find(e => e.id === empCode || (e as any).employeeCode === empCode);
        if (match) {
          errors.push(`Employee Code '${empCode}' already exists in database`);
        }
      }

      if (row.email && row.email.trim() !== "" && !updateExisting) {
        const match = existingEmployees.find(e => e.email?.toLowerCase() === row.email.trim().toLowerCase());
        if (match) {
          errors.push(`Email '${row.email}' already exists in database`);
        }
      }

      // 4. Validate employeeCategory
      if (row.employeeCategory && !["WHITE_COLLAR", "BLUE_COLLAR"].includes(row.employeeCategory.toUpperCase())) {
        errors.push("employeeCategory must be WHITE_COLLAR or BLUE_COLLAR");
      }

      // 5. Validate operationType
      if (row.operationType && !["WHITE_COLLAR", "SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(row.operationType.toUpperCase())) {
        errors.push("operationType must be WHITE_COLLAR, SECURITY_GUARDING, or FACILITY_MANAGEMENT");
      }

      // 6. Validate master references
      if (row.companyCode) {
        const comp = companies.find(c => c.companyCode.toLowerCase() === row.companyCode.trim().toLowerCase());
        if (!comp) errors.push(`Referenced Company Code '${row.companyCode}' not found`);
      }
      if (row.department) {
        const dept = depts.find(d => d.name.toLowerCase() === row.department.trim().toLowerCase() || d.id === row.department);
        if (!dept) errors.push(`Referenced Department '${row.department}' not found`);
      }
      if (row.defaultLocation) {
        const loc = locations.find(l => l.locationCode.toLowerCase() === row.defaultLocation.trim().toLowerCase() || l.locationName.toLowerCase() === row.defaultLocation.trim().toLowerCase());
        if (!loc) errors.push(`Referenced Location '${row.defaultLocation}' not found`);
      }

      // 7. Validate Qatar ID format: /^[23]\d{10}$/
      if (row.qidNumber && row.qidNumber.trim() !== "") {
        if (!/^[23]\d{10}$/.test(row.qidNumber.trim())) {
          errors.push(`Qatar ID '${row.qidNumber}' must be exactly 11 digits starting with 2 or 3`);
        }
      }

      // 8. Validate date formats
      const dateFields = [
        { name: "dateOfJoining", val: row.dateOfJoining },
        { name: "dateOfBirth", val: row.dateOfBirth },
        { name: "qidIssueDate", val: row.qidIssueDate },
        { name: "qidExpiryDate", val: row.qidExpiryDate },
        { name: "passportIssueDate", val: row.passportIssueDate },
        { name: "passportExpiryDate", val: row.passportExpiryDate },
        { name: "visaIssueDate", val: row.visaIssueDate },
        { name: "visaExpiryDate", val: row.visaExpiryDate },
        { name: "workPermitExpiryDate", val: row.workPermitExpiryDate },
        { name: "moiLicenseIssueDate", val: row.moiLicenseIssueDate },
        { name: "moiLicenseExpiryDate", val: row.moiLicenseExpiryDate },
        { name: "securityTrainingExpiryDate", val: row.securityTrainingExpiryDate },
        { name: "siteGatePassExpiryDate", val: row.siteGatePassExpiryDate },
        { name: "skillCertificateExpiryDate", val: row.skillCertificateExpiryDate },
        { name: "healthCardExpiryDate", val: row.healthCardExpiryDate }
      ];

      dateFields.forEach(f => {
        if (f.val && f.val.trim() !== "" && !isValidDate(f.val)) {
          errors.push(`Invalid date format for '${f.name}': '${f.val}' (Expected YYYY-MM-DD)`);
        }
      });

      // 9. Validate expiry dates are after issue/joining dates
      const compareDates = (start?: string, end?: string, startLabel = "Issue Date", endLabel = "Expiry Date") => {
        if (!start || !end || start.trim() === "" || end.trim() === "") return;
        if (!isValidDate(start) || !isValidDate(end)) return;
        if (new Date(end) <= new Date(start)) {
          errors.push(`${endLabel} must be strictly after ${startLabel}`);
        }
      };

      compareDates(row.qidIssueDate, row.qidExpiryDate, "QID Issue Date", "QID Expiry Date");
      compareDates(row.passportIssueDate, row.passportExpiryDate, "Passport Issue Date", "Passport Expiry Date");
      compareDates(row.visaIssueDate, row.visaExpiryDate, "Visa Issue Date", "Visa Expiry Date");
      compareDates(row.moiLicenseIssueDate, row.moiLicenseExpiryDate, "MOI License Issue Date", "MOI License Expiry Date");
      compareDates(row.dateOfJoining, row.workPermitExpiryDate, "Date of Joining", "Work Permit Expiry Date");
      compareDates(row.dateOfJoining, row.securityTrainingExpiryDate, "Date of Joining", "Security Training Expiry Date");
      compareDates(row.dateOfJoining, row.siteGatePassExpiryDate, "Date of Joining", "Site Gate Pass Expiry Date");
      compareDates(row.dateOfJoining, row.skillCertificateExpiryDate, "Date of Joining", "Skill Certificate Expiry Date");
      compareDates(row.dateOfJoining, row.healthCardExpiryDate, "Date of Joining", "Health Card Expiry Date");

      // 10. Operation-specific field validation
      const opType = (row.operationType || "").toUpperCase();
      const hasSGFields = !!(row.moiLicenseNumber || row.moiLicenseIssueDate || row.moiLicenseExpiryDate || row.securityTrainingCertificateNumber || row.securityTrainingExpiryDate || row.siteGatePassNumber || row.siteGatePassExpiryDate);
      const hasFMFields = !!(row.tradeSkill || row.skillCertificateNumber || row.skillCertificateExpiryDate || row.healthCardNumber || row.healthCardExpiryDate);

      if (opType === "SECURITY_GUARDING") {
        if (hasFMFields) {
          errors.push("Facility Management-specific fields (trade skill, skill certificate, health card) are not allowed for SECURITY_GUARDING operation type");
        }
      } else if (opType === "FACILITY_MANAGEMENT") {
        if (hasSGFields) {
          errors.push("Security Guarding-specific fields (MOI license, training certificate, gate pass) are not allowed for FACILITY_MANAGEMENT operation type");
        }
      } else if (opType === "WHITE_COLLAR") {
        if (hasSGFields) {
          errors.push("Security Guarding-specific fields are not allowed for WHITE_COLLAR operation type");
        }
        if (hasFMFields) {
          errors.push("Facility Management-specific fields are not allowed for WHITE_COLLAR operation type");
        }
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else invalidCount++;

      previewRows.push({
        rowNum,
        data: row,
        errors,
        isValid
      });
    }

    return NextResponse.json({
      fileName: fileName || "upload.csv",
      totalRows: rows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      previewRows
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to process csv preview" }, { status: 500 });
  }
}
