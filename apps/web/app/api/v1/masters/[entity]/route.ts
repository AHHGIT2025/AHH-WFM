import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { isDbConnected, readDb, writeDb } from "@ahh-wfm/mock-data";

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

  // 3. Remove read-only fields
  if (isUpdate || copy.id === "") {
    delete copy.id;
  }
  delete copy.createdAt;
  delete copy.updatedAt;

  // 4. Map display fields (code/name) to DB specific fields only where needed
  if (entity === "companies") {
    if (copy.code !== undefined && copy.companyCode === undefined) copy.companyCode = copy.code;
    if (copy.name !== undefined && copy.companyName === undefined) copy.companyName = copy.name;
    delete copy.code;
    delete copy.name;
  }
  else if (entity === "locations") {
    if (copy.code !== undefined && copy.locationCode === undefined) copy.locationCode = copy.code;
    if (copy.name !== undefined && copy.locationName === undefined) copy.locationName = copy.name;
    delete copy.code;
    delete copy.name;
  }
  else if (entity === "cost-centers") {
    if (copy.code !== undefined && copy.costCenterCode === undefined) copy.costCenterCode = copy.code;
    if (copy.name !== undefined && copy.costCenterName === undefined) copy.costCenterName = copy.name;
    delete copy.code;
    delete copy.name;
  }
  else if (entity === "projects") {
    if (copy.code !== undefined && copy.projectCode === undefined) copy.projectCode = copy.code;
    if (copy.name !== undefined && copy.projectName === undefined) copy.projectName = copy.name;
    delete copy.code;
    delete copy.name;
  }
  else if (entity === "project-sites") {
    if (copy.code !== undefined && copy.siteCode === undefined) copy.siteCode = copy.code;
    if (copy.name !== undefined && copy.siteName === undefined) copy.siteName = copy.name;
    delete copy.code;
    delete copy.name;
  }
  else if (entity === "departments") {
    delete copy.code;
    const allowed = ["name", "companyId", "isActive"];
    for (const key of Object.keys(copy)) {
      if (!allowed.includes(key)) {
        delete copy[key];
      }
    }
  }
  else if (entity === "allowed-punch-locations") {
    delete copy.code;
  }

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

export async function GET(request: Request, { params }: { params: { entity: string } }) {
  try {
    const { entity } = params;

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");

    if (!isDbConnected()) {
      const memoryKey = memoryKeyMap[entity];
      if (!memoryKey) {
        return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
      }

      const db = readDb();
      let records = (db as any)[memoryKey] || [];

      // Filter by isActive
      if (isActive !== null) {
        const activeBool = isActive === "true";
        records = records.filter((r: any) => r.isActive === activeBool);
      }

      // Populate relations
      records = records.map((r: any) => {
        const record = { ...r };
        if (record.companyId && !record.company) {
          record.company = db.companies.find((c: any) => c.id === record.companyId);
        }
        if (record.projectId && !record.project) {
          record.project = db.projects.find((p: any) => p.id === record.projectId);
        }
        return record;
      });

      const normalized = records.map((r: any) => normalizeRecord(entity, r));
      return NextResponse.json(normalized);
    }

    const modelName = entityMap[entity];
    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    let whereClause = {};
    if (isActive !== null) {
      whereClause = { isActive: isActive === "true" };
    }

    // Include relations based on entity
    let includeClause: any = undefined;
    if (entity === "project-sites") includeClause = { project: true, company: true };
    else if (entity === "projects") includeClause = { company: true };
    else if (entity === "allowed-punch-locations") includeClause = { company: true };
    else if (entity === "departments") includeClause = { company: true };
    else if (entity === "locations") includeClause = { company: true };
    else if (entity === "cost-centers") includeClause = { company: true };

    const dbModel: any = prisma[modelName];
    const records = await dbModel.findMany({
      where: whereClause,
      include: includeClause,
      orderBy: { createdAt: "desc" },
    });

    const normalized = records.map((r: any) => normalizeRecord(entity, r));
    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error(`Error fetching ${params.entity}:`, error);
    return NextResponse.json({ error: `Failed to fetch ${params.entity}` }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { entity: string } }) {
  let body: any = {};
  let normalizedBody: any = {};
  const { entity } = params;

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

    // Normalize payload
    normalizedBody = normalizeMasterPayload(entity, body, false);

    // Validate companyId requirements dynamically if needed
    const requiredCompanyEntities = ["allowed-punch-locations"];
    if (requiredCompanyEntities.includes(entity) && !normalizedBody.companyId) {
      return NextResponse.json({ error: "Company is required" }, { status: 400 });
    }

    // 2. Perform case-insensitive duplicate checks for code fields
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
          where: { [codeField]: codeValue }
        });
        if (existing) {
          return NextResponse.json({ error: `${entity.substring(0, entity.length - 1)} code already exists` }, { status: 409 });
        }
      } else {
        const db = readDb();
        const memoryKey = memoryKeyMap[entity];
        const records = (db as any)[memoryKey] || [];
        const existing = records.find((r: any) => String(r[codeField]).toLowerCase() === String(codeValue).toLowerCase());
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
      if (entity === "leave-types") {
        const existing = db.leaveTypes?.find((t: any) => t.code.toLowerCase() === normalizedBody.code.trim().toLowerCase());
        if (existing) {
          return NextResponse.json({ error: "Leave type code must be unique" }, { status: 409 });
        }
      }

      // Verify company exists if provided in mock mode
      if (normalizedBody.companyId) {
        const company = db.companies.find((c: any) => c.id === normalizedBody.companyId);
        if (!company) {
          return NextResponse.json({ error: "Invalid company selected" }, { status: 400 });
        }
      }

      const newRecord = {
        id: body.id || `${entity.substring(0, 3).toUpperCase()}-${Date.now()}`,
        ...normalizedBody,
        isActive: normalizedBody.isActive !== undefined ? normalizedBody.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!(db as any)[memoryKey]) {
        (db as any)[memoryKey] = [];
      }
      (db as any)[memoryKey].push(newRecord);
      writeDb(db);

      // Populate relation for normalization if present
      const populatedRecord = { ...newRecord };
      if (populatedRecord.companyId) {
        populatedRecord.company = db.companies.find((c: any) => c.id === populatedRecord.companyId);
      }
      if (populatedRecord.projectId) {
        populatedRecord.project = db.projects.find((p: any) => p.id === populatedRecord.projectId);
      }

      return NextResponse.json(normalizeRecord(entity, populatedRecord), { status: 201 });
    }

    // Verify company exists if provided in DB mode
    if (normalizedBody.companyId) {
      const company = await prisma.company.findUnique({ where: { id: normalizedBody.companyId } });
      if (!company) {
        return NextResponse.json({ error: "Invalid company selected" }, { status: 400 });
      }
    }

    const dbModel: any = prisma[modelName];
    const newRecord = await dbModel.create({
      data: normalizedBody,
    });

    // Populate company/project relation if needed for UI list displays
    let populatedRecord = { ...newRecord };
    if (populatedRecord.companyId) {
      populatedRecord.company = await prisma.company.findUnique({ where: { id: populatedRecord.companyId } });
    }
    if (entity === "project-sites" && populatedRecord.projectId) {
      populatedRecord.project = await prisma.project.findUnique({ where: { id: populatedRecord.projectId } });
    }

    return NextResponse.json(normalizeRecord(entity, populatedRecord), { status: 201 });
  } catch (error: any) {
    console.error(`[API ERROR] Failed to create ${entity}:`, {
      entity,
      action: "create",
      incomingPayload: body,
      normalizedPayload: normalizedBody,
      prismaData: normalizedBody,
      errorCode: error.code || undefined,
      errorMessage: error.message,
    });

    if (error.code === "P2002") {
      return NextResponse.json({ error: `${entity.substring(0, entity.length - 1)} code already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: `Failed to create ${entity}: ${error.message}` }, { status: 500 });
  }
}
