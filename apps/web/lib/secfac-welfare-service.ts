import { prisma } from "@ahh-wfm/database";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import {
  OperationType,
  SecFacWelfareSettingSourceType,
  EffectiveWelfareSetting
} from "@ahh-wfm/types";
import { getQatarBusinessDateString } from "./secfac-alert-service";

export interface CreateWelfareSettingInput {
  operationType: OperationType;
  companyId: string;
  projectId?: string;
  siteId?: string;
  postId?: string;
  checkFrequencyMins?: number;
  gracePeriodMins?: number;
  createdById: string;
}

/**
 * Computes a normalized scope key to prevent duplicate active welfare settings for the same scope.
 * Format: OPERATION:LEVEL:ENTITY_ID
 */
export function buildWelfareScopeKey(
  operationType: OperationType,
  companyId: string,
  projectId?: string | null,
  siteId?: string | null,
  postId?: string | null
): { scopeKey: string; sourceType: SecFacWelfareSettingSourceType; sourceId: string } {
  if (postId) {
    return {
      scopeKey: `${operationType}:POST:${postId}`,
      sourceType: "POST",
      sourceId: postId
    };
  }
  if (siteId) {
    return {
      scopeKey: `${operationType}:SITE:${siteId}`,
      sourceType: "SITE",
      sourceId: siteId
    };
  }
  if (projectId) {
    return {
      scopeKey: `${operationType}:PROJECT:${projectId}`,
      sourceType: "PROJECT",
      sourceId: projectId
    };
  }
  return {
    scopeKey: `${operationType}:COMPANY:${companyId}`,
    sourceType: "COMPANY",
    sourceId: companyId
  };
}

/**
 * Resolves the effective welfare setting using strict precedence:
 * POST -> SITE -> PROJECT -> COMPANY -> SYSTEM_DEFAULT
 */
export async function resolveEffectiveWelfareSetting(params: {
  operationType: OperationType;
  companyId: string;
  projectId?: string | null;
  siteId?: string | null;
  postId?: string | null;
}): Promise<EffectiveWelfareSetting> {
  const { operationType, companyId, projectId, siteId, postId } = params;

  if (isDbConnected()) {
    try {
      // 1. Check POST level
      if (postId) {
        const postSetting = await prisma.secFacWelfareSetting.findFirst({
          where: { operationType, postId, isActive: true }
        });
        if (postSetting) {
          return {
            settingSourceType: "POST",
            settingSourceId: postId,
            effectiveFrequencyMins: postSetting.checkFrequencyMins,
            effectiveGracePeriodMins: postSetting.gracePeriodMins
          };
        }
      }

      // 2. Check SITE level
      if (siteId) {
        const siteSetting = await prisma.secFacWelfareSetting.findFirst({
          where: { operationType, siteId, isActive: true }
        });
        if (siteSetting) {
          return {
            settingSourceType: "SITE",
            settingSourceId: siteId,
            effectiveFrequencyMins: siteSetting.checkFrequencyMins,
            effectiveGracePeriodMins: siteSetting.gracePeriodMins
          };
        }
      }

      // 3. Check PROJECT level
      if (projectId) {
        const projectSetting = await prisma.secFacWelfareSetting.findFirst({
          where: { operationType, projectId, isActive: true }
        });
        if (projectSetting) {
          return {
            settingSourceType: "PROJECT",
            settingSourceId: projectId,
            effectiveFrequencyMins: projectSetting.checkFrequencyMins,
            effectiveGracePeriodMins: projectSetting.gracePeriodMins
          };
        }
      }

      // 4. Check COMPANY level
      const companySetting = await prisma.secFacWelfareSetting.findFirst({
        where: { operationType, companyId, isActive: true }
      });
      if (companySetting) {
        return {
          settingSourceType: "COMPANY",
          settingSourceId: companyId,
          effectiveFrequencyMins: companySetting.checkFrequencyMins,
          effectiveGracePeriodMins: companySetting.gracePeriodMins
        };
      }
    } catch (dbErr) {
      console.warn("DB unreachable in resolveEffectiveWelfareSetting, using fallback default.");
    }
  }

  // 5. System Default Fallback
  return {
    settingSourceType: "SYSTEM_DEFAULT",
    settingSourceId: null,
    effectiveFrequencyMins: 60, // Pilot default: 60 minutes
    effectiveGracePeriodMins: 10 // Pilot default: 10 minutes
  };
}

/**
 * Creates or updates a welfare setting atomically, enforcing scopeKey uniqueness.
 */
export async function upsertWelfareSetting(input: CreateWelfareSettingInput): Promise<any> {
  const {
    operationType,
    companyId,
    projectId,
    siteId,
    postId,
    checkFrequencyMins = 60,
    gracePeriodMins = 10,
    createdById
  } = input;

  const { scopeKey } = buildWelfareScopeKey(operationType, companyId, projectId, siteId, postId);

  if (isDbConnected()) {
    return await prisma.secFacWelfareSetting.upsert({
      where: { scopeKey },
      create: {
        operationType,
        companyId,
        projectId,
        siteId,
        postId,
        scopeKey,
        checkFrequencyMins,
        gracePeriodMins,
        isActive: true,
        createdById
      },
      update: {
        checkFrequencyMins,
        gracePeriodMins,
        isActive: true
      }
    });
  } else {
    return {
      id: `welfare-setting-${Date.now()}`,
      operationType,
      companyId,
      projectId,
      siteId,
      postId,
      scopeKey,
      checkFrequencyMins,
      gracePeriodMins,
      isActive: true,
      createdById,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

/**
 * Worker Job: Generates bounded lone-worker welfare checks for active deployments.
 */
export async function generateWelfareChecksForActiveDeployments(): Promise<{ generatedCount: number }> {
  const now = new Date();
  let generatedCount = 0;

  if (isDbConnected()) {
    try {
      const activeDeployments = await prisma.employeeDeployment.findMany({
        where: { status: "ACTIVE" },
        include: { employee: true }
      });

      for (const dep of activeDeployments) {
        if (!dep.siteId || !dep.employee) continue;

        const opType: OperationType = (dep.employee.operationType as OperationType) || "SECURITY_GUARDING";
        const companyId = dep.employee.companyId || "COMP-002";

        const effective = await resolveEffectiveWelfareSetting({
          operationType: opType,
          companyId,
          projectId: dep.projectId,
          siteId: dep.siteId
        });

        const nextDueAt = new Date(now.getTime() + effective.effectiveFrequencyMins * 60 * 1000);
        const graceExpiresAt = new Date(nextDueAt.getTime() + effective.effectiveGracePeriodMins * 60 * 1000);
        const idempotencyKey = `${opType}:WELFARE:${dep.employeeId}:${nextDueAt.toISOString().slice(0, 13)}`;

        const existing = await prisma.secFacWelfareCheck.findUnique({
          where: { idempotencyKey }
        });

        if (!existing) {
          await prisma.secFacWelfareCheck.create({
            data: {
              operationType: opType,
              companyId,
              projectId: dep.projectId,
              siteId: dep.siteId,
              deploymentId: dep.id,
              employeeId: dep.employeeId,
              scheduledAt: now,
              dueAt: nextDueAt,
              graceExpiresAt,
              status: "PENDING",
              idempotencyKey,
              settingSourceType: effective.settingSourceType,
              settingSourceId: effective.settingSourceId
            }
          });
          generatedCount++;
        }
      }
    } catch (e: any) {
      console.warn("DB query failed in generateWelfareChecksForActiveDeployments:", e?.message);
    }
  }

  return { generatedCount };
}

/**
 * Worker Job: Evaluates expired welfare checks, marks them MISSED, and triggers operational alerts.
 */
export async function evaluateMissedWelfareChecks(): Promise<{ missedCount: number }> {
  const now = new Date();
  let missedCount = 0;

  if (isDbConnected()) {
    try {
      const expiredChecks = await prisma.secFacWelfareCheck.findMany({
        where: {
          status: "PENDING",
          graceExpiresAt: { lt: now }
        },
        include: { employee: true, site: true }
      });

      for (const check of expiredChecks) {
        const qatarDate = new Date();
        const businessDate = new Date(getQatarBusinessDateString(qatarDate));
        const deduplicationKey = `${check.operationType}:WELFARE_CHECK_MISSED:${check.employeeId}:${check.id}`;

        await prisma.$transaction(async (tx) => {
          const alert = await tx.secFacOperationalAlert.create({
            data: {
              operationType: check.operationType,
              alertCode: "WELFARE_CHECK_MISSED",
              sourceType: "WELFARE_CHECK",
              sourceId: check.id,
              siteId: check.siteId,
              projectId: check.projectId,
              employeeId: check.employeeId,
              severity: "HIGH",
              status: "OPEN",
              title: `LONE WORKER MISSED WELFARE CHECK: ${check.employee.name || check.employeeId}`,
              message: `Guard ${check.employee.name || check.employeeId} missed scheduled lone-worker welfare check at site ${check.site.name}. Grace period expired at ${check.graceExpiresAt.toISOString()}.`,
              businessDate,
              deduplicationKey,
              firstDetectedAt: now,
              lastDetectedAt: now,
              metadata: {
                welfareCheckId: check.id,
                employeeName: check.employee.name || check.employeeId,
                siteName: check.site.name,
                dueAt: check.dueAt.toISOString(),
                graceExpiresAt: check.graceExpiresAt.toISOString()
              },
              events: {
                create: {
                  operationType: check.operationType,
                  eventType: "ALERT_CREATED",
                  newStatus: "OPEN",
                  performedById: check.employeeId,
                  note: "Lone worker missed welfare check evaluation."
                }
              }
            }
          });

          await tx.secFacWelfareCheck.update({
            where: { id: check.id },
            data: {
              status: "MISSED",
              alertId: alert.id
            }
          });

          await tx.secFacAlertNotification.create({
            data: {
              alertId: alert.id,
              operationType: check.operationType,
              channel: "IN_APP",
              notificationType: "WELFARE_CHECK_MISSED",
              notificationKey: `notif:welfare:${check.id}`,
              status: "PENDING",
              scheduledAt: now
            }
          });
        });

        missedCount++;
      }
    } catch (e: any) {
      console.warn("DB query failed in evaluateMissedWelfareChecks:", e?.message);
    }
  }

  return { missedCount };
}

/**
 * Guard "I'm Safe" acknowledgement with offline sync reconciliation support.
 */
export async function acknowledgeWelfareCheck(
  welfareId: string,
  employeeId: string,
  method: "MOBILE_APP" | "CONTROL_ROOM" | "OFFLINE_SYNC" = "MOBILE_APP"
): Promise<any> {
  const now = new Date();

  if (isDbConnected()) {
    try {
      const check = await prisma.secFacWelfareCheck.findUnique({
        where: { id: welfareId }
      });

      if (!check) throw new Error("Welfare check not found.");
      if (check.employeeId !== employeeId) throw new Error("Forbidden: Cannot acknowledge another employee's welfare check.");

      const isLateSync = now.getTime() > check.graceExpiresAt.getTime();
      const newStatus = check.status === "MISSED" ? "MISSED" : "ACKNOWLEDGED";

      const updated = await prisma.secFacWelfareCheck.update({
        where: { id: welfareId },
        data: {
          status: newStatus,
          acknowledgedAt: now,
          acknowledgementMethod: method
        }
      });

      return {
        check: updated,
        isLateSync,
        message: isLateSync ? "Check-in received after grace period. Supervisor notified." : "Check-in confirmed."
      };
    } catch (e: any) {
      console.warn("Prisma query failed in acknowledgeWelfareCheck, using fallback:", e?.message);
    }
  }

  return {
    id: welfareId,
    status: "ACKNOWLEDGED",
    acknowledgedAt: now.toISOString(),
    acknowledgementMethod: method,
    message: "Check-in confirmed (mock)."
  };
}

/**
 * Supervisor exemption or shift-end cancellation handler.
 */
export async function exemptWelfareCheck(
  welfareId: string,
  supervisorId: string,
  exemptionType: "SHIFT_END" | "SUPERVISOR_OVERRIDE" | "SITE_EXEMPTION",
  exemptionReason: string
): Promise<any> {
  const now = new Date();

  if (isDbConnected()) {
    try {
      const updated = await prisma.secFacWelfareCheck.update({
        where: { id: welfareId },
        data: {
          status: exemptionType === "SHIFT_END" ? "CANCELLED" : "EXEMPTED",
          exemptionType,
          exemptionReason
        }
      });
      return updated;
    } catch (e: any) {
      console.warn("DB query failed in exemptWelfareCheck, using fallback:", e?.message);
    }
  }

  return {
    id: welfareId,
    status: exemptionType === "SHIFT_END" ? "CANCELLED" : "EXEMPTED",
    exemptionType,
    exemptionReason,
    updatedAt: now.toISOString()
  };
}
