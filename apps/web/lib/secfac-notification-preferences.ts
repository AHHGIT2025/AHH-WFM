import { AlertNotificationChannel, AlertSeverity, OperationType, SecFacNotificationPreference } from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";

export interface ResolvedPreference {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  minimumSeverity: AlertSeverity;
  allowCriticalOverride: boolean;
  resolutionSource: "USER_ALERT" | "USER_DEFAULT" | "ROLE_ALERT" | "ROLE_DEFAULT" | "OPERATION_DEFAULT" | "FALLBACK";
}

export interface QuietHoursResult {
  isQuietHours: boolean;
  action: "DELIVER" | "DEFER" | "SUPPRESS";
  deferredUntil?: Date | null;
  reason?: string;
}

/**
 * Checks whether current time in specified timezone falls inside quiet hours.
 * Supports overnight ranges (e.g., "22:00" to "06:00").
 */
export function evaluateQuietHours(
  startStr?: string | null,
  endStr?: string | null,
  timezone: string = "Asia/Qatar",
  severity: AlertSeverity = "MEDIUM",
  allowCriticalOverride: boolean = true,
  nowInput?: Date
): QuietHoursResult {
  if (!startStr || !endStr) {
    return { isQuietHours: false, action: "DELIVER" };
  }

  const now = nowInput ? new Date(nowInput) : new Date();

  // Convert `now` to target timezone hours and minutes
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const hourPart = parts.find(p => p.type === "hour")?.value || "0";
  const minutePart = parts.find(p => p.type === "minute")?.value || "0";

  const currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minutePart, 10);

  const [sHour, sMin] = startStr.split(":").map(n => parseInt(n, 10));
  const [eHour, eMin] = endStr.split(":").map(n => parseInt(n, 10));

  const startMinutes = sHour * 60 + (sMin || 0);
  const endMinutes = eHour * 60 + (eMin || 0);

  let isQuietHours = false;
  if (startMinutes <= endMinutes) {
    isQuietHours = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight window (e.g. 22:00 to 06:00)
    isQuietHours = currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  if (!isQuietHours) {
    return { isQuietHours: false, action: "DELIVER" };
  }

  // During Quiet Hours:
  if (severity === "CRITICAL") {
    if (allowCriticalOverride) {
      return {
        isQuietHours: true,
        action: "DELIVER",
        reason: "Critical alert bypassed quiet hours via critical override policy."
      };
    } else {
      return {
        isQuietHours: true,
        action: "SUPPRESS",
        reason: "Critical alert suppressed by policy during quiet hours (override disabled)."
      };
    }
  }

  // Non-critical alert: calculate next morning deferred time at `quietHoursEnd`
  const deferredUntil = new Date(now);
  deferredUntil.setHours(eHour, eMin || 0, 0, 0);
  if (deferredUntil.getTime() <= now.getTime()) {
    deferredUntil.setDate(deferredUntil.getDate() + 1);
  }

  return {
    isQuietHours: true,
    action: "DEFER",
    deferredUntil,
    reason: `Non-critical ${severity} alert deferred during quiet hours until ${endStr} ${timezone}.`
  };
}

/**
 * Resolves notification preference hierarchy for a given user, role, alert code, and operation type.
 */
export async function resolveNotificationPreferences(
  operationType: OperationType,
  userId?: string | null,
  roleCode?: string | null,
  alertCode?: string | null
): Promise<ResolvedPreference> {
  const preferences = await prisma.secFacNotificationPreference.findMany({
    where: {
      operationType,
      isActive: true,
      OR: [
        { userId: userId || undefined },
        { roleCode: roleCode || undefined },
        { userId: null, roleCode: null }
      ]
    }
  });

  // 1. User + Alert Code
  if (userId && alertCode) {
    const p = preferences.find(x => x.userId === userId && x.alertCode === alertCode);
    if (p) return mapToResolved(p as any, "USER_ALERT");
  }

  // 2. User Default
  if (userId) {
    const p = preferences.find(x => x.userId === userId && !x.alertCode);
    if (p) return mapToResolved(p as any, "USER_DEFAULT");
  }

  // 3. Role + Alert Code
  if (roleCode && alertCode) {
    const p = preferences.find(x => x.roleCode === roleCode && x.alertCode === alertCode);
    if (p) return mapToResolved(p as any, "ROLE_ALERT");
  }

  // 4. Role Default
  if (roleCode) {
    const p = preferences.find(x => x.roleCode === roleCode && !x.alertCode);
    if (p) return mapToResolved(p as any, "ROLE_DEFAULT");
  }

  // 5. Operation Default
  const opDefault = preferences.find(x => !x.userId && !x.roleCode && (!x.alertCode || x.alertCode === alertCode));
  if (opDefault) return mapToResolved(opDefault as any, "OPERATION_DEFAULT");

  // 6. Global Fallback
  return {
    inAppEnabled: true,
    emailEnabled: false,
    pushEnabled: false,
    smsEnabled: false,
    whatsappEnabled: false,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: "Asia/Qatar",
    minimumSeverity: "MEDIUM",
    allowCriticalOverride: true,
    resolutionSource: "FALLBACK"
  };
}

function mapToResolved(
  p: SecFacNotificationPreference,
  source: ResolvedPreference["resolutionSource"]
): ResolvedPreference {
  return {
    inAppEnabled: p.inAppEnabled,
    emailEnabled: p.emailEnabled,
    pushEnabled: p.pushEnabled,
    smsEnabled: p.smsEnabled,
    whatsappEnabled: p.whatsappEnabled,
    quietHoursEnabled: p.quietHoursEnabled,
    quietHoursStart: p.quietHoursStart || null,
    quietHoursEnd: p.quietHoursEnd || null,
    timezone: p.timezone || "Asia/Qatar",
    minimumSeverity: p.minimumSeverity as AlertSeverity,
    allowCriticalOverride: p.allowCriticalOverride,
    resolutionSource: source
  };
}
