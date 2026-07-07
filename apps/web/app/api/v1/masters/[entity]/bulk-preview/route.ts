import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { MASTER_SCHEMAS } from "@/lib/masters-schema";
import { isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

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

export async function POST(request: Request, { params }: { params: { entity: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { entity } = params;
  const schema = MASTER_SCHEMAS[entity];
  if (!schema) {
    return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { csvText, fileName, updateExisting } = body;
    if (!csvText) {
      return NextResponse.json({ error: "Missing csvText in payload" }, { status: 400 });
    }

    const { rows } = parseCSV(csvText);

    // Fetch DB records for reference checking and duplicate checks
    let dbCompanies: any[] = [];
    let dbLocations: any[] = [];
    let dbProjects: any[] = [];
    let dbDesignations: any[] = [];
    let dbTrades: any[] = [];
    let dbRecords: any[] = [];

    if (isDbConnected()) {
      dbCompanies = await prisma.company.findMany();
      dbLocations = await prisma.locationMaster.findMany();
      dbProjects = await prisma.project.findMany();
      dbDesignations = await prisma.designation.findMany();
      dbTrades = await prisma.tradeClassification.findMany();
      
      // Fetch records for the current entity to check duplicates
      if (entity === "companies") dbRecords = dbCompanies;
      else if (entity === "departments") dbRecords = await prisma.department.findMany();
      else if (entity === "designations") dbRecords = dbDesignations;
      else if (entity === "trade-classifications") dbRecords = dbTrades;
      else if (entity === "locations") dbRecords = dbLocations;
      else if (entity === "cost-centers") dbRecords = await prisma.costCenter.findMany();
      else if (entity === "projects") dbRecords = dbProjects;
      else if (entity === "project-sites") dbRecords = await prisma.projectSite.findMany();
      else if (entity === "allowed-punch-locations") dbRecords = await prisma.allowedPunchLocation.findMany();
      else if (entity === "standby-rules") dbRecords = await prisma.relieverStandbyRule.findMany();
      else if (entity === "leave-types") dbRecords = await prisma.leaveType.findMany();
    } else {
      const db = readDb();
      dbCompanies = db.companies || [];
      dbLocations = db.locations || [];
      dbProjects = db.projects || [];
      dbDesignations = db.designations || [];
      dbTrades = db.tradeClassifications || [];
      
      if (entity === "companies") dbRecords = dbCompanies;
      else if (entity === "departments") dbRecords = db.departments || [];
      else if (entity === "designations") dbRecords = dbDesignations;
      else if (entity === "trade-classifications") dbRecords = dbTrades;
      else if (entity === "locations") dbRecords = dbLocations;
      else if (entity === "cost-centers") dbRecords = db.costCenters || [];
      else if (entity === "projects") dbRecords = dbProjects;
      else if (entity === "project-sites") dbRecords = db.projectSites || [];
      else if (entity === "allowed-punch-locations") dbRecords = db.allowedPunchLocations || [];
      else if (entity === "standby-rules") dbRecords = db.relieverStandbyRules || [];
      else if (entity === "leave-types") dbRecords = db.leaveTypes || [];
    }

    const previewRows = [];
    let validCount = 0;
    let invalidCount = 0;
    const seenCodes = new Set<string>();

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const errors: string[] = [];
      const rowNum = idx + 2;

      // 1. Required fields validation
      schema.columns.forEach(col => {
        const importKey = col.referenceKey || col.key;
        const val = row[importKey];
        if (col.required && (!val || val.trim() === "")) {
          errors.push(`Field '${importKey}' is required`);
        }
      });

      // Find the main code/key field of this entity (usually 'code', 'companyCode', 'ruleName', or 'name')
      const keyField = schema.columns.find(col => col.key === "code" || col.key === "companyCode" || col.key === "ruleName" || col.key === "name");
      const keyVal = keyField ? row[keyField.referenceKey || keyField.key] : null;

      if (keyVal) {
        const normalizedKey = keyVal.trim().toLowerCase();
        
        // 2. Duplicate check inside the file
        if (seenCodes.has(normalizedKey)) {
          errors.push(`Duplicate key value '${keyVal}' in upload file`);
        } else {
          seenCodes.add(normalizedKey);
        }

        // 3. Duplicate check against the database
        if (!updateExisting) {
          const isDup = dbRecords.some((rec: any) => {
            const dbVal = rec.code || rec.companyCode || rec.ruleName || rec.name || "";
            return dbVal.trim().toLowerCase() === normalizedKey;
          });
          if (isDup) {
            errors.push(`Record with code/name '${keyVal}' already exists in database`);
          }
        }
      }

      // 4. Resolve and validate parent reference columns
      schema.columns.forEach(col => {
        if (col.referenceKey && col.referenceEntity) {
          const refVal = row[col.referenceKey];
          if (refVal && refVal.trim() !== "") {
            const normalizedRef = refVal.trim().toLowerCase();
            let refFound = false;

            if (col.referenceEntity === "companies") {
              refFound = dbCompanies.some((c: any) => c.companyCode.toLowerCase() === normalizedRef);
            } else if (col.referenceEntity === "projects") {
              refFound = dbProjects.some((p: any) => p.projectCode.toLowerCase() === normalizedRef);
            } else if (col.referenceEntity === "locations") {
              refFound = dbLocations.some((l: any) => l.locationCode.toLowerCase() === normalizedRef);
            } else if (col.referenceEntity === "designations") {
              refFound = dbDesignations.some((d: any) => d.code.toLowerCase() === normalizedRef);
            } else if (col.referenceEntity === "trade-classifications") {
              refFound = dbTrades.some((t: any) => t.code.toLowerCase() === normalizedRef);
            }

            if (!refFound) {
              errors.push(`Referenced ${col.label} Code '${refVal}' not found in database`);
            }
          }
        }
      });

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
    console.error("Master preview validation error:", e);
    return NextResponse.json({ error: e.message || "Failed to process csv preview" }, { status: 500 });
  }
}
