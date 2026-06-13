export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    "dashboard.view", "employees.view", "employees.create", "employees.edit", "employees.delete", "employees.bulkUpload",
    "attendance.view", "attendance.edit", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "shifts.edit",
    "overtime.view", "overtime.approve", "reports.view", "reports.export",
    "sap.view", "sap.sync", "sap.mapping",
    "backup.view", "backup.create", "backup.download", "backup.delete",
    "settings.view", "settings.roles.manage"
  ],
  ADMIN: [
    "dashboard.view", "employees.view", "employees.create", "employees.edit", "employees.bulkUpload",
    "attendance.view", "attendance.edit", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "shifts.edit",
    "overtime.view", "overtime.approve", "reports.view", "reports.export",
    "sap.view", "sap.sync", "sap.mapping",
    "backup.view", "backup.create", "backup.download",
    "settings.view"
  ],
  HR_MANAGER: [
    "dashboard.view", "employees.view", "employees.create", "employees.edit", "employees.bulkUpload",
    "attendance.view", "attendance.edit", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "shifts.edit",
    "reports.view", "reports.export"
  ],
  FINANCE_MANAGER: [
    "dashboard.view", "employees.view", "attendance.view", "overtime.view", "overtime.approve",
    "reports.view", "reports.export", "sap.view"
  ],
  SUPERVISOR: [
    "dashboard.view", "employees.view", "attendance.view", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "overtime.view"
  ],
  EMPLOYEE: [
    "dashboard.view", "employees.view", "attendance.view", "leaves.view", "shifts.view"
  ],
  SAP_ADMIN: [
    "dashboard.view", "sap.view", "sap.sync", "sap.mapping", "reports.view"
  ],
  REPORT_VIEWER: [
    "dashboard.view", "reports.view"
  ]
};

export function hasPermission(user: { role?: string } | null | undefined, permissionKey: string): boolean {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase();
  
  // SUPER_ADMIN override
  if (role === "SUPER_ADMIN") return true;

  const permissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permissionKey);
}

export function getUserPermissions(user: { role?: string } | null | undefined): string[] {
  if (!user || !user.role) return [];
  const role = user.role.toUpperCase();
  if (role === "SUPER_ADMIN") {
    return DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN;
  }
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}

export function filterNavigationByPermissions(user: { role?: string } | null | undefined, navItems: any[]): any[] {
  if (!user) return [];
  return navItems.filter(item => {
    // Map paths to permissions
    if (item.path === "/" || item.path === "/dashboard") return hasPermission(user, "dashboard.view");
    if (item.path.startsWith("/workforce")) return hasPermission(user, "employees.view");
    if (item.path.startsWith("/attendance")) return hasPermission(user, "attendance.view");
    if (item.path.startsWith("/leave")) return hasPermission(user, "leaves.view");
    if (item.path.startsWith("/sap")) return hasPermission(user, "sap.view");
    if (item.path.startsWith("/shifts")) return hasPermission(user, "shifts.view");
    if (item.path.startsWith("/admin/backup")) return hasPermission(user, "backup.view");
    if (item.path.startsWith("/settings")) return hasPermission(user, "settings.view");
    if (item.path.startsWith("/reports")) return hasPermission(user, "reports.view");
    return true;
  });
}
