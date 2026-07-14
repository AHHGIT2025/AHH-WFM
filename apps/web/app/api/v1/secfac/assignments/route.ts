import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

const APPROVED_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED", "OVERDUE"];

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};

  const { searchParams } = new URL(request.url);
  const operationTypeFilter = searchParams.get("operationType");
  const clientId = searchParams.get("clientId");
  const projectId = searchParams.get("projectId");
  const siteId = searchParams.get("siteId");
  const locationUnitId = searchParams.get("locationUnitId");
  const checkpointId = searchParams.get("checkpointId");
  const templateId = searchParams.get("templateId");
  const employeeId = searchParams.get("employeeId");
  const supervisorId = searchParams.get("supervisorId");
  const status = searchParams.get("status");
  const isActive = searchParams.get("isActive");
  const scheduledStart = searchParams.get("scheduledStart");
  const scheduledEnd = searchParams.get("scheduledEnd");

  // Apply RBAC Operation Restrictions
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

  let targetOp = operationTypeFilter;
  if (targetOp) {
    if (!allowedOps.includes(targetOp)) {
      return NextResponse.json({ success: false, error: `Forbidden: No access to operation type ${targetOp}` }, { status: 403 });
    }
  } else {
    if (allowedOps.length === 1) {
      targetOp = allowedOps[0];
    }
  }

  try {
    const assignments = await mockDb.getSecfacAssignments({
      operationType: targetOp || undefined,
      clientId: clientId || undefined,
      projectId: projectId || undefined,
      siteId: siteId || undefined,
      locationUnitId: locationUnitId || undefined,
      checkpointId: checkpointId || undefined,
      templateId: templateId || undefined,
      employeeId: employeeId || undefined,
      supervisorId: supervisorId || undefined,
      status: status || undefined,
      isActive: isActive !== null ? isActive : undefined,
      scheduledStart: scheduledStart || undefined,
      scheduledEnd: scheduledEnd || undefined
    });

    let filtered = assignments;
    if (!isAdmin) {
      filtered = assignments.filter(x => allowedOps.includes(x.operationType));
    }

    return NextResponse.json({ success: true, data: filtered });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve assignments", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};

  try {
    const payload = await request.json();
    const {
      operationType,
      clientId,
      projectId,
      siteId,
      locationUnitId,
      checkpointId,
      templateId,
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

    // 1. Mandatory Fields Validation
    if (!assignmentName) {
      return NextResponse.json({ success: false, error: "assignmentName is required" }, { status: 400 });
    }
    if (!operationType) {
      return NextResponse.json({ success: false, error: "operationType is required" }, { status: 400 });
    }
    if (!employeeId) {
      return NextResponse.json({ success: false, error: "employeeId is required" }, { status: 400 });
    }
    if (!siteId) {
      return NextResponse.json({ success: false, error: "siteId is required" }, { status: 400 });
    }
    if (!scheduledStart) {
      return NextResponse.json({ success: false, error: "scheduledStart date/time is required" }, { status: 400 });
    }
    if (!scheduledEnd) {
      return NextResponse.json({ success: false, error: "scheduledEnd date/time is required" }, { status: 400 });
    }

    // 2. Validate Operation Type Value
    if (operationType !== "SECURITY_GUARDING" && operationType !== "FACILITY_MANAGEMENT") {
      return NextResponse.json({ success: false, error: "Invalid operationType value" }, { status: 400 });
    }

    // 3. User Scope Restrictions
    if (!isAdmin) {
      if (operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No security operations access allowed" }, { status: 403 });
      }
      if (operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No facility operations access allowed" }, { status: 403 });
      }
    }

    // 4. Validate Dates Chronological Order
    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid scheduled start or end date/time values" }, { status: 400 });
    }
    if (start.getTime() >= end.getTime()) {
      return NextResponse.json({ success: false, error: "scheduledStart must be chronologically before scheduledEnd" }, { status: 400 });
    }

    // 5. Validate Status
    if (status && !APPROVED_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status value" }, { status: 400 });
    }

    // 6. Validate Employee Existence
    let employee: any = null;
    if (isDbConnected()) {
      employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    } else {
      const db = readDb();
      employee = (db.employees || []).find((e: any) => e.id === employeeId);
    }
    if (!employee) {
      return NextResponse.json({ success: false, error: "Employee not found" }, { status: 400 });
    }

    // 7. Validate Supervisor (if provided)
    if (supervisorId) {
      let supervisor: any = null;
      if (isDbConnected()) {
        supervisor = await prisma.employee.findUnique({ where: { id: supervisorId } });
      } else {
        const db = readDb();
        supervisor = (db.employees || []).find((e: any) => e.id === supervisorId);
      }
      if (!supervisor) {
        return NextResponse.json({ success: false, error: "Supervisor employee not found" }, { status: 400 });
      }
    }

    // 8. Validate Site Existence & Operation Type Match
    let site: any = null;
    if (isDbConnected()) {
      site = await prisma.manpowerSite.findUnique({ where: { id: siteId } });
    } else {
      const db = readDb();
      site = (db.manpowerSites || []).find((s: any) => s.id === siteId);
    }
    if (!site) {
      return NextResponse.json({ success: false, error: "Site not found" }, { status: 400 });
    }
    if (site.operationType !== operationType) {
      return NextResponse.json({ success: false, error: "Operation type mismatch between assignment and site" }, { status: 400 });
    }

    // 9. Validate Checkpoint Existence & Operation Type Match
    if (checkpointId) {
      let cp: any = null;
      if (isDbConnected()) {
        cp = await prisma.secfacCheckpoint.findUnique({ where: { id: checkpointId } });
      } else {
        const db = readDb();
        cp = (db.secfacCheckpoints || []).find((c: any) => c.id === checkpointId);
      }
      if (!cp) {
        return NextResponse.json({ success: false, error: "Checkpoint not found" }, { status: 400 });
      }
      if (cp.operationType !== operationType) {
        return NextResponse.json({ success: false, error: "Operation type mismatch between assignment and checkpoint" }, { status: 400 });
      }
    }

    // 10. Validate Checklist Template Existence & Operation Type Match
    if (templateId) {
      let tpl: any = null;
      if (isDbConnected()) {
        tpl = await prisma.secfacChecklistTemplate.findUnique({ where: { id: templateId } });
      } else {
        const db = readDb();
        tpl = (db.secfacChecklistTemplates || []).find((t: any) => t.id === templateId);
      }
      if (!tpl) {
        return NextResponse.json({ success: false, error: "Checklist template not found" }, { status: 400 });
      }
      if (tpl.operationType !== operationType) {
        return NextResponse.json({ success: false, error: "Operation type mismatch between assignment and checklist template" }, { status: 400 });
      }
    }

    // Save Assignment
    const result = await mockDb.createSecfacAssignment({
      operationType,
      clientId: clientId || null,
      projectId: projectId || null,
      siteId,
      locationUnitId: locationUnitId || null,
      checkpointId: checkpointId || null,
      templateId: templateId || null,
      employeeId,
      supervisorId: supervisorId || null,
      assignmentName,
      assignmentCode: assignmentCode || null,
      description: description || null,
      scheduledStart: start.toISOString(),
      scheduledEnd: end.toISOString(),
      status: status || "PENDING",
      isActive: isActive !== false
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to create assignment", error: error.message }, { status: 500 });
  }
}
