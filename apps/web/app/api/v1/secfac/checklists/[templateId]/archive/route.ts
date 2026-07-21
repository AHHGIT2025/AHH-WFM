import { NextResponse } from "next/server";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import { auditSecfacDeleteAction } from "@/lib/secfac-delete-audit-service";

export async function POST(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "secfac.checklists.edit" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const templateId = params.templateId;

  try {
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "Archived via Control Room UI";

    const template = await mockDb.getSecfacChecklistById(templateId);
    if (!template) {
      return NextResponse.json({ success: false, error: "Checklist template not found" }, { status: 404 });
    }

    const opType = template.operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";

    if (!isAdmin) {
      if (opType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: Scope access denied for Security Guarding" }, { status: 403 });
      }
      if (opType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: Scope access denied for Facility Management" }, { status: 403 });
      }
    }

    let result;
    if (isDbConnected()) {
      result = await prisma.secfacChecklistTemplate.update({
        where: { id: templateId },
        data: { isActive: false }
      });
    } else {
      result = await mockDb.updateSecfacChecklist(templateId, { isActive: false });
    }

    await auditSecfacDeleteAction({
      entityType: "CHECKLIST_TEMPLATE",
      entityId: templateId,
      actionType: "ARCHIVE",
      userId: user.id,
      userRole: user.role,
      userEmail: user.email,
      permission: "secfac.checklists.edit",
      operationType: opType,
      siteId: template.siteId,
      reason,
      resultStatus: "SUCCESS",
      resultMessage: "Checklist template archived (isActive = false)"
    });

    return NextResponse.json({ success: true, data: result, message: "Checklist template archived successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to archive checklist template", error: error.message }, { status: 500 });
  }
}
