import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request, context: { params: { business: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const params = await context.params;
  const business = params?.business;
  const isSecurity = business === "security-guarding";
  const expectedType = isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, isSecurity ? "manpower.security.view" : "manpower.fm.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  if (!dateStr) {
    return NextResponse.json({ error: "Date is required (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const deployments = await mockDb.getManpowerDeployments(expectedType, dateStr);
    return NextResponse.json(deployments);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch deployments" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: { business: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const params = await context.params;
  const business = params?.business;
  const isSecurity = business === "security-guarding";
  const expectedType = isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, isSecurity ? "manpower.security.manage" : "manpower.fm.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { action } = payload;

    if (action === "create_deployment") {
      const { date, shiftRequirementId } = payload;
      if (!date || !shiftRequirementId) {
        return NextResponse.json({ error: "Date and shiftRequirementId are required" }, { status: 400 });
      }
      const dep = await mockDb.createManpowerDeployment({
        date,
        shiftRequirementId,
        operationType: expectedType,
        approvalStatus: "DRAFT"
      });
      return NextResponse.json(dep);
    }

    if (action === "assign") {
      const { deploymentId, employeeId, date } = payload;
      if (!deploymentId || !employeeId || !date) {
        return NextResponse.json({ error: "deploymentId, employeeId, and date are required" }, { status: 400 });
      }

      // --- Business Validations ---
      const employees = await mockDb.getEmployees();
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }

      // 1. Cross-business block
      if (employee.operationType !== expectedType) {
        return NextResponse.json({
          error: `Cross-business block: Employee ${employee.name} (${employee.operationType}) cannot be assigned to ${expectedType} operations.`
        }, { status: 400 });
      }

      // 2. Double-booking check
      const deployments = await mockDb.getManpowerDeployments(expectedType, date);
      for (const dep of deployments) {
        for (const asg of dep.assignments) {
          if (asg.employeeId === employeeId) {
            return NextResponse.json({
              error: `Double-booking block: Employee ${employee.name} is already assigned to a shift on this date.`
            }, { status: 400 });
          }
          for (const rel of asg.relieverAssignments) {
            if (rel.relieverEmployeeId === employeeId) {
              return NextResponse.json({
                error: `Double-booking block: Employee ${employee.name} is already assigned as a reliever on this date.`
              }, { status: 400 });
            }
          }
        }
      }

      // 3. Leave overlap check
      const leaves = await mockDb.getLeaves();
      const dateGte = new Date(date);
      dateGte.setUTCHours(0, 0, 0, 0);
      const dateLte = new Date(date);
      dateLte.setUTCHours(23, 59, 59, 999);

      const hasLeave = leaves.some(l => {
        if (l.employeeId !== employeeId || l.status !== "APPROVED") return false;
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        return start <= dateLte && end >= dateGte;
      });

      if (hasLeave) {
        return NextResponse.json({
          error: `Leave conflict: Employee ${employee.name} has approved leave on this date.`
        }, { status: 400 });
      }

      // Perform assignment
      const asg = await mockDb.assignManpowerToDeployment({
        deploymentId,
        employeeId,
        isReliever: false
      });
      return NextResponse.json(asg);
    }

    if (action === "unassign") {
      const { assignmentId } = payload;
      if (!assignmentId) {
        return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
      }
      await mockDb.unassignManpowerFromDeployment(assignmentId);
      return NextResponse.json({ success: true });
    }

    if (action === "relieve") {
      const { originalAssignmentId, relieverEmployeeId, reason, date } = payload;
      if (!originalAssignmentId || !relieverEmployeeId || !date) {
        return NextResponse.json({ error: "originalAssignmentId, relieverEmployeeId, and date are required" }, { status: 400 });
      }

      // Validate reliever
      const employees = await mockDb.getEmployees();
      const reliever = employees.find(e => e.id === relieverEmployeeId);
      if (!reliever) {
        return NextResponse.json({ error: "Reliever not found" }, { status: 404 });
      }

      // 1. Cross-business block
      if (reliever.operationType !== expectedType) {
        return NextResponse.json({
          error: `Cross-business block: Reliever ${reliever.name} belongs to ${reliever.operationType} and cannot be assigned here.`
        }, { status: 400 });
      }

      // 2. Double-booking check
      const deployments = await mockDb.getManpowerDeployments(expectedType, date);
      for (const dep of deployments) {
        for (const asg of dep.assignments) {
          if (asg.employeeId === relieverEmployeeId) {
            return NextResponse.json({
              error: `Double-booking block: Reliever ${reliever.name} is already assigned on this date.`
            }, { status: 400 });
          }
          for (const rel of asg.relieverAssignments) {
            if (rel.relieverEmployeeId === relieverEmployeeId) {
              return NextResponse.json({
                error: `Double-booking block: Reliever ${reliever.name} is already assigned as a reliever on this date.`
              }, { status: 400 });
            }
          }
        }
      }

      // 3. Leave overlap check
      const leaves = await mockDb.getLeaves();
      const dateGte = new Date(date);
      dateGte.setUTCHours(0, 0, 0, 0);
      const dateLte = new Date(date);
      dateLte.setUTCHours(23, 59, 59, 999);

      const hasLeave = leaves.some(l => {
        if (l.employeeId !== relieverEmployeeId || l.status !== "APPROVED") return false;
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        return start <= dateLte && end >= dateGte;
      });

      if (hasLeave) {
        return NextResponse.json({
          error: `Leave conflict: Reliever ${reliever.name} has approved leave on this date.`
        }, { status: 400 });
      }

      const rel = await mockDb.createRelieverAssignment({
        originalAssignmentId,
        relieverEmployeeId,
        reason,
        status: "APPROVED"
      });
      return NextResponse.json(rel);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to process deployment action" }, { status: 500 });
  }
}
