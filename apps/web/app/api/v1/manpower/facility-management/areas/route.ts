import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const areas = await mockDb.getManpowerLocationUnits("FACILITY_MANAGEMENT");
    return NextResponse.json(areas);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch areas" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.siteId || !payload.name || !payload.type) {
      return NextResponse.json({ error: "Site, Area Name, and Type are required" }, { status: 400 });
    }
    const area = await mockDb.createManpowerLocationUnit({
      ...payload,
      operationType: "FACILITY_MANAGEMENT"
    });
    return NextResponse.json(area);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create area" }, { status: 500 });
  }
}
