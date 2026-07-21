import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
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
  const auth = await checkApiAuth(undefined, { requiredPermission: "secfac.patrolRoutes.delete" });
  if (auth.error) {
    const session = auth.session as any;
    if (session?.user?.id) {
      const { auditSecfacDeleteAction } = require("@/lib/secfac-delete-audit-service");
      await auditSecfacDeleteAction({
        entityType: "PATROL_ROUTE",
        entityId: params.routeId,
        actionType: "PERMISSION_DENIED",
        userId: session.user.id,
        userRole: session.user.role,
        userEmail: session.user.email,
        permission: "secfac.patrolRoutes.delete",
        operationType: "SECURITY_GUARDING",
        resultStatus: "DENIED",
        resultMessage: "Forbidden: User lacks secfac.patrolRoutes.delete permission"
      });
    }
    return auth.error;
  }

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const { routeId } = params;

  try {
    const route = await mockDb.getSecfacPatrolRouteById(routeId);
    if (!route) {
      return NextResponse.json({ success: false, error: "Patrol route not found" }, { status: 404 });
    }

    const opType = route.operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";

    if (!isAdmin) {
      if (opType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        const { auditSecfacDeleteAction } = require("@/lib/secfac-delete-audit-service");
        await auditSecfacDeleteAction({
          entityType: "PATROL_ROUTE",
          entityId: routeId,
          actionType: "PERMISSION_DENIED",
          userId: user.id,
          userRole: user.role,
          permission: "secfac.patrolRoutes.delete",
          operationType: opType,
          siteId: route.siteId,
          resultStatus: "DENIED",
          resultMessage: "Forbidden: Scope access denied for Security Guarding"
        });
        return NextResponse.json({ success: false, error: "Forbidden: Scope access denied for Security Guarding" }, { status: 403 });
      }
      if (opType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        const { auditSecfacDeleteAction } = require("@/lib/secfac-delete-audit-service");
        await auditSecfacDeleteAction({
          entityType: "PATROL_ROUTE",
          entityId: routeId,
          actionType: "PERMISSION_DENIED",
          userId: user.id,
          userRole: user.role,
          permission: "secfac.patrolRoutes.delete",
          operationType: opType,
          siteId: route.siteId,
          resultStatus: "DENIED",
          resultMessage: "Forbidden: Scope access denied for Facility Management"
        });
        return NextResponse.json({ success: false, error: "Forbidden: Scope access denied for Facility Management" }, { status: 403 });
      }
    }

    let dependencies = {
      assignments: 0,
      executions: 0
    };

    const isDb = isDbConnected();
    if (isDb) {
      const assignments = await prisma.secfacAssignment.count({ where: { patrolRouteId: routeId } });
      const executions = await prisma.secfacPatrolExecution.count({ where: { routeId } });
      dependencies = { assignments, executions };
    } else {
      const db = readDb();
      dependencies.assignments = (db.secfacAssignments || []).filter((x: any) => x.patrolRouteId === routeId).length;
      dependencies.executions = (db.secfacPatrolExecutions || []).filter((x: any) => x.routeId === routeId).length;
    }

    const totalDependencies = dependencies.assignments + dependencies.executions;

    if (totalDependencies > 0) {
      const { auditSecfacDeleteAction } = require("@/lib/secfac-delete-audit-service");
      await auditSecfacDeleteAction({
        entityType: "PATROL_ROUTE",
        entityId: routeId,
        actionType: "DEPENDENCY_BLOCKED",
        userId: user.id,
        userRole: user.role,
        userEmail: user.email,
        permission: "secfac.patrolRoutes.delete",
        operationType: opType,
        siteId: route.siteId,
        resultStatus: "BLOCKED",
        resultMessage: `Deletion blocked due to ${totalDependencies} assignment/execution history records`
      });

      return NextResponse.json({
        success: false,
        error: "DELETE_BLOCKED",
        message: `This patrol route cannot be hard deleted because assignment or execution history exists (${totalDependencies} references).`,
        dependencies,
        allowedAction: "DEACTIVATE"
      }, { status: 409 });
    }

    if (isDb) {
      await prisma.secfacPatrolRouteCheckpoint.deleteMany({ where: { routeId } });
      await prisma.secfacPatrolRoute.delete({ where: { id: routeId } });
    } else {
      await mockDb.deleteSecfacPatrolRoute(routeId);
    }

    const { auditSecfacDeleteAction } = require("@/lib/secfac-delete-audit-service");
    await auditSecfacDeleteAction({
      entityType: "PATROL_ROUTE",
      entityId: routeId,
      actionType: "HARD_DELETE",
      userId: user.id,
      userRole: user.role,
      userEmail: user.email,
      permission: "secfac.patrolRoutes.delete",
      operationType: opType,
      siteId: route.siteId,
      resultStatus: "SUCCESS",
      resultMessage: "Patrol route permanently deleted (zero dependencies)"
    });

    return NextResponse.json({ success: true, message: "Patrol route deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to delete patrol route", error: error.message }, { status: 500 });
  }
}
