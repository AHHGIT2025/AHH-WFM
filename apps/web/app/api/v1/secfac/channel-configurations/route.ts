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
    requiredPermission: "secfac.notifications.configure"
  });
  if (auth.error) return auth.error;

  try {
    const configs = await prisma.secFacChannelConfiguration.findMany({
      where: { operationType: operationTypeParam as any }
    });

    // Ensure non-secret settings return safely
    const sanitizedConfigs = configs.map(c => {
      const s = (c.settings as any) || {};
      const { password, secret, token, apiKey, ...safeSettings } = s;
      return {
        ...c,
        settings: safeSettings
      };
    });

    return NextResponse.json({ operationType: operationTypeParam, configurations: sanitizedConfigs });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/channel-configurations error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    operationType,
    channel,
    provider,
    isEnabled,
    senderName,
    senderAddress,
    templateNamespace,
    maximumAttempts,
    baseRetryDelaySeconds,
    maximumRetryDelaySeconds,
    rateLimitPerMinute,
    settings
  } = body;

  if (!operationType || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationType)) {
    return NextResponse.json({ error: "Explicit valid operationType is required." }, { status: 400 });
  }

  if (!channel || !["EMAIL", "PUSH", "SMS", "WHATSAPP", "IN_APP"].includes(channel)) {
    return NextResponse.json({ error: "Valid channel is required." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationType as any,
    requiredPermission: "secfac.notifications.configure"
  });
  if (auth.error) return auth.error;

  // Sanitize input settings to prevent storing secrets in database
  const safeSettings = { ...(settings || {}) };
  delete safeSettings.password;
  delete safeSettings.secret;
  delete safeSettings.token;
  delete safeSettings.apiKey;

  try {
    const config = await prisma.secFacChannelConfiguration.upsert({
      where: { operationType_channel: { operationType, channel } },
      create: {
        operationType,
        channel,
        provider: provider || "DEFAULT",
        isEnabled: !!isEnabled,
        senderName,
        senderAddress,
        templateNamespace,
        maximumAttempts: maximumAttempts !== undefined ? Number(maximumAttempts) : 3,
        baseRetryDelaySeconds: baseRetryDelaySeconds !== undefined ? Number(baseRetryDelaySeconds) : 60,
        maximumRetryDelaySeconds: maximumRetryDelaySeconds !== undefined ? Number(maximumRetryDelaySeconds) : 3600,
        rateLimitPerMinute: rateLimitPerMinute ? Number(rateLimitPerMinute) : null,
        settings: safeSettings,
        createdById: (auth.session.user as any).id
      },
      update: {
        provider: provider || "DEFAULT",
        isEnabled: !!isEnabled,
        ...(senderName !== undefined && { senderName }),
        ...(senderAddress !== undefined && { senderAddress }),
        ...(templateNamespace !== undefined && { templateNamespace }),
        ...(maximumAttempts !== undefined && { maximumAttempts: Number(maximumAttempts) }),
        ...(baseRetryDelaySeconds !== undefined && { baseRetryDelaySeconds: Number(baseRetryDelaySeconds) }),
        ...(maximumRetryDelaySeconds !== undefined && { maximumRetryDelaySeconds: Number(maximumRetryDelaySeconds) }),
        ...(rateLimitPerMinute !== undefined && { rateLimitPerMinute: rateLimitPerMinute ? Number(rateLimitPerMinute) : null }),
        settings: safeSettings,
        updatedById: (auth.session.user as any).id
      }
    });

    await prisma.secFacAlertEvent.create({
      data: {
        alertId: `CONFIG_${config.id}`,
        operationType,
        eventType: isEnabled ? "CHANNEL_ENABLED" : "CHANNEL_DISABLED",
        performedById: (auth.session.user as any).id,
        note: `Channel configuration '${channel}' (${provider}) ${isEnabled ? "ENABLED" : "DISABLED"} for ${operationType}`
      }
    });

    return NextResponse.json({ configuration: config });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/channel-configurations error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
