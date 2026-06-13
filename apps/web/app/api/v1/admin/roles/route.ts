import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";

// Default permission definition list to seed
const DEFAULT_PERMISSIONS = [
  { key: "dashboard.view", label: "View Executive Dashboard", module: "Dashboard" },
  { key: "employees.view", label: "View Workforce Directory", module: "Employees" },
  { key: "employees.create", label: "Create Employees", module: "Employees" },
  { key: "employees.edit", label: "Edit Employee Records", module: "Employees" },
  { key: "employees.delete", label: "Delete/Deactivate Employees", module: "Employees" },
  { key: "employees.bulkUpload", label: "Bulk Upload Employees", module: "Employees" },
  { key: "attendance.view", label: "View Attendance Monitor", module: "Attendance" },
  { key: "attendance.edit", label: "Edit Attendance Records", module: "Attendance" },
  { key: "attendance.approveCorrection", label: "Approve Attendance Corrections", module: "Attendance" },
  { key: "leaves.view", label: "View Leave Manager", module: "Leaves" },
  { key: "leaves.approve", label: "Approve Leave Requests", module: "Leaves" },
  { key: "shifts.view", label: "View Shift Rosters", module: "Scheduling" },
  { key: "shifts.edit", label: "Edit Shift Calendars", module: "Scheduling" },
  { key: "overtime.view", label: "View Overtime Claims", module: "Overtime" },
  { key: "overtime.approve", label: "Approve Overtime Payments", module: "Overtime" },
  { key: "reports.view", label: "View Analytics Hub", module: "Reports" },
  { key: "reports.export", label: "Export Secure CSV/JSON Data", module: "Reports" },
  { key: "sap.view", label: "View SuccessFactors Sync Dashboard", module: "SAP Integration" },
  { key: "sap.sync", label: "Trigger Manual Inbound Sync", module: "SAP Integration" },
  { key: "sap.mapping", label: "Configure SAP Field Translation Mappings", module: "SAP Integration" },
  { key: "backup.view", label: "View System Backups", module: "Backups" },
  { key: "backup.create", label: "Run Data Archive Backups", module: "Backups" },
  { key: "backup.download", label: "Download Encrypted Backups", module: "Backups" },
  { key: "backup.delete", label: "Purge Archive Backups", module: "Backups" },
  { key: "settings.view", label: "View Settings Command", module: "Settings" },
  { key: "settings.roles.manage", label: "Manage Roles & System Permissions Matrix", module: "Settings" }
];

const DEFAULT_SYSTEM_ROLES = [
  { name: "SUPER_ADMIN", description: "All permissions granted including database backups and integrations configuration.", isSystemDefault: true, isActive: true },
  { name: "ADMIN", description: "Full operation administration controls.", isSystemDefault: true, isActive: true },
  { name: "HR_MANAGER", description: "Workforce directory and leave processing controls.", isSystemDefault: true, isActive: true },
  { name: "FINANCE_MANAGER", description: "Overtime validation and payroll staging calculations.", isSystemDefault: true, isActive: true },
  { name: "SUPERVISOR", description: "Team schedule tracking and attendance corrections approvals.", isSystemDefault: true, isActive: true },
  { name: "EMPLOYEE", description: "Employee self service clocks and requests.", isSystemDefault: true, isActive: true },
  { name: "SAP_ADMIN", description: "SAP inbound synchronization and field schema overrides controls.", isSystemDefault: true, isActive: true },
  { name: "REPORT_VIEWER", description: "Read only access to reporting and analytics hub dashboards.", isSystemDefault: true, isActive: true }
];

async function seedPermissionsIfEmpty() {
  const perm = await mockDb.getSystemPermissions();
  if (perm.length === 0) {
    for (const def of DEFAULT_PERMISSIONS) {
      await mockDb.createSystemPermission(def);
    }
  }

  const roles = await mockDb.getSystemRoles();
  if (roles.length === 0) {
    for (const roleDef of DEFAULT_SYSTEM_ROLES) {
      const createdRole = await mockDb.createSystemRole(roleDef);
      
      // Auto-assign permissions to default roles for seed compatibility
      const allPerms = await mockDb.getSystemPermissions();
      const rolePerms = allPerms.map(p => {
        let view = false;
        let create = false;
        let edit = false;
        let del = false;
        let approve = false;
        let exportFlag = false;

        if (roleDef.name === "SUPER_ADMIN") {
          view = create = edit = del = approve = exportFlag = true;
        } else if (roleDef.name === "ADMIN") {
          view = create = edit = approve = exportFlag = true;
          if (!p.key.startsWith("settings") && !p.key.startsWith("backup")) {
            del = true;
          }
        } else if (roleDef.name === "HR_MANAGER") {
          if (p.key.startsWith("employees") || p.key.startsWith("leaves") || p.key.startsWith("attendance") || p.key.startsWith("reports")) {
            view = create = edit = approve = exportFlag = true;
          }
        } else if (roleDef.name === "FINANCE_MANAGER") {
          if (p.key.startsWith("overtime") || p.key.startsWith("reports") || p.key.startsWith("sap")) {
            view = create = edit = approve = exportFlag = true;
          }
        } else if (roleDef.name === "SUPERVISOR") {
          if (p.key.startsWith("attendance") || p.key.startsWith("shifts") || p.key.startsWith("leaves") || p.key.startsWith("overtime")) {
            view = true;
            if (p.key === "attendance.approveCorrection" || p.key === "leaves.approve") {
              approve = true;
            }
          }
        } else if (roleDef.name === "EMPLOYEE") {
          if (p.key === "dashboard.view" || p.key === "employees.view" || p.key === "attendance.view" || p.key === "leaves.view" || p.key === "shifts.view") {
            view = true;
          }
        } else if (roleDef.name === "SAP_ADMIN") {
          if (p.key.startsWith("sap")) {
            view = create = edit = approve = exportFlag = true;
          }
        } else if (roleDef.name === "REPORT_VIEWER") {
          if (p.key.startsWith("reports") || p.key.startsWith("dashboard")) {
            view = true;
          }
        }

        return {
          permissionId: p.id,
          canView: view,
          canCreate: create,
          canEdit: edit,
          canDelete: del,
          canApprove: approve,
          canExport: exportFlag
        };
      });
      await mockDb.saveRolePermissions(createdRole.id, rolePerms);
    }
  }
}

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    await seedPermissionsIfEmpty();

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
    return NextResponse.json({ error: e.message || "Failed to fetch settings permissions mapping" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  const session = auth.session;
  const userId = (session?.user as any)?.id || "admin-system";

  try {
    const body = await request.json();
    const { name, description, isActive } = body;
    if (!name) {
      return NextResponse.json({ error: "Missing name parameter" }, { status: 400 });
    }

    const created = await mockDb.createSystemRole({
      name: name.toUpperCase().replace(/\s+/g, "_"),
      description: description || "",
      isSystemDefault: false,
      isActive: isActive !== undefined ? isActive : true
    });

    // Create default empty permissions for this new role
    const allPerms = await mockDb.getSystemPermissions();
    const defaultPerms = allPerms.map(p => ({
      permissionId: p.id,
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canApprove: false,
      canExport: false
    }));
    await mockDb.saveRolePermissions(created.id, defaultPerms);

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

  const session = auth.session;
  const userId = (session?.user as any)?.id || "admin-system";

  try {
    const body = await request.json();
    const { roleId, permissions, assignments, systemRoleData } = body;

    if (!roleId) {
      return NextResponse.json({ error: "Missing roleId parameter" }, { status: 400 });
    }

    // 1. Update basic role metadata if present
    if (systemRoleData) {
      const existing = await mockDb.getSystemRoles();
      const role = existing.find(r => r.id === roleId);
      if (role && !role.isSystemDefault) {
        await mockDb.updateSystemRole(roleId, {
          description: systemRoleData.description,
          isActive: systemRoleData.isActive
        });
      }
    }

    // 2. Save matrix permissions mappings
    if (permissions && Array.isArray(permissions)) {
      await mockDb.saveRolePermissions(roleId, permissions);
    }

    // 3. Save user assignments
    if (assignments && Array.isArray(assignments)) {
      for (const empId of assignments) {
        await mockDb.createUserRoleAssignment({
          employeeId: empId,
          roleId,
          assignedById: userId,
          isActive: true
        });
      }
    }

    await mockDb.createUserActivityLog({
      userId,
      action: "ROLE_PERMISSIONS_UPDATED",
      entityType: "SYSTEM_ROLE",
      entityId: roleId,
      afterJson: JSON.stringify({ message: `Updated permissions and assignments mapping for role ID ${roleId}` }),
      ipAddress: "127.0.0.1",
      userAgent: "Server Internal Trigger"
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Failed to update system roles configuration" }, { status: 500 });
  }
}
