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
  const requiredPermission = isSecurity ? "manpower.security.contracts.manage" : "manpower.fm.contracts.manage";
  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, requiredPermission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const reason = body.reason;
  if (!reason || typeof reason !== "string" || reason.trim() === "") {
    return NextResponse.json({ error: "Request reason is mandatory" }, { status: 400 });
  }

  // Validate state
  if (requirement.focStatus === "PENDING_APPROVAL" || requirement.focStatus === "APPROVED") {
    return NextResponse.json({ error: `Cannot request FOC when status is ${requirement.focStatus}` }, { status: 409 });
  }

  // Back up original values
  const preFocUnitPrice = requirement.unitPrice ?? 0;
  const preFocLineTotal = requirement.lineTotal ?? 0;

  try {
    const updated = await mockDb.updateContractManpowerRequirement(requirementId, {
      focStatus: "PENDING_APPROVAL",
      billingEligible: false,
      focRequestedById: auth.session.user.id,
      focRequestReason: reason,
      focRequestedAt: new Date().toISOString(),
      preFocUnitPrice,
      preFocLineTotal,
    });

    // Write Activity Log
    await mockDb.createUserActivityLog({
      userId: auth.session.user.id,
      action: "CONTRACT_FOC_REQUEST",
      entityType: "ContractManpowerRequirement",
      entityId: requirementId,
      beforeJson: JSON.stringify(requirement),
      afterJson: JSON.stringify(updated),
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      userAgent: request.headers.get("user-agent") || "Unknown"
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to request FOC", details: String(e) }, { status: 500 });
  }
}
