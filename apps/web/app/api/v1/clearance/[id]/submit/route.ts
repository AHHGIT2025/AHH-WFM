import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { validateClearanceCompanyAndAccess } from "@/lib/clearance-auth";

/**
 * Resolve the assigned approver and fallback role for a clearance section
 * from the central WorkflowTemplate (moduleType: "CLEARANCE").
 * 
 * This enforces the business rule that all workflow routing for Clearance
 * must come exclusively from Settings > Workflow Setup — not from local
 * ClearanceTemplateSection fields.
 * 
 * Resolution order:
 * 1. Central WorkflowTemplate level matching sectionName (exact or step order)
 * 2. Per-submission HR override (data.overrides)
 * 3. Graceful null if no central workflow is configured for CLEARANCE yet
 */
async function resolveClearanceApprover(
  sectionName: string,
  stepOrder: number,
  overrides: any[]
): Promise<{ assignedApproverId: string | null; fallbackRole: string | null }> {
  // 1. Per-submission HR override always wins
  const override = overrides?.find((o: any) => o.sectionName === sectionName);
  if (override?.assignedApproverId) {
    return {
      assignedApproverId: override.assignedApproverId,
      fallbackRole: override.fallbackRole || null
    };
  }

  // 2. Resolve from central WorkflowTemplate (Settings > Workflow Setup)
  const wfTemplates = await mockDb.getWorkflowTemplates("CLEARANCE");
  const activeTemplate = wfTemplates.find(
    (t: any) => t.isActive && (t.appliesTo === "ACTIVATION" || !t.appliesTo)
  );

  if (activeTemplate?.levels) {
    // Match by step order (levelNumber) or by level name matching sectionName
    const level = activeTemplate.levels.find(
      (l: any) => l.levelNumber === stepOrder || l.levelName === sectionName
    );
    if (level?.approvers?.length > 0) {
      const ap = level.approvers[0];
      return {
        assignedApproverId: ap.employeeId || null,
        fallbackRole: ap.roleName || null
      };
    }
  }

  // 3. No central CLEARANCE workflow configured yet — approver unassigned
  return { assignedApproverId: null, fallbackRole: null };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "clearance.edit" });
    if (auth.error) {
      return auth.error;
    }
    const user = auth.session.user;
    const clearanceId = params.id;
    const data = await request.json().catch(() => ({}));
    
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
      include: { approvalSteps: true }
    });

    if (!clearance) {
      return NextResponse.json({ success: false, error: "Clearance not found" }, { status: 404 });
    }

    const accessError = validateClearanceCompanyAndAccess(user, clearance);
    if (accessError) return accessError;

    if (clearance.status !== "DRAFT" && clearance.status !== "RETURNED_FOR_CORRECTION") {
      return NextResponse.json({ success: false, error: "Only DRAFT or RETURNED clearances can be submitted" }, { status: 400 });
    }

    // Process the template if steps aren't generated yet
    if (clearance.approvalSteps.length === 0 && data.templateId) {
      const template = await prisma.clearanceTemplate.findUnique({
        where: { id: data.templateId },
        include: { sections: { orderBy: { stepOrder: "asc" } } }
      });

      if (template) {
        // Create steps — approver routing resolved exclusively from central WorkflowTemplate
        for (const section of template.sections) {
          const override = data.overrides?.find((o: any) => o.sectionName === section.sectionName);
          const isApplicable = override !== undefined ? override.isApplicable : section.isRequiredByDefault;
          const notApplicableReason = override?.notApplicableReason || null;

          // Central workflow resolution (Settings > Workflow Setup is authoritative)
          const { assignedApproverId, fallbackRole } = await resolveClearanceApprover(
            section.sectionName,
            section.stepOrder,
            data.overrides || []
          );

          await prisma.clearanceApprovalStep.create({
            data: {
              clearanceRequestId: clearance.id,
              stepOrder: section.stepOrder,
              sectionName: section.sectionName,
              isApplicable,
              notApplicableReason,
              status: isApplicable ? "PENDING" : "NOT_APPLICABLE",
              assignedApproverId,
              fallbackRole
            }
          });
        }
      }
    }

    const newStatus = "PENDING_EMPLOYEE_SIGNATURE";
    
    await prisma.clearanceRequest.update({
      where: { id: clearanceId },
      data: { status: newStatus }
    });
    
    await prisma.clearanceHistory.create({
      data: {
        clearanceRequestId: clearance.id,
        actorId: user.id || "system",
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
