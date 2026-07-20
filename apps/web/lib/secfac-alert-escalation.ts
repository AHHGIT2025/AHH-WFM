import { prisma } from "@ahh-wfm/database";
import { AlertEscalationResult, OperationType, SecFacAlertRuleEscalationLevel } from "@ahh-wfm/types";
import { resolveAlertSupervisor } from "./secfac-alert-resolver";

export interface ForceEscalationParams {
  alertId: string;
  actorUserId: string;
  reason: string;
}

/**
 * Evaluates open unresolved alerts against their configured rule escalation timings,
 * or handles forced manual escalation.
 */
export async function evaluateAlertEscalation(
  alertId: string,
  options?: { force?: boolean; actorUserId?: string; forceReason?: string }
): Promise<{ success: boolean; escalated: boolean; newLevel: number; warning?: string }> {
  try {
    const alert = await prisma.secFacOperationalAlert.findUnique({
      where: { id: alertId },
      include: { rule: true }
    });

    if (!alert) {
      return { success: false, escalated: false, newLevel: 0, warning: "Alert not found" };
    }

    // Must be in active unresolved status
    if (!["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"].includes(alert.status)) {
      return { success: true, escalated: false, newLevel: alert.escalationLevel, warning: `Alert is in status ${alert.status}, skipping escalation.` };
    }

    const rule = alert.rule;
    if (!rule || !rule.isActive) {
      if (!options?.force) {
        return { success: true, escalated: false, newLevel: alert.escalationLevel, warning: "No active rule attached to alert." };
      }
    }

    let escalationConfig: { levels?: SecFacAlertRuleEscalationLevel[] } | null = null;
    if (rule?.escalationConfig && typeof rule.escalationConfig === "object") {
      escalationConfig = rule.escalationConfig as any;
    }

    const currentLevel = alert.escalationLevel;
    const nextLevelIndex = currentLevel; // 0-based index for level 1, 2, 3...
    const levels = escalationConfig?.levels || [
      { level: 1, afterMinutes: 30, targetRole: alert.operationType === "SECURITY_GUARDING" ? "SECURITY_PROJECT_MANAGER" : "FM_PROJECT_MANAGER" },
      { level: 2, afterMinutes: 60, targetRole: alert.operationType === "SECURITY_GUARDING" ? "SECURITY_OPERATIONS_MANAGER" : "FM_OPERATIONS_MANAGER" },
      { level: 3, afterMinutes: 120, targetRole: "ADMIN" }
    ];

    if (!options?.force && nextLevelIndex >= levels.length) {
      return { success: true, escalated: false, newLevel: currentLevel, warning: "Maximum escalation level reached." };
    }

    const targetLevelConfig = levels[nextLevelIndex] || levels[levels.length - 1];
    const firstDetectedMs = new Date(alert.firstDetectedAt).getTime();
    const elapsedMinutes = (Date.now() - firstDetectedMs) / (1000 * 60);

    // Confirm timing if not forced
    if (!options?.force && targetLevelConfig) {
      if (elapsedMinutes < targetLevelConfig.afterMinutes) {
        return {
          success: true,
          escalated: false,
          newLevel: currentLevel,
          warning: `Not ready for level ${targetLevelConfig.level}. Elapsed: ${Math.floor(elapsedMinutes)} mins, required: ${targetLevelConfig.afterMinutes} mins.`
        };
      }
    }

    // Resolve target supervisor for elevated role
    const resolution = await resolveAlertSupervisor({
      operationType: alert.operationType as unknown as OperationType,
      siteId: alert.siteId,
      projectId: alert.projectId,
      employeeId: alert.employeeId,
      targetRole: targetLevelConfig.targetRole
    });

    const newEscalationLevel = currentLevel + 1;
    const now = new Date();

    // Transactionally update alert, write event, and queue notification
    await prisma.$transaction(async (tx) => {
      await tx.secFacOperationalAlert.update({
        where: { id: alert.id },
        data: {
          escalationLevel: newEscalationLevel,
          escalatedAt: now,
          assignedUserId: resolution.assignedUserId || alert.assignedUserId,
          assignedRole: resolution.assignedRole || targetLevelConfig.targetRole,
          assignmentSource: resolution.source,
          updatedAt: now
        }
      });

      await tx.secFacAlertEvent.create({
        data: {
          alertId: alert.id,
          operationType: alert.operationType,
          eventType: "ALERT_ESCALATED",
          previousStatus: alert.status,
          newStatus: alert.status,
          previousAssignedUserId: alert.assignedUserId,
          newAssignedUserId: resolution.assignedUserId || alert.assignedUserId,
          escalationLevel: newEscalationLevel,
          performedById: options?.actorUserId || null,
          note: options?.force ? `Forced escalation: ${options.forceReason}` : `Escalated to Level ${newEscalationLevel} (${targetLevelConfig.targetRole})`
        }
      });

      // Idempotent Notification Queueing
      const notifKey = `${alert.id}:${resolution.assignedUserId || "ADMIN"}:ESCALATION:${newEscalationLevel}`;
      const existingNotif = await tx.secFacAlertNotification.findUnique({
        where: { notificationKey: notifKey }
      });

      if (!existingNotif) {
        await tx.secFacAlertNotification.create({
          data: {
            alertId: alert.id,
            operationType: alert.operationType,
            recipientUserId: resolution.assignedUserId || null,
            recipientRole: resolution.assignedRole || targetLevelConfig.targetRole,
            channel: "IN_APP",
            notificationType: "ESCALATION",
            status: "PENDING",
            notificationKey: notifKey,
            scheduledAt: now,
            payload: {
              title: `[ESCALATED L${newEscalationLevel}] ${alert.title}`,
              message: alert.message,
              severity: alert.severity,
              alertCode: alert.alertCode,
              escalationLevel: newEscalationLevel
            }
          }
        });
      }
    });

    return { success: true, escalated: true, newLevel: newEscalationLevel };
  } catch (e: any) {
    console.error("[secfac-alert-escalation] Error evaluating escalation:", e);
    return { success: false, escalated: false, newLevel: 0, warning: e?.message || String(e) };
  }
}

/**
 * Batch evaluates all open alerts for an operational scope against escalation rules.
 */
export async function evaluateOperationEscalations(
  operationType?: OperationType
): Promise<AlertEscalationResult> {
  const warnings: string[] = [];
  let escalatedCount = 0;
  let alertsEvaluated = 0;

  try {
    const whereClause: any = {
      status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] }
    };
    if (operationType && (operationType as string) !== "ALL") {
      whereClause.operationType = operationType;
    }

    const openAlerts = await prisma.secFacOperationalAlert.findMany({
      where: whereClause,
      take: 100,
      orderBy: { firstDetectedAt: "asc" }
    });

    alertsEvaluated = openAlerts.length;

    for (const alert of openAlerts) {
      const result = await evaluateAlertEscalation(alert.id);
      if (result.escalated) {
        escalatedCount++;
      }
      if (result.warning) {
        warnings.push(`Alert ${alert.id}: ${result.warning}`);
      }
    }

    return { escalatedCount, alertsEvaluated, warnings };
  } catch (e: any) {
    console.error("[secfac-alert-escalation] Error evaluating operation escalations:", e);
    warnings.push(`Batch evaluation failed: ${e?.message || e}`);
    return { escalatedCount, alertsEvaluated, warnings };
  }
}
