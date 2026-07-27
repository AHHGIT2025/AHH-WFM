import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { validateSeasonalRuleScopeAndTimeWindow } from "@/lib/master-data-validator";

export async function GET(req: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId") || undefined;
  const positionCategoryId = searchParams.get("positionCategoryId") || undefined;
  const profileId = searchParams.get("profileId") || undefined;

  const rules = await (prisma as any).manpowerSeasonalWorkRule.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      ...(positionCategoryId ? { positionCategoryId } : {}),
      ...(profileId ? { profileId } : {})
    },
    include: {
      company: true,
      positionCategory: true,
      profile: true
    },
    orderBy: { effectiveFrom: "desc" }
  });

  return NextResponse.json({ success: true, data: rules });
}

export async function POST(req: Request) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.manage" });
  if (auth.error) return auth.error;

  try {
    const body = await req.json();

    const {
      profileId,
      companyId,
      positionCategoryId,
      ruleScope,
      ruleType,
      effectiveFrom,
      effectiveTo,
      morningStartMinutes,
      morningEndMinutes,
      mandatoryBreakStartMinutes,
      mandatoryBreakEndMinutes,
      eveningStartMinutes,
      eveningEndMinutes,
      allowedDailyMinutes,
      sourceReference,
      approvalStatus,
      notes
    } = body;

    if (!companyId || !ruleScope || !ruleType || !effectiveFrom || !effectiveTo || allowedDailyMinutes == null) {
      return NextResponse.json({ success: false, error: "Missing required seasonal rule fields" }, { status: 400 });
    }

    validateSeasonalRuleScopeAndTimeWindow({
      ruleScope,
      companyId,
      positionCategoryId,
      profileId,
      morningStartMinutes: parseInt(morningStartMinutes),
      morningEndMinutes: parseInt(morningEndMinutes),
      mandatoryBreakStartMinutes: parseInt(mandatoryBreakStartMinutes),
      mandatoryBreakEndMinutes: parseInt(mandatoryBreakEndMinutes),
      eveningStartMinutes: eveningStartMinutes != null ? parseInt(eveningStartMinutes) : null,
      eveningEndMinutes: eveningEndMinutes != null ? parseInt(eveningEndMinutes) : null,
      allowedDailyMinutes: parseInt(allowedDailyMinutes)
    });

    const targetStatus = approvalStatus || "DRAFT";
    const userId = auth.session?.user?.id || "AD-0001";

    const rule = await (prisma as any).manpowerSeasonalWorkRule.create({
      data: {
        profileId: profileId || null,
        companyId,
        positionCategoryId: positionCategoryId || null,
        ruleScope,
        ruleType,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: new Date(effectiveTo),
        morningStartMinutes: parseInt(morningStartMinutes),
        morningEndMinutes: parseInt(morningEndMinutes),
        mandatoryBreakStartMinutes: parseInt(mandatoryBreakStartMinutes),
        mandatoryBreakEndMinutes: parseInt(mandatoryBreakEndMinutes),
        eveningStartMinutes: eveningStartMinutes != null ? parseInt(eveningStartMinutes) : null,
        eveningEndMinutes: eveningEndMinutes != null ? parseInt(eveningEndMinutes) : null,
        allowedDailyMinutes: parseInt(allowedDailyMinutes),
        sourceReference: sourceReference || null,
        approvalStatus: targetStatus,
        approvedBy: targetStatus === "APPROVED" ? userId : null,
        approvedAt: targetStatus === "APPROVED" ? new Date() : null,
        createdById: userId,
        notes: notes || null
      }
    });

    return NextResponse.json({ success: true, data: rule });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
