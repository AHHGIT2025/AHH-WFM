import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clearanceId = params.id;
    
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
            company: true
          }
        },
        approvalSteps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            assignedApprover: {
              select: {
                firstName: true,
                lastName: true,
                employeeCode: true
              }
            },
            responses: {
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        history: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!clearance) {
      return NextResponse.json({ success: false, error: "Clearance not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: clearance });
  } catch (error: any) {
    console.error("GET /api/v1/clearance/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clearanceId = params.id;
    const data = await request.json();
    
    const clearance = await prisma.clearanceRequest.update({
      where: { id: clearanceId },
      data: {
        clearanceType: data.clearanceType,
        separationType: data.separationType,
        typeOfProcess: data.typeOfProcess,
        departureDate: data.departureDate ? new Date(data.departureDate) : undefined,
        returningDate: data.returningDate ? new Date(data.returningDate) : undefined,
        lastWorkingDate: data.lastWorkingDate ? new Date(data.lastWorkingDate) : undefined,
        employeeRemarks: data.employeeRemarks
      }
    });
    
    return NextResponse.json({ success: true, data: clearance });
  } catch (error: any) {
    console.error("PATCH /api/v1/clearance/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
