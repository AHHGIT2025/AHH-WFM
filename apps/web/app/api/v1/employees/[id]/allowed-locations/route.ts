import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const locations = await prisma.employeeAllowedPunchLocation.findMany({
      where: { employeeId: id },
      include: { allowedPunchLocation: true },
      orderBy: { priority: "asc" },
    });

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

    // if isDefault is true, unset other defaults
    if (body.isDefault) {
      await prisma.employeeAllowedPunchLocation.updateMany({
        where: { employeeId: id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const newAssignment = await prisma.employeeAllowedPunchLocation.create({
      data: {
        employeeId: id,
        allowedPunchLocationId: body.allowedPunchLocationId,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validTo: body.validTo ? new Date(body.validTo) : null,
        priority: body.priority || 1,
        isDefault: body.isDefault || false,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
      include: { allowedPunchLocation: true },
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

    await prisma.employeeAllowedPunchLocation.delete({
      where: { id: assignmentId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting location assignment:", error);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}
