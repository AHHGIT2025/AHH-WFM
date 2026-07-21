import { NextResponse } from "next/server";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import { auditSecfacDeleteAction } from "@/lib/secfac-delete-audit-service";

export async function POST(
  request: Request,
  { params }: { params: { checkpointId: string } }
) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "secfac.checkpoints.edit" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const checkpointId = params.checkpointId;

  try {
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "Deactivated via Control Room UI";

    const checkpoint = await mockDb.getSecfacCheckpointById(checkpointId);
    if (!checkpoint) {
      return NextResponse.json({ success: false, error: "Checkpoint not found" }, { status: 404 });
    }

    const opType = checkpoint.operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";

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
      result = await prisma.secfacCheckpoint.update({
        where: { id: checkpointId },
        data: { isActive: false }
      });
    } else {
      result = await mockDb.updateSecfacCheckpoint(checkpointId, { isActive: false });
    }

    await auditSecfacDeleteAction({
      entityType: "CHECKPOINT",
      entityId: checkpointId,
      actionType: "DEACTIVATE",
      userId: user.id,
      userRole: user.role,
      userEmail: user.email,
      permission: "secfac.checkpoints.edit",
      operationType: opType,
      siteId: checkpoint.siteId,
      reason,
      resultStatus: "SUCCESS",
      resultMessage: "Checkpoint deactivated (isActive = false)"
    });

    return NextResponse.json({ success: true, data: result, message: "Checkpoint deactivated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to deactivate checkpoint", error: error.message }, { status: 500 });
  }
}
