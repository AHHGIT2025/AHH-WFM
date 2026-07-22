import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../../lib/permissions";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const requirementId = params.id;
  const requirement = await mockDb.getContractManpowerRequirement(requirementId);
  if (!requirement) {
    return NextResponse.json({ error: "Manpower requirement not found" }, { status: 404 });
  }

  const contract = requirement.contract;
  if (!contract) {
    return NextResponse.json({ error: "Associated contract not found" }, { status: 404 });
  }

  // Permission checks
  const isSecurity = contract.operationType === "SECURITY_GUARDING";
  const requiredPermission = isSecurity ? "manpower.security.contracts.foc_approve" : "manpower.fm.contracts.foc_approve";
  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, requiredPermission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Maker-Checker Check
  if (requirement.focRequestedById === auth.session.user.id) {
    return NextResponse.json({ error: "Self-approval is prohibited" }, { status: 403 });
  }

  // Validate active Employee mapping
  const employees = await mockDb.getEmployees();
  const employee = employees.find((e: any) => e.id === auth.session.user.id);
  if (!employee || !employee.isActive) {
    return NextResponse.json({ error: "Unauthorized: Approval actor must be an active Employee" }, { status: 403 });
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, reason } = body;
  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ error: "Invalid action. Must be APPROVE or REJECT" }, { status: 400 });
  }

  if (action === "REJECT" && (!reason || typeof reason !== "string" || reason.trim() === "")) {
    return NextResponse.json({ error: "Rejection reason is mandatory" }, { status: 400 });
  }

  // Validate current FOC state
  if (requirement.focStatus !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: `Cannot evaluate FOC when status is ${requirement.focStatus}` }, { status: 409 });
  }

  try {
    let updatePayload: any = {};
    let auditAction = "";

    if (action === "APPROVE") {
      updatePayload = {
        focStatus: "APPROVED",
        billingEligible: false,
        focApprovedById: auth.session.user.id,
        focApprovalReason: reason || "",
        focApprovedAt: new Date().toISOString(),
        unitPrice: 0,
        lineTotal: 0,
      };
      auditAction = "CONTRACT_FOC_APPROVE";
    } else {
      // Restore pre-FOC pricing
      updatePayload = {
        focStatus: "REJECTED",
        billingEligible: true,
        focRejectedById: auth.session.user.id,
        focRejectionReason: reason,
        focRejectedAt: new Date().toISOString(),
        unitPrice: requirement.preFocUnitPrice ?? 0,
        lineTotal: requirement.preFocLineTotal ?? 0,
      };
      auditAction = "CONTRACT_FOC_REJECT";
    }

    const updated = await mockDb.updateContractManpowerRequirement(requirementId, updatePayload);

    // Log Activity
    await mockDb.createUserActivityLog({
      userId: auth.session.user.id,
      action: auditAction,
      entityType: "ContractManpowerRequirement",
      entityId: requirementId,
      beforeJson: JSON.stringify(requirement),
      afterJson: JSON.stringify(updated),
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      userAgent: request.headers.get("user-agent") || "Unknown"
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to evaluate FOC", details: String(e) }, { status: 500 });
  }
}
