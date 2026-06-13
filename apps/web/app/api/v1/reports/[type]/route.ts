import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request, { params }: { params: { type: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const startDate = url.searchParams.get("startDate") || date;
  const endDate = url.searchParams.get("endDate") || date;

  try {
    const reportType = params.type.toLowerCase();

    // 1. PROJECT MANPOWER SCHEDULE
    if (reportType === "manpower" || reportType === "project-manpower") {
      const projects = await mockDb.getProjects();
      const deployments = await mockDb.getDeployments({ date });
      const employees = await mockDb.getEmployees();

      const data = projects.map(proj => {
        const projDeps = deployments.filter(d => d.projectId === proj.id);
        const uniqueEmployeeIds = Array.from(new Set(projDeps.map(d => d.employeeId)));
        const totalPlannedHours = projDeps.reduce((sum, d) => sum + d.plannedHours, 0);

        const details = uniqueEmployeeIds.map(empId => {
          const emp = employees.find(e => e.id === empId);
          const empDeps = projDeps.filter(d => d.employeeId === empId);
          const hours = empDeps.reduce((sum, d) => sum + d.plannedHours, 0);
          return {
            employeeId: empId,
            employeeName: emp ? emp.name : "Unknown",
            plannedHours: hours
          };
        });

        return {
          projectId: proj.id,
          projectName: proj.projectName,
          projectCode: proj.projectCode,
          headcount: uniqueEmployeeIds.length,
          totalPlannedHours,
          details
        };
      });

      return NextResponse.json(data);
    }

    // 2. SITE COVERAGE
    if (reportType === "coverage" || reportType === "site-coverage") {
      const coverage = await mockDb.getDeploymentsCoverage(date);
      return NextResponse.json(coverage);
    }

    // 3. STANDBY POOL
    if (reportType === "standby" || reportType === "standby-pool") {
      const employees = await mockDb.getEmployees();
      const rules = await mockDb.getRelieverStandbyRules();
      const standbyDesignationIds = new Set(
        rules.filter(r => r.isActive && r.standbyRequired && r.designationId).map(r => r.designationId)
      );
      const standbyTradeIds = new Set(
        rules.filter(r => r.isActive && r.standbyRequired && r.tradeClassificationId).map(r => r.tradeClassificationId)
      );

      const standbyEmployees = employees.filter(emp => {
        return (
          emp.isStandbyEligible === true ||
          (emp.designationId && standbyDesignationIds.has(emp.designationId)) ||
          (emp.tradeClassificationId && standbyTradeIds.has(emp.tradeClassificationId))
        );
      });

      const deployments = await mockDb.getDeployments({ date });
      const deployedIds = new Set(deployments.map(d => d.employeeId));

      const report = standbyEmployees.map(emp => {
        let status = "STANDBY_AVAILABLE";
        if (deployedIds.has(emp.id)) {
          status = "DEPLOYED";
        } else if (emp.status === "On Leave" || emp.status === "Offline") {
          status = emp.status.toUpperCase().replace(" ", "_");
        }

        return {
          employeeId: emp.id,
          employeeName: emp.name,
          role: emp.role,
          designationId: emp.designationId,
          tradeClassificationId: emp.tradeClassificationId,
          isStandbyEligible: emp.isStandbyEligible,
          status,
          currentDutyStatus: emp.status
        };
      });

      return NextResponse.json(report);
    }

    // 4. RELIEVER ASSIGNMENT
    if (reportType === "relievers" || reportType === "reliever-assignment") {
      const assignments = await mockDb.getShiftRelieverAssignments();
      const employees = await mockDb.getEmployees();

      const filtered = assignments.filter(a => a.date === date);
      const report = filtered.map(a => {
        const origEmp = employees.find(e => e.id === a.originalEmployeeId);
        const relEmp = employees.find(e => e.id === a.relieverEmployeeId);

        return {
          ...a,
          originalEmployeeName: origEmp ? origEmp.name : "Unknown",
          relieverEmployeeName: relEmp ? relEmp.name : "Unknown"
        };
      });

      return NextResponse.json(report);
    }

    // 5. LEAVE/OFF/VACATION SCHEDULER
    if (reportType === "leave" || reportType === "leave-off-vacation" || reportType === "leaves") {
      const leaves = await mockDb.getLeaves();
      const employees = await mockDb.getEmployees();

      // Filter leaves matching the date range or date
      const targetTime = new Date(date).getTime();
      const filtered = leaves.filter(leave => {
        if (leave.status !== "Approved") return false;
        if (leave.startDate && leave.endDate) {
          const s = new Date(leave.startDate).getTime();
          const e = new Date(leave.endDate).getTime();
          return targetTime >= s && targetTime <= e;
        }
        return true;
      });

      const report = filtered.map(leave => {
        const emp = employees.find(e => e.id === leave.employeeId);
        return {
          ...leave,
          department: emp ? emp.department : undefined,
          role: emp ? emp.role : undefined
        };
      });

      return NextResponse.json(report);
    }

    // 6. SPLIT SHIFT
    if (reportType === "split-shift") {
      const assignments = await mockDb.getShiftAssignments();
      const employees = await mockDb.getEmployees();
      const templates = await mockDb.getShiftTemplates();

      const filtered = assignments.filter(a => {
        const saDateStr = typeof a.date === "string" ? a.date.split("T")[0] : new Date(a.date).toISOString().split("T")[0];
        if (saDateStr !== date) return false;

        const template = templates.find(t => t.id === a.shiftTemplateId);
        return a.isSplitShift === true || template?.isSplit === true;
      });

      const report = filtered.map(a => {
        const emp = employees.find(e => e.id === a.employeeId);
        const template = templates.find(t => t.id === a.shiftTemplateId);
        return {
          assignmentId: a.id,
          employeeId: a.employeeId,
          employeeName: emp ? emp.name : "Unknown",
          shiftTemplateId: a.shiftTemplateId,
          shiftName: template ? template.name : "Unknown",
          startTime: template ? template.startTime : "",
          endTime: template ? template.endTime : "",
          splitStart: template ? template.splitStart : undefined,
          splitEnd: template ? template.splitEnd : undefined,
          date: date
        };
      });

      return NextResponse.json(report);
    }

    // 7. EMPLOYEE DAILY ALLOCATION
    if (reportType === "daily-allocation" || reportType === "allocation") {
      const deployments = await mockDb.getDeployments({ date });
      const assignments = await mockDb.getShiftAssignments();
      const employees = await mockDb.getEmployees();
      const projects = await mockDb.getProjects();
      const sites = await mockDb.getProjectSites();

      const report = employees.map(emp => {
        const empDeps = deployments.filter(d => d.employeeId === emp.id);
        const empShift = assignments.find(a => {
          const saDateStr = typeof a.date === "string" ? a.date.split("T")[0] : new Date(a.date).toISOString().split("T")[0];
          return saDateStr === date && a.employeeId === emp.id;
        });

        const allocationDetails = empDeps.map(dep => {
          const proj = projects.find(p => p.id === dep.projectId);
          const site = sites.find(s => s.id === dep.siteId);
          return {
            type: "DEPLOYMENT",
            projectId: dep.projectId,
            projectName: proj ? proj.projectName : "Unknown Project",
            projectCode: proj ? proj.projectCode : "",
            siteId: dep.siteId,
            siteName: site ? site.siteName : "Unknown Site",
            startTime: dep.startTime,
            endTime: dep.endTime,
            plannedHours: dep.plannedHours,
            status: dep.status
          };
        });

        return {
          employeeId: emp.id,
          employeeName: emp.name,
          role: emp.role,
          department: emp.department,
          hasShiftAssignment: !!empShift,
          shiftTemplateId: empShift ? empShift.shiftTemplateId : null,
          allocations: allocationDetails
        };
      });

      return NextResponse.json(report);
    }

    return NextResponse.json({ error: `Unsupported report type: ${params.type}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to generate report" }, { status: 500 });
  }
}
