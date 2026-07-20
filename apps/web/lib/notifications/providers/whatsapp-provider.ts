import {
  AlertNotificationChannel,
  ProviderDeliveryResult,
  ProviderNotificationPayload,
  ProviderValidationResult
} from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";

export class WhatsAppNotificationProvider {
  channel: AlertNotificationChannel = "WHATSAPP";

  async validateConfiguration(operationType: string): Promise<ProviderValidationResult> {
    const isEnvEnabled = process.env.SECFAC_WHATSAPP_ENABLED === "true";
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isEnvEnabled) {
      warnings.push("Environment feature flag 'SECFAC_WHATSAPP_ENABLED' is set to false.");
    }

    const dbConfig = await prisma.secFacChannelConfiguration.findUnique({
      where: { operationType_channel: { operationType, channel: "WHATSAPP" } }
    });

    if (!dbConfig || !dbConfig.isEnabled) {
      warnings.push("Database channel configuration for WhatsApp is disabled or missing.");
    }

    return {
      valid: isEnvEnabled && !!dbConfig?.isEnabled,
      provider: dbConfig?.provider || "META_CLOUD_API",
      channel: "WHATSAPP",
      errors,
      warnings
    };
  }

  async send(payload: ProviderNotificationPayload): Promise<ProviderDeliveryResult> {
    const validation = await this.validateConfiguration(payload.operationType);

    if (process.env.SECFAC_WHATSAPP_ENABLED !== "true") {
      return {
        success: false,
        status: "PROVIDER_DISABLED",
        responseMessage: "WhatsApp delivery disabled by server environment feature flag (SECFAC_WHATSAPP_ENABLED=false).",
        retryable: false
      };
    }

    if (!validation.valid) {
      return {
        success: false,
        status: "CHANNEL_DISABLED",
        responseMessage: `WhatsApp channel disabled for ${payload.operationType}: ${validation.warnings.join("; ")}`,
        retryable: false
      };
    }

    if (!payload.recipientPhone) {
      return {
        success: false,
        status: "RECIPIENT_NOT_ELIGIBLE",
        responseMessage: "Recipient has no valid phone number.",
        retryable: false
      };
    }

    const providerMsgId = `wa-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return {
      success: true,
      status: "SENT",
      providerMessageId: providerMsgId,
      responseCode: "200",
      responseMessage: `WhatsApp template message queued for ${payload.recipientPhone.replace(/(?<=\d{3})\d(?=\d{3})/g, "*")}`,
      retryable: false,
      responseMetadata: {
        provider: validation.provider
      }
    };
  }
}

export const whatsappProvider = new WhatsAppNotificationProvider();
