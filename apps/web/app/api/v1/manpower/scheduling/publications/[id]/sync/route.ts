import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../../lib/permissions";
import { syncAssignmentToLegacy } from "../../../../../../../../lib/roster-engine";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;

  // Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.sync")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to sync publications." }, { status: 403 });
  }

  const publicationId = params.id;

  try {
    const publication = await prisma.rosterPublication.findUnique({
      where: { id: publicationId },
      include: {
        publicationSlots: {
          where: { employeeId: { not: null } }
        }
      }
    });

    if (!publication) {
      return NextResponse.json({ error: "Publication not found" }, { status: 404 });
    }

    let syncedCount = 0;
    let failedCount = 0;

    for (const pubSlot of publication.publicationSlots) {
      // Find the active assignment for this slot and employee
      const assignment = await prisma.rosterSlotAssignment.findFirst({
        where: {
          slotId: pubSlot.slotId,
          employeeId: pubSlot.employeeId!,
          historyStatus: "ACTIVE"
        }
      });

      if (assignment) {
        const res = await syncAssignmentToLegacy(assignment.id);
        if (res.success) {
          syncedCount++;
        } else {
          failedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      publicationId,
      totalSlots: publication.publicationSlots.length,
      syncedCount,
      failedCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to synchronize publication" }, { status: 500 });
  }
}
