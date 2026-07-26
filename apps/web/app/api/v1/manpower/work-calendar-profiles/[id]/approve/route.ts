import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { validateProfileOverlap } from "@/lib/manpower-work-calendar-engine";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.approve" });
  if (auth.error) return auth.error;
  const user = auth.session.user;

  const profile = await prisma.manpowerWorkCalendarProfile.findUnique({
    where: { id: params.id }
  });

  if (!profile) {
    return NextResponse.json({ error: "Work calendar profile not found" }, { status: 404 });
  }

  if (profile.approvalStatus === "APPROVED") {
    return NextResponse.json({ error: "Profile is already approved and immutable" }, { status: 400 });
  }

  // Validate complete threshold values before approval
  if (
    profile.ordinaryDailyMinutes == null ||
    profile.ordinaryWeeklyMinutes == null ||
    profile.ramadanDailyMinutes == null ||
    profile.ramadanWeeklyMinutes == null ||
    !profile.weeklyRestConfigType
  ) {
    return NextResponse.json(
      { error: "Approved profiles must explicitly contain ordinary & ramadan daily/weekly minute thresholds and weekly rest configuration" },
      { status: 400 }
    );
  }

  // Validate overlap
  const overlap = await validateProfileOverlap({
    id: profile.id,
    operationType: profile.operationType,
    workerCategory: profile.workerCategory,
    effectiveFrom: profile.effectiveFrom,
    effectiveTo: profile.effectiveTo,
    companyId: profile.companyId
  });

  if (overlap.hasOverlap) {
    return NextResponse.json(
      { error: `OVERLAP_CONFLICT: Proposed profile overlaps with existing approved profile ${overlap.overlappingProfileId}` },
      { status: 409 }
    );
  }

  const updated = await prisma.manpowerWorkCalendarProfile.update({
    where: { id: profile.id },
    data: {
      approvalStatus: "APPROVED",
      approvedBy: user.id,
      approvedAt: new Date()
    }
  });

  try {
    await prisma.userActivityLog.create({
      data: {
        userId: user.id,
        action: "APPROVE_WORK_CALENDAR_PROFILE",
        entityType: "ManpowerWorkCalendarProfile",
        entityId: profile.id,
        afterJson: JSON.stringify({ code: updated.code, version: updated.version, status: updated.approvalStatus })
      }
    });
  } catch (e) {}

  return NextResponse.json({ success: true, profile: updated });
}
