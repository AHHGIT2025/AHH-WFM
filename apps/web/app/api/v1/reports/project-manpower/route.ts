import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
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
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate project manpower report" }, { status: 500 });
  }
}
