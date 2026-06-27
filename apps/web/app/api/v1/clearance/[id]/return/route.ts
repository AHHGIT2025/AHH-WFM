import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clearanceId = params.id;
    const data = await request.json(); 
    
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
      include: { approvalSteps: true }
    });

    if (!clearance) {
      return NextResponse.json({ success: false, error: "Clearance not found" }, { status: 404 });
    }

    const step = await prisma.clearanceApprovalStep.findUnique({
      where: { id: data.stepId }
    });

    if (!step || step.clearanceRequestId !== clearanceId) {
      return NextResponse.json({ success: false, error: "Invalid approval step" }, { status: 400 });
    }

    // Update step
    await prisma.clearanceApprovalStep.update({
      where: { id: step.id },
      data: { 
        status: "RETURNED",
        notes: data.notes || step.notes,
        remarks: data.remarks || step.remarks,
        signatureName: data.signatureName,
        signatureDate: new Date(),
        actedAt: new Date(),
        actedById: data.actorId
      }
    });

    // Record response
    await prisma.clearanceApprovalResponse.create({
      data: {
        stepId: step.id,
        actionType: "RETURN",
        actorId: data.actorId || "system",
        remarks: data.remarks
      }
    });
    
    // Log history
    await prisma.clearanceHistory.create({
      data: {
        clearanceRequestId: clearance.id,
        actorId: data.actorId || "system",
        actionType: "RETURN",
        details: `Step ${step.sectionName} was RETURNED.`
      }
    });

    
        await prisma.clearanceRequest.update({
            where: { id: clearanceId },
            data: { status: "RETURNED_FOR_CORRECTION" }
        });
    

    return NextResponse.json({ success: true, message: "Action recorded successfully" });
  } catch (error: any) {
    console.error("POST /api/v1/clearance/[id]/return error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
