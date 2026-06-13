import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: (session?.user as any)?.id },
      include: { leaveType: true },
      orderBy: { submittedAt: "desc" },
      take: 20
    });

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

    const employee = await prisma.employee.findUnique({ where: { id: (session?.user as any)?.id } });
    const leaveTypeObj = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: employee!.id,
        employeeName: employee!.name,
        leaveTypeId,
        type: leaveTypeObj?.name || "Annual",
        dateRange: `${startDate} to ${endDate}`,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "PENDING",
        reason
      }
    });

    return NextResponse.json({ success: true, leaveRequest });
  } catch (error) {
    console.error("POST /leaves Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
