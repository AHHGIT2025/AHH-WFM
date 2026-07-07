import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { MASTER_SCHEMAS } from "@/lib/masters-schema";
import { isDbConnected, readDb, writeDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

const entityMap: Record<string, string> = {
  companies: "company",
  departments: "department",
  designations: "designation",
  "trade-classifications": "tradeClassification",
  locations: "locationMaster",
  "cost-centers": "costCenter",
  projects: "project",
  "project-sites": "projectSite",
  "allowed-punch-locations": "allowedPunchLocation",
  "standby-rules": "relieverStandbyRule",
  "leave-types": "leaveType",
};

const memoryKeyMap: Record<string, string> = {
  companies: "companies",
  departments: "departments",
  designations: "designations",
  "trade-classifications": "tradeClassifications",
  locations: "locations",
  "cost-centers": "costCenters",
  projects: "projects",
  "project-sites": "projectSites",
  "allowed-punch-locations": "allowedPunchLocations",
  "standby-rules": "relieverStandbyRules",
  "leave-types": "leaveTypes",
};

export async function POST(request: Request, { params }: { params: { entity: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { entity } = params;
  const schema = MASTER_SCHEMAS[entity];
  const modelName = entityMap[entity];
  const memoryKey = memoryKeyMap[entity];

  if (!schema || !modelName || !memoryKey) {
    return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
  }

  const userId = (auth.session?.user as any)?.id || "admin-system";

  try {
    const body = await request.json();
    const { rows, fileName, updateExisting } = body;
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing rows array" }, { status: 400 });
    }

    // Load reference mappings to map codes to database IDs
    let dbCompanies: any[] = [];
    let dbLocations: any[] = [];
    let dbProjects: any[] = [];
    let dbDesignations: any[] = [];
    let dbTrades: any[] = [];

    if (isDbConnected()) {
      dbCompanies = await prisma.company.findMany();
      dbLocations = await prisma.locationMaster.findMany();
      dbProjects = await prisma.project.findMany();
      dbDesignations = await prisma.designation.findMany();
      dbTrades = await prisma.tradeClassification.findMany();
    } else {
      const db = readDb();
      dbCompanies = db.companies || [];
      dbLocations = db.locations || [];
      dbProjects = db.projects || [];
      dbDesignations = db.designations || [];
      dbTrades = db.tradeClassifications || [];
    }

    let importedCount = 0;
    let updatedCount = 0;

    if (isDbConnected()) {
      const dbModel: any = prisma[modelName as any];

      for (const row of rows) {
        // Resolve values and parse types
        const payload: Record<string, any> = {};
        
        schema.columns.forEach(col => {
          const importKey = col.referenceKey || col.key;
          let val: any = row[importKey];

          if (val === undefined || val === null || String(val).trim() === "") {
            payload[col.key] = null;
            return;
          }

          val = String(val).trim();

          // If it references another table, resolve code to ID
          if (col.referenceKey && col.referenceEntity) {
            const codeVal = val.toLowerCase();
            let matchedId: string | null = null;

            if (col.referenceEntity === "companies") {
              const matched = dbCompanies.find((c: any) => c.companyCode.toLowerCase() === codeVal);
              if (matched) matchedId = matched.id;
            } else if (col.referenceEntity === "projects") {
              const matched = dbProjects.find((p: any) => p.projectCode.toLowerCase() === codeVal);
              if (matched) matchedId = matched.id;
            } else if (col.referenceEntity === "locations") {
              const matched = dbLocations.find((l: any) => l.locationCode.toLowerCase() === codeVal);
              if (matched) matchedId = matched.id;
            } else if (col.referenceEntity === "designations") {
              const matched = dbDesignations.find((d: any) => d.code.toLowerCase() === codeVal);
              if (matched) matchedId = matched.id;
            } else if (col.referenceEntity === "trade-classifications") {
              const matched = dbTrades.find((t: any) => t.code.toLowerCase() === codeVal);
              if (matched) matchedId = matched.id;
            }

            payload[col.key] = matchedId;
          } else if (col.type === "boolean") {
            payload[col.key] = val.toLowerCase() === "true" || val === "1" || val === "yes";
          } else if (col.type === "number") {
            payload[col.key] = Number(val);
          } else {
            payload[col.key] = val;
          }
        });

        // Determine unique key field value to check duplicates
        const keyField = schema.columns.find(col => col.key === "code" || col.key === "companyCode" || col.key === "ruleName" || col.key === "name");
        const keyVal = keyField ? payload[keyField.key] : null;

        let existingRecord = null;
        if (keyField && keyVal) {
          const filter: any = {};
          filter[keyField.key] = keyVal;
          existingRecord = await dbModel.findFirst({ where: filter });
        }

        if (existingRecord) {
          if (updateExisting) {
            await dbModel.update({
              where: { id: existingRecord.id },
              data: {
                ...payload,
                updatedAt: new Date()
              }
            });
            updatedCount++;
          }
        } else {
          await dbModel.create({
            data: {
              id: `${entity.substring(0, 3).toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              ...payload,
              isActive: payload.isActive !== undefined ? payload.isActive : true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          importedCount++;
        }
      }

      // Log import activity
      await prisma.userActivityLog.create({
        data: {
          id: `LOG-${Date.now()}`,
          userId,
          action: "MASTER_BULK_IMPORT",
          entityType: entity.toUpperCase(),
          entityId: "SYSTEM",
          afterJson: JSON.stringify({
            fileName,
            totalRows: rows.length,
            importedCount,
            updatedCount
          }),
          ipAddress: "127.0.0.1",
          userAgent: "API Call"
        }
      });
    } else {
      const db = readDb();
      const records = (db as any)[memoryKey] || [];

      for (const row of rows) {
        const payload: Record<string, any> = {};

        schema.columns.forEach(col => {
          const importKey = col.referenceKey || col.key;
          let val: any = row[importKey];

          if (val === undefined || val === null || String(val).trim() === "") {
            payload[col.key] = null;
            return;
          }

          val = String(val).trim();

          if (col.referenceKey && col.referenceEntity) {
            const codeVal = val.toLowerCase();
            let matchedId: string | null = null;

            if (col.referenceEntity === "companies") {
              const matched = dbCompanies.find((c: any) => c.companyCode.toLowerCase() === codeVal);
              if (matched) matchedId = matched.id;
            } else if (col.referenceEntity === "projects") {
              const matched = dbProjects.find((p: any) => p.projectCode.toLowerCase() === codeVal);
              if (matched) matchedId = matched.id;
            } else if (col.referenceEntity === "locations") {
              const matched = dbLocations.find((l: any) => l.locationCode.toLowerCase() === codeVal);
              if (matched) matchedId = matched.id;
            } else if (col.referenceEntity === "designations") {
              const matched = dbDesignations.find((d: any) => d.code.toLowerCase() === codeVal);
              if (matched) matchedId = matched.id;
            } else if (col.referenceEntity === "trade-classifications") {
              const matched = dbTrades.find((t: any) => t.code.toLowerCase() === codeVal);
              if (matched) matchedId = matched.id;
            }

            payload[col.key] = matchedId;
          } else if (col.type === "boolean") {
            payload[col.key] = val.toLowerCase() === "true" || val === "1" || val === "yes";
          } else if (col.type === "number") {
            payload[col.key] = Number(val);
          } else {
            payload[col.key] = val;
          }
        });

        const keyField = schema.columns.find(col => col.key === "code" || col.key === "companyCode" || col.key === "ruleName" || col.key === "name");
        const keyVal = keyField ? payload[keyField.key] : null;

        let existingRecordIndex = -1;
        if (keyField && keyVal) {
          const normalizedVal = String(keyVal).trim().toLowerCase();
          existingRecordIndex = records.findIndex((rec: any) => {
            const dbVal = rec.code || rec.companyCode || rec.ruleName || rec.name || "";
            return String(dbVal).trim().toLowerCase() === normalizedVal;
          });
        }

        if (existingRecordIndex !== -1) {
          if (updateExisting) {
            records[existingRecordIndex] = {
              ...records[existingRecordIndex],
              ...payload,
              updatedAt: new Date().toISOString()
            };
            updatedCount++;
          }
        } else {
          records.push({
            id: `${entity.substring(0, 3).toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            ...payload,
            isActive: payload.isActive !== undefined ? payload.isActive : true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          importedCount++;
        }
      }

      (db as any)[memoryKey] = records;

      const newLog = {
        id: `LOG-${Date.now()}`,
        userId,
        action: "MASTER_BULK_IMPORT",
        entityType: entity.toUpperCase(),
        entityId: "SYSTEM",
        afterJson: JSON.stringify({
          fileName,
          totalRows: rows.length,
          importedCount,
          updatedCount
        }),
        createdAt: new Date().toISOString(),
        ipAddress: "127.0.0.1",
        userAgent: "API Call"
      };
      db.userActivityLogs = db.userActivityLogs || [];
      db.userActivityLogs.push(newLog);

      writeDb(db);
    }

    return NextResponse.json({
      success: true,
      importedRows: importedCount,
      updatedRows: updatedCount
    });
  } catch (e: any) {
    console.error("Master bulk import error:", e);
    return NextResponse.json({ error: e.message || "Failed to import bulk rows" }, { status: 500 });
  }
}
