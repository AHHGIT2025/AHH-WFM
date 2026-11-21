/**
 * Client-Side Authorization Helper for Mobile Components
 * Pure function with ZERO Node/Prisma/NextAuth-server dependencies.
 * Safe for Client Components ("use client").
 */

export function isAdminUser(user: { role?: string } | null | undefined): boolean {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase().replace(/\s+/g, "_");
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const MANPOWER_ADMIN_IMPLIED_PERMISSIONS = new Set<string>([
  "manpower.view",
  "manpower.manage",
  "manpower.admin.full_access",
  "manpower.schedule.view",
  "manpower.schedule.write",
  "manpower.schedule.edit",
  "manpower.schedule.manage",
  "manpower.schedule.assign",
  "manpower.schedule.unassign",
  "manpower.schedule.override",
  "manpower.schedule.sync",
  "manpower.roster.publish",
  "manpower.roster.cancel",
  "manpower.roster.changeRequest.submit",
  "manpower.roster.changeRequest.review",
  "manpower.roster.changeRequest.approve",
  "manpower.roster.changeRequest.reject",
  "manpower.roster.changeRequest.withdraw",
  "manpower.roster.acknowledge",
  "manpower.roster.publication.viewHistory",
  "manpower.reconciliation.view",
  "manpower.reconciliation.run",
  "manpower.reconciliation.review",
  "manpower.reconciliation.excuse",
  "manpower.reconciliation.classifyUnexcused",
  "manpower.reconciliation.markSyncDelay",
  "manpower.reconciliation.manageConfig",
  "manpower.advisory.view",
  "manpower.advisory.calculate",
  "manpower.advisory.review",
  "manpower.advisory.lock",
  "manpower.advisory.export",
  "manpower.calendars.manage",
  "manpower.calendars.approve",
  "security.scheduling.view",
  "security.scheduling.assign",
  "security.scheduling.instructions.manage",
  "security.scheduling.siteAllowance.manage",
  "security.scheduling.siteShift.manage",
]);

export function hasClientPermission(
  user: { role?: string; permissions?: string[] } | null | undefined,
  permissionKey: string
): boolean {
  if (!user) return false;

  // Centralized Admin bypass (ADMIN & SUPER_ADMIN)
  if (isAdminUser(user)) {
    return true;
  }

  // Explicit permission or scoped manpower admin override
  if (user.permissions && Array.isArray(user.permissions)) {
    if (
      user.permissions.includes("manpower.admin.full_access") &&
      MANPOWER_ADMIN_IMPLIED_PERMISSIONS.has(permissionKey)
    ) {
      return true;
    }
    return user.permissions.includes(permissionKey);
  }

  return false;
}
