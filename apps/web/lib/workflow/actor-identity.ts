import { prisma } from "@ahh-wfm/database";
import { hasPermission, isAdminUser } from "@/lib/permissions";

/**
 * Enforces SECURITY_GUARDING / FACILITY_MANAGEMENT operational scope isolation
 * consistently across Approval Center Inbox, Outbox, and Counts.
 */
export function isOperationScopePermitted(
  user: any,
  operationScope: string | null | undefined
): boolean {
  if (!operationScope) return true;
  if (isAdminUser(user) || hasPermission(user, "manpower.admin.full_access")) return true;
  const scope = operationScope.toUpperCase().trim();
  const allowedSG =
    user?.operationAccess?.allowedSecurityGuarding ?? user?.allowedSecurityGuarding ?? true;
  const allowedFM =
    user?.operationAccess?.allowedFacilityManagement ?? user?.allowedFacilityManagement ?? true;
  if (scope === "SECURITY_GUARDING" && !allowedSG) return false;
  if (scope === "FACILITY_MANAGEMENT" && !allowedFM) return false;
  return true;
}

/**
 * Resolves verified actor tokens for querying legacy WorkflowActionHistory.actedBy.
 *
 * Security rule:
 * - Always includes immutable user/employee IDs (`user.id`, `user.employeeId`).
 * - Includes `user.email` ONLY if uniquely associated with this user (<= 1 employee row).
 * - Includes `user.name` ONLY if uniquely associated with this exact user in `Employee`
 *   (exactly 1 matching row whose id matches `user.id` or `user.employeeId`).
 *   Two different employees sharing the same display name NEVER match each other's history.
 */
export async function resolveVerifiedActorTokens(user: any): Promise<string[]> {
  const immutableIds = Array.from(
    new Set(
      [user?.id, user?.employeeId]
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim())
    )
  );
  const tokens = new Set<string>(immutableIds);

  const email = typeof user?.email === "string" ? user.email.trim() : "";
  if (email) {
    try {
      const emailMatches = await prisma.employee.findMany({
        where: { email },
        select: { id: true },
        take: 2,
      });
      if (
        emailMatches.length === 0 ||
        (emailMatches.length === 1 && immutableIds.includes(emailMatches[0].id))
      ) {
        tokens.add(email);
      }
    } catch {
      // Fail closed on lookup error: rely on immutable IDs only
    }
  }

  const name = typeof user?.name === "string" ? user.name.trim() : "";
  if (name) {
    try {
      const nameMatches = await prisma.employee.findMany({
        where: { name },
        select: { id: true },
        take: 2,
      });
      if (nameMatches.length === 1 && immutableIds.includes(nameMatches[0].id)) {
        tokens.add(name);
      }
    } catch {
      // Fail closed on lookup error: never match by unverified display name
    }
  }

  return Array.from(tokens);
}
