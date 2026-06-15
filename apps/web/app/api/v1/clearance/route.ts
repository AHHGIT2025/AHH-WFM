import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clearanceType = searchParams.get("clearanceType");
    const status = searchParams.get("status");
    
    const whereClause: any = {};
    if (clearanceType) whereClause.clearanceType = clearanceType;
    if (status) whereClause.status = status;

    const clearances = await prisma.clearanceRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
          }
        },
        company: {
          select: {
            companyName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ success: true, data: clearances });
  } catch (error: any) {
    console.error("GET /api/v1/clearance error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validate employee
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      include: {
        company: true,
        department: true,
        designation: true,
      }
    });

    if (!employee) {
      return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
    }

    // Generate Clearance Number
    const year = new Date().getFullYear();
    const count = await prisma.clearanceRequest.count();
    const clearanceNumber = `CLR-${year}-${String(count + 1).padStart(4, '0')}`;

    const newClearance = await prisma.clearanceRequest.create({
      data: {
        clearanceNumber,
        formCode: "26-12-2020",
        issueRef: "FM-14-04-02",
        issueDate: "26th DEC, 2020",
        employeeId: employee.id,
        companyId: employee.companyId,
        clearanceType: data.clearanceType,
        separationType: data.separationType,
        typeOfProcess: data.typeOfProcess,
        departureDate: data.departureDate ? new Date(data.departureDate) : null,
        returningDate: data.returningDate ? new Date(data.returningDate) : null,
        lastWorkingDate: data.lastWorkingDate ? new Date(data.lastWorkingDate) : null,
        requestedById: data.requestedById || "system",
        
        // Snapshots
        dateOfJoiningSnapshot: employee.dateOfJoining ? employee.dateOfJoining.toISOString() : null,
        employeeCodeSnapshot: employee.employeeCode,
        employeeNameSnapshot: `${employee.firstName} ${employee.lastName}`,
        designationSnapshot: employee.designation?.name || "N/A",
        workingForSnapshot: employee.company?.companyName || "N/A",
        qidNumberSnapshot: employee.qidNumber,
        qidExpiryDateSnapshot: employee.qidExpiryDate ? employee.qidExpiryDate.toISOString() : null,
        
        status: "DRAFT"
      }
    });
    
    // Create history
    await prisma.clearanceHistory.create({
      data: {
        clearanceRequestId: newClearance.id,
        actorId: data.requestedById || "system",
        actionType: "CREATED",
        details: `Clearance request drafted for ${employee.firstName} ${employee.lastName}`
      }
    });

    return NextResponse.json({ success: true, data: newClearance });
  } catch (error: any) {
    console.error("POST /api/v1/clearance error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
