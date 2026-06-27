import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clearanceId = params.id;
    const data = await request.json(); // May contain overrides for applicability and approvers
    
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
      include: { approvalSteps: true }
    });

    if (!clearance) {
      return NextResponse.json({ success: false, error: "Clearance not found" }, { status: 404 });
    }

    if (clearance.status !== "DRAFT") {
      return NextResponse.json({ success: false, error: "Only DRAFT clearances can be submitted" }, { status: 400 });
    }

    // Process the template if steps aren't generated yet
    if (clearance.approvalSteps.length === 0 && data.templateId) {
      const template = await prisma.clearanceTemplate.findUnique({
        where: { id: data.templateId },
        include: { sections: true }
      });

      if (template) {
        // Create steps based on template
        for (const section of template.sections) {
          // Check overrides from UI
          const override = data.overrides?.find((o: any) => o.sectionName === section.sectionName);
          const isApplicable = override !== undefined ? override.isApplicable : section.isRequiredByDefault;
          const assignedApproverId = override?.assignedApproverId || section.defaultApproverId;
          const notApplicableReason = override?.notApplicableReason || null;

          await prisma.clearanceApprovalStep.create({
            data: {
              clearanceRequestId: clearance.id,
              stepOrder: section.stepOrder,
              sectionName: section.sectionName,
              isApplicable,
              notApplicableReason,
              status: isApplicable ? "PENDING" : "NOT_APPLICABLE",
              assignedApproverId,
              fallbackRole: section.defaultApproverRole
            }
          });
        }
      }
    }

    // Update status to PENDING_EMPLOYEE_SIGNATURE or directly to PENDING_APPROVAL
    const newStatus = "PENDING_EMPLOYEE_SIGNATURE"; // According to rules, employee signs first
    
    await prisma.clearanceRequest.update({
      where: { id: clearanceId },
      data: { status: newStatus }
    });
    
    await prisma.clearanceHistory.create({
      data: {
        clearanceRequestId: clearance.id,
        actorId: data.actorId || "system",
        actionType: "SUBMITTED",
        details: "Clearance request submitted and waiting for employee signature."
      }
    });

    return NextResponse.json({ success: true, message: "Clearance submitted successfully" });
  } catch (error: any) {
    console.error("POST /api/v1/clearance/[id]/submit error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
