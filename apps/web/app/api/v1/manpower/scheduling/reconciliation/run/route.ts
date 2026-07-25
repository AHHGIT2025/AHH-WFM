import { NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { executeReconciliationRun } from "../../../../../../../lib/reconciliation-engine";

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.reconciliation.run" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const body = await request.json().catch(() => ({}));
    const { business, date, contractId, siteId } = body;

    const dateStr = date || new Date().toISOString().split("T")[0];
    let operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT" = "SECURITY_GUARDING";
    if (business === "facility-management" || business === "FACILITY_MANAGEMENT") {
      operationType = "FACILITY_MANAGEMENT";
    }

    if (operationType === "SECURITY_GUARDING" && !user?.operationAccess?.allowedSecurityGuarding) {
      return NextResponse.json({ error: "Access Forbidden: User cannot access Security Guarding scope." }, { status: 403 });
    }
    if (operationType === "FACILITY_MANAGEMENT" && !user?.operationAccess?.allowedFacilityManagement) {
      return NextResponse.json({ error: "Access Forbidden: User cannot access Facility Management scope." }, { status: 403 });
    }

    const result = await executeReconciliationRun({
      operationType,
      contractId,
      siteId,
      businessDateStr: dateStr,
      runType: "MANUAL",
      workerInstanceId: `manual-user-${user.id}`
    });

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error: any) {
    console.error("POST /api/v1/manpower/scheduling/reconciliation/run Error:", error);
    return NextResponse.json({ error: error.message || "Manual reconciliation run failed." }, { status: 500 });
  }
}
