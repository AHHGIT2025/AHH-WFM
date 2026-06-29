import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function getShiftIntervals(start: string, end: string): { start: number; end: number }[] {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s < e) {
    return [{ start: s, end: e }];
  } else {
    return [
      { start: s, end: 1440 },
      { start: 0, end: e }
    ];
  }
}

function intervalsOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

function areShiftsOverlapping(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = start1 || "00:00";
  const e1 = end1 || "23:59";
  const s2 = start2 || "00:00";
  const e2 = end2 || "23:59";
  const ints1 = getShiftIntervals(s1, e1);
  const ints2 = getShiftIntervals(s2, e2);
  for (const i1 of ints1) {
    for (const i2 of ints2) {
      if (intervalsOverlap(i1, i2)) {
        return true;
      }
    }
  }
  return false;
}

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

      // Fetch all deployments on this date to inspect requirements, assignments, shift times
      const deployments = await mockDb.getManpowerDeployments(expectedType, date);
      const targetDeployment = deployments.find(d => d.id === deploymentId);
      if (!targetDeployment) {
        return NextResponse.json({ error: "Target deployment not found on this date." }, { status: 404 });
      }

      const targetStart = targetDeployment.shiftRequirement?.shiftStartTime || "00:00";
      const targetEnd = targetDeployment.shiftRequirement?.shiftEndTime || "23:59";

      // 2. Double-booking / Shift timing overlap check
      let hasOverlap = false;
      let isOvertimeAssignment = false;
      let existingAssignedShiftInfo = "";

      for (const dep of deployments) {
        for (const asg of dep.assignments || []) {
          if (asg.employeeId === employeeId) {
            isOvertimeAssignment = true;
            const existingStart = dep.shiftRequirement?.shiftStartTime || "00:00";
            const existingEnd = dep.shiftRequirement?.shiftEndTime || "23:59";
            if (areShiftsOverlapping(targetStart, targetEnd, existingStart, existingEnd)) {
              hasOverlap = true;
              existingAssignedShiftInfo = `${dep.shiftRequirement?.shiftCode || "Unnamed Shift"} (${existingStart} - ${existingEnd})`;
              break;
            }
          }
          for (const rel of asg.relieverAssignments || []) {
            if (rel.relieverEmployeeId === employeeId) {
              isOvertimeAssignment = true;
              const existingStart = dep.shiftRequirement?.shiftStartTime || "00:00";
              const existingEnd = dep.shiftRequirement?.shiftEndTime || "23:59";
              if (areShiftsOverlapping(targetStart, targetEnd, existingStart, existingEnd)) {
                hasOverlap = true;
                existingAssignedShiftInfo = `Reliever for ${dep.shiftRequirement?.shiftCode || "Unnamed Shift"} (${existingStart} - ${existingEnd})`;
                break;
              }
            }
          }
        }
        if (hasOverlap) break;
      }

      if (hasOverlap) {
        return NextResponse.json({
          error: `Double-booking overlap: Employee ${employee.name} is already assigned to an overlapping shift on this date: ${existingAssignedShiftInfo}.`
        }, { status: 400 });
      }

      // Check if overtime and require reason
      if (isOvertimeAssignment && !payload.overtimeReason) {
        return NextResponse.json({
          error: `Overtime assignment: Employee ${employee.name} is already assigned to another shift on this date. An overtime reason is required to assign this additional shift.`
        }, { status: 400 });
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

      // 4. Deployability check
      const categories = await mockDb.getManpowerCategories(expectedType);
      const empCategory = categories.find(c => c.name === employee.employeeCategory || c.code === employee.employeeCategory || c.id === employee.employeeCategoryId);
      if (empCategory && empCategory.isDeployableInRoster === false) {
        return NextResponse.json({
          error: `Roster assignment blocked: Employee category '${employee.employeeCategory}' is not deployable in the roster.`
        }, { status: 400 });
      }

      // Fetch target site to determine validation modes
      const siteId = targetDeployment.shiftRequirement?.siteId;
      const sites = await mockDb.getManpowerSites(expectedType);
      const targetSite = sites.find(s => s.id === siteId);

      const warnings: string[] = [];

      // 5. MOI License validation
      if (empCategory?.requiresMoiLicense) {
        const licenses = await mockDb.getSecurityLicenses(employeeId);
        const todayStr = new Date().toISOString().split("T")[0];
        const validLicense = licenses.find(lic => lic.expiryDate && lic.expiryDate >= todayStr);
        if (!validLicense) {
          const mode = targetSite?.gatePassValidationMode || "WARNING";
          if (mode === "STRICT") {
            return NextResponse.json({
              error: `MOI License block: Employee ${employee.name} does not have a valid, unexpired MOI Security License, which is strictly required for this site.`
            }, { status: 400 });
          } else {
            warnings.push("Missing or expired MOI License.");
          }
        }
      }

      // 6. Gate Pass validation
      if (empCategory?.requiresGatePassCheck && targetSite?.gatePassRequired) {
        const gatePasses = await mockDb.getSecurityGatePasses(employeeId, siteId);
        const todayStr = new Date().toISOString().split("T")[0];
        const validGatePass = gatePasses.find(gp => gp.expiryDate && gp.expiryDate >= todayStr && gp.status === "ACTIVE");
        if (!validGatePass) {
          const mode = targetSite?.gatePassValidationMode || "WARNING";
          if (mode === "STRICT") {
            return NextResponse.json({
              error: `Gate Pass block: Employee ${employee.name} does not have a valid, active gate pass for site '${targetSite?.name || "this site"}', which is strictly required.`
            }, { status: 400 });
          } else {
            warnings.push(`Missing or expired Gate Pass for site '${targetSite?.name || "this site"}'.`);
          }
        }
      }

      // 7. Over-deployment check
      const requiredCount = targetDeployment.shiftRequirement?.requiredCount || 0;
      const currentAssignments = targetDeployment.assignments || [];
      const activeCount = currentAssignments.length;
      
      const st = payload.sourceType || "GENERAL_POOL";
      if (activeCount >= requiredCount && st !== "OJT" && st !== "FOC") {
        return NextResponse.json({
          error: `Over-deployment block: The shift requirement count (${requiredCount}) has already been met. To over-deploy, set deployment type/source to OJT (On-the-Job Training) or FOC (Free of Cost).`
        }, { status: 400 });
      }

      // Perform assignment
      const asg = await mockDb.assignManpowerToDeployment({
        deploymentId,
        employeeId,
        isReliever: false,
        isOvertime: isOvertimeAssignment,
        overtimeReason: payload.overtimeReason || null,
        deploymentType: payload.deploymentType || (isOvertimeAssignment ? "OVERTIME" : "PERMANENT"),
        sourceType: st,
        validationWarnings: warnings.length > 0 ? warnings : null
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
