import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  try {
    const delegations = await mockDb.getWorkflowDelegations();
    return NextResponse.json(delegations);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch delegations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.originalApproverEmployeeId || !payload.delegatedApproverEmployeeId || !payload.effectiveFrom || !payload.effectiveTo) {
      return NextResponse.json({ error: "Missing required delegation fields" }, { status: 400 });
    }
    const delegation = await mockDb.createWorkflowDelegation(payload);
    return NextResponse.json(delegation);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create delegation" }, { status: 500 });
  }
}
