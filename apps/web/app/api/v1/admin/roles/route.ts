import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

// Default permission definition list to seed
const DEFAULT_PERMISSIONS = [
  // Executive Dashboard
  { key: "dashboard.view", label: "View Executive Dashboard", module: "Dashboard" },

  // Employees / Workforce
  { key: "employees.view", label: "View Workforce Directory", module: "Employees" },
  { key: "employees.create", label: "Create Employees", module: "Employees" },
  { key: "employees.edit", label: "Edit Employee Records", module: "Employees" },
  { key: "employees.delete", label: "Delete/Deactivate Employees", module: "Employees" },
  { key: "employees.bulkUpload", label: "Bulk Upload Employees", module: "Employees" },

  // Attendance
  { key: "attendance.view", label: "View Attendance Monitor", module: "Attendance" },
  { key: "attendance.edit", label: "Edit Attendance Records", module: "Attendance" },
  { key: "attendance.approveCorrection", label: "Approve Attendance Corrections", module: "Attendance" },

  // Leaves
  { key: "leaves.view", label: "View Leave Manager", module: "Leaves" },
  { key: "leaves.approve", label: "Approve Leave Requests", module: "Leaves" },

  // Shift Scheduling
  { key: "shifts.view", label: "View Shift Rosters", module: "Scheduling" },
  { key: "shifts.edit", label: "Edit Shift Calendars", module: "Scheduling" },

  // Overtime
  { key: "overtime.view", label: "View Overtime Claims", module: "Overtime" },
  { key: "overtime.approve", label: "Approve Overtime Payments", module: "Overtime" },

  // Reports
  { key: "reports.view", label: "View Analytics Hub", module: "Reports" },
  { key: "reports.export", label: "Export Secure CSV/JSON Data", module: "Reports" },

  // SAP Integration
  { key: "sap.view", label: "View SuccessFactors Sync Dashboard", module: "SAP Integration" },
  { key: "sap.sync", label: "Trigger Manual Inbound Sync", module: "SAP Integration" },
  { key: "sap.mapping", label: "Configure SAP Field Translation Mappings", module: "SAP Integration" },

  // Backups
  { key: "backup.view", label: "View System Backups", module: "Backups" },
  { key: "backup.create", label: "Run Data Archive Backups", module: "Backups" },
  { key: "backup.download", label: "Download Encrypted Backups", module: "Backups" },
  { key: "backup.delete", label: "Purge Archive Backups", module: "Backups" },

  // Settings & Access Control
  { key: "settings.view", label: "View Settings Command", module: "Settings" },
  { key: "settings.manage", label: "Manage Settings Configuration", module: "Settings" },
  { key: "settings.roles.manage", label: "Manage Roles & System Permissions Matrix", module: "Settings" },
  { key: "users.view", label: "View Users Directory", module: "Users" },
  { key: "users.manage", label: "Manage Users Configuration", module: "Users" },
  { key: "roles.view", label: "View Access Roles List", module: "Roles" },
  { key: "roles.manage", label: "Manage Custom Access Roles", module: "Roles" },
  { key: "audit.view", label: "View Access/Audit Logs", module: "Audit" },
  { key: "audit.export", label: "Export Audit Logs Data", module: "Audit" },
  { key: "system.config.view", label: "View System Configuration Parameters", module: "System Config" },
  { key: "system.config.manage", label: "Modify System Configuration Parameters", module: "System Config" },
  { key: "masterdata.view", label: "View Master Data References", module: "Master Data" },
  { key: "masterdata.manage", label: "Modify Master Data References", module: "Master Data" },
  { key: "integration.view", label: "View Integration Gateways", module: "Integration" },
  { key: "integration.manage", label: "Configure Integration Gateways", module: "Integration" },

  // Manpower General
  { key: "manpower.view", label: "Access Manpower Module", module: "Manpower General" },
  { key: "manpower.manage", label: "Manage Manpower Master Records", module: "Manpower General" },
  { key: "manpower.admin.full_access", label: "Full Administrator Access to Manpower Console", module: "Manpower General" },

  // Security Guarding Specific
  { key: "manpower.security.view", label: "Access Security Guarding Dashboard", module: "Security Guarding" },
  { key: "manpower.security.manage", label: "Manage Security Master Records", module: "Security Guarding" },
  { key: "manpower.security.clients.view", label: "View Security Clients", module: "Security Guarding" },
  { key: "manpower.security.clients.manage", label: "Manage Security Clients", module: "Security Guarding" },
  { key: "manpower.security.contracts.view", label: "View Security Contracts", module: "Security Guarding" },
  { key: "manpower.security.contracts.manage", label: "Manage Security Contracts", module: "Security Guarding" },
  { key: "manpower.security.projects.view", label: "View Security Projects", module: "Security Guarding" },
  { key: "manpower.security.projects.manage", label: "Manage Security Projects", module: "Security Guarding" },
  { key: "manpower.security.sites.view", label: "View Security Sites", module: "Security Guarding" },
  { key: "manpower.security.sites.manage", label: "Manage Security Sites", module: "Security Guarding" },
  { key: "manpower.security.zones.view", label: "View Security Zones / Gates / Posts", module: "Security Guarding" },
  { key: "manpower.security.zones.manage", label: "Manage Security Zones / Gates / Posts", module: "Security Guarding" },
  { key: "manpower.security.manpower.view", label: "View Security Rosters / Workforce", module: "Security Guarding" },
  { key: "manpower.security.manpower.manage", label: "Manage Security Rosters / Workforce", module: "Security Guarding" },
  { key: "manpower.security.shifts.view", label: "View Security Shift Requirements", module: "Security Guarding" },
  { key: "manpower.security.shifts.manage", label: "Manage Security Shift Requirements", module: "Security Guarding" },
  { key: "manpower.security.deployments.view", label: "View Daily Security Planner Grid", module: "Security Guarding" },
  { key: "manpower.security.deployments.manage", label: "Assign/Unassign Security Roster Slots", module: "Security Guarding" },
  { key: "manpower.security.relievers.view", label: "View Security Reliever Standby Lists", module: "Security Guarding" },
  { key: "manpower.security.relievers.manage", label: "Assign Security Relievers/Substitutes", module: "Security Guarding" },
  { key: "manpower.security.reports.view", label: "View Security Operational Reports", module: "Security Guarding" },
  { key: "manpower.security.reports.export", label: "Export Security Reports Data", module: "Security Guarding" },

  // Facility Management Specific
  { key: "manpower.fm.view", label: "Access Facility Management Dashboard", module: "Facility Management" },
  { key: "manpower.fm.manage", label: "Manage FM Master Records", module: "Facility Management" },
  { key: "manpower.fm.clients.view", label: "View FM Clients", module: "Facility Management" },
  { key: "manpower.fm.clients.manage", label: "Manage FM Clients", module: "Facility Management" },
  { key: "manpower.fm.contracts.view", label: "View FM Contracts", module: "Facility Management" },
  { key: "manpower.fm.contracts.manage", label: "Manage FM Contracts", module: "Facility Management" },
  { key: "manpower.fm.projects.view", label: "View FM Projects", module: "Facility Management" },
  { key: "manpower.fm.projects.manage", label: "Manage FM Projects", module: "Facility Management" },
  { key: "manpower.fm.sites.view", label: "View FM Sites", module: "Facility Management" },
  { key: "manpower.fm.sites.manage", label: "Manage FM Sites", module: "Facility Management" },
  { key: "manpower.fm.areas.view", label: "View FM Areas / Floors / Blocks", module: "Facility Management" },
  { key: "manpower.fm.areas.manage", label: "Manage FM Areas / Floors / Blocks", module: "Facility Management" },
  { key: "manpower.fm.manpower.view", label: "View FM Rosters / Workforce", module: "Facility Management" },
  { key: "manpower.fm.manpower.manage", label: "Manage FM Rosters / Workforce", module: "Facility Management" },
  { key: "manpower.fm.shifts.view", label: "View FM Shift Requirements", module: "Facility Management" },
  { key: "manpower.fm.shifts.manage", label: "Manage FM Shift Requirements", module: "Facility Management" },
  { key: "manpower.fm.deployments.view", label: "View Daily FM Planner Grid", module: "Facility Management" },
  { key: "manpower.fm.deployments.manage", label: "Assign/Unassign FM Roster Slots", module: "Facility Management" },
  { key: "manpower.fm.relievers.view", label: "View FM Reliever Standby Lists", module: "Facility Management" },
  { key: "manpower.fm.relievers.manage", label: "Assign FM Relievers/Substitutes", module: "Facility Management" },
  { key: "manpower.fm.reports.view", label: "View FM Operational Reports", module: "Facility Management" },
  { key: "manpower.fm.reports.export", label: "Export FM Reports Data", module: "Facility Management" },

  // Employee Self-Service specific permissions
  { key: "self.profile.view", label: "View Own Profile", module: "Self Service" },
  { key: "self.attendance.view", label: "View Own Attendance Records", module: "Self Service" },
  { key: "self.attendance.punch", label: "Clock In and Out", module: "Self Service" },
  { key: "self.leave.view", label: "View Own Leave Requests", module: "Self Service" },
  { key: "self.leave.apply", label: "Submit Leave Applications", module: "Self Service" },
  { key: "self.announcements.view", label: "View Company Announcements", module: "Self Service" },
  { key: "self.password.change", label: "Change Own Password", module: "Self Service" }
];

const DEFAULT_SYSTEM_ROLES = [
  // IT / System Administration Roles
  { name: "SUPER_ADMIN", description: "All permissions granted including database backups and integrations configuration.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "IT / System Administration" },
  { name: "ADMIN", description: "Full operation administration controls.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "IT / System Administration" },
  { name: "SYSTEM_ADMIN", description: "System configuration, users, roles, and settings manager.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "IT / System Administration" },
  { name: "IT_ADMIN", description: "IT administrator for systems, backups, and audits.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "IT / System Administration" },
  { name: "APPLICATION_ADMIN", description: "Admin for workforce users, roles, and master data.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "IT / System Administration" },
  { name: "SETTINGS_ADMIN", description: "Manage settings parameters and custom security roles.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "IT / System Administration" },
  { name: "AUDIT_VIEWER", description: "Read only access to settings and system audit logs.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "IT / System Administration" },
  { name: "SAP_ADMIN", description: "SAP inbound synchronization and field schema overrides controls.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "IT / System Administration" },

  // Employee Self-Service Roles
  { name: "EMPLOYEE_SELF_SERVICE", description: "Self service access only (own profile, leave, and attendance).", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "Employee Self-Service" },
  { name: "EMPLOYEE", description: "Employee self service clocks and requests.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "Employee Self-Service" },

  // White Collar Operations Roles
  { name: "HR_MANAGER", description: "Workforce directory and leave processing controls.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "White Collar Operations" },
  { name: "HR_EXECUTIVE", description: "Staff view and requests processing support.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "White Collar Operations" },
  { name: "DEPARTMENT_MANAGER", description: "Standard viewer for departments status.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "White Collar Operations" },
  { name: "SUPERVISOR", description: "Team schedule tracking and attendance corrections approvals.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "White Collar Operations" },

  // Security Guarding Specific Roles
  { name: "SECURITY_ADMIN", description: "Full administration control over Security Guarding operations.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Security Guarding", roleType: "Security Guarding Operations" },
  { name: "SECURITY_OPERATIONS_MANAGER", description: "Manager for rosters, shift schedules, and sites allocations.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Security Guarding", roleType: "Security Guarding Operations" },
  { name: "SECURITY_PROJECT_MANAGER", description: "Manage projects, sites, and deploy guards.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Security Guarding", roleType: "Security Guarding Operations" },
  { name: "SECURITY_SUPERVISOR", description: "Site supervisor to track guard attendance.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Security Guarding", roleType: "Security Guarding Operations" },

  // Facility Management Specific Roles
  { name: "FM_ADMIN", description: "Full administration control over Facility Management operations.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Facility Management", roleType: "Facility Management Operations" },
  { name: "FM_OPERATIONS_MANAGER", description: "Manager for cleanings rosters and areas requirements.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Facility Management", roleType: "Facility Management Operations" },
  { name: "FM_PROJECT_MANAGER", description: "Manage FM projects, sites, and deploy cleaners.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Facility Management", roleType: "Facility Management Operations" },
  { name: "FM_SUPERVISOR", description: "FM supervisor to track cleaning attendance.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Facility Management", roleType: "Facility Management Operations" },

  // Finance / Reports Roles
  { name: "FINANCE_VIEWER", description: "Read only access to SuccessFactors mappings and overtime reports.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "Finance / Reports" },
  { name: "SECURITY_HR_PAYROLL_VIEWER", description: "HR viewer for guards profiles and shift reports.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Security Guarding", roleType: "Finance / Reports" },
  { name: "SECURITY_FINANCE_VIEWER", description: "Finance viewer for guards overtime calculations.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Security Guarding", roleType: "Finance / Reports" },
  { name: "FM_HR_PAYROLL_VIEWER", description: "HR viewer for FM staff profiles and shift reports.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Facility Management", roleType: "Finance / Reports" },
  { name: "FM_FINANCE_VIEWER", description: "Finance viewer for FM overtime calculations.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Facility Management", roleType: "Finance / Reports" },
  { name: "REPORT_VIEWER", description: "Read only access to reporting and analytics hub dashboards.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Global", roleType: "Finance / Reports" },

  // Read Only Roles
  { name: "SECURITY_READ_ONLY", description: "Read only viewer for security guard planning calendars.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Security Guarding", roleType: "Read Only" },
  { name: "FM_READ_ONLY", description: "Read only viewer for FM planning calendars.", isSystemDefault: true, isActive: true, isEditable: false, scope: "Facility Management", roleType: "Read Only" }
];

async function seedPermissionsIfEmpty() {
  const perm = await mockDb.getSystemPermissions();
  if (perm.length === 0) {
    for (const def of DEFAULT_PERMISSIONS) {
      await mockDb.createSystemPermission(def);
    }
  } else {
    // Sync new permissions
    for (const def of DEFAULT_PERMISSIONS) {
      if (!perm.some(p => p.key === def.key)) {
        await mockDb.createSystemPermission(def);
      }
    }
  }

  const roles = await mockDb.getSystemRoles();
  if (roles.length === 0) {
    for (const roleDef of DEFAULT_SYSTEM_ROLES) {
      const createdRole = await mockDb.createSystemRole(roleDef);
      
      const allPerms = await mockDb.getSystemPermissions();
      const roleNameNormalized = roleDef.name.toUpperCase().replace(/\s+/g, "_");
      const defaultRolePermKeys = DEFAULT_ROLE_PERMISSIONS[roleNameNormalized] || [];

      const rolePerms = allPerms.map(p => {
        const isGranted = defaultRolePermKeys.includes(p.key);
        return {
          permissionId: p.id,
          canView: isGranted,
          canCreate: isGranted,
          canEdit: isGranted,
          canDelete: isGranted,
          canApprove: isGranted,
          canExport: isGranted
        };
      });
      await mockDb.saveRolePermissions(createdRole.id, rolePerms);
    }
  } else {
    // Sync new default system roles
    for (const roleDef of DEFAULT_SYSTEM_ROLES) {
      if (!roles.some(r => r.name === roleDef.name)) {
        const createdRole = await mockDb.createSystemRole(roleDef);
        const allPerms = await mockDb.getSystemPermissions();
        const roleNameNormalized = roleDef.name.toUpperCase().replace(/\s+/g, "_");
        const defaultRolePermKeys = DEFAULT_ROLE_PERMISSIONS[roleNameNormalized] || [];

        const rolePerms = allPerms.map(p => {
          const isGranted = defaultRolePermKeys.includes(p.key);
          return {
            permissionId: p.id,
            canView: isGranted,
            canCreate: isGranted,
            canEdit: isGranted,
            canDelete: isGranted,
            canApprove: isGranted,
            canExport: isGranted
          };
        });
        await mockDb.saveRolePermissions(createdRole.id, rolePerms);
      }
    }
  }
}

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    try {
      await seedPermissionsIfEmpty();
    } catch (dbErr) {
      console.warn("Prisma sync / seed warning, falling back to mock JSON seeding", dbErr);
    }

    const roles = await mockDb.getSystemRoles();
    const permissions = await mockDb.getSystemPermissions();
    const rolePermissions = await mockDb.getRolePermissions();
    const assignments = await mockDb.getUserRoleAssignments();

    return NextResponse.json({
      roles,
      permissions,
      rolePermissions,
      assignments
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch roles settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  const userId = auth.session?.user?.id || "admin-system";

  try {
    const body = await request.json();
    const { name, description, scope, isActive, cloneFromRoleId } = body;
    if (!name) {
      return NextResponse.json({ error: "Missing name parameter" }, { status: 400 });
    }

    const rolesList = await mockDb.getSystemRoles();
    const normalizedName = name.trim().toUpperCase().replace(/\s+/g, "_");

    if (rolesList.some(r => r.name === normalizedName)) {
      return NextResponse.json({ error: "Role name already exists" }, { status: 400 });
    }

    const created = await mockDb.createSystemRole({
      name: normalizedName,
      description: description || "",
      isSystemDefault: false,
      isActive: isActive !== undefined ? isActive : true,
      isEditable: true,
      scope: scope || "Global"
    });

    const allPerms = await mockDb.getSystemPermissions();
    let initialPerms = allPerms.map(p => ({
      permissionId: p.id,
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canApprove: false,
      canExport: false
    }));

    if (cloneFromRoleId) {
      const allRolePerms = await mockDb.getRolePermissions();
      const sourcePerms = allRolePerms.filter(rp => rp.roleId === cloneFromRoleId);
      initialPerms = allPerms.map(p => {
        const matched = sourcePerms.find(sp => sp.permissionId === p.id);
        return {
          permissionId: p.id,
          canView: !!matched?.canView,
          canCreate: !!matched?.canCreate,
          canEdit: !!matched?.canEdit,
          canDelete: !!matched?.canDelete,
          canApprove: !!matched?.canApprove,
          canExport: !!matched?.canExport
        };
      });
    }

    await mockDb.saveRolePermissions(created.id, initialPerms);

    await mockDb.createUserActivityLog({
      userId,
      action: "ROLE_CREATED",
      entityType: "SYSTEM_ROLE",
      entityId: created.id,
      afterJson: JSON.stringify({ message: `Created new custom role ${created.name}` }),
      ipAddress: "127.0.0.1",
      userAgent: "Server Internal Trigger"
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create custom role" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  const userId = auth.session?.user?.id || "admin-system";

  try {
    const body = await request.json();
    const { roleId, permissions, systemRoleData } = body;

    if (!roleId) {
      return NextResponse.json({ error: "Missing roleId parameter" }, { status: 400 });
    }

    const existing = await mockDb.getSystemRoles();
    const role = existing.find(r => r.id === roleId);
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (systemRoleData) {
      if (role.isSystemDefault || role.isEditable === false) {
        if (systemRoleData.isActive === false) {
          return NextResponse.json({ error: "Default system roles cannot be deactivated" }, { status: 400 });
        }
      } else {
        await mockDb.updateSystemRole(roleId, {
          description: systemRoleData.description,
          isActive: systemRoleData.isActive !== undefined ? systemRoleData.isActive : role.isActive,
          scope: systemRoleData.scope || role.scope
        });
      }
    }

    if (permissions && Array.isArray(permissions)) {
      if (role.isSystemDefault || role.isEditable === false) {
        return NextResponse.json({ error: "Default system roles are protected and cannot be directly modified. Please clone and customize instead." }, { status: 400 });
      }
      await mockDb.saveRolePermissions(roleId, permissions);
    }

    await mockDb.createUserActivityLog({
      userId,
      action: "ROLE_PERMISSIONS_UPDATED",
      entityType: "SYSTEM_ROLE",
      entityId: roleId,
      afterJson: JSON.stringify({ message: `Updated details and permissions mapping for role ID ${roleId}` }),
      ipAddress: "127.0.0.1",
      userAgent: "Server Internal Trigger"
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Failed to update system roles configuration" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get("roleId");

    if (!roleId) {
      return NextResponse.json({ error: "roleId is required" }, { status: 400 });
    }

    const existing = await mockDb.getSystemRoles();
    const role = existing.find(r => r.id === roleId);

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (role.isSystemDefault || role.isEditable === false) {
      return NextResponse.json({ error: "Default system roles cannot be deleted." }, { status: 400 });
    }

    const isDbConnected = () => (global as any).prismaClient !== undefined;
    const prisma = (global as any).prismaClient;

    if (isDbConnected()) {
      await prisma.userRoleAssignment.deleteMany({ where: { roleId } });
      await prisma.rolePermission.deleteMany({ where: { roleId } });
      await prisma.systemRole.delete({ where: { id: roleId } });
    } else {
      const fs = require("fs");
      const path = require("path");
      const dbPath = path.resolve(process.cwd(), "packages/mock-data/db.json");
      const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      
      db.systemRoles = (db.systemRoles || []).filter((r: any) => r.id !== roleId);
      db.rolePermissions = (db.rolePermissions || []).filter((rp: any) => rp.roleId !== roleId);
      db.userRoleAssignments = (db.userRoleAssignments || []).filter((a: any) => a.roleId !== roleId);
      
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete role" }, { status: 500 });
  }
}
