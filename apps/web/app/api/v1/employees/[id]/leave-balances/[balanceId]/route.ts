import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; balanceId: string } }
) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  const { id: employeeId, balanceId } = params;

  try {
    const body = await request.json();
    const balance = await mockDb.updateEmployeeLeaveBalance(employeeId, balanceId, body);
    if (!balance) {
      return NextResponse.json({ error: "Leave balance not found" }, { status: 404 });
    }
    return NextResponse.json(balance);
  } catch (e: any) {
    console.error("Error updating leave balance:", e);
    return NextResponse.json({ error: e.message || "Failed to update leave balance" }, { status: 400 });
  }
}

export async function PUT(
  request: Request,
  context: { params: { id: string; balanceId: string } }
) {
  return PATCH(request, context);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; balanceId: string } }
) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  const { id: employeeId, balanceId } = params;

  try {
    const success = await mockDb.deleteEmployeeLeaveBalance(employeeId, balanceId);
    if (!success) {
      return NextResponse.json({ error: "Leave balance not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Error deleting leave balance:", e);
    return NextResponse.json({ error: e.message || "Failed to delete leave balance" }, { status: 400 });
  }
}
