import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const project = await mockDb.getProjectById(params.id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const project = await mockDb.updateProject(params.id, payload);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update project" }, { status: 500 });
  }
}

import { isAdminUser } from "@/lib/permissions";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!isAdminUser(auth.session?.user)) {
    return NextResponse.json({ error: "Only Admin and Super Admin can delete master data." }, { status: 403 });
  }

  try {
    await mockDb.deleteProject(params.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
