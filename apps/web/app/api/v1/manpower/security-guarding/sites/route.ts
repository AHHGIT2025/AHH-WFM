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
    const sites = await mockDb.getManpowerSites("SECURITY_GUARDING");
    return NextResponse.json(sites);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
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
    if (!payload.projectId || !payload.name) {
      return NextResponse.json({ error: "Project and Site Name are required" }, { status: 400 });
    }
    const site = await mockDb.createManpowerSite({
      ...payload,
      operationType: "SECURITY_GUARDING"
    });
    return NextResponse.json(site);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create site" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.id) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
    }
    const { id, ...updates } = payload;
    const site = await mockDb.updateManpowerSite(id, updates);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
    return NextResponse.json(site);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update site" }, { status: 500 });
  }
}
