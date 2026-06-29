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
    const updated = await mockDb.updateSecurityProjectCoordinatorAssignment(id, data);
    if (!updated) {
      return NextResponse.json({ error: "Coordinator assignment not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update coordinator assignment" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  const id = params.id;
  try {
    await mockDb.deleteSecurityProjectCoordinatorAssignment(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete coordinator assignment" }, { status: 500 });
  }
}
