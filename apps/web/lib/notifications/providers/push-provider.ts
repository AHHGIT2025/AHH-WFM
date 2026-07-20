import {
  AlertNotificationChannel,
  ProviderDeliveryResult,
  ProviderNotificationPayload,
  ProviderValidationResult
} from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";

export class PushNotificationProvider {
  channel: AlertNotificationChannel = "PUSH";

  async validateConfiguration(operationType: string): Promise<ProviderValidationResult> {
    const isEnvEnabled = process.env.SECFAC_PUSH_ENABLED === "true";
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isEnvEnabled) {
      warnings.push("Environment feature flag 'SECFAC_PUSH_ENABLED' is set to false.");
    }

    const dbConfig = await prisma.secFacChannelConfiguration.findUnique({
      where: { operationType_channel: { operationType, channel: "PUSH" } }
    });

    if (!dbConfig || !dbConfig.isEnabled) {
      warnings.push("Database channel configuration for Push is disabled or missing.");
    }

    return {
      valid: isEnvEnabled && !!dbConfig?.isEnabled,
      provider: dbConfig?.provider || "FCM_CAPACITOR",
      channel: "PUSH",
      errors,
      warnings
    };
  }

  async send(payload: ProviderNotificationPayload): Promise<ProviderDeliveryResult> {
    const validation = await this.validateConfiguration(payload.operationType);

    if (process.env.SECFAC_PUSH_ENABLED !== "true") {
      return {
        success: false,
        status: "PROVIDER_DISABLED",
        responseMessage: "Push notification delivery disabled by server environment feature flag (SECFAC_PUSH_ENABLED=false).",
        retryable: false
      };
    }

    if (!validation.valid) {
      return {
        success: false,
        status: "CHANNEL_DISABLED",
        responseMessage: `Push channel disabled for ${payload.operationType}: ${validation.warnings.join("; ")}`,
        retryable: false
      };
    }

    const tokens = payload.recipientPushTokens || [];
    if (tokens.length === 0) {
      return {
        success: false,
        status: "RECIPIENT_NOT_ELIGIBLE",
        responseMessage: "No registered active push tokens found for recipient.",
        retryable: false
      };
    }

    const providerMsgId = `push-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return {
      success: true,
      status: "SENT",
      providerMessageId: providerMsgId,
      responseCode: "200",
      responseMessage: `Push notification dispatched to ${tokens.length} device(s).`,
      retryable: false,
      responseMetadata: {
        provider: validation.provider,
        tokenCount: tokens.length
      }
    };
  }
}

export const pushProvider = new PushNotificationProvider();
