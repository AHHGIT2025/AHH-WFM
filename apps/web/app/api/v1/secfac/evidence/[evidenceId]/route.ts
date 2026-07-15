import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";

interface RouteParams {
  params: {
    evidenceId: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const { evidenceId } = params;

  try {
    const attachment = await mockDb.getSecfacEvidenceAttachmentById(evidenceId);
    if (!attachment) {
      return NextResponse.json({ success: false, error: "Evidence attachment not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions
    let allowedOps: string[] = [];
    if (isAdmin) {
      allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
    } else {
      if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
      if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
    }

    if (!allowedOps.includes(attachment.operationType)) {
      return NextResponse.json({ success: false, error: "Forbidden: No access to this operation scope" }, { status: 403 });
    }

    const isSupervisorOrAdmin = isAdmin || 
      ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_")) ||
      (user.permissions || []).some((p: string) => 
        p === "manpower.security.manage" || 
        p === "manpower.fm.manage" || 
        p.startsWith("manpower.admin.")
      );

    if (!isSupervisorOrAdmin) {
      // Standard employee can only view their own evidence
      if (attachment.employeeId !== user.id) {
        return NextResponse.json({ success: false, error: "Forbidden: Cannot view another employee's evidence" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: attachment });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const { evidenceId } = params;

  try {
    const attachment = await mockDb.getSecfacEvidenceAttachmentById(evidenceId);
    if (!attachment) {
      return NextResponse.json({ success: false, error: "Evidence attachment not found" }, { status: 404 });
    }

    // 1. Verify operation scope
    let allowedOps: string[] = [];
    if (isAdmin) {
      allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
    } else {
      if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
      if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
    }

    if (!allowedOps.includes(attachment.operationType)) {
      return NextResponse.json({ success: false, error: "Forbidden: No access to this operation scope" }, { status: 403 });
    }

    // 2. Fetch execution to check status
    const execution = await mockDb.getSecfacChecklistExecutionById(attachment.executionId);
    if (!execution) {
      return NextResponse.json({ success: false, error: "Associated checklist execution not found" }, { status: 400 });
    }

    const EDITABLE_STATUSES = ["DRAFT", "REJECTED", "REOPENED"];
    if (!EDITABLE_STATUSES.includes(execution.status.toUpperCase())) {
      return NextResponse.json({ success: false, error: `Cannot delete evidence for execution with status ${execution.status}` }, { status: 400 });
    }

    // 3. Verify ownership: standard employee can only delete their own uploads
    if (!isAdmin && attachment.employeeId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden: Cannot delete another employee's evidence" }, { status: 403 });
    }

    // 4. Soft-delete the attachment
    const success = await mockDb.deleteSecfacEvidenceAttachment(evidenceId);
    return NextResponse.json({ success });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
