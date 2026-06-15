import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allLeaves = await mockDb.getLeaves();
    const employeeLeaves = allLeaves
      .filter((l: any) => l.employeeId === (session?.user as any)?.id)
      .sort((a: any, b: any) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime())
      .slice(0, 20);

    const leaveTypes = await mockDb.getLeaveTypes();
    const leaves = employeeLeaves.map((l: any) => ({
      ...l,
      leaveType: leaveTypes.find((lt: any) => lt.id === l.leaveTypeId || lt.name === l.type)
    }));

    return NextResponse.json({ leaves });
  } catch (error) {
    console.error("GET /leaves Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { leaveTypeId, startDate, endDate, reason } = body;

    const leaveTypes = await mockDb.getLeaveTypes();
    const leaveTypeObj = leaveTypes.find((lt: any) => lt.id === leaveTypeId);
    const leaveTypeName = leaveTypeObj?.name || "Annual Leave";

    const dateRange = `${startDate} to ${endDate}`;
    const leaveRequest = await mockDb.applyLeave(
      (session?.user as any)?.id,
      leaveTypeName,
      dateRange,
      reason
    );

    return NextResponse.json({ success: true, leaveRequest });
  } catch (error) {
    console.error("POST /leaves Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
