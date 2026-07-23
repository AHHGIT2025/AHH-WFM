import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../lib/api-guards";
import { hasPermission } from "../../../../../lib/permissions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");

  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId query parameter" }, { status: 400 });
  }

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: ["Approved", "APPROVED"] }
      },
      orderBy: { startDate: "desc" }
    });

    return NextResponse.json({ success: true, leaveRequests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch leave requests" }, { status: 500 });
  }
}
