import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    const balances = await mockDb.getLeaveBalances(employeeId);
    return NextResponse.json(balances);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch leave balances" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    
    // Support running monthly accrual or manual adjustment
    if (payload.action === "accrue") {
      const result = await mockDb.runMonthlyAccrual();
      return NextResponse.json(result);
    }

    const { employeeId, leaveTypeId, amount, reason } = payload;
    const adjustedById = auth.session?.user?.email || "ADMIN";

    const result = await mockDb.adjustLeaveBalance(
      employeeId,
      leaveTypeId,
      Number(amount),
      reason,
      adjustedById
    );
    if (!result) {
      return NextResponse.json({ error: "Failed to adjust leave balance" }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 500 });
  }
}
