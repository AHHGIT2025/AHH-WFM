import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { validateProfileOverlap } from "@/lib/manpower-work-calendar-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const operationType = searchParams.get("operationType") || undefined;
  const workerCategory = searchParams.get("workerCategory") || undefined;

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const profiles = await prisma.manpowerWorkCalendarProfile.findMany({
    where: {
      ...(operationType ? { operationType } : {}),
      ...(workerCategory ? { workerCategory } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ success: true, profiles });
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  let body: any = {};
  try { body = await request.json(); } catch (e) {}

  const {
    code,
    name,
    operationType,
    workerCategory,
    ordinaryDailyMinutes,
    ordinaryWeeklyMinutes,
    ramadanDailyMinutes,
    ramadanWeeklyMinutes,
    weeklyRestConfigType,
    weeklyRestFixedDay,
    weeklyRestCustomSchedule,
    effectiveFrom,
    effectiveTo,
    approvalStatus,
    companyId,
    notes
  } = body;

  const userId = auth.session?.user?.id || "AD-0001";

  if (!code || !name || !operationType || !workerCategory || !effectiveFrom || !effectiveTo) {
    return NextResponse.json({ success: false, error: "Missing required profile fields" }, { status: 400 });
  }

  const targetStatus = approvalStatus || "DRAFT";
  if (targetStatus === "APPROVED") {
    if (
      ordinaryDailyMinutes == null ||
      ordinaryWeeklyMinutes == null ||
      ramadanDailyMinutes == null ||
      ramadanWeeklyMinutes == null
    ) {
      return NextResponse.json({
        success: false,
        error: "All daily and weekly minute thresholds are required before approving a Work Calendar Profile."
      }, { status: 400 });
    }

    const overlap = await validateProfileOverlap({
      operationType,
      workerCategory,
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: new Date(effectiveTo),
      companyId
    });

    if (overlap.hasOverlap) {
      return NextResponse.json({
        success: false,
        error: `Profile overlaps with existing approved profile ID: ${overlap.overlappingProfileId}`
      }, { status: 409 });
    }
  }

  try {
    const profile = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code,
        name,
        operationType,
        workerCategory,
        ordinaryDailyMinutes: ordinaryDailyMinutes != null ? parseInt(ordinaryDailyMinutes) : null,
        ordinaryWeeklyMinutes: ordinaryWeeklyMinutes != null ? parseInt(ordinaryWeeklyMinutes) : null,
        ramadanDailyMinutes: ramadanDailyMinutes != null ? parseInt(ramadanDailyMinutes) : null,
        ramadanWeeklyMinutes: ramadanWeeklyMinutes != null ? parseInt(ramadanWeeklyMinutes) : null,
        weeklyRestConfigType: weeklyRestConfigType || "FIXED_DAY",
        weeklyRestFixedDay: weeklyRestFixedDay || "FRIDAY",
        weeklyRestCustomSchedule,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: new Date(effectiveTo),
        approvalStatus: targetStatus,
        approvedBy: targetStatus === "APPROVED" ? userId : null,
        approvedAt: targetStatus === "APPROVED" ? new Date() : null,
        companyId: companyId || null,
        notes
      }
    });

    return NextResponse.json({ success: true, profile }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create Work Calendar Profile:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
