import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth, canAccessCompany } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (companyId && !canAccessCompany(user, companyId)) {
      return NextResponse.json({ error: "Forbidden: Cross-company access denied" }, { status: 403 });
    }

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
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (
    !isAdminUser(user) &&
    !hasPermission(user, "attendance.manage") &&
    !hasPermission(user, "attendance.edit") &&
    !hasPermission(user, "settings.manage")
  ) {
    return NextResponse.json(
      { error: "Forbidden: Requires attendance.manage or settings.manage permission" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    
    if (!body.companyId || !body.policyName) {
      return NextResponse.json({ error: "Company ID and Policy Name are required" }, { status: 400 });
    }

    if (!canAccessCompany(user, body.companyId)) {
      return NextResponse.json({ error: "Forbidden: Cross-company access denied" }, { status: 403 });
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
