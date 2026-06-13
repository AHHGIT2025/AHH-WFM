import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const assignments = await mockDb.getShiftRelieverAssignments();
    const assignment = assignments.find(a => a.id === params.id);
    if (!assignment) {
      return NextResponse.json({ error: "Shift reliever assignment not found" }, { status: 404 });
    }
    return NextResponse.json(assignment);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch reliever assignment" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const assignment = await mockDb.updateShiftRelieverAssignment(params.id, payload);
    if (!assignment) {
      return NextResponse.json({ error: "Shift reliever assignment not found" }, { status: 404 });
    }
    return NextResponse.json(assignment);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update reliever assignment" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const success = await mockDb.deleteShiftRelieverAssignment(params.id);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete or reliever assignment not found" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete reliever assignment" }, { status: 500 });
  }
}
