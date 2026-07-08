import { NextResponse } from "next/server";
import { mockDb, readDb, writeDb } from "@ahh-wfm/mock-data";
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

    // Save site allocations in db.json
    const db = readDb() as any;
    db.siteManpowerAllocations = db.siteManpowerAllocations || [];

    if (payload.allocations && Array.isArray(payload.allocations)) {
      db.siteManpowerAllocations = db.siteManpowerAllocations.filter((a: any) => a.siteId !== site.id);
      for (const item of payload.allocations) {
        db.siteManpowerAllocations.push({
          id: `sma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          siteId: site.id,
          position: item.position,
          quantity: item.allocatedQty || 0,
          deploymentType: item.deploymentType || "PERMANENT",
          relieverPoolType: item.relieverPoolType || "DEDICATED"
        });
      }
    }
    writeDb(db);

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
    const { id, allocations, ...updates } = payload;
    const site = await mockDb.updateManpowerSite(id, updates);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Save site allocations in db.json
    const db = readDb() as any;
    db.siteManpowerAllocations = db.siteManpowerAllocations || [];

    if (allocations && Array.isArray(allocations)) {
      db.siteManpowerAllocations = db.siteManpowerAllocations.filter((a: any) => a.siteId !== id);
      for (const item of allocations) {
        db.siteManpowerAllocations.push({
          id: `sma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          siteId: id,
          position: item.position,
          quantity: item.allocatedQty || 0,
          deploymentType: item.deploymentType || "PERMANENT",
          relieverPoolType: item.relieverPoolType || "DEDICATED"
        });
      }
    }
    writeDb(db);

    return NextResponse.json(site);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update site" }, { status: 500 });
  }
}
