import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { ReportService } from "@/lib/report-service";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "HR", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  const session = auth.session;
  const userRole = (session?.user as any).role;
  const userId = (session?.user as any).id;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    
    let departmentId = searchParams.get("departmentId") || undefined;
    let employeeId = searchParams.get("employeeId") || undefined;

    // RBAC filtering
    if (userRole === "EMPLOYEE") {
      employeeId = userId;
      departmentId = undefined; // Force self-only
    } else if (userRole === "SUPERVISOR") {
      // Find supervisor's department
      const employees = await mockDb.getEmployees();
      const supervisor = employees.find(e => e.id === userId);
      if (supervisor?.departmentId) {
        departmentId = supervisor.departmentId;
      } else {
        return NextResponse.json({ error: "Supervisor department not found" }, { status: 400 });
      }
      if (employeeId) {
        // Confirm requested employee is in supervisor's department
        const targetEmp = employees.find(e => e.id === employeeId);
        if (targetEmp?.departmentId !== departmentId) {
          return NextResponse.json({ error: "Access denied: Employee not in department" }, { status: 403 });
        }
      }
    }

    const data = await ReportService.getAttendanceReport({
      startDate,
      endDate,
      departmentId,
      employeeId
    });

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate attendance report" }, { status: 500 });
  }
}
