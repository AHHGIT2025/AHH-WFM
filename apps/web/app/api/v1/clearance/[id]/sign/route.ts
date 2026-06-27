import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clearanceId = params.id;
    const data = await request.json(); // { signatureName: "...", signatureData?: "..." }
    
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
    });

    if (!clearance) {
      return NextResponse.json({ success: false, error: "Clearance not found" }, { status: 404 });
    }

    if (clearance.status !== "PENDING_EMPLOYEE_SIGNATURE") {
      return NextResponse.json({ success: false, error: "Clearance is not waiting for employee signature" }, { status: 400 });
    }

    await prisma.clearanceRequest.update({
      where: { id: clearanceId },
      data: { 
        employeeSignedAt: new Date(),
        employeeSignatureName: data.signatureName,
        employeeSignatureData: data.signatureData,
        status: "IN_PROGRESS" // Moves to department approvals
      }
    });
    
    await prisma.clearanceHistory.create({
      data: {
        clearanceRequestId: clearance.id,
        actorId: clearance.employeeId, // Typically the employee
        actionType: "SIGNED",
        details: "Employee has signed the clearance declaration."
      }
    });

    return NextResponse.json({ success: true, message: "Clearance signed successfully" });
  } catch (error: any) {
    console.error("POST /api/v1/clearance/[id]/sign error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
