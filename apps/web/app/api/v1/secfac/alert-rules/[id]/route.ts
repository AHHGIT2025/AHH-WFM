import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rule = await prisma.secFacAlertRule.findUnique({
    where: { id: params.id }
  });

  if (!rule) {
    return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: rule.operationType as any,
    requiredPermission: "secfac.alert.rules.view"
  });
  if (auth.error) return auth.error;

  return NextResponse.json({ rule });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const existing = await prisma.secFacAlertRule.findUnique({
    where: { id: params.id }
  });

  if (!existing) {
    return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: existing.operationType as any,
    requiredPermission: "secfac.alert.rules.manage"
  });
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const {
      name,
      description,
      severity,
      isActive,
      triggerAfterMinutes,
      reminderIntervalMinutes,
      maximumReminders,
      targetRole,
      fallbackRole,
      escalationConfig,
      conditions,
      settings
    } = body;

    if (reminderIntervalMinutes !== undefined && reminderIntervalMinutes !== null && reminderIntervalMinutes <= 0) {
      return NextResponse.json({ error: "Reminder interval must be positive when enabled." }, { status: 400 });
    }
    if (maximumReminders !== undefined && maximumReminders < 0) {
      return NextResponse.json({ error: "Maximum reminders cannot be negative." }, { status: 400 });
    }

    if (existing.operationType === "SECURITY_GUARDING" && targetRole?.startsWith("FM_")) {
      return NextResponse.json({ error: "Facility Management roles cannot be assigned to Security Guarding rules." }, { status: 400 });
    }
    if (existing.operationType === "FACILITY_MANAGEMENT" && targetRole?.startsWith("SECURITY_")) {
      return NextResponse.json({ error: "Security Guarding roles cannot be assigned to Facility Management rules." }, { status: 400 });
    }

    if (isActive === true && existing.isActive === false) {
      const { validateRuleActivation } = await import("@/lib/secfac-alert-rollout");
      const validation = await validateRuleActivation(params.id);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Pilot Activation Safeguard Rejected: ${validation.errors.join(" ")}` },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.secFacAlertRule.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(severity !== undefined && { severity }),
        ...(isActive !== undefined && { isActive }),
        ...(triggerAfterMinutes !== undefined && { triggerAfterMinutes: triggerAfterMinutes !== null ? Number(triggerAfterMinutes) : null }),
        ...(reminderIntervalMinutes !== undefined && { reminderIntervalMinutes: reminderIntervalMinutes !== null ? Number(reminderIntervalMinutes) : null }),
        ...(maximumReminders !== undefined && { maximumReminders: Number(maximumReminders) }),
        ...(targetRole !== undefined && { targetRole }),
        ...(fallbackRole !== undefined && { fallbackRole }),
        ...(escalationConfig !== undefined && { escalationConfig }),
        ...(conditions !== undefined && { conditions }),
        ...(settings !== undefined && { settings }),
        updatedById: (auth.session.user as any).id
      }
    });

    if (isActive !== undefined && isActive !== existing.isActive) {
      await prisma.secFacAlertEvent.create({
        data: {
          alertId: `RULE_${updated.id}`,
          operationType: updated.operationType,
          eventType: isActive ? "ALERT_RULE_PILOT_ENABLED" : "ALERT_RULE_PILOT_DISABLED",
          performedById: (auth.session.user as any).id,
          note: `Rule '${updated.code}' (${updated.name}) ${isActive ? "ENABLED" : "DISABLED"} for pilot scope`
        }
      });
    }

    return NextResponse.json({ rule: updated });
  } catch (e: any) {
    console.error("PUT /api/v1/secfac/alert-rules/[id] error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
