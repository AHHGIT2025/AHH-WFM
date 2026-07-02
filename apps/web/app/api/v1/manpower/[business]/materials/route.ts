import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request, { params }: { params: { business: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const business = params.business;
  const isSecurity = business === "security-guarding";
  const viewPermission = isSecurity ? "manpower.security.view" : "manpower.fm.view";

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, viewPermission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    const operationType = isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";
    const materials = await mockDb.getManpowerMaterialMasters(operationType, includeInactive);
    return NextResponse.json(materials);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch materials" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { business: string } }) {
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
    if (!payload.materialName || !payload.materialCategory || !payload.unitOfMeasure) {
      return NextResponse.json({ error: "Material Name, Category, and UOM are required" }, { status: 400 });
    }
    const material = await mockDb.createManpowerMaterialMaster(payload);
    return NextResponse.json(material);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create material" }, { status: 500 });
  }
}
