import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const rule = await (prisma as any).manpowerSeasonalWorkRule.findUnique({
    where: { id: params.id },
    include: { company: true, positionCategory: true, profile: true }
  });

  if (!rule) {
    return NextResponse.json({ success: false, error: "Seasonal rule not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: rule });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.manage" });
  if (auth.error) return auth.error;

  const rule = await (prisma as any).manpowerSeasonalWorkRule.findUnique({
    where: { id: params.id }
  });

  if (!rule) {
    return NextResponse.json({ success: false, error: "Seasonal rule not found" }, { status: 404 });
  }

  if (rule.approvalStatus === "APPROVED" || rule.approvalStatus === "SUPERSEDED") {
    return NextResponse.json({ success: false, error: "Approved or superseded seasonal rules are immutable" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const updated = await (prisma as any).manpowerSeasonalWorkRule.update({
      where: { id: params.id },
      data: body
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.manage" });
  if (auth.error) return auth.error;

  const rule = await (prisma as any).manpowerSeasonalWorkRule.findUnique({
    where: { id: params.id },
    include: { supersededByRules: true }
  });

  if (!rule) {
    return NextResponse.json({ success: false, error: "Seasonal rule not found" }, { status: 404 });
  }

  if (rule.approvalStatus !== "DRAFT") {
    return NextResponse.json({
      success: false,
      error: `RULE_LIFECYCLE_PROTECTION: Only DRAFT seasonal rules can be deleted. Current status is ${rule.approvalStatus}.`
    }, { status: 400 });
  }

  if (rule.supersededByRules && rule.supersededByRules.length > 0) {
    return NextResponse.json({
      success: false,
      error: "RULE_DEPENDENCY_PROTECTION: Cannot delete seasonal rule referenced by superseded versions."
    }, { status: 400 });
  }

  try {
    await (prisma as any).manpowerSeasonalWorkRule.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, message: "Seasonal rule deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
