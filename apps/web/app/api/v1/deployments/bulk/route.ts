import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { employeeIds, ...baseDeployment } = payload;
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: "employeeIds array is required" }, { status: 400 });
    }
    const result = await mockDb.bulkCreateDeployments(employeeIds, {
      ...baseDeployment,
      createdById: (auth.session?.user as any)?.id || "ADMIN"
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to bulk create deployments" }, { status: 500 });
  }
}
