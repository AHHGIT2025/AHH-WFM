import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

const APPROVED_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED", "OVERDUE"];

export async function GET(
  request: Request,
  { params }: { params: { assignmentId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const assignmentId = params.assignmentId;

  try {
    const assignment = await mockDb.getSecfacAssignmentById(assignmentId);
    if (!assignment) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions
    if (!isAdmin) {
      if (assignment.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to security assignments" }, { status: 403 });
      }
      if (assignment.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to facility assignments" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: assignment });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve assignment", error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { assignmentId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const assignmentId = params.assignmentId;

  try {
    const assignment = await mockDb.getSecfacAssignmentById(assignmentId);
    if (!assignment) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions on existing assignment
    if (!isAdmin) {
      if (assignment.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to modify security assignments" }, { status: 403 });
      }
      if (assignment.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to modify facility assignments" }, { status: 403 });
      }
    }

    const payload = await request.json();
    const {
      operationType,
      clientId,
      projectId,
      siteId,
      locationUnitId,
      checkpointId,
      templateId,
      patrolRouteId,
      employeeId,
      supervisorId,
      assignmentName,
      assignmentCode,
      description,
      scheduledStart,
      scheduledEnd,
      status,
      isActive
    } = payload;

    const finalOp = operationType || assignment.operationType;

    // Apply RBAC Operation Restrictions on requested new operationType
    if (operationType && !isAdmin) {
      if (operationType !== "SECURITY_GUARDING" && operationType !== "FACILITY_MANAGEMENT") {
        return NextResponse.json({ success: false, error: "Invalid operationType value" }, { status: 400 });
      }
      if (operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: Cannot set operation type to security" }, { status: 403 });
      }
      if (operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: Cannot set operation type to facility" }, { status: 403 });
      }
    }

    // Validate Dates Chronological Order
    const finalStartStr = scheduledStart || assignment.scheduledStart;
    const finalEndStr = scheduledEnd || assignment.scheduledEnd;
    const start = new Date(finalStartStr);
    const end = new Date(finalEndStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid scheduled start or end date/time values" }, { status: 400 });
    }
    if (start.getTime() >= end.getTime()) {
      return NextResponse.json({ success: false, error: "scheduledStart must be chronologically before scheduledEnd" }, { status: 400 });
    }

    // Validate Status
    if (status && !APPROVED_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status value" }, { status: 400 });
    }

    // Validate Employee Existence
    const targetEmployeeId = employeeId !== undefined ? employeeId : assignment.employeeId;
    if (targetEmployeeId) {
      let employee: any = null;
      if (isDbConnected()) {
        employee = await prisma.employee.findUnique({ where: { id: targetEmployeeId } });
      } else {
        const db = readDb();
        employee = (db.employees || []).find((e: any) => e.id === targetEmployeeId);
      }
      if (!employee) {
        return NextResponse.json({ success: false, error: "Employee not found" }, { status: 400 });
      }
    }

    // Validate Supervisor
    const targetSupervisorId = supervisorId !== undefined ? supervisorId : assignment.supervisorId;
    if (targetSupervisorId) {
      let supervisor: any = null;
      if (isDbConnected()) {
        supervisor = await prisma.employee.findUnique({ where: { id: targetSupervisorId } });
      } else {
        const db = readDb();
        supervisor = (db.employees || []).find((e: any) => e.id === targetSupervisorId);
      }
      if (!supervisor) {
        return NextResponse.json({ success: false, error: "Supervisor employee not found" }, { status: 400 });
      }
    }

    // Validate Site Existence & Operation Type Match
    const targetSiteId = siteId !== undefined ? siteId : assignment.siteId;
    if (targetSiteId) {
      let site: any = null;
      if (isDbConnected()) {
        site = await prisma.manpowerSite.findUnique({ where: { id: targetSiteId } });
      } else {
        const db = readDb();
        site = (db.manpowerSites || []).find((s: any) => s.id === targetSiteId);
      }
      if (!site) {
        return NextResponse.json({ success: false, error: "Site not found" }, { status: 400 });
      }
      if (site.operationType !== finalOp) {
        return NextResponse.json({ success: false, error: "Operation type mismatch between assignment and site" }, { status: 400 });
      }
    }

    // Validate Checkpoint
    const targetCheckpointId = checkpointId !== undefined ? checkpointId : assignment.checkpointId;
    if (targetCheckpointId) {
      let cp: any = null;
      if (isDbConnected()) {
        cp = await prisma.secfacCheckpoint.findUnique({ where: { id: targetCheckpointId } });
      } else {
        const db = readDb();
        cp = (db.secfacCheckpoints || []).find((c: any) => c.id === targetCheckpointId);
      }
      if (!cp) {
        return NextResponse.json({ success: false, error: "Checkpoint not found" }, { status: 400 });
      }
      if (cp.operationType !== finalOp) {
        return NextResponse.json({ success: false, error: "Operation type mismatch between assignment and checkpoint" }, { status: 400 });
      }
    }

    // Validate Template
    const targetTemplateId = templateId !== undefined ? templateId : assignment.templateId;
    if (targetTemplateId) {
      let tpl: any = null;
      if (isDbConnected()) {
        tpl = await prisma.secfacChecklistTemplate.findUnique({ where: { id: targetTemplateId } });
      } else {
        const db = readDb();
        tpl = (db.secfacChecklistTemplates || []).find((t: any) => t.id === targetTemplateId);
      }
      if (!tpl) {
        return NextResponse.json({ success: false, error: "Checklist template not found" }, { status: 400 });
      }
      if (tpl.operationType !== finalOp) {
        return NextResponse.json({ success: false, error: "Operation type mismatch between assignment and checklist template" }, { status: 400 });
      }
    }

    // Validate Patrol Route Existence & Operation Type Match
    const targetPatrolRouteId = patrolRouteId !== undefined ? patrolRouteId : assignment.patrolRouteId;
    if (targetPatrolRouteId) {
      let route: any = null;
      if (isDbConnected()) {
        route = await prisma.secfacPatrolRoute.findUnique({ where: { id: targetPatrolRouteId } });
      } else {
        const db = readDb();
        route = (db.secfacPatrolRoutes || []).find((r: any) => r.id === targetPatrolRouteId);
      }
      if (!route) {
        return NextResponse.json({ success: false, error: "Patrol route not found" }, { status: 400 });
      }
      if (route.operationType !== finalOp) {
        return NextResponse.json({ success: false, error: "Operation type mismatch between assignment and patrol route" }, { status: 400 });
      }
    }

    // Perform Update
    const result = await mockDb.updateSecfacAssignment(assignmentId, {
      operationType: finalOp,
      clientId: clientId !== undefined ? clientId : assignment.clientId,
      projectId: projectId !== undefined ? projectId : assignment.projectId,
      siteId: targetSiteId,
      locationUnitId: locationUnitId !== undefined ? locationUnitId : assignment.locationUnitId,
      checkpointId: targetCheckpointId,
      templateId: targetTemplateId,
      patrolRouteId: targetPatrolRouteId,
      employeeId: targetEmployeeId,
      supervisorId: targetSupervisorId,
      assignmentName: assignmentName !== undefined ? assignmentName : assignment.assignmentName,
      assignmentCode: assignmentCode !== undefined ? assignmentCode : assignment.assignmentCode,
      description: description !== undefined ? description : assignment.description,
      scheduledStart: finalStartStr,
      scheduledEnd: finalEndStr,
      status: status !== undefined ? status : assignment.status,
      isActive: isActive !== undefined ? !!isActive : assignment.isActive
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to update assignment", error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { assignmentId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const assignmentId = params.assignmentId;

  try {
    const assignment = await mockDb.getSecfacAssignmentById(assignmentId);
    if (!assignment) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions
    if (!isAdmin) {
      if (assignment.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to delete security assignments" }, { status: 403 });
      }
      if (assignment.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to delete facility assignments" }, { status: 403 });
      }
    }

    // Soft delete
    await mockDb.deleteSecfacAssignment(assignmentId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to delete assignment", error: error.message }, { status: 500 });
  }
}
