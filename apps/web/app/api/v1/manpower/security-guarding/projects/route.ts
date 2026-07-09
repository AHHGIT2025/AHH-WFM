import { NextResponse } from "next/server";
import { mockDb, readDb, writeDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const projects = await mockDb.getManpowerProjects("SECURITY_GUARDING");
    return NextResponse.json(projects);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.contractId || !payload.name || !payload.code) {
      return NextResponse.json({ error: "Contract, Project Name, and Code are required" }, { status: 400 });
    }
    const project = await mockDb.createManpowerProject({
      ...payload,
      operationType: "SECURITY_GUARDING"
    });

    // Persist allocations to db.json
    const db = readDb() as any;
    db.projectManpowerAllocations = db.projectManpowerAllocations || [];
    db.projectRelieverAllocations = db.projectRelieverAllocations || [];

    if (payload.allocations && Array.isArray(payload.allocations)) {
      db.projectManpowerAllocations = db.projectManpowerAllocations.filter((a: any) => a.projectId !== project.id);
      for (const item of payload.allocations) {
        db.projectManpowerAllocations.push({
          id: `pma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          projectId: project.id,
          contractRequirementId: item.requirementId,
          position: item.position,
          quantity: item.allocatedQty || 0
        });
      }
    }

    if (payload.relieverAllocations && Array.isArray(payload.relieverAllocations)) {
      db.projectRelieverAllocations = db.projectRelieverAllocations.filter((a: any) => a.projectId !== project.id);
      for (const item of payload.relieverAllocations) {
        db.projectRelieverAllocations.push({
          id: `pra-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          projectId: project.id,
          contractRequirementId: item.requirementId,
          position: item.position,
          quantity: item.allocatedQty || 0
        });
      }
    }

    writeDb(db);
    return NextResponse.json(project);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create project" }, { status: 500 });
  }
}
