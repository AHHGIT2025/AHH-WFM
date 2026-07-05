import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  try {
    const template = await mockDb.getWorkflowTemplate(params.id);
    if (!template) {
      return NextResponse.json({ error: "Workflow template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch workflow template" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const template = await mockDb.updateWorkflowTemplate(params.id, payload);
    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update workflow template" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await mockDb.deleteWorkflowTemplate(params.id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete workflow template" }, { status: 500 });
  }
}
