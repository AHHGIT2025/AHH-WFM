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
};

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
  try {
    const { entity } = params;
    const body = await request.json();

    if (!isDbConnected()) {
      const memoryKey = memoryKeyMap[entity];
      if (!memoryKey) {
        return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
      }

      const db = readDb();
      const newRecord = {
        id: body.id || `${entity.substring(0, 3).toUpperCase()}-${Date.now()}`,
        ...body,
        isActive: body.isActive !== undefined ? body.isActive : true,
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

    const modelName = entityMap[entity];
    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    const dbModel: any = prisma[modelName];
    const newRecord = await dbModel.create({
      data: body,
    });

    return NextResponse.json(normalizeRecord(entity, newRecord), { status: 201 });
  } catch (error: any) {
    console.error(`Error creating ${params.entity}:`, error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A unique constraint violation occurred" }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to create ${params.entity}` }, { status: 500 });
  }
}
