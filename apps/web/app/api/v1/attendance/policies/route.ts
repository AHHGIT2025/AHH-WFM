import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    let whereClause = {};
    if (companyId) {
      whereClause = { companyId };
    }

    const policies = await prisma.companyAttendancePolicy.findMany({
      where: whereClause,
      include: { company: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(policies);
  } catch (error: any) {
    console.error("Error fetching attendance policies:", error);
    return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.companyId || !body.policyName) {
      return NextResponse.json({ error: "Company ID and Policy Name are required" }, { status: 400 });
    }

    const newPolicy = await prisma.companyAttendancePolicy.create({
      data: body,
    });

    return NextResponse.json(newPolicy, { status: 201 });
  } catch (error: any) {
    console.error("Error creating policy:", error);
    return NextResponse.json({ error: "Failed to create policy" }, { status: 500 });
  }
}
