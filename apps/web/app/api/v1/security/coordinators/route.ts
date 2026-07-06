import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

async function validateCoordinatorAssignment(projectId: string, coordinatorEmployeeId: string) {
  if (!projectId || !coordinatorEmployeeId) {
    throw new Error("Missing required fields (projectId, coordinatorEmployeeId)");
  }

  // 1. Fetch project
  let project: any = null;
  if (isDbConnected()) {
    project = await prisma.manpowerProject.findUnique({
      where: { id: projectId }
    });
  } else {
    const db = readDb();
    project = (db.manpowerProjects || []).find((p: any) => p.id === projectId);
  }

  if (!project) {
    throw new Error("Project not found");
  }

  const projOpType = project.operationType; // "SECURITY_GUARDING" or "FACILITY_MANAGEMENT"

  // 2. Fetch employee
  let employee: any = null;
  if (isDbConnected()) {
    employee = await prisma.employee.findUnique({
      where: { id: coordinatorEmployeeId },
      include: { company: true }
    });
  } else {
    const db = readDb() as any;
    employee = (db.employees || []).find((e: any) => e.id === coordinatorEmployeeId);
    if (employee) {
      const compId = employee.companyId;
      employee.company = (db.companies || []).find((c: any) => c.id === compId);
    }
  }

  if (!employee) {
    throw new Error("Coordinator employee not found");
  }

  const empOpType = employee.operationType;
  const compCode = employee.company?.companyCode || employee.companyCode;
  const category = employee.employeeCategory;

  if (projOpType === "SECURITY_GUARDING") {
    const isValid = empOpType === "SECURITY_GUARDING" || (compCode === "HS01" && category === "BLUE_COLLAR");
    if (!isValid) {
      throw new Error("Selected employee does not belong to the Security Guarding manpower directory.");
    }
  } else if (projOpType === "FACILITY_MANAGEMENT") {
    const isValid = empOpType === "FACILITY_MANAGEMENT" || (compCode === "TC01" && category === "BLUE_COLLAR");
    if (!isValid) {
      throw new Error("Selected employee does not belong to the Facility Management manpower directory.");
    }
  } else {
    throw new Error(`Invalid project operation type: ${projOpType}`);
  }
}

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;
  const coordinatorEmployeeId = searchParams.get("coordinatorEmployeeId") || undefined;
  const operationType = searchParams.get("operationType") || undefined;

  try {
    const list = await mockDb.getSecurityProjectCoordinatorAssignments(projectId, coordinatorEmployeeId, operationType);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch project coordinator assignments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    if (!data.projectId || !data.coordinatorEmployeeId) {
      return NextResponse.json({ error: "Missing required fields (projectId, coordinatorEmployeeId)" }, { status: 400 });
    }
    
    // Validate coordinator scope
    await validateCoordinatorAssignment(data.projectId, data.coordinatorEmployeeId);

    const created = await mockDb.createSecurityProjectCoordinatorAssignment(data);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create coordinator assignment" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }
    const { id, ...updates } = payload;

    // Validate if updates affect scope
    if (updates.projectId || updates.coordinatorEmployeeId) {
      let currentAssignment: any = null;
      if (isDbConnected()) {
        currentAssignment = await prisma.securityProjectCoordinatorAssignment.findUnique({
          where: { id }
        });
      } else {
        const db = readDb();
        currentAssignment = (db.securityProjectCoordinatorAssignments || []).find((x: any) => x.id === id);
      }

      if (!currentAssignment) {
        return NextResponse.json({ error: "Coordinator assignment not found" }, { status: 404 });
      }

      const targetProjectId = updates.projectId || currentAssignment.projectId;
      const targetCoordinatorId = updates.coordinatorEmployeeId || currentAssignment.coordinatorEmployeeId;

      await validateCoordinatorAssignment(targetProjectId, targetCoordinatorId);
    }

    const updated = await mockDb.updateSecurityProjectCoordinatorAssignment(id, updates);
    if (!updated) {
      return NextResponse.json({ error: "Coordinator assignment not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update coordinator assignment" }, { status: 400 });
  }
}
