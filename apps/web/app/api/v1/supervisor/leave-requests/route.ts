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
    const teamIds = team.map(t => t.id);

    const leaves = await mockDb.getLeaves();
    
    // Filter leaves to only include team members, but EXCLUDE the supervisor's own leave
    const teamLeaves = leaves.filter(l => teamIds.includes(l.employeeId) && l.employeeId !== supervisorId);

    return NextResponse.json(teamLeaves);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch leave requests" }, { status: 500 });
  }
}
