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

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
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
    const projects = await mockDb.getProjects();
    const sites = await mockDb.getProjectSites();
    const categories = await mockDb.getBlueCollarPositionCategories();
    const roles = ["ADMIN", "SUPERVISOR", "EMPLOYEE", "SUPER_ADMIN", "HR_MANAGER", "FINANCE_MANAGER", "SAP_ADMIN", "REPORT_VIEWER"];

    const previewRows = [];
    let validCount = 0;
    let invalidCount = 0;

    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const errors: string[] = [];
      const rowNum = idx + 2; // header is row 1

      // 1. Required fields
      if (!row.employeeId) errors.push("employeeId is required");
      if (!row.fullName) errors.push("fullName is required");
      if (!row.email) errors.push("email is required");
      if (!row.department) errors.push("department is required");
      if (!row.role) errors.push("role is required");

      // 2. Validate duplicates in payload
      if (row.employeeId) {
        if (seenIds.has(row.employeeId)) {
          errors.push(`Duplicate employeeId '${row.employeeId}' in upload file`);
        } else {
          seenIds.add(row.employeeId);
        }
      }

      if (row.email) {
        if (seenEmails.has(row.email.toLowerCase())) {
          errors.push(`Duplicate email '${row.email}' in upload file`);
        } else {
          seenEmails.add(row.email.toLowerCase());
        }
      }

      // 3. Validate duplicates against DB (unless updateExisting is true)
      if (row.employeeId && !updateExisting) {
        const match = existingEmployees.find(e => e.id === row.employeeId);
        if (match) {
          errors.push(`Employee ID '${row.employeeId}' already exists in database`);
        }
      }

      if (row.email && !updateExisting) {
        const match = existingEmployees.find(e => e.email.toLowerCase() === row.email.toLowerCase());
        if (match) {
          errors.push(`Email '${row.email}' already exists in database`);
        }
      }

      // 4. Validate employeeCategory
      const resolvedCategory = row.employeeCategory || row.workerCategory;
      if (resolvedCategory && !["WHITE_COLLAR", "BLUE_COLLAR"].includes(resolvedCategory)) {
        errors.push("employeeCategory must be WHITE_COLLAR or BLUE_COLLAR");
      }

      // 5. Validate Role
      if (row.role && !roles.includes(row.role.toUpperCase())) {
        errors.push(`Invalid role '${row.role}'. Supported roles: ${roles.join(", ")}`);
      }

      // 6. Validate positionCategory, defaultProjectCode, defaultSiteCode
      if (resolvedCategory === "BLUE_COLLAR" || row.positionCategory || row.defaultProjectCode || row.defaultSiteCode) {
        if (row.positionCategory) {
          const matchCat = categories.find(c => c.code.toLowerCase() === row.positionCategory.toLowerCase() || c.name.toLowerCase() === row.positionCategory.toLowerCase());
          if (!matchCat) {
            errors.push(`Position Category '${row.positionCategory}' not found. Configure it in Settings first.`);
          }
        }
        if (row.defaultProjectCode) {
          const matchProj = projects.find(p => p.projectCode.toLowerCase() === row.defaultProjectCode.toLowerCase() || p.id.toLowerCase() === row.defaultProjectCode.toLowerCase());
          if (!matchProj) {
            errors.push(`Project Code/ID '${row.defaultProjectCode}' not found.`);
          }
        }
        if (row.defaultSiteCode) {
          const matchSite = sites.find(s => s.siteCode.toLowerCase() === row.defaultSiteCode.toLowerCase() || s.id.toLowerCase() === row.defaultSiteCode.toLowerCase());
          if (!matchSite) {
            errors.push(`Project Site Code/ID '${row.defaultSiteCode}' not found.`);
          }
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
