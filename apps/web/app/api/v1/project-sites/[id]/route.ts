import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const site = await mockDb.getProjectSiteById(params.id);
    if (!site) return NextResponse.json({ error: "Project site not found" }, { status: 404 });
    return NextResponse.json(site);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch project site" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const site = await mockDb.updateProjectSite(params.id, payload);
    if (!site) return NextResponse.json({ error: "Project site not found" }, { status: 404 });
    return NextResponse.json(site);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update project site" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    await mockDb.deleteProjectSite(params.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete project site" }, { status: 500 });
  }
}
