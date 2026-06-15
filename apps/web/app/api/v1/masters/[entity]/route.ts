import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";

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
    const modelName = entityMap[entity];

    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");

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
    const modelName = entityMap[entity];

    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    const body = await request.json();

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
