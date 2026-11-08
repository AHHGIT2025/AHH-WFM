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
    const date = searchParams.get("date");
    const employeeId = searchParams.get("employeeId");
    const companyId = searchParams.get("companyId");

    if (companyId && !canAccessCompany(user, companyId)) {
      return NextResponse.json({ error: "Forbidden: Cross-company access denied" }, { status: 403 });
    }

    if (user.isSelfServiceOnly && employeeId && employeeId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: Self-service users can only access their own on-call assignments" },
        { status: 403 }
      );
    }

    let whereClause: any = {};
    if (date) {
      // Assuming date is passed as YYYY-MM-DD
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);
      whereClause.assignmentDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }
    if (user.isSelfServiceOnly) {
      whereClause.employeeId = user.id;
    } else if (employeeId) {
      whereClause.employeeId = employeeId;
    }
    if (companyId) {
      whereClause.companyId = companyId;
    }

    const assignments = await prisma.onCallAssignment.findMany({
      where: whereClause,
      include: { 
        employee: true,
        project: true,
        site: true,
        allowedPunchLocation: true
      },
      orderBy: [
        { assignmentDate: "desc" },
        { startTime: "asc" }
      ],
    });

    return NextResponse.json(assignments);
  } catch (error: any) {
    console.error("Error fetching on-call assignments:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (
    !isAdminUser(user) &&
    user.role !== "SUPERVISOR" &&
    !hasPermission(user, "shifts.edit") &&
    !hasPermission(user, "shifts.manage") &&
    !hasPermission(user, "manpower.security.manage") &&
    !hasPermission(user, "manpower.fm.manage")
  ) {
    return NextResponse.json(
      { error: "Forbidden: Requires shift or manpower management permission" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    
    if (!body.companyId || !body.employeeId || !body.assignmentDate || !body.startTime || !body.endTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!canAccessCompany(user, body.companyId)) {
      return NextResponse.json({ error: "Forbidden: Cross-company access denied" }, { status: 403 });
    }

    const newAssignment = await prisma.onCallAssignment.create({
      data: {
        companyId: body.companyId,
        employeeId: body.employeeId,
        projectId: body.projectId || null,
        siteId: body.siteId || null,
        allowedPunchLocationId: body.allowedPunchLocationId || null,
        assignmentDate: new Date(body.assignmentDate),
        startTime: body.startTime,
        endTime: body.endTime,
        status: body.status || "STANDBY",
        description: body.description || null,
        createdById: user.id || body.createdById || "SYSTEM",
      },
      include: {
        employee: true,
        project: true,
        site: true,
      }
    });

    return NextResponse.json(newAssignment, { status: 201 });
  } catch (error: any) {
    console.error("Error creating on-call assignment:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (
    !isAdminUser(user) &&
    user.role !== "SUPERVISOR" &&
    !hasPermission(user, "shifts.edit") &&
    !hasPermission(user, "shifts.manage") &&
    !hasPermission(user, "manpower.security.manage") &&
    !hasPermission(user, "manpower.fm.manage")
  ) {
    return NextResponse.json(
      { error: "Forbidden: Requires shift or manpower management permission" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    if (updateData.companyId && !canAccessCompany(user, updateData.companyId)) {
      return NextResponse.json({ error: "Forbidden: Cross-company access denied" }, { status: 403 });
    }

    const updated = await prisma.onCallAssignment.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating on-call assignment:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}
