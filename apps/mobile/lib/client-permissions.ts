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

export function hasClientPermission(
  user: { role?: string; permissions?: string[] } | null | undefined,
  permissionKey: string
): boolean {
  if (!user) return false;

  // Centralized Admin bypass (ADMIN & SUPER_ADMIN)
  if (isAdminUser(user)) {
    return true;
  }

  // Explicit permission or manpower admin override
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.includes("manpower.admin.full_access")) return true;
    return user.permissions.includes(permissionKey);
  }

  return false;
}
