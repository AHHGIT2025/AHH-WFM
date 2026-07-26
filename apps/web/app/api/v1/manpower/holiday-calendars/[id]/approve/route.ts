import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.approve" });
  if (auth.error) return auth.error;
  const user = auth.session.user;

  const calendar = await prisma.manpowerHolidayCalendar.findUnique({
    where: { id: params.id },
    include: { dates: true }
  });

  if (!calendar) {
    return NextResponse.json({ error: "Holiday calendar not found" }, { status: 404 });
  }

  if (calendar.approvalStatus === "APPROVED") {
    return NextResponse.json({ error: "Holiday calendar is already approved and immutable" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Approve dates
    await tx.manpowerHolidayDate.updateMany({
      where: { calendarId: calendar.id },
      data: { approvalStatus: "APPROVED" }
    });

    return await tx.manpowerHolidayCalendar.update({
      where: { id: calendar.id },
      data: {
        approvalStatus: "APPROVED",
        approvedById: user.id,
        approvedBy: user.id,
        approvedAt: new Date()
      }
    });
  });

  try {
    await prisma.userActivityLog.create({
      data: {
        userId: user.id,
        action: "APPROVE_HOLIDAY_CALENDAR",
        entityType: "ManpowerHolidayCalendar",
        entityId: calendar.id,
        afterJson: JSON.stringify({ year: updated.year, scope: updated.scope, version: updated.version, status: updated.approvalStatus })
      }
    });
  } catch (e) {}

  return NextResponse.json({ success: true, calendar: updated });
}
