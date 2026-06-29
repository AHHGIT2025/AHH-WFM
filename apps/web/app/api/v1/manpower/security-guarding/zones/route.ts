import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const zones = await mockDb.getManpowerLocationUnits("SECURITY_GUARDING");
    return NextResponse.json(zones);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch zones" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.siteId || !payload.name || !payload.type) {
      return NextResponse.json({ error: "Site, Zone Name, and Type are required" }, { status: 400 });
    }
    const zone = await mockDb.createManpowerLocationUnit({
      ...payload,
      operationType: "SECURITY_GUARDING"
    });
    return NextResponse.json(zone);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create zone" }, { status: 500 });
  }
}
