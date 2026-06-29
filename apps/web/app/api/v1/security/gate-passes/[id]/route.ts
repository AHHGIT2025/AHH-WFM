import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  const id = params.id;
  try {
    const data = await request.json();
    const updated = await mockDb.updateSecurityGatePass(id, data);
    if (!updated) {
      return NextResponse.json({ error: "Security gate pass not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update security gate pass" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  const id = params.id;
  try {
    await mockDb.deleteSecurityGatePass(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete security gate pass" }, { status: 500 });
  }
}
