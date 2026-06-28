import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { isDbConnected, readDb, writeDb, mockDb } from "@ahh-wfm/mock-data";

const entityMap: Record<string, keyof typeof prisma> = {
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

const entityWhitelists: Record<string, string[]> = {
  companies: ["companyCode", "companyName", "isActive"],
  departments: ["name", "companyId"],
  designations: ["code", "name", "description", "employeeCategory", "isSupervisorPosition", "isRelieverEligible", "isActive"],
  "trade-classifications": ["code", "name", "description", "linkedDesignationId", "isActive"],
  locations: ["companyId", "locationCode", "locationName", "address", "latitude", "longitude", "defaultGeofenceRadiusMeters", "isActive"],
  "cost-centers": ["companyId", "costCenterCode", "costCenterName", "description", "sapCostCenterCode", "isActive"],
  projects: ["companyId", "projectCode", "projectName", "projectType", "locationId", "costCenter", "isOnCallProject", "clientName", "clientCode", "contractNumber", "sapProjectCode", "sapCostCenterCode", "startDate", "endDate", "status"],
  "project-sites": ["companyId", "projectId", "siteCode", "siteName", "address", "latitude", "longitude", "geofenceRadiusMeters", "isActive"],
  "allowed-punch-locations": ["companyId", "name", "locationType", "latitude", "longitude", "radiusMeters", "isActive"],
  "standby-rules": ["ruleName", "designationId", "tradeClassificationId", "standbyRequired", "relieverRequiredForLeave", "relieverRequiredForOff", "isActive"],
  "leave-types": ["code", "name", "description", "isPaid", "requiresDocument", "workflowCode", "defaultAnnualAllocation", "maxDaysPerRequest", "allowHalfDay", "allowCarryForward", "carryForwardLimit", "genderRestriction", "applicableAfterProbation", "isActive"]
};

function normalizeMasterPayload(entity: string, payload: any, isUpdate = false) {
  if (!payload) return payload;
  const copy = { ...payload };

  // 1. Convert empty relation IDs from "" to null
  const relationIdFields = [
    "companyId",
    "departmentId",
    "costCenterId",
    "projectId",
    "siteId",
    "locationId"
  ];
  for (const field of relationIdFields) {
    if (copy[field] === "") {
      copy[field] = null;
    }
  }

  // 2. Remove nested relation objects and arrays (any field that is an object/array except null)
  for (const key of Object.keys(copy)) {
    const val = copy[key];
    if (val !== null && typeof val === "object") {
      // For projects, costCenter is a required string, not an object relation.
      if (key === "costCenter" && entity === "projects") {
        continue;
      }
      delete copy[key];
    }
  }

  // 3. Map display fields (code/name/type) to DB specific fields only where needed
  if (entity === "companies") {
    if (copy.code !== undefined && copy.companyCode === undefined) copy.companyCode = copy.code;
    if (copy.name !== undefined && copy.companyName === undefined) copy.companyName = copy.name;
  }
  else if (entity === "locations") {
    if (copy.code !== undefined && copy.locationCode === undefined) copy.locationCode = copy.code;
    if (copy.name !== undefined && copy.locationName === undefined) copy.locationName = copy.name;
  }
  else if (entity === "cost-centers") {
    if (copy.code !== undefined && copy.costCenterCode === undefined) copy.costCenterCode = copy.code;
    if (copy.name !== undefined && copy.costCenterName === undefined) copy.costCenterName = copy.name;
  }
  else if (entity === "projects") {
    if (copy.code !== undefined && copy.projectCode === undefined) copy.projectCode = copy.code;
    if (copy.name !== undefined && copy.projectName === undefined) copy.projectName = copy.name;
    if (copy.type !== undefined && copy.projectType === undefined) copy.projectType = copy.type;

    if (copy.costCenter === undefined || copy.costCenter === null) {
      copy.costCenter = "";
    }
    // Map isActive to status for projects
    if (copy.isActive !== undefined) {
      copy.status = copy.isActive ? "ACTIVE" : "INACTIVE";
    }
    if (!copy.status) {
      copy.status = "ACTIVE";
    }
  }
  else if (entity === "project-sites") {
    if (copy.code !== undefined && copy.siteCode === undefined) copy.siteCode = copy.code;
    if (copy.name !== undefined && copy.siteName === undefined) copy.siteName = copy.name;
  }

  // 4. Filter copy payload using whitelist to prevent database unknown field errors
  const whitelist = entityWhitelists[entity];
  if (whitelist) {
    for (const key of Object.keys(copy)) {
      if (!whitelist.includes(key)) {
        console.log(`[normalizeMasterPayload] Stripping unsupported field "${key}" for entity "${entity}"`);
        delete copy[key];
      }
    }
  }

  // 5. Remove read-only fields
  if (isUpdate || copy.id === "") {
    delete copy.id;
  }
  delete copy.createdAt;
  delete copy.updatedAt;

  return copy;
}

function normalizeRecord(entity: string, record: any) {
  if (!record) return record;
  const copy = { ...record };

  // Normalize Company
  if (entity === "companies") {
    copy.code = record.companyCode;
    copy.name = record.companyName;
  }
  // Normalize Department
  if (entity === "departments") {
    copy.code = "";
  }
  // Normalize Cost Center
  if (entity === "cost-centers") {
    copy.code = record.costCenterCode;
    copy.name = record.costCenterName;
  }
  // Normalize Location
  if (entity === "locations") {
    copy.code = record.locationCode;
    copy.name = record.locationName;
  }
  // Normalize Project
  if (entity === "projects") {
    copy.code = record.projectCode;
    copy.name = record.projectName;
  }
  // Normalize Project Site
  if (entity === "project-sites") {
    copy.code = record.siteCode;
    copy.name = record.siteName;
  }

  // Normalize nested company relation
  if (copy.company) {
    copy.company = {
      ...copy.company,
      code: copy.company.companyCode,
      name: copy.company.companyName
    };
  }
  // Normalize nested project relation
  if (copy.project) {
    copy.project = {
      ...copy.project,
      code: copy.project.projectCode,
      name: copy.project.projectName
    };
  }

  return copy;
}

export async function GET(request: Request, { params }: { params: { entity: string; id: string } }) {
  try {
    const { entity, id } = params;

    if (!isDbConnected()) {
      const memoryKey = memoryKeyMap[entity];
      if (!memoryKey) {
        return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
      }

      const db = readDb();
      const records = (db as any)[memoryKey] || [];
      const record = records.find((r: any) => r.id === id);

      if (!record) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      // Populate relations
      const populatedRecord = { ...record };
      if (populatedRecord.companyId && !populatedRecord.company) {
        populatedRecord.company = db.companies.find((c: any) => c.id === populatedRecord.companyId);
      }
      if (populatedRecord.projectId && !populatedRecord.project) {
        populatedRecord.project = db.projects.find((p: any) => p.id === populatedRecord.projectId);
      }

      return NextResponse.json(normalizeRecord(entity, populatedRecord));
    }

    const modelName = entityMap[entity];
    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    const dbModel: any = prisma[modelName];
    const record = await dbModel.findUnique({
      where: { id },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json(normalizeRecord(entity, record));
  } catch (error: any) {
    console.error(`Error fetching ${params.entity}:`, error);
    return NextResponse.json({ error: `Failed to fetch ${params.entity}` }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { entity: string; id: string } }) {
  let body: any = {};
  let normalizedBody: any = {};
  const { entity, id } = params;

  try {
    body = await request.json();

    if (entity === "projects" && body.costCenter === undefined) {
      body.costCenter = "";
    }

    // 1. Perform validation of required fields
    if (entity === "projects") {
      if (!body.companyId) {
        return NextResponse.json({ error: "Company is required" }, { status: 400 });
      }
      if (!body.projectCode || body.projectCode.trim() === "") {
        return NextResponse.json({ error: "Project Code is required" }, { status: 400 });
      }
      if (!body.projectName || body.projectName.trim() === "") {
        return NextResponse.json({ error: "Project Name is required" }, { status: 400 });
      }
      if (!body.locationId) {
        return NextResponse.json({ error: "Location is required" }, { status: 400 });
      }
    }
    else if (entity === "designations") {
      if (!body.code || body.code.trim() === "") {
        return NextResponse.json({ error: "Designation Code is required" }, { status: 400 });
      }
      if (!body.name || body.name.trim() === "") {
        return NextResponse.json({ error: "Designation Title is required" }, { status: 400 });
      }
    }
    else if (entity === "trade-classifications") {
      if (!body.code || body.code.trim() === "") {
        return NextResponse.json({ error: "Trade Code is required" }, { status: 400 });
      }
      if (!body.name || body.name.trim() === "") {
        return NextResponse.json({ error: "Trade Name is required" }, { status: 400 });
      }
    }
    else if (entity === "cost-centers") {
      if (!body.companyId) {
        return NextResponse.json({ error: "Company is required" }, { status: 400 });
      }
      if (!body.costCenterCode || body.costCenterCode.trim() === "") {
        return NextResponse.json({ error: "Cost Center Code is required" }, { status: 400 });
      }
      if (!body.costCenterName || body.costCenterName.trim() === "") {
        return NextResponse.json({ error: "Cost Center Name is required" }, { status: 400 });
      }
    }
    else if (entity === "leave-types") {
      if (!body.code || body.code.trim() === "") {
        return NextResponse.json({ error: "Leave type code is required" }, { status: 400 });
      }
      if (!body.name || body.name.trim() === "") {
        return NextResponse.json({ error: "Leave type name is required" }, { status: 400 });
      }
    }

    if (entity === "leave-types") {
      try {
        const updated = await mockDb.updateLeaveType(id, body);
        return NextResponse.json(normalizeRecord(entity, updated));
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to update leave type" }, { status: 400 });
      }
    }

    // Normalize payload
    normalizedBody = normalizeMasterPayload(entity, body, true);

    // Validate companyId requirements dynamically if needed
    const requiredCompanyEntities = ["allowed-punch-locations"];
    if (requiredCompanyEntities.includes(entity) && !normalizedBody.companyId) {
      return NextResponse.json({ error: "Company is required" }, { status: 400 });
    }

    // 2. Perform case-insensitive duplicate checks for code fields (excluding self)
    const codeFields: Record<string, string> = {
      companies: "companyCode",
      designations: "code",
      "trade-classifications": "code",
      locations: "locationCode",
      "cost-centers": "costCenterCode",
      projects: "projectCode",
      "project-sites": "siteCode",
      "leave-types": "code",
    };

    const codeField = codeFields[entity];
    const modelName = entityMap[entity];
    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    if (codeField && normalizedBody[codeField]) {
      const codeValue = normalizedBody[codeField];
      if (isDbConnected()) {
        const dbModel: any = prisma[modelName];
        const existing = await dbModel.findFirst({
          where: {
            [codeField]: codeValue,
            id: { not: id } // Exclude self
          }
        });
        if (existing) {
          return NextResponse.json({ error: `${entity.substring(0, entity.length - 1)} code already exists` }, { status: 409 });
        }
      } else {
        const db = readDb();
        const memoryKey = memoryKeyMap[entity];
        const records = (db as any)[memoryKey] || [];
        const existing = records.find((r: any) => r.id !== id && String(r[codeField]).toLowerCase() === String(codeValue).toLowerCase());
        if (existing) {
          return NextResponse.json({ error: `${entity.substring(0, entity.length - 1)} code already exists` }, { status: 409 });
        }
      }
    }

    if (!isDbConnected()) {
      const memoryKey = memoryKeyMap[entity];
      if (!memoryKey) {
        return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
      }

      const db = readDb();
      const records = (db as any)[memoryKey] || [];
      const index = records.findIndex((r: any) => r.id === id);

      if (index === -1) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      // Verify company exists if provided in mock mode
      if (normalizedBody.companyId) {
        const company = db.companies.find((c: any) => c.id === normalizedBody.companyId);
        if (!company) {
          return NextResponse.json({ error: "Invalid company selected" }, { status: 400 });
        }
      }

      const updatedRecord = {
        ...records[index],
        ...normalizedBody,
        updatedAt: new Date().toISOString(),
      };

      records[index] = updatedRecord;
      writeDb(db);

      // Populate relations
      const populatedRecord = { ...updatedRecord };
      if (populatedRecord.companyId) {
        populatedRecord.company = db.companies.find((c: any) => c.id === populatedRecord.companyId);
      }
      if (populatedRecord.projectId) {
        populatedRecord.project = db.projects.find((p: any) => p.id === populatedRecord.projectId);
      }

      return NextResponse.json(normalizeRecord(entity, populatedRecord));
    }

    // Verify company exists if provided in DB mode
    if (normalizedBody.companyId) {
      const company = await prisma.company.findUnique({ where: { id: normalizedBody.companyId } });
      if (!company) {
        return NextResponse.json({ error: "Invalid company selected" }, { status: 400 });
      }
    }

    const dbModel: any = prisma[modelName];
    const updatedRecord = await dbModel.update({
      where: { id },
      data: normalizedBody,
    });

    // Populate company/project relation if needed for UI list displays
    let populatedRecord = { ...updatedRecord };
    if (populatedRecord.companyId) {
      populatedRecord.company = await prisma.company.findUnique({ where: { id: populatedRecord.companyId } });
    }
    if (entity === "project-sites" && populatedRecord.projectId) {
      populatedRecord.project = await prisma.project.findUnique({ where: { id: populatedRecord.projectId } });
    }

    return NextResponse.json(normalizeRecord(entity, populatedRecord));
  } catch (error: any) {
    console.error(`[API ERROR] Failed to update ${entity}:`, {
      entity,
      action: "update",
      incomingPayload: body,
      normalizedPayload: normalizedBody,
      prismaData: normalizedBody,
      errorCode: error.code || undefined,
      errorMessage: error.message,
    });

    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: `${entity.substring(0, entity.length - 1)} code already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: `Failed to update ${entity}: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { entity: string; id: string } }) {
  try {
    const { entity, id } = params;

    if (entity === "leave-types") {
      try {
        const result = await mockDb.deleteLeaveType(id);
        return NextResponse.json({ success: true, softDeleted: result.softDeleted });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to delete leave type" }, { status: 400 });
      }
    }

    if (!isDbConnected()) {
      const memoryKey = memoryKeyMap[entity];
      if (!memoryKey) {
        return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
      }

      const db = readDb();
      const records = (db as any)[memoryKey] || [];
      const index = records.findIndex((r: any) => r.id === id);

      if (index === -1) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      records.splice(index, 1);
      writeDb(db);

      return NextResponse.json({ success: true });
    }

    const modelName = entityMap[entity];
    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    const dbModel: any = prisma[modelName];
    await dbModel.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`Error deleting ${params.entity}:`, error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    // Handle foreign key constraint failures
    if (error.code === "P2003") {
      return NextResponse.json({ error: "Cannot delete record because it is referenced by other records." }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to delete ${params.entity}` }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: { entity: string; id: string } }) {
  return PUT(request, context);
}
