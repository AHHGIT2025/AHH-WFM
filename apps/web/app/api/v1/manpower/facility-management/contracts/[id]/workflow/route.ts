import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "FACILITY_MANAGEMENT" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const contract = await mockDb.getManpowerContract(params.id);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    if (contract.operationType && contract.operationType !== "FACILITY_MANAGEMENT") {
      return NextResponse.json({ error: "Forbidden: Contract belongs to a different operation scope" }, { status: 403 });
    }
    return NextResponse.json({
      workflow: contract.workflows?.[0] || null,
      status: contract.approvalStatus || "DRAFT"
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch workflow" }, { status: 500 });
  }
}
