import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const moduleType = searchParams.get("moduleType") || undefined;
    const workflows = await mockDb.getWorkflowTemplates(moduleType);
    return NextResponse.json(workflows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch workflow templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.workflowName || !payload.moduleType) {
      return NextResponse.json({ error: "Workflow name and module type are required" }, { status: 400 });
    }
    const template = await mockDb.createWorkflowTemplate(payload);
    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create workflow template" }, { status: 500 });
  }
}
