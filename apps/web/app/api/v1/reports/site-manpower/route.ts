import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const sites = await mockDb.getProjectSites();
    const deployments = await mockDb.getDeployments({ date });
    const employees = await mockDb.getEmployees();

    const data = sites.map(site => {
      const siteDeps = deployments.filter(d => d.siteId === site.id);
      const uniqueEmployeeIds = Array.from(new Set(siteDeps.map(d => d.employeeId)));
      const totalPlannedHours = siteDeps.reduce((sum, d) => sum + d.plannedHours, 0);

      const details = uniqueEmployeeIds.map(empId => {
        const emp = employees.find(e => e.id === empId);
        const empDeps = siteDeps.filter(d => d.employeeId === empId);
        const hours = empDeps.reduce((sum, d) => sum + d.plannedHours, 0);
        return {
          employeeId: empId,
          employeeName: emp ? emp.name : "Unknown",
          plannedHours: hours
        };
      });

      return {
        siteId: site.id,
        siteName: site.siteName,
        siteCode: site.siteCode,
        headcount: uniqueEmployeeIds.length,
        totalPlannedHours,
        details
      };
    });

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate site manpower report" }, { status: 500 });
  }
}
