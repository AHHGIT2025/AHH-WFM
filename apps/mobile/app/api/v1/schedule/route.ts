import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    const employeeId = (session?.user as any)?.employeeId || userId;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const todayStr = new Date().toISOString().split("T")[0];

    const deployments = await prisma.employeeDeployment.findMany({
      where: { employeeId: userId, deploymentDate: { gte: todayStr } },
      include: { project: true, site: true },
      take: 5,
      orderBy: { deploymentDate: "asc" }
    });

    const shifts = await prisma.shiftAssignment.findMany({
      where: { employeeId: userId },
      include: { shiftTemplate: true },
      take: 5,
      orderBy: { createdAt: "desc" }
    });

    const onCalls = await prisma.onCallAssignment.findMany({
      where: { employeeId: userId, assignmentDate: { gte: todayStr } },
      include: { project: true, site: true },
      take: 5,
      orderBy: { assignmentDate: "asc" }
    });

    // Published roster slots for this employee
    const publishedSlots = await prisma.rosterPublicationSlot.findMany({
      where: {
        employeeId: employeeId,
        publication: {
          status: "ACTIVE"
        }
      },
      include: {
        publication: true,
        acknowledgments: {
          where: { employeeId }
        }
      },
      orderBy: { businessDate: "asc" },
      take: 10
    });

    const formattedPublishedSlots = publishedSlots.map(slot => {
      const isAcked = slot.acknowledgments.length > 0;
      return {
        id: slot.id,
        publicationId: slot.publicationId,
        publicationVersion: slot.publication.publicationVersion,
        operationType: slot.publication.operationType,
        position: slot.position,
        shiftName: slot.shiftName,
        startTime: slot.startTime,
        endTime: slot.endTime,
        businessDate: slot.businessDate,
        coverageType: slot.coverageType,
        assignmentStatus: slot.assignmentStatus,
        isAcknowledged: isAcked,
        acknowledgedAt: isAcked ? slot.acknowledgments[0].acknowledgedAt : null
      };
    });

    return NextResponse.json({
      deployments,
      shifts,
      onCalls,
      publishedSlots: formattedPublishedSlots
    });
  } catch (error) {
    console.error("GET /schedule Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
