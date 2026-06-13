import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { ReportService } from "@/lib/report-service";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "FINANCE", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  const session = auth.session;
  const userRole = (session?.user as any).role;
  const userId = (session?.user as any).id;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || undefined;
    let departmentId = searchParams.get("departmentId") || undefined;
    let employeeId = searchParams.get("employeeId") || undefined;

    // RBAC filtering
    if (userRole === "EMPLOYEE") {
      employeeId = userId;
      departmentId = undefined;
    } else if (userRole === "SUPERVISOR") {
      const employees = await mockDb.getEmployees();
      const supervisor = employees.find(e => e.id === userId);
      if (supervisor?.departmentId) {
        departmentId = supervisor.departmentId;
      } else {
        return NextResponse.json({ error: "Supervisor department not found" }, { status: 400 });
      }
      if (employeeId) {
        const targetEmp = employees.find(e => e.id === employeeId);
        if (targetEmp?.departmentId !== departmentId) {
          return NextResponse.json({ error: "Access denied: Employee not in department" }, { status: 403 });
        }
      }
    }

    const data = await ReportService.getOvertimeReport({
      departmentId,
      employeeId,
      period
    });

    // Mask financial details for supervisors and employees if needed
    if (userRole === "SUPERVISOR" || userRole === "EMPLOYEE") {
      // Set pay amounts to 0 or mask them as undefined to ensure hours-only visibility
      if (data.approvedOvertime) {
        data.approvedOvertime = data.approvedOvertime.map((o: any) => ({ ...o, overtimePayAmount: 0 }));
      }
      if (data.pendingOvertime) {
        data.pendingOvertime = data.pendingOvertime.map((o: any) => ({ ...o, overtimePayAmount: 0 }));
      }
      data.costByDepartment = {};
      data.costByEmployee = {};
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate overtime report" }, { status: 500 });
  }
}
