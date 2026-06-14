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

export async function GET(request: Request, { params }: { params: { entity: string; id: string } }) {
  try {
    const { entity, id } = params;
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

    return NextResponse.json(record);
  } catch (error: any) {
    console.error(`Error fetching ${params.entity}:`, error);
    return NextResponse.json({ error: `Failed to fetch ${params.entity}` }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { entity: string; id: string } }) {
  try {
    const { entity, id } = params;
    const modelName = entityMap[entity];

    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    const body = await request.json();

    const dbModel: any = prisma[modelName];
    const updatedRecord = await dbModel.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(updatedRecord);
  } catch (error: any) {
    console.error(`Error updating ${params.entity}:`, error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    return NextResponse.json({ error: `Failed to update ${params.entity}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { entity: string; id: string } }) {
  try {
    const { entity, id } = params;
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
