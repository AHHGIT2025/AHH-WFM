import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const workflows = await mockDb.getLeaveApprovalWorkflows();
    return NextResponse.json(workflows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch approval workflows" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { name, description, isActive, steps } = payload;
    if (!name || !steps || !Array.isArray(steps)) {
      return NextResponse.json({ error: "Missing required fields (name, steps)" }, { status: 400 });
    }

    const workflow = await mockDb.createLeaveApprovalWorkflow(
      name,
      description || "",
      isActive !== false,
      steps
    );
    return NextResponse.json(workflow);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create approval workflow" }, { status: 500 });
  }
}
