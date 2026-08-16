import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { validateClearanceCompanyAndAccess, validateClearanceApproverSoD } from "@/lib/clearance-auth";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "clearance.approve" });
    if (auth.error) {
      return auth.error;
    }
    const user = auth.session.user;
    const clearanceId = params.id;
    const data = await request.json(); 
    
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
      include: { approvalSteps: true }
    });

    if (!clearance) {
      return NextResponse.json({ success: false, error: "Clearance not found" }, { status: 404 });
    }

    const accessError = validateClearanceCompanyAndAccess(user, clearance);
    if (accessError) return accessError;

    const step = await prisma.clearanceApprovalStep.findUnique({
      where: { id: data.stepId }
    });

    if (!step || step.clearanceRequestId !== clearanceId) {
      return NextResponse.json({ success: false, error: "Invalid approval step" }, { status: 400 });
    }

    const sodError = validateClearanceApproverSoD(user, clearance, step);
    if (sodError) return sodError;

    // Update step
    await prisma.clearanceApprovalStep.update({
      where: { id: step.id },
      data: { 
        status: "APPROVED",
        notes: data.notes || step.notes,
        remarks: data.remarks || step.remarks,
        signatureName: data.signatureName,
        signatureDate: new Date(),
        actedAt: new Date(),
        actedById: user.id
      }
    });

    // Record response
    await prisma.clearanceApprovalResponse.create({
      data: {
        stepId: step.id,
        actionType: "APPROVE",
        actorId: user.id || "system",
        remarks: data.remarks
      }
    });
    
    // Log history
    await prisma.clearanceHistory.create({
      data: {
        clearanceRequestId: clearance.id,
        actorId: user.id || "system",
        actionType: "APPROVE",
        details: `Step ${step.sectionName} was APPROVED.`
      }
    });

    const allSteps = await prisma.clearanceApprovalStep.findMany({
      where: { clearanceRequestId: clearanceId }
    });
    
    const allDone = allSteps.every(s => s.status === "APPROVED" || s.status === "NOT_APPLICABLE" || s.status === "SKIPPED");
    
    if (allDone) {
      await prisma.clearanceRequest.update({
        where: { id: clearanceId },
        data: { 
          status: "COMPLETED",
          finalApprovedAt: new Date(),
          completedAt: new Date()
        }
      });
    }

    return NextResponse.json({ success: true, message: "Action recorded successfully" });
  } catch (error: any) {
    console.error("POST /api/v1/clearance/[id]/approve error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
