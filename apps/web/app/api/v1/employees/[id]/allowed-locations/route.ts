import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET(request: Request, { params }: { params: { id: string } }) {
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
