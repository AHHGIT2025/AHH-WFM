import { SecFacAlertRule, SecFacOperationalAlert } from "@ahh-wfm/types";

export type AlertSlaStatus = {
  acknowledgementDueAt: Date | null;
  resolutionDueAt: Date | null;
  acknowledgementOverdue: boolean;
  resolutionOverdue: boolean;
  remainingAcknowledgementMinutes: number | null;
  remainingResolutionMinutes: number | null;
  breachedSlaType: "ACKNOWLEDGEMENT" | "RESOLUTION" | "BOTH" | null;
};

/**
 * Gets default SLA target minutes based on severity.
 */
export function getDefaultSlaMinutes(severity: string): { ackMinutes: number; resMinutes: number } {
  switch (severity) {
    case "CRITICAL":
      return { ackMinutes: 5, resMinutes: 60 };
    case "HIGH":
      return { ackMinutes: 15, resMinutes: 120 };
    case "MEDIUM":
      return { ackMinutes: 30, resMinutes: 240 };
    case "LOW":
    default:
      return { ackMinutes: 60, resMinutes: 480 };
  }
}

/**
 * Calculates authoritative SLA status in Qatar operational time (UTC+3).
 */
export function calculateAlertSlaStatus(
  alert: SecFacOperationalAlert,
  rule?: SecFacAlertRule | null,
  nowInput?: Date
): AlertSlaStatus {
  const now = nowInput ? new Date(nowInput) : new Date();
  const detectedAt = new Date(alert.firstDetectedAt);

  // Extract SLA targets from rule settings or metadata or defaults
  const ruleAckSla = rule?.settings?.acknowledgementSlaMinutes;
  const ruleResSla = rule?.settings?.resolutionSlaMinutes;
  const defaults = getDefaultSlaMinutes(alert.severity);

  const ackMinutes = ruleAckSla !== undefined && ruleAckSla !== null ? Number(ruleAckSla) : defaults.ackMinutes;
  const resMinutes = ruleResSla !== undefined && ruleResSla !== null ? Number(ruleResSla) : defaults.resMinutes;

  const acknowledgementDueAt = new Date(detectedAt.getTime() + ackMinutes * 60 * 1000);
  const resolutionDueAt = new Date(detectedAt.getTime() + resMinutes * 60 * 1000);

  const isResolvedOrClosed = ["RESOLVED", "DISMISSED", "CANCELLED"].includes(alert.status);
  const isAcknowledged = alert.acknowledgedAt !== null || ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"].includes(alert.status);

  // Calculate active overdue status
  let acknowledgementOverdue = false;
  if (!isAcknowledged && !isResolvedOrClosed) {
    acknowledgementOverdue = now.getTime() > acknowledgementDueAt.getTime();
  }

  let resolutionOverdue = false;
  if (!isResolvedOrClosed) {
    resolutionOverdue = now.getTime() > resolutionDueAt.getTime();
  }

  // Calculate historical breach status if alert is closed
  if (isAcknowledged && alert.acknowledgedAt) {
    const ackTime = new Date(alert.acknowledgedAt).getTime();
    if (ackTime > acknowledgementDueAt.getTime()) {
      // Historical breach recorded
    }
  }

  const remainingAcknowledgementMinutes = !isAcknowledged && !isResolvedOrClosed
    ? Math.round((acknowledgementDueAt.getTime() - now.getTime()) / (60 * 1000))
    : null;

  const remainingResolutionMinutes = !isResolvedOrClosed
    ? Math.round((resolutionDueAt.getTime() - now.getTime()) / (60 * 1000))
    : null;

  let breachedSlaType: "ACKNOWLEDGEMENT" | "RESOLUTION" | "BOTH" | null = null;
  if (acknowledgementOverdue && resolutionOverdue) {
    breachedSlaType = "BOTH";
  } else if (acknowledgementOverdue) {
    breachedSlaType = "ACKNOWLEDGEMENT";
  } else if (resolutionOverdue) {
    breachedSlaType = "RESOLUTION";
  }

  return {
    acknowledgementDueAt,
    resolutionDueAt,
    acknowledgementOverdue,
    resolutionOverdue,
    remainingAcknowledgementMinutes,
    remainingResolutionMinutes,
    breachedSlaType
  };
}
