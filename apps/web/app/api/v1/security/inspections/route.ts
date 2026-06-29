import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId") || undefined;
  const inspectorEmployeeId = searchParams.get("inspectorEmployeeId") || undefined;

  try {
    const list = await mockDb.getSecuritySiteInspections(siteId, inspectorEmployeeId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch security site inspections" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    if (!data.siteId || !data.inspectorEmployeeId || !data.inspectionDate || !data.status) {
      return NextResponse.json({ error: "Missing required fields (siteId, inspectorEmployeeId, inspectionDate, status)" }, { status: 400 });
    }
    const created = await mockDb.createSecuritySiteInspection(data);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create site inspection" }, { status: 500 });
  }
}
