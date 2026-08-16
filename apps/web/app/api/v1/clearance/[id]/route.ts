import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { validateClearanceCompanyAndAccess } from "@/lib/clearance-auth";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "clearance.view" });
    if (auth.error) {
      return auth.error;
    }
    const user = auth.session.user;
    const clearanceId = params.id;
    
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
      include: {
        employee: {
          include: {
            departmentRef: true,
            designation: true,
            company: true
          }
        },
        approvalSteps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            assignedApprover: {
              select: {
                name: true,
                id: true
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

    const accessError = validateClearanceCompanyAndAccess(user, clearance);
    if (accessError) return accessError;
    
    return NextResponse.json({ success: true, data: clearance });
  } catch (error: any) {
    console.error("GET /api/v1/clearance/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "clearance.edit" });
    if (auth.error) {
      return auth.error;
    }
    const user = auth.session.user;
    const clearanceId = params.id;
    const data = await request.json();

    const existingClearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId }
    });

    if (!existingClearance) {
      return NextResponse.json({ success: false, error: "Clearance not found" }, { status: 404 });
    }

    const accessError = validateClearanceCompanyAndAccess(user, existingClearance);
    if (accessError) return accessError;
    
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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "clearance.manage" });
    if (auth.error) {
      return auth.error;
    }
    const user = auth.session.user;
    const clearanceId = params.id;

    const existingClearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId }
    });

    if (!existingClearance) {
      return NextResponse.json({ success: false, error: "Clearance not found" }, { status: 404 });
    }

    const accessError = validateClearanceCompanyAndAccess(user, existingClearance);
    if (accessError) return accessError;

    await prisma.clearanceRequest.delete({
      where: { id: clearanceId }
    });

    return NextResponse.json({ success: true, message: "Clearance request deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/v1/clearance/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
