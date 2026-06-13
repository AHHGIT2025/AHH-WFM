import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const designations = await mockDb.getDesignations();
    const designation = designations.find(d => d.id === params.id);
    if (!designation) {
      return NextResponse.json({ error: "Designation not found" }, { status: 404 });
    }
    return NextResponse.json(designation);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch designation" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const designation = await mockDb.updateDesignation(params.id, payload);
    if (!designation) {
      return NextResponse.json({ error: "Designation not found" }, { status: 404 });
    }
    return NextResponse.json(designation);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update designation" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const success = await mockDb.deleteDesignation(params.id);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete or designation not found" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete designation" }, { status: 500 });
  }
}
