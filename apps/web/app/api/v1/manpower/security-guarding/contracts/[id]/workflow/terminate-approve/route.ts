import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { levelId, employeeId, remarks } = payload;
    if (!levelId || !employeeId) {
      return NextResponse.json({ error: "Level ID and Employee ID are required" }, { status: 400 });
    }
    const contract = await mockDb.approveContractWorkflowLevel(params.id, levelId, employeeId, remarks);
    return NextResponse.json(contract);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to approve termination workflow level" }, { status: 500 });
  }
}
