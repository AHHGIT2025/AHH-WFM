import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";

const entityMap: Record<string, keyof typeof prisma> = {
  companies: "company",
  designations: "designation",
  trades: "tradeClassification",
  locations: "locationMaster",
  "cost-centers": "costCenter",
  projects: "project",
  sites: "projectSite",
  "punch-locations": "allowedPunchLocation",
  "standby-rules": "relieverStandbyRule",
};

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
    let includeClause = undefined;
    if (entity === "sites") includeClause = { project: true, company: true };
    if (entity === "projects") includeClause = { company: true };
    if (entity === "punch-locations") includeClause = { company: true };

    const dbModel: any = prisma[modelName];
    const records = await dbModel.findMany({
      where: whereClause,
      include: includeClause,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(records);
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

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error: any) {
    console.error(`Error creating ${params.entity}:`, error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A unique constraint violation occurred" }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to create ${params.entity}` }, { status: 500 });
  }
}
