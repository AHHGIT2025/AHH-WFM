import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { employeeIdParam: params.id });
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const locations = await mockDb.getEmployeeAllowedPunchLocations(id);
    return NextResponse.json(locations);
  } catch (error: any) {
    console.error("Error fetching employee locations:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (
    !isAdminUser(user) &&
    !hasPermission(user, "employees.edit") &&
    !hasPermission(user, "attendance.manage") &&
    !hasPermission(user, "masters.manage") &&
    !hasPermission(user, "masterdata.manage")
  ) {
    return NextResponse.json(
      { error: "Forbidden: Requires employees.edit or attendance.manage permission" },
      { status: 403 }
    );
  }

  try {
    const { id } = params;
    const body = await request.json();
    
    if (!body.allowedPunchLocationId) {
      return NextResponse.json({ error: "Allowed Punch Location ID is required" }, { status: 400 });
    }

    const newAssignment = await mockDb.createEmployeeAllowedPunchLocation({
      employeeId: id,
      allowedPunchLocationId: body.allowedPunchLocationId,
      validFrom: body.validFrom || null,
      validTo: body.validTo || null,
      priority: body.priority || 1,
      isDefault: body.isDefault || false,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });

    return NextResponse.json(newAssignment, { status: 201 });
  } catch (error: any) {
    console.error("Error assigning location:", error);
    return NextResponse.json({ error: "Failed to assign location" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (
    !isAdminUser(user) &&
    !hasPermission(user, "employees.edit") &&
    !hasPermission(user, "attendance.manage") &&
    !hasPermission(user, "masters.manage") &&
    !hasPermission(user, "masterdata.manage")
  ) {
    return NextResponse.json(
      { error: "Forbidden: Requires employees.edit or attendance.manage permission" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
       return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    await mockDb.deleteEmployeeAllowedPunchLocation(assignmentId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting location assignment:", error);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}
