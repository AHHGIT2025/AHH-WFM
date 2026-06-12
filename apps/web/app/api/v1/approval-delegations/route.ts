import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const delegations = await mockDb.getLeaveApprovalDelegations();
    return NextResponse.json(delegations);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch approval delegations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { employeeId, delegateApproverId, validFrom, validTo, reason } = payload;
    if (!employeeId || !delegateApproverId || !validFrom || !validTo) {
      return NextResponse.json({ error: "Missing required fields (employeeId, delegateApproverId, validFrom, validTo)" }, { status: 400 });
    }

    const delegation = await mockDb.createLeaveApprovalDelegation(
      employeeId,
      delegateApproverId,
      validFrom,
      validTo,
      reason || ""
    );
    return NextResponse.json(delegation);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create approval delegation" }, { status: 500 });
  }
}
