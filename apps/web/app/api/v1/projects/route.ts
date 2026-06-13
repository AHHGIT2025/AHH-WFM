import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const projects = await mockDb.getProjects();
    return NextResponse.json(projects);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.projectCode || !payload.projectName || !payload.costCenter) {
      return NextResponse.json({ error: "Project Code, Project Name, and Cost Center are required" }, { status: 400 });
    }
    const project = await mockDb.createProject(payload);
    return NextResponse.json(project);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create project" }, { status: 500 });
  }
}
