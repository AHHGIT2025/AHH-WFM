/**
 * Client-Side Authorization Helper for Mobile Components
 * Pure function with ZERO Node/Prisma/NextAuth-server dependencies.
 * Safe for Client Components ("use client").
 */
export function hasClientPermission(
  user: { role?: string; permissions?: string[] } | null | undefined,
  permissionKey: string
): boolean {
  if (!user) return false;
  const roleUpper = user.role?.toUpperCase().replace(/\s+/g, "_") || "";
  if (roleUpper === "SUPER_ADMIN") {
    return true;
  }
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.includes("manpower.admin.full_access")) return true;
    return user.permissions.includes(permissionKey);
  }
  return false;
}
