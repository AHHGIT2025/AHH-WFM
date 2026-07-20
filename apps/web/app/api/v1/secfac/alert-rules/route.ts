import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operationTypeParam = searchParams.get("operationType");

  if (!operationTypeParam || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationTypeParam)) {
    return NextResponse.json(
      { error: "Explicit valid operationType parameter ('SECURITY_GUARDING' or 'FACILITY_MANAGEMENT') is required." },
      { status: 400 }
    );
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationTypeParam as any,
    requiredPermission: "secfac.alert.rules.view"
  });
  if (auth.error) return auth.error;

  try {
    const code = searchParams.get("code") || undefined;
    const isActiveStr = searchParams.get("isActive");
    const siteId = searchParams.get("siteId") || undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const search = searchParams.get("search") || undefined;

    const where: any = { operationType: operationTypeParam };
    if (code) where.code = code;
    if (isActiveStr !== null && isActiveStr !== undefined) where.isActive = isActiveStr === "true";
    if (siteId) where.siteId = siteId;
    if (projectId) where.projectId = projectId;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { description: { contains: q } }
      ];
    }

    const rules = await prisma.secFacAlertRule.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
    });

    return NextResponse.json({ rules });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/alert-rules error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { operationType } = body;

  if (!operationType || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationType)) {
    return NextResponse.json(
      { error: "Explicit valid operationType ('SECURITY_GUARDING' or 'FACILITY_MANAGEMENT') is required." },
      { status: 400 }
    );
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationType as any,
    requiredPermission: "secfac.alert.rules.manage"
  });
  if (auth.error) return auth.error;

  try {
    const {
      code,
      name,
      description,
      sourceType,
      severity,
      isActive = true,
      triggerAfterMinutes,
      reminderIntervalMinutes,
      maximumReminders = 0,
      targetRole,
      fallbackRole,
      contractId,
      projectId,
      siteId,
      escalationConfig,
      conditions,
      settings
    } = body;

    if (!code || !name || !sourceType || !severity) {
      return NextResponse.json({ error: "Missing required fields (code, name, sourceType, severity)." }, { status: 400 });
    }

    if (reminderIntervalMinutes !== undefined && reminderIntervalMinutes !== null && reminderIntervalMinutes <= 0) {
      return NextResponse.json({ error: "Reminder interval must be positive when enabled." }, { status: 400 });
    }
    if (maximumReminders < 0) {
      return NextResponse.json({ error: "Maximum reminders cannot be negative." }, { status: 400 });
    }

    // Role scope validation
    if (operationType === "SECURITY_GUARDING" && targetRole?.startsWith("FM_")) {
      return NextResponse.json({ error: "Facility Management roles cannot be assigned to Security Guarding rules." }, { status: 400 });
    }
    if (operationType === "FACILITY_MANAGEMENT" && targetRole?.startsWith("SECURITY_")) {
      return NextResponse.json({ error: "Security Guarding roles cannot be assigned to Facility Management rules." }, { status: 400 });
    }

    // Check duplicate active rule for exact scope
    const existing = await prisma.secFacAlertRule.findFirst({
      where: {
        operationType,
        code,
        siteId: siteId || null,
        projectId: projectId || null,
        contractId: contractId || null,
        isActive: true
      }
    });

    if (existing && isActive) {
      return NextResponse.json(
        { error: `An active rule already exists for code '${code}' in this exact scope.` },
        { status: 400 }
      );
    }

    const created = await prisma.secFacAlertRule.create({
      data: {
        operationType,
        code,
        name,
        description,
        sourceType,
        severity,
        isActive,
        triggerAfterMinutes: triggerAfterMinutes !== undefined ? Number(triggerAfterMinutes) : null,
        reminderIntervalMinutes: reminderIntervalMinutes !== undefined ? Number(reminderIntervalMinutes) : null,
        maximumReminders: Number(maximumReminders || 0),
        targetRole,
        fallbackRole,
        contractId,
        projectId,
        siteId,
        escalationConfig: escalationConfig || null,
        conditions: conditions || null,
        settings: settings || null,
        createdById: (auth.session.user as any).id
      }
    });

    return NextResponse.json({ rule: created }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/alert-rules error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
