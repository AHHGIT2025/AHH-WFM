import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const todayStr = new Date().toISOString().split("T")[0];

    const deployments = await prisma.employeeDeployment.findMany({
      where: { employeeId: (session?.user as any)?.id, deploymentDate: { gte: todayStr } },
      include: { project: true, site: true },
      take: 5,
      orderBy: { deploymentDate: "asc" }
    });

    const shifts = await prisma.shiftAssignment.findMany({
      where: { employeeId: (session?.user as any)?.id },
      include: { shiftTemplate: true },
      take: 5,
      orderBy: { createdAt: "desc" }
    });

    const onCalls = await prisma.onCallAssignment.findMany({
      where: { employeeId: (session?.user as any)?.id, assignmentDate: { gte: todayStr } },
      include: { project: true, site: true },
      take: 5,
      orderBy: { assignmentDate: "asc" }
    });

    return NextResponse.json({
      deployments,
      shifts,
      onCalls
    });
  } catch (error) {
    console.error("GET /schedule Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
