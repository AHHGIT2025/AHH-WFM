import {
  AlertNotificationChannel,
  ProviderDeliveryResult,
  ProviderNotificationPayload,
  ProviderValidationResult
} from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";

export class EmailNotificationProvider {
  channel: AlertNotificationChannel = "EMAIL";

  async validateConfiguration(operationType: string): Promise<ProviderValidationResult> {
    const isEnvEnabled = process.env.SECFAC_EMAIL_ENABLED === "true";
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isEnvEnabled) {
      warnings.push("Environment feature flag 'SECFAC_EMAIL_ENABLED' is set to false.");
    }

    const dbConfig = await prisma.secFacChannelConfiguration.findUnique({
      where: { operationType_channel: { operationType, channel: "EMAIL" } }
    });

    if (!dbConfig || !dbConfig.isEnabled) {
      warnings.push("Database channel configuration for Email is disabled or missing.");
    }

    return {
      valid: isEnvEnabled && !!dbConfig?.isEnabled,
      provider: dbConfig?.provider || "M365_SMTP",
      channel: "EMAIL",
      errors,
      warnings
    };
  }

  async send(payload: ProviderNotificationPayload): Promise<ProviderDeliveryResult> {
    const validation = await this.validateConfiguration(payload.operationType);

    if (process.env.SECFAC_EMAIL_ENABLED !== "true") {
      return {
        success: false,
        status: "PROVIDER_DISABLED",
        responseMessage: "Email delivery disabled by server environment feature flag (SECFAC_EMAIL_ENABLED=false).",
        retryable: false
      };
    }

    if (!validation.valid) {
      return {
        success: false,
        status: "CHANNEL_DISABLED",
        responseMessage: `Email channel disabled for ${payload.operationType}: ${validation.warnings.join("; ")}`,
        retryable: false
      };
    }

    if (!payload.recipientEmail) {
      return {
        success: false,
        status: "RECIPIENT_NOT_ELIGIBLE",
        responseMessage: "Recipient has no valid email address.",
        retryable: false
      };
    }

    // Provider foundation simulation / adapter hook (e.g. M365 SMTP / SendGrid / AWS SES)
    const providerMsgId = `email-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return {
      success: true,
      status: "SENT",
      providerMessageId: providerMsgId,
      responseCode: "250",
      responseMessage: `Email accepted for queueing to ${payload.recipientEmail.replace(/(?<=.).(?=.*@)/g, "*")}`,
      retryable: false,
      responseMetadata: {
        provider: validation.provider,
        recipientDomain: payload.recipientEmail.split("@")[1]
      }
    };
  }
}

export const emailProvider = new EmailNotificationProvider();
