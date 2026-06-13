import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;
  const siteId = url.searchParams.get("siteId") || undefined;
  const date = url.searchParams.get("date") || undefined;

  try {
    const list = await mockDb.getDeployments({ employeeId, projectId, siteId, date });
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch deployments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.employeeId || !payload.projectId || !payload.siteId || !payload.positionCategoryId || !payload.deploymentDate || !payload.startTime || !payload.endTime) {
      return NextResponse.json({ error: "Missing required deployment fields" }, { status: 400 });
    }
    const result = await mockDb.createDeployment({
      ...payload,
      createdById: (auth.session?.user as any)?.id || "ADMIN"
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create deployment" }, { status: 500 });
  }
}
