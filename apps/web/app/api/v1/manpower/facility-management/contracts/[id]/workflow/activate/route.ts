import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "FACILITY_MANAGEMENT" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.manage") &&
      !hasPermission(auth.session?.user, "manpower.fm.contracts.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const existing = await mockDb.getManpowerContract(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    if (existing.operationType && existing.operationType !== "FACILITY_MANAGEMENT") {
      return NextResponse.json({ error: "Forbidden: Contract belongs to a different operation scope" }, { status: 403 });
    }
    const activatedBy = auth.session?.user?.name || auth.session?.user?.email || "Admin";
    const contract = await mockDb.activateContract(params.id, activatedBy);
    return NextResponse.json(contract);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to activate contract" }, { status: 500 });
  }
}
