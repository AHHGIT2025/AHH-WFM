import { NextResponse } from "next/server";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

export async function GET(
  request: Request,
  { params }: { params: { routeId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));

  const { routeId } = params;

  try {
    const route = await mockDb.getSecfacPatrolRouteById(routeId);
    if (!route) {
      return NextResponse.json({ success: false, error: "Patrol route not found" }, { status: 404 });
    }

    // RBAC check
    if (!isAdmin) {
      if (isSupervisor) {
        if (route.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
          return NextResponse.json({ success: false, error: "Forbidden: No security operations access allowed" }, { status: 403 });
        }
        if (route.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
          return NextResponse.json({ success: false, error: "Forbidden: No facility operations access allowed" }, { status: 403 });
        }
      } else {
        // Field employee: only allow if this route is linked to one of their active assignments
        const assignments = await mockDb.getSecfacAssignedTasks(user.id);
        const hasLink = assignments.some(a => a.patrolRouteId === routeId);
        if (!hasLink) {
          return NextResponse.json({ success: false, error: "Forbidden: Route not assigned to you" }, { status: 403 });
        }
      }
    }

    return NextResponse.json({ success: true, data: route });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve patrol route", error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { routeId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));

  if (!isAdmin && !isSupervisor) {
    return NextResponse.json({ success: false, error: "Forbidden: Field employees cannot modify route masters" }, { status: 403 });
  }

  const { routeId } = params;

  try {
    const route = await mockDb.getSecfacPatrolRouteById(routeId);
    if (!route) {
      return NextResponse.json({ success: false, error: "Patrol route not found" }, { status: 404 });
    }

    // Check scope
    if (!isAdmin) {
      if (route.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No security operations access allowed" }, { status: 403 });
      }
      if (route.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No facility operations access allowed" }, { status: 403 });
      }
    }

    // Rule: Route master modification is blocked if active IN_PROGRESS executions exist.
    const activeExecs = await mockDb.getSecfacPatrolExecutions({ routeId, status: "IN_PROGRESS" });
    if (activeExecs && activeExecs.length > 0) {
      return NextResponse.json({ success: false, error: "Cannot modify route master: active IN PROGRESS executions exist" }, { status: 400 });
    }

    const payload = await request.json();
    const {
      routeName,
      routeCode,
      description,
      checkpoints,
      isActive
    } = payload;

    // Validate checkpoints if modifying checkpoints
    if (checkpoints !== undefined) {
      if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
        return NextResponse.json({ success: false, error: "At least one checkpoint is required for a patrol route" }, { status: 400 });
      }

      const seqs = checkpoints.map(c => Number(c.sequenceNo));
      const uniqueSeqs = new Set(seqs);
      if (seqs.some(isNaN)) {
        return NextResponse.json({ success: false, error: "checkpoint sequenceNo must be numeric" }, { status: 400 });
      }
      if (uniqueSeqs.size !== seqs.length) {
        return NextResponse.json({ success: false, error: "Duplicate sequenceNo within route" }, { status: 400 });
      }

      for (const item of checkpoints) {
        const cp = await mockDb.getSecfacCheckpointById(item.checkpointId);
        if (!cp || !cp.isActive) {
          return NextResponse.json({ success: false, error: `Checkpoint with ID ${item.checkpointId} not found or inactive` }, { status: 400 });
        }
        if (cp.siteId !== route.siteId) {
          return NextResponse.json({ success: false, error: `Checkpoint ${cp.checkpointName} belongs to a different site` }, { status: 400 });
        }
        if (cp.operationType !== route.operationType) {
          return NextResponse.json({ success: false, error: `Checkpoint ${cp.checkpointName} operation type mismatch` }, { status: 400 });
        }
      }
    }

    const updated = await mockDb.updateSecfacPatrolRoute(routeId, {
      routeName,
      routeCode,
      description,
      checkpoints: checkpoints ? checkpoints.map((c: any) => ({
        checkpointId: c.checkpointId,
        sequenceNo: Number(c.sequenceNo),
        required: c.required !== undefined ? !!c.required : true
      })) : undefined,
      isActive
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to update patrol route", error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { routeId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));

  if (!isAdmin && !isSupervisor) {
    return NextResponse.json({ success: false, error: "Forbidden: Field employees cannot delete route masters" }, { status: 403 });
  }

  const { routeId } = params;

  try {
    const route = await mockDb.getSecfacPatrolRouteById(routeId);
    if (!route) {
      return NextResponse.json({ success: false, error: "Patrol route not found" }, { status: 404 });
    }

    // Check scope
    if (!isAdmin) {
      if (route.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No security operations access allowed" }, { status: 403 });
      }
      if (route.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No facility operations access allowed" }, { status: 403 });
      }
    }

    // Soft delete deactivates only
    const success = await mockDb.deleteSecfacPatrolRoute(routeId);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to delete patrol route", error: error.message }, { status: 500 });
  }
}
