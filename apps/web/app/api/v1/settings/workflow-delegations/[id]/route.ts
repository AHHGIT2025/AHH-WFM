import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const delegation = await mockDb.updateWorkflowDelegation(params.id, payload);
    return NextResponse.json(delegation);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update delegation" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await mockDb.deleteWorkflowDelegation(params.id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete delegation" }, { status: 500 });
  }
}
