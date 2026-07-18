import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { getSecfacLiveMonitoringSnapshot } from "@/lib/secfac-monitoring-helpers";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const role = (user.role || "EMPLOYEE").toUpperCase().replace(/\s+/g, "_");
  const isAdmin = isAdminUser(user);
  
  const isSupervisor = [
    "SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR",
    "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER",
    "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"
  ].includes(role);

  // 1. Enforce RBAC: only admins and supervisors allowed
  if (!isAdmin && !isSupervisor) {
    return NextResponse.json({ success: false, error: "Forbidden: Access denied to live monitoring data" }, { status: 403 });
  }

  // 2. Parse query parameters
  const { searchParams } = new URL(request.url);
  const operationType = searchParams.get("operationType") || "ALL";
  const project = searchParams.get("project") || "ALL";
  const site = searchParams.get("site") || "ALL";
  const employee = searchParams.get("employee") || "ALL";
  const status = searchParams.get("status") || "ALL";
  const dateRange = searchParams.get("dateRange") || "ALL";

  try {
    const snapshot = await getSecfacLiveMonitoringSnapshot(
      { operationType, project, site, employee, status, dateRange },
      user
    );

    return NextResponse.json({
      success: true,
      data: snapshot
    });
  } catch (err: any) {
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Forbidden: Operation scope access denied" }, { status: 403 });
    }
    return NextResponse.json({
      success: false,
      error: err.message || "Failed to retrieve live monitoring snapshot"
    }, { status: 500 });
  }
}
