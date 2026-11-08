/**
 * Client-Side Authorization Helper for Mobile Components
 * Pure function with ZERO Node/Prisma/NextAuth-server dependencies.
 * Safe for Client Components ("use client").
 */

const MANPOWER_ADMIN_EXCLUDED_PREFIXES = [
  "users.",
  "roles.",
  "settings.",
  "system.",
  "backup.",
  "audit.",
  "integration.",
  "sap.",
  "employees.",
  "masters.",
  "masterdata.",
  "precontract."
];

function isScopeBlockedForPermission(user: any, permissionKey: string): boolean {
  const roleUpper = (user?.role || "").trim().toUpperCase().replace(/\s+/g, "_");
  const opAccess = user?.operationAccess;
  const isOpArray = Array.isArray(opAccess);
  const arrayHasAll = isOpArray && opAccess.includes("ALL");
  const arrayAllowsSG = isOpArray ? arrayHasAll || opAccess.includes("SECURITY_GUARDING") : undefined;
  const arrayAllowsFM = isOpArray ? arrayHasAll || opAccess.includes("FACILITY_MANAGEMENT") : undefined;

  const disallowSG =
    roleUpper.startsWith("FM_") ||
    (isOpArray ? !arrayAllowsSG : opAccess?.allowedSecurityGuarding === false);
  const disallowFM =
    roleUpper.startsWith("SECURITY_") ||
    (isOpArray ? !arrayAllowsFM : opAccess?.allowedFacilityManagement === false);

  if (permissionKey === "manpower.admin.full_access") {
    if (disallowSG || disallowFM) {
      return true;
    }
  }

  const isSecurityOnlyKey =
    permissionKey.startsWith("manpower.security.") ||
    permissionKey.startsWith("security.") ||
    permissionKey.startsWith("secfac.postOrders.") ||
    permissionKey.startsWith("secfac.briefings.") ||
    permissionKey.startsWith("secfac.incidents.") ||
    permissionKey.startsWith("secfac.inspections.");

  if (isSecurityOnlyKey && disallowSG) {
    return true;
  }

  const isFacilityOnlyKey =
    permissionKey.startsWith("manpower.fm.") ||
    permissionKey.startsWith("manpower.facility.") ||
    permissionKey.startsWith("facility.");

  if (isFacilityOnlyKey && disallowFM) {
    return true;
  }

  return false;
}

function isManpowerAdminWildcardAllowed(
  user: {
    role?: string;
    operationAccess?: any;
  },
  permissionKey: string
): boolean {
  if (MANPOWER_ADMIN_EXCLUDED_PREFIXES.some((prefix) => permissionKey.startsWith(prefix))) {
    return false;
  }

  const isManpowerScopedKey =
    permissionKey.startsWith("manpower.") ||
    permissionKey.startsWith("secfac.") ||
    permissionKey.startsWith("security.") ||
    permissionKey.startsWith("facility.") ||
    permissionKey.startsWith("commercial.commandCenter.");

  if (!isManpowerScopedKey) {
    return false;
  }

  if (isScopeBlockedForPermission(user, permissionKey)) {
    return false;
  }

  return true;
}

export function isAdminUser(user: { role?: string } | null | undefined): boolean {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase().replace(/\s+/g, "_");
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function hasClientPermission(
  user: {
    role?: string;
    permissions?: string[];
    operationAccess?: any;
  } | null | undefined,
  permissionKey: string
): boolean {
  if (!user) return false;

  // Centralized Admin bypass (ADMIN & SUPER_ADMIN)
  if (isAdminUser(user)) {
    return true;
  }

  if (isScopeBlockedForPermission(user, permissionKey)) {
    return false;
  }

  // Explicit permission or scoped manpower admin override
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.includes(permissionKey)) return true;
    if (
      user.permissions.includes("manpower.admin.full_access") &&
      isManpowerAdminWildcardAllowed(user, permissionKey)
    ) {
      return true;
    }
    return false;
  }

  return false;
}
