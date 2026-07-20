import { OperationType, SecFacAlertRule, SecFacOperationalAlert } from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";
import { calculateAlertSlaStatus } from "./secfac-alert-sla";

export interface ReadinessCheckItem {
  id: string;
  name: string;
  passed: boolean;
  severity: "CRITICAL" | "WARNING" | "INFO";
  details: string;
}

export interface PilotReadinessResult {
  operationType: OperationType;
  overallStatus: "READY" | "READY_WITH_WARNINGS" | "NOT_READY";
  totalChecks: number;
  passedChecks: number;
  checks: ReadinessCheckItem[];
}

export interface AlertRuleHealth {
  ruleId: string;
  alertCode: string;
  totalAlerts: number;
  dismissalRate: number;
  escalationRate: number;
  adminQueueRate: number;
  averageAcknowledgementMinutes: number | null;
  averageResolutionMinutes: number | null;
  health: "HEALTHY" | "REVIEW" | "HIGH_NOISE";
  warnings: string[];
}

/**
 * Validates Pilot Readiness for an operational scope.
 */
export async function validatePilotReadiness(
  operationType: OperationType
): Promise<PilotReadinessResult> {
  const checks: ReadinessCheckItem[] = [];

  // Fetch rules for operation
  const rules = await prisma.secFacAlertRule.findMany({
    where: { operationType }
  });

  const activeRules = rules.filter(r => r.isActive);

  // Check 1: At least one active rule
  checks.push({
    id: "active_rules_exist",
    name: "Active Pilot Alert Rules",
    passed: activeRules.length > 0,
    severity: "CRITICAL",
    details: activeRules.length > 0
      ? `Found ${activeRules.length} active alert rule(s) configured for ${operationType}.`
      : `No active alert rules found. At least one rule must be activated for pilot readiness.`
  });

  // Check 2: Target & Fallback roles specified on active rules
  const rulesMissingRoles = activeRules.filter(r => !r.targetRole || !r.fallbackRole);
  checks.push({
    id: "target_fallback_roles",
    name: "Target & Fallback Roles Specified",
    passed: rulesMissingRoles.length === 0,
    severity: "CRITICAL",
    details: rulesMissingRoles.length === 0
      ? `All active rules have explicit target and fallback roles assigned.`
      : `${rulesMissingRoles.length} active rule(s) missing target or fallback roles: ${rulesMissingRoles.map(r => r.code).join(", ")}.`
  });

  // Check 3: Escalation Config Validity
  const invalidEscalation = activeRules.filter(r => {
    if (!r.escalationConfig) return false;
    const levels = (r.escalationConfig as any)?.levels;
    if (!Array.isArray(levels)) return true;
    for (let i = 0; i < levels.length; i++) {
      if (!levels[i].targetRole || levels[i].afterMinutes <= 0) return true;
      if (i > 0 && levels[i].afterMinutes <= levels[i - 1].afterMinutes) return true;
    }
    return false;
  });

  checks.push({
    id: "escalation_config_validity",
    name: "Escalation Configuration Validity",
    passed: invalidEscalation.length === 0,
    severity: "CRITICAL",
    details: invalidEscalation.length === 0
      ? `Escalation timing and level thresholds are valid across all active rules.`
      : `${invalidEscalation.length} active rule(s) contain invalid escalation levels or non-increasing delays: ${invalidEscalation.map(r => r.code).join(", ")}.`
  });

  // Check 4: Cross-Operation Role Check
  const invalidCrossRoles = activeRules.filter(r => {
    if (operationType === "SECURITY_GUARDING" && (r.targetRole?.startsWith("FM_") || r.fallbackRole?.startsWith("FM_"))) return true;
    if (operationType === "FACILITY_MANAGEMENT" && (r.targetRole?.startsWith("SECURITY_") || r.fallbackRole?.startsWith("SECURITY_"))) return true;
    return false;
  });

  checks.push({
    id: "cross_operation_roles",
    name: "Operational Role Isolation",
    passed: invalidCrossRoles.length === 0,
    severity: "CRITICAL",
    details: invalidCrossRoles.length === 0
      ? `No cross-operation role mismatches detected.`
      : `${invalidCrossRoles.length} active rule(s) assign roles from outside ${operationType}: ${invalidCrossRoles.map(r => r.code).join(", ")}.`
  });

  // Check 5: Duplicate Scope Active Rules
  const scopeKeys = new Set<string>();
  let duplicateFound = false;
  for (const r of activeRules) {
    const key = `${r.code}:${r.siteId || "null"}:${r.projectId || "null"}:${r.contractId || "null"}`;
    if (scopeKeys.has(key)) {
      duplicateFound = true;
      break;
    }
    scopeKeys.add(key);
  }

  checks.push({
    id: "duplicate_scope_rules",
    name: "Exact Scope Rule Uniqueness",
    passed: !duplicateFound,
    severity: "CRITICAL",
    details: !duplicateFound
      ? `No duplicate active rules exist for identical code and site/project scopes.`
      : `Duplicate active rules detected for the same operational scope.`
  });

  // Check 6: Supervisors Exist in Database
  const supervisorCount = await prisma.employee.count({
    where: {
      isActive: true,
      isLocked: false,
      isSupervisor: true
    }
  });

  checks.push({
    id: "active_supervisors_exist",
    name: "Active Operational Supervisors",
    passed: supervisorCount > 0,
    severity: "WARNING",
    details: supervisorCount > 0
      ? `Found ${supervisorCount} active supervisor(s) available for alert resolution.`
      : `No active supervisors found in employee master. Alerts will fall back to Admin Queue.`
  });

  // Check 7: Valid Reminders & SLA Configuration
  const invalidRemindersSla = activeRules.filter(r => {
    if (r.reminderIntervalMinutes !== null && r.reminderIntervalMinutes <= 0) return true;
    if (r.maximumReminders < 0) return true;
    return false;
  });

  checks.push({
    id: "reminders_sla_validity",
    name: "Reminder Limits & SLA Parameters",
    passed: invalidRemindersSla.length === 0,
    severity: "WARNING",
    details: invalidRemindersSla.length === 0
      ? `Reminder intervals and maximum reminder limits are properly bounded.`
      : `${invalidRemindersSla.length} rule(s) contain invalid reminder intervals or negative limits.`
  });

  // Determine overall status
  const criticalFailed = checks.some(c => c.severity === "CRITICAL" && !c.passed);
  const warningFailed = checks.some(c => c.severity === "WARNING" && !c.passed);

  let overallStatus: "READY" | "READY_WITH_WARNINGS" | "NOT_READY" = "READY";
  if (criticalFailed) {
    overallStatus = "NOT_READY";
  } else if (warningFailed) {
    overallStatus = "READY_WITH_WARNINGS";
  }

  const passedChecks = checks.filter(c => c.passed).length;

  return {
    operationType,
    overallStatus,
    totalChecks: checks.length,
    passedChecks,
    checks
  };
}

/**
 * Evaluates rule fatigue and health indicators.
 */
export async function calculateAlertRuleHealth(
  ruleId: string,
  days: number = 30
): Promise<AlertRuleHealth> {
  const rule = await prisma.secFacAlertRule.findUnique({ where: { id: ruleId } });
  if (!rule) {
    throw new Error(`Alert rule '${ruleId}' not found`);
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const alerts = await prisma.secFacOperationalAlert.findMany({
    where: {
      ruleId,
      firstDetectedAt: { gte: since }
    }
  });

  const totalAlerts = alerts.length;
  if (totalAlerts === 0) {
    return {
      ruleId,
      alertCode: rule.code,
      totalAlerts: 0,
      dismissalRate: 0,
      escalationRate: 0,
      adminQueueRate: 0,
      averageAcknowledgementMinutes: null,
      averageResolutionMinutes: null,
      health: "HEALTHY",
      warnings: ["No alerts generated in evaluation window."]
    };
  }

  const dismissed = alerts.filter(a => a.status === "DISMISSED").length;
  const escalated = alerts.filter(a => a.escalationLevel > 0).length;
  const adminQueue = alerts.filter(a => a.assignmentSource === "ADMIN_QUEUE").length;

  const dismissalRate = Math.round((dismissed / totalAlerts) * 100);
  const escalationRate = Math.round((escalated / totalAlerts) * 100);
  const adminQueueRate = Math.round((adminQueue / totalAlerts) * 100);

  // Calculate average ack and resolution times
  let totalAckMins = 0;
  let ackCount = 0;
  let totalResMins = 0;
  let resCount = 0;

  for (const a of alerts) {
    if (a.acknowledgedAt) {
      const diff = (new Date(a.acknowledgedAt).getTime() - new Date(a.firstDetectedAt).getTime()) / (60 * 1000);
      if (diff >= 0) {
        totalAckMins += diff;
        ackCount++;
      }
    }
    if (a.resolvedAt) {
      const diff = (new Date(a.resolvedAt).getTime() - new Date(a.firstDetectedAt).getTime()) / (60 * 1000);
      if (diff >= 0) {
        totalResMins += diff;
        resCount++;
      }
    }
  }

  const averageAcknowledgementMinutes = ackCount > 0 ? Math.round(totalAckMins / ackCount) : null;
  const averageResolutionMinutes = resCount > 0 ? Math.round(totalResMins / resCount) : null;

  const warnings: string[] = [];
  let health: "HEALTHY" | "REVIEW" | "HIGH_NOISE" = "HEALTHY";

  if (dismissalRate >= 40) {
    warnings.push(`High dismissal rate (${dismissalRate}%). Rule may produce false positives or low-value noise.`);
    health = "HIGH_NOISE";
  } else if (dismissalRate >= 20) {
    warnings.push(`Elevated dismissal rate (${dismissalRate}%).`);
    if (health === "HEALTHY") health = "REVIEW";
  }

  if (adminQueueRate >= 30) {
    warnings.push(`High Admin Queue routing (${adminQueueRate}%). Supervisor coverage incomplete for assigned sites.`);
    if (health === "HEALTHY") health = "REVIEW";
  }

  if (totalAlerts > 50 && dismissalRate >= 30) {
    health = "HIGH_NOISE";
    warnings.push(`High volume (${totalAlerts} alerts) combined with high noise.`);
  }

  return {
    ruleId,
    alertCode: rule.code,
    totalAlerts,
    dismissalRate,
    escalationRate,
    adminQueueRate,
    averageAcknowledgementMinutes,
    averageResolutionMinutes,
    health,
    warnings
  };
}

/**
 * Validates rule configuration before setting `isActive: true`.
 */
export async function validateRuleActivation(ruleId: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  const rule = await prisma.secFacAlertRule.findUnique({ where: { id: ruleId } });

  if (!rule) {
    return { valid: false, errors: ["Alert rule not found."] };
  }

  if (!rule.targetRole) errors.push("Target role is required before activation.");
  if (!rule.fallbackRole) errors.push("Fallback role is required before activation.");

  if (rule.operationType === "SECURITY_GUARDING" && (rule.targetRole?.startsWith("FM_") || rule.fallbackRole?.startsWith("FM_"))) {
    errors.push("Security Guarding rule cannot assign Facility Management roles.");
  }
  if (rule.operationType === "FACILITY_MANAGEMENT" && (rule.targetRole?.startsWith("SECURITY_") || rule.fallbackRole?.startsWith("SECURITY_"))) {
    errors.push("Facility Management rule cannot assign Security Guarding roles.");
  }

  if (rule.projectId) {
    const proj = await prisma.manpowerProject.findUnique({ where: { id: rule.projectId } });
    if (!proj || !proj.isActive) errors.push(`Target project '${rule.projectId}' does not exist or is inactive.`);
  }

  if (rule.siteId) {
    const site = await prisma.manpowerSite.findUnique({ where: { id: rule.siteId } });
    if (!site || !site.isActive) {
      errors.push(`Target site '${rule.siteId}' does not exist or is inactive.`);
    } else if (rule.projectId && site.projectId !== rule.projectId) {
      errors.push(`Selected site does not belong to the selected project.`);
    }
  }

  // Check duplicate active rule
  const duplicate = await prisma.secFacAlertRule.findFirst({
    where: {
      id: { not: ruleId },
      operationType: rule.operationType,
      code: rule.code,
      siteId: rule.siteId || null,
      projectId: rule.projectId || null,
      contractId: rule.contractId || null,
      isActive: true
    }
  });

  if (duplicate) {
    errors.push(`Another active rule for code '${rule.code}' already exists in this exact scope.`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
