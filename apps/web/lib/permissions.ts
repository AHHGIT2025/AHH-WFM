export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    "dashboard.view", "employees.view", "employees.create", "employees.edit", "employees.delete", "employees.bulkUpload",
    "attendance.view", "attendance.edit", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "shifts.edit",
    "overtime.view", "overtime.approve", "reports.view", "reports.export",
    "sap.view", "sap.sync", "sap.mapping",
    "backup.view", "backup.create", "backup.download", "backup.delete",
    "settings.view", "settings.roles.manage", "masters.view", "masters.manage",
    "users.view", "users.manage", "roles.view", "roles.manage", "audit.view",
    "manpower.view", "manpower.manage", "manpower.admin.full_access",
    "manpower.security.view", "manpower.security.manage", "manpower.security.reports.view", "manpower.security.reports.export",
    "manpower.fm.view", "manpower.fm.manage", "manpower.fm.reports.view", "manpower.fm.reports.export",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change",
    "settings.manage", "system.config.view", "system.config.manage", "masterdata.view", "masterdata.manage", "audit.export", "integration.view", "integration.manage"
  ],
  ADMIN: [
    "dashboard.view", "employees.view", "employees.create", "employees.edit", "employees.bulkUpload",
    "attendance.view", "attendance.edit", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "shifts.edit",
    "overtime.view", "overtime.approve", "reports.view", "reports.export",
    "sap.view", "sap.sync", "sap.mapping",
    "backup.view", "backup.create", "backup.download",
    "settings.view", "masters.view", "masters.manage",
    "users.view", "users.manage", "roles.view", "roles.manage", "audit.view",
    "manpower.view", "manpower.manage",
    "manpower.security.view", "manpower.security.manage", "manpower.security.reports.view", "manpower.security.reports.export",
    "manpower.fm.view", "manpower.fm.manage", "manpower.fm.reports.view", "manpower.fm.reports.export",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change",
    "settings.manage", "system.config.view", "system.config.manage", "masterdata.view", "masterdata.manage", "audit.export", "integration.view", "integration.manage"
  ],
  SYSTEM_ADMIN: [
    "settings.view", "settings.manage", "users.view", "users.manage", "roles.view", "roles.manage",
    "system.config.view", "system.config.manage", "masterdata.view", "masterdata.manage",
    "audit.view", "audit.export", "integration.view", "integration.manage",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  IT_ADMIN: [
    "settings.view", "settings.manage", "users.view", "users.manage", "roles.view", "roles.manage",
    "system.config.view", "system.config.manage", "audit.view", "integration.view", "integration.manage",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  APPLICATION_ADMIN: [
    "settings.view", "users.view", "users.manage", "roles.view", "roles.manage", "masterdata.view", "masterdata.manage",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  SETTINGS_ADMIN: [
    "settings.view", "settings.manage", "roles.view", "roles.manage",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  AUDIT_VIEWER: [
    "settings.view", "audit.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  EMPLOYEE_SELF_SERVICE: [
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  HR_MANAGER: [
    "dashboard.view", "employees.view", "employees.create", "employees.edit", "employees.bulkUpload",
    "attendance.view", "attendance.edit", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "shifts.edit",
    "reports.view", "reports.export", "masters.view",
    "users.view", "users.manage", "roles.view", "roles.manage", "audit.view",
    "manpower.view", "manpower.manage",
    "manpower.security.view", "manpower.security.manage",
    "manpower.fm.view", "manpower.fm.manage",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  HR_EXECUTIVE: [
    "dashboard.view", "employees.view", "attendance.view", "leaves.view", "shifts.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  FINANCE_MANAGER: [
    "dashboard.view", "employees.view", "attendance.view", "overtime.view", "overtime.approve",
    "reports.view", "reports.export", "sap.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  FINANCE_VIEWER: [
    "dashboard.view", "reports.view", "sap.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  DEPARTMENT_MANAGER: [
    "dashboard.view", "employees.view", "attendance.view", "leaves.view", "shifts.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  SUPERVISOR: [
    "dashboard.view", "employees.view", "attendance.view", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "overtime.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  EMPLOYEE: [
    "dashboard.view", "employees.view", "attendance.view", "leaves.view", "shifts.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  SAP_ADMIN: [
    "dashboard.view", "sap.view", "sap.sync", "sap.mapping", "reports.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  REPORT_VIEWER: [
    "dashboard.view", "reports.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],

  // Security Guarding Default Roles
  SECURITY_ADMIN: [
    "dashboard.view", "manpower.view", "manpower.manage", "manpower.admin.full_access",
    "manpower.security.view", "manpower.security.manage", "manpower.security.clients.view", "manpower.security.clients.manage",
    "manpower.security.contracts.view", "manpower.security.contracts.manage", "manpower.security.projects.view", "manpower.security.projects.manage",
    "manpower.security.sites.view", "manpower.security.sites.manage", "manpower.security.zones.view", "manpower.security.zones.manage",
    "manpower.security.manpower.view", "manpower.security.manpower.manage", "manpower.security.shifts.view", "manpower.security.shifts.manage",
    "manpower.security.deployments.view", "manpower.security.deployments.manage", "manpower.security.relievers.view", "manpower.security.relievers.manage",
    "manpower.security.reports.view", "manpower.security.reports.export"
  ],
  SECURITY_OPERATIONS_MANAGER: [
    "dashboard.view", "manpower.security.view", "manpower.security.manage", "manpower.security.clients.view",
    "manpower.security.contracts.view", "manpower.security.projects.view", "manpower.security.sites.view", "manpower.security.zones.view",
    "manpower.security.manpower.view", "manpower.security.manpower.manage", "manpower.security.shifts.view", "manpower.security.shifts.manage",
    "manpower.security.deployments.view", "manpower.security.deployments.manage", "manpower.security.relievers.view", "manpower.security.relievers.manage",
    "manpower.security.reports.view", "manpower.security.reports.export"
  ],
  SECURITY_PROJECT_MANAGER: [
    "dashboard.view", "manpower.security.view", "manpower.security.projects.view", "manpower.security.sites.view",
    "manpower.security.zones.view", "manpower.security.manpower.view", "manpower.security.shifts.view", "manpower.security.deployments.view"
  ],
  SECURITY_SUPERVISOR: [
    "dashboard.view", "manpower.security.view", "manpower.security.manpower.view", "manpower.security.shifts.view",
    "manpower.security.deployments.manage"
  ],
  SECURITY_HR_PAYROLL_VIEWER: [
    "dashboard.view", "manpower.security.view", "manpower.security.reports.view", "manpower.security.manpower.view"
  ],
  SECURITY_FINANCE_VIEWER: [
    "dashboard.view", "manpower.security.view", "manpower.security.reports.view"
  ],
  SECURITY_READ_ONLY: [
    "dashboard.view", "manpower.security.view", "manpower.security.clients.view", "manpower.security.contracts.view",
    "manpower.security.projects.view", "manpower.security.sites.view", "manpower.security.zones.view", "manpower.security.manpower.view",
    "manpower.security.shifts.view", "manpower.security.deployments.view", "manpower.security.relievers.view", "manpower.security.reports.view"
  ],

  // Facility Management Default Roles
  FM_ADMIN: [
    "dashboard.view", "manpower.view", "manpower.manage", "manpower.admin.full_access",
    "manpower.fm.view", "manpower.fm.manage", "manpower.fm.clients.view", "manpower.fm.clients.manage",
    "manpower.fm.contracts.view", "manpower.fm.contracts.manage", "manpower.fm.projects.view", "manpower.fm.projects.manage",
    "manpower.fm.sites.view", "manpower.fm.sites.manage", "manpower.fm.areas.view", "manpower.fm.areas.manage",
    "manpower.fm.manpower.view", "manpower.fm.manpower.manage", "manpower.fm.shifts.view", "manpower.fm.shifts.manage",
    "manpower.fm.deployments.view", "manpower.fm.deployments.manage", "manpower.fm.relievers.view", "manpower.fm.relievers.manage",
    "manpower.fm.reports.view", "manpower.fm.reports.export"
  ],
  FM_OPERATIONS_MANAGER: [
    "dashboard.view", "manpower.fm.view", "manpower.fm.manage", "manpower.fm.clients.view",
    "manpower.fm.contracts.view", "manpower.fm.projects.view", "manpower.fm.sites.view", "manpower.fm.areas.view",
    "manpower.fm.manpower.view", "manpower.fm.manpower.manage", "manpower.fm.shifts.view", "manpower.fm.shifts.manage",
    "manpower.fm.deployments.view", "manpower.fm.deployments.manage", "manpower.fm.relievers.view", "manpower.fm.relievers.manage",
    "manpower.fm.reports.view", "manpower.fm.reports.export"
  ],
  FM_PROJECT_MANAGER: [
    "dashboard.view", "manpower.fm.view", "manpower.fm.projects.view", "manpower.fm.sites.view",
    "manpower.fm.areas.view", "manpower.fm.manpower.view", "manpower.fm.shifts.view", "manpower.fm.deployments.view"
  ],
  FM_SUPERVISOR: [
    "dashboard.view", "manpower.fm.view", "manpower.fm.manpower.view", "manpower.fm.shifts.view",
    "manpower.fm.deployments.manage"
  ],
  FM_HR_PAYROLL_VIEWER: [
    "dashboard.view", "manpower.fm.view", "manpower.fm.reports.view", "manpower.fm.manpower.view"
  ],
  FM_FINANCE_VIEWER: [
    "dashboard.view", "manpower.fm.view", "manpower.fm.reports.view"
  ],
  FM_READ_ONLY: [
    "dashboard.view", "manpower.fm.view", "manpower.fm.clients.view", "manpower.fm.contracts.view",
    "manpower.fm.projects.view", "manpower.fm.sites.view", "manpower.fm.areas.view", "manpower.fm.manpower.view",
    "manpower.fm.shifts.view", "manpower.fm.deployments.view", "manpower.fm.relievers.view", "manpower.fm.reports.view"
  ]
};

export function hasPermission(user: { role?: string; permissions?: string[] } | null | undefined, permissionKey: string): boolean {
  if (!user) return false;

  // SUPER_ADMIN override (must always bypass everything for safety)
  if (user.role && user.role.toUpperCase().replace(/\s+/g, "_") === "SUPER_ADMIN") {
    return true;
  }

  // Check database-driven combined permissions in session if loaded
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.includes("manpower.admin.full_access")) return true;
    return user.permissions.includes(permissionKey);
  }

  // Fallback to hardcoded roles in code if not loaded in session
  if (!user.role) return false;
  const role = user.role.toUpperCase().replace(/\s+/g, "_");
  const permissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permissionKey);
}

export function getUserPermissions(user: { role?: string; permissions?: string[] } | null | undefined): string[] {
  if (!user) return [];

  if (user.role && user.role.toUpperCase().replace(/\s+/g, "_") === "SUPER_ADMIN") {
    return DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN;
  }

  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions;
  }

  if (!user.role) return [];
  const role = user.role.toUpperCase().replace(/\s+/g, "_");
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
    if (item.path.startsWith("/admin/masters")) return hasPermission(user, "masters.view");
    if (item.path.startsWith("/settings")) return hasPermission(user, "settings.view");
    if (item.path.startsWith("/reports")) return hasPermission(user, "reports.view");
    
    // --- Manpower Operations Navigation Filtering ---
    if (item.path === "/manpower") {
      return hasPermission(user, "manpower.admin.full_access") || 
             hasPermission(user, "manpower.security.view") || 
             hasPermission(user, "manpower.fm.view");
    }
    if (item.path.startsWith("/manpower/security-guarding")) {
      return hasPermission(user, "manpower.admin.full_access") || hasPermission(user, "manpower.security.view");
    }
    if (item.path.startsWith("/manpower/facility-management")) {
      return hasPermission(user, "manpower.admin.full_access") || hasPermission(user, "manpower.fm.view");
    }
    
    return true;
  });
}

export function isEmployeeActive(employee: any): boolean {
  if (!employee) return false;
  if (employee.employmentStatus) {
    return employee.employmentStatus === "ACTIVE";
  }
  return employee.isActive !== false;
}

export function getEmploymentStatusLabel(employee: any): "Active" | "Deactivated" {
  return isEmployeeActive(employee) ? "Active" : "Deactivated";
}

export function getDutyStatusLabel(employee: any): string {
  if (!employee) return "OFF_DUTY";
  return employee.dutyStatus || "OFF_DUTY";
}

export function canAssignShift(employee: any): boolean {
  return isEmployeeActive(employee);
}
