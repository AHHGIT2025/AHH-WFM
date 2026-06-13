import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const employee = await prisma.employee.findUnique({
      where: { id: (session?.user as any)?.id }
    });

    if (!employee || (employee.role !== "SUPERVISOR" && employee.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden. Supervisor role required." }, { status: 403 });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Mock simple team aggregation
    // A real implementation would get all employees under this supervisor's department or project
    const teamMembers = await prisma.employee.findMany({
      where: { 
        companyId: employee.companyId,
        id: { not: employee.id } // exclude self
      },
      include: {
        attendance: {
          where: { checkIn: { gte: startOfDay, lte: endOfDay } }
        },
        designation: true
      },
      take: 20
    });

    let present = 0;
    let absent = 0;
    let late = 0;
    let outOfZone = 0;

    const roster = teamMembers.map(member => {
      const todayRecord = member.attendance[0];
      if (todayRecord) {
        present++;
        if (todayRecord.status === "LATE") late++;
        if (todayRecord.status === "OUT_OF_ZONE") outOfZone++;
      } else {
        absent++;
      }

      return {
        id: member.id,
        name: member.name,
        designation: member.designation?.name || "Unknown",
        status: todayRecord ? todayRecord.status : "ABSENT",
        checkInTime: todayRecord?.checkIn || null
      };
    });

    return NextResponse.json({
      summary: {
        total: teamMembers.length,
        present,
        absent,
        late,
        outOfZone
      },
      roster
    });

  } catch (error) {
    console.error("GET /supervisor/team-status Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
