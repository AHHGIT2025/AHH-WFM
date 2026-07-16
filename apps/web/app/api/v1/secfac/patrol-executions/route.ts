import { NextResponse } from "next/server";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));
  const isStandardEmployee = !isAdmin && !isSupervisor;

  const { searchParams } = new URL(request.url);
  const routeIdFilter = searchParams.get("routeId");
  const assignmentIdFilter = searchParams.get("assignmentId");
  const employeeIdFilter = searchParams.get("employeeId");
  const statusFilter = searchParams.get("status");

  // Determine allowed scopes
  let allowedOps: string[] = [];
  if (isAdmin) {
    allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
  } else {
    if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
    if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
  }

  if (allowedOps.length === 0) {
    return NextResponse.json({ success: false, error: "Forbidden: No operations access allowed" }, { status: 403 });
  }

  // Standard employee can only see own executions
  let targetEmployeeId = employeeIdFilter;
  if (isStandardEmployee) {
    targetEmployeeId = user.id;
  }

  try {
    const executions = await mockDb.getSecfacPatrolExecutions({
      routeId: routeIdFilter || undefined,
      assignmentId: assignmentIdFilter || undefined,
      employeeId: targetEmployeeId || undefined,
      status: statusFilter || undefined
    });

    // Filter by allowed operation scope via the execution's route
    let filtered = executions;
    if (!isAdmin) {
      filtered = executions.filter((x: any) => {
        const routeOp = x.route?.operationType || x.assignment?.operationType;
        return allowedOps.includes(routeOp);
      });
    }

    return NextResponse.json({ success: true, data: filtered });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve patrol executions", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));
  const isStandardEmployee = !isAdmin && !isSupervisor;

  // Determine allowed scopes
  let allowedOps: string[] = [];
  if (isAdmin) {
    allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
  } else {
    if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
    if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
  }

  try {
    const body = await request.json();
    const { routeId, assignmentId } = body;

    // 1. Required fields
    if (!routeId) {
      return NextResponse.json({ success: false, error: "routeId is required" }, { status: 400 });
    }
    if (!assignmentId) {
      return NextResponse.json({ success: false, error: "assignmentId is required" }, { status: 400 });
    }

    // 2. Route exists and is active
    const route = await mockDb.getSecfacPatrolRouteById(routeId);
    if (!route || !route.isActive) {
      return NextResponse.json({ success: false, error: "Patrol route not found or inactive" }, { status: 404 });
    }

    // 3. Assignment exists and is active
    const assignment = await mockDb.getSecfacAssignmentById(assignmentId);
    if (!assignment || !assignment.isActive) {
      return NextResponse.json({ success: false, error: "Assignment not found or inactive" }, { status: 404 });
    }

    // 4. Assignment.patrolRouteId must match routeId
    if (assignment.patrolRouteId !== routeId) {
      return NextResponse.json({ success: false, error: "Assignment does not belong to the specified route" }, { status: 400 });
    }

    // 5. Standard employee: assignment.employeeId must equal user.id
    if (isStandardEmployee && assignment.employeeId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden: Cannot start execution for another employee" }, { status: 403 });
    }

    // 6. Assignment.operationType must be in user's allowed scope
    if (!allowedOps.includes(assignment.operationType)) {
      return NextResponse.json({ success: false, error: "Forbidden: No access to this operation scope" }, { status: 403 });
    }

    // 7. No existing active or finalized execution for same assignmentId+routeId
    const existing = await mockDb.getSecfacPatrolExecutions({
      assignmentId,
      routeId
    });
    const hasActiveOrCompleted = existing && existing.some((x: any) => x.status !== "CANCELLED");
    if (hasActiveOrCompleted) {
      return NextResponse.json({ success: false, error: "An execution already exists for this assignment" }, { status: 400 });
    }

    // 8. Route must have at least one checkpoint
    if (!route.checkpoints || route.checkpoints.length === 0) {
      return NextResponse.json({ success: false, error: "Route must have at least one checkpoint" }, { status: 400 });
    }

    // Create execution — the mock helper creates checkpoint rows from the route checkpoints
    const execution = await mockDb.createSecfacPatrolExecution({
      routeId,
      assignmentId,
      employeeId: assignment.employeeId,
      checkpoints: route.checkpoints
    });

    return NextResponse.json({ success: true, data: execution }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to create patrol execution", error: error.message }, { status: 500 });
  }
}
