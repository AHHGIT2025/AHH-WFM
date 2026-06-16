import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  const employeeId = params.id;

  try {
    const balances = await mockDb.getEmployeeLeaveBalances(employeeId);
    return NextResponse.json(balances);
  } catch (e: any) {
    console.error("Error getting leave balances:", e);
    return NextResponse.json({ error: e.message || "Failed to fetch leave balances" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  const employeeId = params.id;
  try {
    const body = await request.json();
    const balance = await mockDb.createEmployeeLeaveBalance(employeeId, body);
    return NextResponse.json(balance, { status: 201 });
  } catch (e: any) {
    console.error("Error creating leave balance:", e);
    return NextResponse.json({ error: e.message || "Failed to create leave balance" }, { status: 400 });
  }
}
