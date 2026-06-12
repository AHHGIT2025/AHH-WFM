import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const leaves = await mockDb.getLeaves();
    return NextResponse.json(leaves);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const result = await mockDb.applyLeave(
      payload.employeeId,
      payload.type,
      payload.dateRange,
      payload.reason
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Failed to apply leave" }, { status: 500 });
  }
}
