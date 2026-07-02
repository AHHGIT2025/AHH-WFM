import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function PUT(request: Request, { params }: { params: { business: string; id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const business = params.business;
  const isSecurity = business === "security-guarding";
  const managePermission = isSecurity ? "manpower.security.manage" : "manpower.fm.manage";

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, managePermission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const updated = await mockDb.updateManpowerMaterialMaster(params.id, payload);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update material" }, { status: 500 });
  }
}
