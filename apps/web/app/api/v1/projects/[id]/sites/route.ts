import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const sites = await mockDb.getProjectSites(params.id);
    return NextResponse.json(sites);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch project sites" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.siteCode || !payload.siteName) {
      return NextResponse.json({ error: "Site Code and Site Name are required" }, { status: 400 });
    }
    const site = await mockDb.createProjectSite(params.id, payload);
    return NextResponse.json(site);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create project site" }, { status: 500 });
  }
}
