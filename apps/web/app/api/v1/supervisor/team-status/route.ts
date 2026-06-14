import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { getSupervisorTeam } from "@/lib/supervisor";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET() {
  const auth = await checkApiAuth(["SUPERVISOR", "ADMIN"]);
  if (auth.error) return auth.error;

  try {
    if (!auth.session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supervisorId = (auth.session.user as any).id;
    const team = await getSupervisorTeam(supervisorId);
    const today = new Date().toISOString().split("T")[0];

    const attendance = await mockDb.getAttendance();
    const todayAttendance = attendance.filter(a => a.checkIn.startsWith(today) || a.originalCheckIn.startsWith(today));

    const statusCounts = {
      total: team.length,
      present: 0,
      absent: 0,
      onLeave: 0
    };

    const teamStatus = team.map(emp => {
      const att = todayAttendance.find(a => a.employeeId === emp.id);
      
      let currentStatus = emp.status || "Offline";
      if (emp.status === "On Leave") {
        statusCounts.onLeave++;
      } else if (att) {
        statusCounts.present++;
        currentStatus = "On Duty";
      } else {
        statusCounts.absent++;
      }

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        status: currentStatus,
        attendance: att || null
      };
    });

    return NextResponse.json({
      counts: statusCounts,
      members: teamStatus
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch team status" }, { status: 500 });
  }
}
