import { OperationType } from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";

export interface PilotRuleTemplate {
  code: string;
  name: string;
  description: string;
  sourceType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  triggerAfterMinutes: number;
  reminderIntervalMinutes: number;
  maximumReminders: number;
  targetRole: string;
  fallbackRole: string;
  acknowledgementSlaMinutes: number;
  resolutionSlaMinutes: number;
  escalationLevels: {
    level: number;
    afterMinutes: number;
    targetRole: string;
  }[];
}

export function getSecurityGuardingPilotTemplates(): PilotRuleTemplate[] {
  return [
    {
      code: "GUARD_NO_SHOW",
      name: "Guard No Show at Shift Start",
      description: "Triggered when a guard has not clocked in within 15 minutes of scheduled shift start.",
      sourceType: "ATTENDANCE_SCHEDULING",
      severity: "HIGH",
      triggerAfterMinutes: 15,
      reminderIntervalMinutes: 30,
      maximumReminders: 3,
      targetRole: "SECURITY_SUPERVISOR",
      fallbackRole: "SECURITY_OPERATIONS_MANAGER",
      acknowledgementSlaMinutes: 15,
      resolutionSlaMinutes: 120,
      escalationLevels: [
        { level: 1, afterMinutes: 30, targetRole: "SECURITY_OPERATIONS_MANAGER" },
        { level: 2, afterMinutes: 60, targetRole: "SECURITY_DIRECTOR" }
      ]
    },
    {
      code: "LATE_ARRIVAL",
      name: "Guard Late Arrival Anomaly",
      description: "Triggered when a guard clocks in late beyond the 10 minute grace threshold.",
      sourceType: "ATTENDANCE",
      severity: "MEDIUM",
      triggerAfterMinutes: 10,
      reminderIntervalMinutes: 30,
      maximumReminders: 2,
      targetRole: "SECURITY_SUPERVISOR",
      fallbackRole: "OPERATIONS_COORDINATOR",
      acknowledgementSlaMinutes: 30,
      resolutionSlaMinutes: 180,
      escalationLevels: [
        { level: 1, afterMinutes: 45, targetRole: "SECURITY_OPERATIONS_MANAGER" }
      ]
    },
    {
      code: "WRONG_SITE_CLOCK_IN",
      name: "Out of Geofence Clock-In",
      description: "Triggered when a guard attempts clock-in outside the assigned site boundary.",
      sourceType: "ATTENDANCE",
      severity: "HIGH",
      triggerAfterMinutes: 0,
      reminderIntervalMinutes: 15,
      maximumReminders: 2,
      targetRole: "SECURITY_SUPERVISOR",
      fallbackRole: "SECURITY_OPERATIONS_MANAGER",
      acknowledgementSlaMinutes: 15,
      resolutionSlaMinutes: 60,
      escalationLevels: [
        { level: 1, afterMinutes: 30, targetRole: "SECURITY_OPERATIONS_MANAGER" }
      ]
    },
    {
      code: "PATROL_MISSED",
      name: "Guard Patrol Route Missed",
      description: "Triggered when a scheduled guard patrol is not started within 20 minutes.",
      sourceType: "PATROL",
      severity: "HIGH",
      triggerAfterMinutes: 20,
      reminderIntervalMinutes: 30,
      maximumReminders: 3,
      targetRole: "SECURITY_SUPERVISOR",
      fallbackRole: "SECURITY_OPERATIONS_MANAGER",
      acknowledgementSlaMinutes: 15,
      resolutionSlaMinutes: 120,
      escalationLevels: [
        { level: 1, afterMinutes: 30, targetRole: "SECURITY_OPERATIONS_MANAGER" }
      ]
    },
    {
      code: "INCIDENT_UNRESOLVED",
      name: "Critical Security Incident Unresolved",
      description: "Triggered when a reported security incident remains open past 30 minutes.",
      sourceType: "INCIDENT",
      severity: "HIGH",
      triggerAfterMinutes: 30,
      reminderIntervalMinutes: 60,
      maximumReminders: 4,
      targetRole: "SECURITY_SUPERVISOR",
      fallbackRole: "SECURITY_OPERATIONS_MANAGER",
      acknowledgementSlaMinutes: 15,
      resolutionSlaMinutes: 240,
      escalationLevels: [
        { level: 1, afterMinutes: 60, targetRole: "SECURITY_OPERATIONS_MANAGER" },
        { level: 2, afterMinutes: 120, targetRole: "SECURITY_DIRECTOR" }
      ]
    },
    {
      code: "MINIMUM_MANPOWER_BREACH",
      name: "Minimum Manpower Post Requirement Breach",
      description: "Triggered when active deployed guards drop below mandatory site post quota.",
      sourceType: "SCHEDULING",
      severity: "CRITICAL",
      triggerAfterMinutes: 0,
      reminderIntervalMinutes: 15,
      maximumReminders: 5,
      targetRole: "SECURITY_SUPERVISOR",
      fallbackRole: "SECURITY_DIRECTOR",
      acknowledgementSlaMinutes: 5,
      resolutionSlaMinutes: 60,
      escalationLevels: [
        { level: 1, afterMinutes: 15, targetRole: "SECURITY_OPERATIONS_MANAGER" },
        { level: 2, afterMinutes: 30, targetRole: "SECURITY_DIRECTOR" }
      ]
    },
    {
      code: "SUPERVISOR_REPORT_OVERDUE",
      name: "Supervisor Daily Security Shift Report Overdue",
      description: "Triggered when shift supervisor end-of-shift report is overdue by 60 minutes.",
      sourceType: "REPORTING",
      severity: "MEDIUM",
      triggerAfterMinutes: 60,
      reminderIntervalMinutes: 60,
      maximumReminders: 2,
      targetRole: "SECURITY_OPERATIONS_MANAGER",
      fallbackRole: "SECURITY_DIRECTOR",
      acknowledgementSlaMinutes: 30,
      resolutionSlaMinutes: 240,
      escalationLevels: [
        { level: 1, afterMinutes: 120, targetRole: "SECURITY_DIRECTOR" }
      ]
    }
  ];
}

export function getFacilityManagementPilotTemplates(): PilotRuleTemplate[] {
  return [
    {
      code: "EMPLOYEE_NO_SHOW",
      name: "FM Technician No Show at Shift Start",
      description: "Triggered when an FM technician has not clocked in within 15 minutes of scheduled shift start.",
      sourceType: "ATTENDANCE_SCHEDULING",
      severity: "HIGH",
      triggerAfterMinutes: 15,
      reminderIntervalMinutes: 30,
      maximumReminders: 3,
      targetRole: "FM_SUPERVISOR",
      fallbackRole: "FM_OPERATIONS_MANAGER",
      acknowledgementSlaMinutes: 15,
      resolutionSlaMinutes: 120,
      escalationLevels: [
        { level: 1, afterMinutes: 30, targetRole: "FM_OPERATIONS_MANAGER" },
        { level: 2, afterMinutes: 60, targetRole: "FM_DIRECTOR" }
      ]
    },
    {
      code: "LATE_ARRIVAL",
      name: "FM Technician Late Arrival",
      description: "Triggered when an FM employee clocks in late beyond the 15 minute threshold.",
      sourceType: "ATTENDANCE",
      severity: "MEDIUM",
      triggerAfterMinutes: 15,
      reminderIntervalMinutes: 30,
      maximumReminders: 2,
      targetRole: "FM_SUPERVISOR",
      fallbackRole: "OPERATIONS_COORDINATOR",
      acknowledgementSlaMinutes: 30,
      resolutionSlaMinutes: 180,
      escalationLevels: [
        { level: 1, afterMinutes: 60, targetRole: "FM_OPERATIONS_MANAGER" }
      ]
    },
    {
      code: "WRONG_SITE_CLOCK_IN",
      name: "Out of Geofence FM Clock-In",
      description: "Triggered when an FM employee attempts clock-in outside the assigned facility site boundary.",
      sourceType: "ATTENDANCE",
      severity: "HIGH",
      triggerAfterMinutes: 0,
      reminderIntervalMinutes: 15,
      maximumReminders: 2,
      targetRole: "FM_SUPERVISOR",
      fallbackRole: "FM_OPERATIONS_MANAGER",
      acknowledgementSlaMinutes: 15,
      resolutionSlaMinutes: 60,
      escalationLevels: [
        { level: 1, afterMinutes: 30, targetRole: "FM_OPERATIONS_MANAGER" }
      ]
    },
    {
      code: "TASK_OVERDUE",
      name: "FM Maintenance Task Overdue",
      description: "Triggered when an assigned facility maintenance task exceeds its scheduled deadline.",
      sourceType: "TASK",
      severity: "MEDIUM",
      triggerAfterMinutes: 30,
      reminderIntervalMinutes: 60,
      maximumReminders: 3,
      targetRole: "FM_SUPERVISOR",
      fallbackRole: "FM_OPERATIONS_MANAGER",
      acknowledgementSlaMinutes: 30,
      resolutionSlaMinutes: 240,
      escalationLevels: [
        { level: 1, afterMinutes: 60, targetRole: "FM_OPERATIONS_MANAGER" }
      ]
    },
    {
      code: "CHECKLIST_FAILED_ACTION_REQUIRED",
      name: "Facility Inspection Checklist Failure",
      description: "Triggered when a critical facility inspection item fails inspection and requires corrective action.",
      sourceType: "CHECKLIST",
      severity: "HIGH",
      triggerAfterMinutes: 0,
      reminderIntervalMinutes: 30,
      maximumReminders: 3,
      targetRole: "FM_SUPERVISOR",
      fallbackRole: "FM_OPERATIONS_MANAGER",
      acknowledgementSlaMinutes: 15,
      resolutionSlaMinutes: 120,
      escalationLevels: [
        { level: 1, afterMinutes: 30, targetRole: "FM_OPERATIONS_MANAGER" }
      ]
    },
    {
      code: "INCIDENT_UNRESOLVED",
      name: "Facility Operational Hazard Unresolved",
      description: "Triggered when a facility safety hazard or incident remains open past 30 minutes.",
      sourceType: "INCIDENT",
      severity: "HIGH",
      triggerAfterMinutes: 30,
      reminderIntervalMinutes: 60,
      maximumReminders: 4,
      targetRole: "FM_SUPERVISOR",
      fallbackRole: "FM_OPERATIONS_MANAGER",
      acknowledgementSlaMinutes: 15,
      resolutionSlaMinutes: 240,
      escalationLevels: [
        { level: 1, afterMinutes: 60, targetRole: "FM_OPERATIONS_MANAGER" },
        { level: 2, afterMinutes: 120, targetRole: "FM_DIRECTOR" }
      ]
    },
    {
      code: "SUPERVISOR_REPORT_OVERDUE",
      name: "Supervisor Daily FM Shift Report Overdue",
      description: "Triggered when FM shift supervisor daily operations report is overdue by 60 minutes.",
      sourceType: "REPORTING",
      severity: "MEDIUM",
      triggerAfterMinutes: 60,
      reminderIntervalMinutes: 60,
      maximumReminders: 2,
      targetRole: "FM_OPERATIONS_MANAGER",
      fallbackRole: "FM_DIRECTOR",
      acknowledgementSlaMinutes: 30,
      resolutionSlaMinutes: 240,
      escalationLevels: [
        { level: 1, afterMinutes: 120, targetRole: "FM_DIRECTOR" }
      ]
    }
  ];
}

/**
 * Seeds pilot alert rule templates into database for given operation type.
 * MANDATORY RULE: Rules are created with isActive = false by default!
 */
export async function seedPilotAlertRules(
  operationType: OperationType,
  actorUserId?: string
): Promise<{ seeded: number; skipped: number }> {
  const templates = operationType === "SECURITY_GUARDING"
    ? getSecurityGuardingPilotTemplates()
    : getFacilityManagementPilotTemplates();

  let seeded = 0;
  let skipped = 0;

  for (const t of templates) {
    const existing = await prisma.secFacAlertRule.findFirst({
      where: {
        operationType,
        code: t.code,
        siteId: null,
        projectId: null,
        contractId: null
      }
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.secFacAlertRule.create({
      data: {
        operationType,
        code: t.code,
        name: t.name,
        description: t.description,
        sourceType: t.sourceType,
        severity: t.severity,
        isActive: false, // MANDATORY: INACTIVE BY DEFAULT!
        triggerAfterMinutes: t.triggerAfterMinutes,
        reminderIntervalMinutes: t.reminderIntervalMinutes,
        maximumReminders: t.maximumReminders,
        targetRole: t.targetRole,
        fallbackRole: t.fallbackRole,
        escalationConfig: { levels: t.escalationLevels },
        settings: {
          acknowledgementSlaMinutes: t.acknowledgementSlaMinutes,
          resolutionSlaMinutes: t.resolutionSlaMinutes,
          isPilotTemplate: true
        },
        createdById: actorUserId || null
      }
    });

    seeded++;
  }

  return { seeded, skipped };
}
