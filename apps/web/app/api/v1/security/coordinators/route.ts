import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;
  const coordinatorEmployeeId = searchParams.get("coordinatorEmployeeId") || undefined;

  try {
    const list = await mockDb.getSecurityProjectCoordinatorAssignments(projectId, coordinatorEmployeeId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch project coordinator assignments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    if (!data.projectId || !data.coordinatorEmployeeId) {
      return NextResponse.json({ error: "Missing required fields (projectId, coordinatorEmployeeId)" }, { status: 400 });
    }
    const created = await mockDb.createSecurityProjectCoordinatorAssignment(data);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create coordinator assignment" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }
    const { id, ...updates } = payload;
    const updated = await mockDb.updateSecurityProjectCoordinatorAssignment(id, updates);
    if (!updated) {
      return NextResponse.json({ error: "Coordinator assignment not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update coordinator assignment" }, { status: 500 });
  }
}
