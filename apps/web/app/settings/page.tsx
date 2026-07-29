"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Card, Button, Input, Modal, Badge } from "@ahh-wfm/ui/src";
import { useSession } from "next-auth/react";
import { Employee } from "@ahh-wfm/types";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { WorkflowManagementTab } from "./components/WorkflowManagementTab";
import { WorkflowDelegationsTab } from "./components/WorkflowDelegationsTab";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import Link from "next/link";

interface SystemRole {
  id: string;
  name: string;
  description: string;
  isSystemDefault: boolean;
  isActive: boolean;
  isEditable?: boolean;
  scope?: string;
  roleType?: string;
}

interface SystemPermission {
  id: string;
  key: string;
  label: string;
  module: string;
}

interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
}

interface UserRoleAssignment {
  id: string;
  employeeId: string;
  roleId: string;
  isActive: boolean;
}

interface Company {
  id: string;
  companyCode: string;
  companyName: string;
  isActive: boolean;
}

const ACCORDION_GROUPS = [
  {
    title: "Main Modules",
    icon: "home",
    modules: [
      { label: "Dashboard / Overview", capabilities: { view: "dashboard.view" } },
      { label: "Workforce Directory", capabilities: { view: "employees.view", create: "employees.create", edit: "employees.edit", delete: "employees.delete", manage: "employees.manage" } },
      { label: "Attendance Monitor", capabilities: { view: "attendance.view", edit: "attendance.edit", manage: "attendance.approveCorrection", export: "attendance.export" } },
      { label: "Leave Management", capabilities: { view: "leaves.view", create: "leaves.create", edit: "leaves.edit", approve: "leaves.approve", manage: "leaves.manage" } },
      { label: "Shift Master", capabilities: { view: "shifts.view", create: "shifts.create", edit: "shifts.edit", delete: "shifts.delete", manage: "shifts.manage" } },
      { label: "Clearance Management", capabilities: { view: "clearance.view", create: "clearance.create", edit: "clearance.edit", approve: "clearance.approve", manage: "clearance.manage" } },
      { label: "Security Guarding", capabilities: { view: "manpower.security.view", manage: "manpower.security.manage" } },
      { label: "Facility Management", capabilities: { view: "manpower.fm.view", manage: "manpower.fm.manage" } },
      { label: "Reports Hub", capabilities: { view: "reports.view", export: "reports.export", manage: "reports.manage" } },
      { label: "Master Data Hub", capabilities: { view: "masterdata.view", manage: "masterdata.manage" } },
      { label: "Settings", capabilities: { view: "settings.view", manage: "settings.manage" } }
    ]
  },
  {
    title: "Workforce",
    icon: "group",
    modules: [
      { label: "Employees Directory", capabilities: { view: "employees.view", create: "employees.create", edit: "employees.edit", delete: "employees.delete", manage: "employees.manage" } },
      { label: "Bulk Upload Contracts", capabilities: { view: "employees.bulkUpload", manage: "employees.manage" } }
    ]
  },
  {
    title: "Attendance",
    icon: "fact_check",
    modules: [
      { label: "Attendance Records", capabilities: { view: "attendance.view", edit: "attendance.edit", manage: "attendance.approveCorrection", export: "attendance.export" } },
      { label: "Attendance Geofence Rules", capabilities: { view: "system.config.view", edit: "system.config.manage" } }
    ]
  },
  {
    title: "Leave Management",
    icon: "event_busy",
    modules: [
      { label: "Leaves Processing", capabilities: { view: "leaves.view", create: "leaves.create", edit: "leaves.edit", approve: "leaves.approve", manage: "leaves.manage" } }
    ]
  },
  {
    title: "Shift Scheduling",
    icon: "schedule",
    modules: [
      { label: "Shift Roster Planners", capabilities: { view: "shifts.view", create: "shifts.create", edit: "shifts.edit", delete: "shifts.delete", manage: "shifts.manage" } }
    ]
  },
  {
    title: "Clearance",
    icon: "task",
    modules: [
      { label: "Clearance Workflows", capabilities: { view: "clearance.view", create: "clearance.create", edit: "clearance.edit", approve: "clearance.approve", manage: "clearance.manage" } }
    ]
  },
  {
    title: "Security Guarding",
    icon: "security",
    modules: [
      { label: "Security Dashboard", capabilities: { view: "manpower.security.view", manage: "manpower.security.manage" } },
      { label: "Contracts / Projects", capabilities: { view: "manpower.security.contracts.view", edit: "manpower.security.contracts.manage", manage: "manpower.security.projects.manage" } },
      { label: "Manpower Directory", capabilities: { view: "manpower.security.manpower.view", edit: "manpower.security.manpower.manage", manage: "manpower.security.manpower.manage" } },
      { label: "Deployment Planner", capabilities: { view: "manpower.security.deployments.view", edit: "manpower.security.deployments.manage", manage: "manpower.security.deployments.manage" } },
      { label: "Coordinator Workspace", capabilities: { view: "security.coordinators.view", edit: "security.coordinators.manage", manage: "security.coordinators.manage" } },
      { label: "Patrol Operations Board", capabilities: { view: "security.patrols.view", manage: "security.patrols.manage" } },
      { label: "Incidents", capabilities: { view: "security.patrols.view", manage: "security.patrols.manage" } },
      { label: "Replacement / Reliever", capabilities: { view: "manpower.security.relievers.view", manage: "manpower.security.relievers.manage" } },
      { label: "Client Notes", capabilities: { view: "manpower.security.clients.view", manage: "manpower.security.clients.manage" } },
      { label: "Daily Patrol Reports", capabilities: { view: "reports.patrol.view", manage: "reports.manage" } }
    ]
  },
  {
    title: "Facility Management",
    icon: "business",
    modules: [
      { label: "FM Dashboard", capabilities: { view: "manpower.fm.view", manage: "manpower.fm.manage" } },
      { label: "Contracts / Projects", capabilities: { view: "manpower.fm.contracts.view", edit: "manpower.fm.contracts.manage", manage: "manpower.fm.projects.manage" } },
      { label: "Manpower Directory", capabilities: { view: "manpower.fm.manpower.view", edit: "manpower.fm.manpower.manage", manage: "manpower.fm.manpower.manage" } },
      { label: "Deployment Planner", capabilities: { view: "manpower.fm.deployments.view", edit: "manpower.fm.deployments.manage", manage: "manpower.fm.deployments.manage" } },
      { label: "Coordinator Workspace", capabilities: { view: "manpower.fm.view", manage: "manpower.fm.manage" } },
      { label: "Work Reports", capabilities: { view: "manpower.fm.reports.view", export: "manpower.fm.reports.export" } },
      { label: "Client Notes", capabilities: { view: "manpower.fm.clients.view", manage: "manpower.fm.clients.manage" } }
    ]
  },
  {
    title: "Reports",
    icon: "analytics",
    modules: [
      { label: "Executive Dashboard", capabilities: { view: "reports.executive.view" } },
      { label: "Attendance Report", capabilities: { view: "reports.attendance.view" } },
      { label: "Leave Report", capabilities: { view: "reports.leave.view" } },
      { label: "Overtime Report", capabilities: { view: "reports.overtime.view" } },
      { label: "Shift Roster Report", capabilities: { view: "reports.shiftRoster.view" } },
      { label: "SAP Sync Report", capabilities: { view: "reports.sapSync.view" } },
      { label: "Audit Report", capabilities: { view: "reports.audit.view" } },
      { label: "Backup / Restore Report", capabilities: { view: "reports.backup.view" } },
      { label: "Production Readiness Report", capabilities: { view: "reports.productionReadiness.view" } },
      { label: "Patrol Report", capabilities: { view: "reports.patrol.view" } },
      { label: "Security Operations Report", capabilities: { view: "reports.security.view" } },
      { label: "Facility Operations Report", capabilities: { view: "reports.facility.view" } }
    ]
  },
  {
    title: "Settings",
    icon: "settings",
    modules: [
      { label: "General Settings", capabilities: { view: "system.config.view", edit: "system.config.manage" } },
      { label: "Master Data", capabilities: { view: "masterdata.view", edit: "masterdata.manage" } },
      { label: "Workflow Setup", capabilities: { view: "settings.view", edit: "settings.manage" } },
      { label: "Pre-Contract Configuration", capabilities: { view: "precontract.config.view", edit: "precontract.config.manage" } },
      { label: "User Roles & Permissions", capabilities: { view: "roles.view", manage: "settings.roles.manage" } },
      { label: "Integration Hub", capabilities: { view: "settings.integration.view", manage: "settings.integration.manage" } },
      { label: "Backup & Restore", capabilities: { view: "settings.backup.view", manage: "settings.backup.manage" } },
      { label: "User Action Audits", capabilities: { view: "settings.audit.view" } },
      { label: "Production Readiness", capabilities: { view: "settings.productionReadiness.view" } }
    ]
  }
];

const REPORTS_LIST = [
  { key: "reports.executive.view", name: "Executive Dashboard", description: "Executive high-level summary & KPIs chart panels.", category: "Operations" },
  { key: "reports.attendance.view", name: "Attendance Report", description: "Workforce clock-ins, overrides, and deviations.", category: "Workforce" },
  { key: "reports.leave.view", name: "Leave Report", description: "Leave records, historical applications, and balances.", category: "Workforce" },
  { key: "reports.overtime.view", name: "Overtime Report", description: "Overtime claims, wage costs, and supervisor reviews.", category: "Finance" },
  { key: "reports.shiftRoster.view", name: "Shift Roster Report", description: "Assigned duties schedules, rotations, and variances.", category: "Operations" },
  { key: "reports.sapSync.view", name: "SAP Sync Report", description: "SuccessFactors manual syncing and inbound audits.", category: "System Admin" },
  { key: "reports.audit.view", name: "Audit Report", description: "System security logs and administrator modifications.", category: "System Admin" },
  { key: "reports.backup.view", name: "Backup/Restore Report", description: "System database backup operations and size logs.", category: "System Admin" },
  { key: "reports.productionReadiness.view", name: "Production Readiness Report", description: "Operations checklist and environment health scores.", category: "System Admin" },
  { key: "reports.security.view", name: "Security Guarding Reports", description: "Client site visits, relief, and guard attendance.", category: "Security" },
  { key: "reports.facility.view", name: "Facility Management Reports", description: "Cleaners rosters, area checks, and supervisor tasks.", category: "Facility" },
  { key: "reports.patrol.view", name: "Patrol Inspections Reports", description: "Patrolling checklist OK/Not OK metrics details.", category: "Security" },
  { key: "reports.deployment.view", name: "Daily Planner Reports", description: "Daily assignments planner status and variances.", category: "Operations" }
];

function SettingsContent() {
  const { data: session, update: updateSession } = useSession();
  const user = session?.user as any;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get("tab") || "general") as
    | "rolesPermissions"
    | "general"
    | "workflowManagement"
    | "workflowDelegations";

  // Enforce access control
  const hasAccess = session && (isAdminUser(user) || hasPermission(user, "settings.view"));
  const hasTabAccess = activeTab !== "rolesPermissions" || isAdminUser(user) || hasPermission(user, "settings.roles.manage");

  // General configurations
  const [latencyThreshold, setLatencyThreshold] = useState("200");
  const [offlineSyncInterval, setOfflineSyncInterval] = useState("60");
  const [geofencingRadius, setGeofencingRadius] = useState("100");

  const activeSection = searchParams.get("section") || "roles";

  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    if (tab === "rolesPermissions") {
      params.set("section", "roles");
    } else {
      params.delete("section");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const setSection = (sec: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", sec);
    router.replace(`${pathname}?${params.toString()}`);
    setSaveSuccess(null);
    setError(null);
  };

  // Loaded DB data
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [permissions, setPermissions] = useState<SystemPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workforceEmployees, setWorkforceEmployees] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showRefreshNotice, setShowRefreshNotice] = useState(false);

  // Search & Filter States
  const [rolesSearchQuery, setRolesSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [matrixSearchQuery, setMatrixSearchQuery] = useState("");
  const [previewUserId, setPreviewUserId] = useState("");

  // Accordion Expand States
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Main Modules": true
  });

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // User Access Modal
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [modalUsername, setModalUsername] = useState("");
  const [modalAuthMode, setModalAuthMode] = useState("LOCAL");
  const [modalIsActive, setModalIsActive] = useState(true);
  const [modalIsLoginEnabled, setModalIsLoginEnabled] = useState(true);
  const [modalSelfServiceEnabled, setModalSelfServiceEnabled] = useState(true);
  const [modalWebAccessEnabled, setModalWebAccessEnabled] = useState(true);
  const [modalMobileAccessEnabled, setModalMobileAccessEnabled] = useState(true);
  const [modalAssignedRoleIds, setModalAssignedRoleIds] = useState<string[]>([]);
  const [modalAllowedWhiteCollar, setModalAllowedWhiteCollar] = useState(true);
  const [modalAllowedSecurityGuarding, setModalAllowedSecurityGuarding] = useState(false);
  const [modalAllowedFacilityManagement, setModalAllowedFacilityManagement] = useState(false);
  const [modalDefaultLanding, setModalDefaultLanding] = useState("/dashboard");
  const [modalAllowedCompanyIds, setModalAllowedCompanyIds] = useState<string[]>([]);

  // Password reset states
  const [newPassword, setNewPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  // Role Management Tab states
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleScope, setNewRoleScope] = useState("General");
  const [newRoleType, setNewRoleType] = useState("White Collar Operations");
  const [cloneFromRoleId, setCloneFromRoleId] = useState("");
  const [createRoleError, setCreateRoleError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, accountsRes, companiesRes, employeesRes] = await Promise.all([
        fetch("/api/v1/admin/roles"),
        fetch("/api/v1/admin/user-accounts"),
        fetch("/api/v1/companies").catch(() => null),
        fetch("/api/v1/employees").catch(() => null)
      ]);

      if (!settingsRes.ok || !accountsRes.ok) {
        throw new Error("Failed to load settings data");
      }

      const settingsData = await settingsRes.json();
      const accountsData = await accountsRes.json();
      const companiesData = companiesRes && companiesRes.ok ? await companiesRes.json() : [];
      const workforceData = employeesRes && employeesRes.ok ? await employeesRes.json() : [];

      setRoles(settingsData.roles || []);
      setPermissions(settingsData.permissions || []);
      setRolePermissions(settingsData.rolePermissions || []);
      setAssignments(settingsData.assignments || []);
      setEmployees(accountsData || []);
      setWorkforceEmployees(workforceData || []);

      setCompanies(companiesData.length > 0 ? companiesData : [
        { id: "comp-1", companyCode: "AHH", companyName: "AHH Corporate Services", isActive: true },
        { id: "comp-2", companyCode: "SGC", companyName: "Security Guarding Services", isActive: true },
        { id: "comp-3", companyCode: "FMS", companyName: "Facility Management Services", isActive: true }
      ]);

      if (settingsData.roles && settingsData.roles.length > 0 && !selectedRoleId) {
        setSelectedRoleId(settingsData.roles[0].id);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchData();
    }
  }, [hasAccess]);

  const getRoleCategory = (r: SystemRole) => {
    if (r.roleType) return r.roleType;
    const name = r.name.toUpperCase();
    if (["SUPER_ADMIN", "SYSTEM_ADMIN", "IT_ADMIN", "APPLICATION_ADMIN", "SETTINGS_ADMIN", "AUDIT_VIEWER", "SAP_ADMIN"].includes(name)) {
      return "IT / System Administration";
    }
    if (["EMPLOYEE_SELF_SERVICE", "EMPLOYEE"].includes(name)) {
      return "Employee Self-Service";
    }
    if (["SECURITY_ADMIN", "SECURITY_OPERATIONS_MANAGER", "SECURITY_PROJECT_MANAGER", "SECURITY_SUPERVISOR", "SECURITY_HR_PAYROLL_VIEWER", "SECURITY_FINANCE_VIEWER", "SECURITY_READ_ONLY"].includes(name)) {
      return "Security Guarding Operations";
    }
    if (["FM_ADMIN", "FM_OPERATIONS_MANAGER", "FM_PROJECT_MANAGER", "FM_SUPERVISOR", "FM_HR_PAYROLL_VIEWER", "FM_FINANCE_VIEWER", "FM_READ_ONLY"].includes(name)) {
      return "Facility Management Operations";
    }
    if (["FINANCE_VIEWER", "FINANCE_MANAGER"].includes(name)) {
      return "Finance / Reports";
    }
    return "White Collar Operations";
  };

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  // Unified Save User Access Changes
  const handleSaveUserAccess = async () => {
    if (!selectedUser) return;
    setSaveSuccess(null);
    setError(null);

    // Safeguard: Do not allow disabling Super Admin login access
    if (selectedUser.role === "SUPER_ADMIN") {
      if (!modalIsLoginEnabled) {
        setError("Super Admin login access cannot be disabled.");
        return;
      }
      const saRole = roles.find(r => r.name === "SUPER_ADMIN");
      if (saRole && !modalAssignedRoleIds.includes(saRole.id)) {
        setError("Super Admin role cannot be unassigned from this account.");
        return;
      }
    }

    try {
      let primaryRole = selectedUser.role;
      if (modalAssignedRoleIds.length > 0) {
        const matchingRole = roles.find(r => r.id === modalAssignedRoleIds[0]);
        if (matchingRole) primaryRole = matchingRole.name;
      }

      const res = await fetch(`/api/v1/admin/user-accounts/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: modalUsername.trim() || null,
          authMode: modalAuthMode,
          isLoginEnabled: modalIsLoginEnabled,
          selfServiceEnabled: modalSelfServiceEnabled,
          webAccessEnabled: modalWebAccessEnabled,
          mobileAccessEnabled: modalMobileAccessEnabled,
          role: primaryRole,
          assignedRoleIds: modalAssignedRoleIds,
          operationAccess: {
            allowedWhiteCollar: modalAllowedWhiteCollar,
            allowedSecurityGuarding: modalAllowedSecurityGuarding,
            allowedFacilityManagement: modalAllowedFacilityManagement,
            defaultLanding: modalDefaultLanding,
            allowedCompanyIds: modalAllowedCompanyIds
          }
        })
      });

      if (res.ok) {
        // Toggle Active Status on Employee Record
        if (modalIsActive !== (selectedUser.isActive !== false)) {
          await fetch(`/api/v1/admin/user-accounts/${selectedUser.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: modalIsActive })
          });
        }

        setSaveSuccess(`User access configuration updated for ${selectedUser.name}!`);
        setShowRefreshNotice(true);
        setIsUserModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to update user configuration");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  const handleOpenUserModal = (emp: Employee) => {
    setSelectedUser(emp);
    setModalUsername(emp.username || "");
    setModalAuthMode((emp as any).authMode || "LOCAL");
    setModalIsActive(emp.isActive !== false);
    setModalIsLoginEnabled(emp.isLoginEnabled !== false);
    setModalSelfServiceEnabled(emp.selfServiceEnabled !== false);
    setModalWebAccessEnabled(emp.webAccessEnabled !== false);
    setModalMobileAccessEnabled(emp.mobileAccessEnabled !== false);
    
    const userRoleIds = (emp as any).assignedRoleIds || [];
    setModalAssignedRoleIds(userRoleIds);

    const access = (emp as any).operationAccess || {};
    setModalAllowedWhiteCollar(access.allowedWhiteCollar !== false);
    setModalAllowedSecurityGuarding(!!access.allowedSecurityGuarding);
    setModalAllowedFacilityManagement(!!access.allowedFacilityManagement);
    setModalDefaultLanding(access.defaultLanding || "/dashboard");

    let allowedCompanies: string[] = [];
    if (access.allowedCompanyIds) {
      if (Array.isArray(access.allowedCompanyIds)) {
        allowedCompanies = access.allowedCompanyIds;
      } else if (typeof access.allowedCompanyIds === "string") {
        try {
          allowedCompanies = JSON.parse(access.allowedCompanyIds);
        } catch {
          allowedCompanies = access.allowedCompanyIds.split(",");
        }
      }
    }
    setModalAllowedCompanyIds(allowedCompanies);
    
    setNewPassword("");
    setMustChangePassword(false);
    setPasswordResetSuccess(false);
    setIsUserModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    setPasswordResetSuccess(false);
    setError(null);

    try {
      const res = await fetch(`/api/v1/admin/user-accounts/${selectedUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
          mustChangePassword
        })
      });

      if (res.ok) {
        setPasswordResetSuccess(true);
        setNewPassword("");
      } else {
        const err = await res.json();
        setError(err.error || "Failed to reset password");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  const handleLockUnlock = async (emp: Employee, lockAction: "lock" | "unlock") => {
    setSaveSuccess(null);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/user-accounts/${emp.id}/${lockAction}`, {
        method: "POST"
      });
      if (res.ok) {
        setSaveSuccess(`Employee successfully ${lockAction === "lock" ? "locked out" : "unlocked"}!`);
        fetchData();
      } else {
        setError(`Failed to perform ${lockAction} operation`);
      }
    } catch (e: any) {
      setError(e.message || "Error occurred");
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateRoleError(null);

    if (!newRoleName.trim()) {
      setCreateRoleError("Role Name is required");
      return;
    }

    const codeToSubmit = newRoleCode.trim().toUpperCase().replace(/\s+/g, "_") || newRoleName.trim().toUpperCase().replace(/\s+/g, "_");

    try {
      const res = await fetch("/api/v1/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: codeToSubmit,
          description: newRoleDesc || `${newRoleName.trim()} description`,
          scope: newRoleScope,
          roleType: newRoleType,
          cloneFromRoleId: cloneFromRoleId || undefined
        })
      });

      if (res.ok) {
        const created = await res.json();
        setIsCreateRoleOpen(false);
        setNewRoleName("");
        setNewRoleCode("");
        setNewRoleDesc("");
        setCloneFromRoleId("");
        setSelectedRoleId(created.id);
        setSaveSuccess("New custom role created successfully!");
        fetchData();
      } else {
        const err = await res.json();
        setCreateRoleError(err.error || "Failed to create custom role");
      }
    } catch (err: any) {
      setCreateRoleError(err.message || "Network error occurred");
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setSaveSuccess(null);
    setError(null);

    // Deletion validation: Check if role is assigned to any user
    const assignedUsers = assignments.filter(a => a.roleId === roleId && a.isActive);
    if (assignedUsers.length > 0) {
      const names = assignedUsers.map(au => {
        const emp = employees.find(e => e.id === au.employeeId);
        return emp ? emp.name : au.employeeId;
      }).join(", ");
      setError(`Cannot delete this role because it is currently assigned to: ${names}. Unassign the role from these users before deleting.`);
      return;
    }

    if (!confirm("Are you sure you want to delete this custom role? This will permanently remove this role and clear it from all assigned users.")) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/roles?roleId=${roleId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setSaveSuccess("Role deleted successfully!");
        setSelectedRoleId(roles[0]?.id || "");
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to delete role");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  const handleSaveRoleDetails = async () => {
    if (!selectedRole) return;
    setSaveSuccess(null);
    setError(null);

    try {
      const res = await fetch("/api/v1/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRoleId,
          systemRoleData: {
            name: selectedRole.name.trim().toUpperCase().replace(/\s+/g, "_"),
            description: selectedRole.description,
            isActive: selectedRole.isActive,
            scope: selectedRole.scope,
            roleType: selectedRole.roleType || getRoleCategory(selectedRole)
          }
        })
      });

      if (res.ok) {
        setSaveSuccess(`Role details saved successfully for "${selectedRole.name}"!`);
        setShowRefreshNotice(true);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save role details");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    }
  };

  const handleToggleMatrixCheckbox = (permKey: string) => {
    if (!selectedRole || selectedRole.isSystemDefault || selectedRole.isEditable === false) return;

    const matchedPermission = permissions.find(p => p.key === permKey);
    if (!matchedPermission) return;

    setRolePermissions(prev => {
      const exists = prev.some(rp => rp.roleId === selectedRoleId && rp.permissionId === matchedPermission.id);
      if (exists) {
        return prev.map(rp => {
          if (rp.roleId === selectedRoleId && rp.permissionId === matchedPermission.id) {
            const newState = !rp.canView;
            return {
              ...rp,
              canView: newState,
              canCreate: newState,
              canEdit: newState,
              canDelete: newState,
              canApprove: newState,
              canExport: newState
            };
          }
          return rp;
        });
      } else {
        return [
          ...prev,
          {
            id: `TEMP-${Math.random().toString()}`,
            roleId: selectedRoleId,
            permissionId: matchedPermission.id,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canApprove: true,
            canExport: true
          }
        ];
      }
    });
  };

  const handleBulkRoleAction = (actionType: "view_all" | "manage_all" | "clear_all", accordionTitle: string) => {
    if (!selectedRole || selectedRole.isSystemDefault || selectedRole.isEditable === false) return;
    
    const group = ACCORDION_GROUPS.find(g => g.title === accordionTitle);
    if (!group) return;

    const targetKeys: string[] = [];
    group.modules.forEach(m => {
      if (actionType === "view_all") {
        if (m.capabilities.view) targetKeys.push(m.capabilities.view);
      } else if (actionType === "manage_all") {
        Object.keys(m.capabilities).forEach(cap => {
          if (cap !== "view") {
            targetKeys.push((m.capabilities as any)[cap]);
          }
        });
      } else {
        Object.values(m.capabilities).forEach(key => targetKeys.push(key));
      }
    });

    setRolePermissions(prev => {
      let updated = [...prev];
      for (const key of targetKeys) {
        const perm = permissions.find(p => p.key === key);
        if (!perm) continue;

        const idx = updated.findIndex(x => x.roleId === selectedRoleId && x.permissionId === perm.id);
        const shouldCheck = actionType !== "clear_all";

        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            canView: shouldCheck,
            canCreate: shouldCheck,
            canEdit: shouldCheck,
            canDelete: shouldCheck,
            canApprove: shouldCheck,
            canExport: shouldCheck
          };
        } else if (shouldCheck) {
          updated.push({
            id: `TEMP-${Math.random().toString()}`,
            roleId: selectedRoleId,
            permissionId: perm.id,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canApprove: true,
            canExport: true
          });
        }
      }
      return updated;
    });
  };

  const handleSaveMenuPermissions = async () => {
    if (!selectedRole) return;
    setSaveSuccess(null);
    setError(null);

    try {
      const currentRolePerms = rolePermissions.filter(rp => rp.roleId === selectedRoleId);
      const res = await fetch("/api/v1/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRoleId,
          permissions: currentRolePerms
        })
      });

      if (res.ok) {
        setSaveSuccess(`Matrix configurations saved successfully for role "${selectedRole.name}"!`);
        setShowRefreshNotice(true);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save matrix permissions");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  if (!hasAccess || !hasTabAccess) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center max-w-md p-6 bg-status-error/10 border border-status-error/20 rounded-2xl">
          <span className="material-symbols-outlined text-status-error text-5xl">gpp_bad</span>
          <h2 className="text-lg font-bold text-primary mt-2">Access Denied</h2>
          <p className="text-xs text-on-surface-variant mt-1 font-semibold">
            {!hasAccess 
              ? "You do not have the required administrative clearance to view the settings dashboard."
              : "You do not have the required administrative clearance to manage user roles and permissions."}
          </p>
          <div className="mt-4">
            <Link href="/">
              <Button size="sm" className="font-bold text-xs">Return to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Preview effective permissions calculator
  const calculateEffectivePermissions = (empId: string) => {
    const empObj = employees.find(e => e.id === empId);
    if (!empObj) return { baseRole: "EMPLOYEE", rolesList: [], activeRoles: [], inactiveRoles: [], permissionsKeys: [], visibleMenus: [], deniedMenus: [] };

    const baseRoleName = empObj.role ? empObj.role.toUpperCase().replace(/\s+/g, "_") : "EMPLOYEE";
    
    // Auto Admin Bypass
    if (baseRoleName === "SUPER_ADMIN" || baseRoleName === "ADMIN") {
      const adminPerms = permissions.map(p => p.key);
      const visible = ACCORDION_GROUPS.flatMap(g => g.modules.map(m => m.label));
      const uniqVisible = Array.from(new Set(visible));
      return {
        baseRole: baseRoleName,
        rolesList: [baseRoleName],
        activeRoles: [baseRoleName],
        inactiveRoles: [],
        permissionsKeys: adminPerms,
        visibleMenus: uniqVisible,
        deniedMenus: []
      };
    }

    const activeRoles = [baseRoleName];
    const inactiveRoles: string[] = [];
    const rolesList = [baseRoleName];
    const userAssignments = assignments.filter(a => a.employeeId === empId && a.isActive);
    
    const assignedRoles = userAssignments.map(a => roles.find(r => r.id === a.roleId)).filter(Boolean) as SystemRole[];
    assignedRoles.forEach(r => {
      if (r.isActive) {
        if (!activeRoles.includes(r.name)) activeRoles.push(r.name);
      } else {
        if (!inactiveRoles.includes(r.name)) inactiveRoles.push(r.name);
      }
      if (!rolesList.includes(r.name)) rolesList.push(r.name);
    });

    const activeRoleIds = assignedRoles.filter(r => r.isActive).map(r => r.id);
    const permKeys = new Set<string>();

    // 1. Add base role permissions
    const defaultRolePermKeys = (global as any).DEFAULT_ROLE_PERMISSIONS?.[baseRoleName] || [];
    defaultRolePermKeys.forEach((k: string) => permKeys.add(k));

    // 2. Add custom roles permissions
    rolePermissions.filter(rp => activeRoleIds.includes(rp.roleId)).forEach(rp => {
      if (rp.canView || rp.canCreate || rp.canEdit || rp.canDelete || rp.canApprove || rp.canExport) {
        const pObj = permissions.find(p => p.id === rp.permissionId);
        if (pObj) permKeys.add(pObj.key);
      }
    });

    const permissionsKeys = Array.from(permKeys);

    // Mock navigation filtering simulation
    const visibleMenus: string[] = [];
    const deniedMenus: string[] = [];

    ACCORDION_GROUPS.forEach(g => {
      g.modules.forEach(m => {
        const viewKey = m.capabilities.view;
        const isGranted = permissionsKeys.includes(viewKey) || baseRoleName === "SUPER_ADMIN" || baseRoleName === "ADMIN";
        if (isGranted) {
          if (!visibleMenus.includes(m.label)) visibleMenus.push(m.label);
        } else {
          if (!deniedMenus.includes(m.label)) deniedMenus.push(m.label);
        }
      });
    });

    return {
      baseRole: baseRoleName,
      rolesList,
      activeRoles,
      inactiveRoles,
      permissionsKeys,
      visibleMenus,
      deniedMenus
    };
  };

  const previewInfo = calculateEffectivePermissions(previewUserId);

  return (
    <div className="space-y-4 max-w-none w-full px-0">
      {/* Compact Dynamic Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-primary-container via-surface-container-high to-surface border border-outline-variant rounded-xl p-4 shadow-sm">
        <div>
          <h1 className="text-lg font-black text-primary flex items-center gap-1.5 tracking-tight">
            <span className="material-symbols-outlined text-secondary text-xl">
              {activeTab === "general" ? "settings" : activeTab === "rolesPermissions" ? "shield_person" : "flowsheet"}
            </span>
            <span>
              {activeTab === "general"
                ? "General Settings"
                : activeTab === "rolesPermissions"
                ? "User Roles & Permissions"
                : "Approval Workflows Setup"}
            </span>
          </h1>
          <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">
            {activeTab === "general"
              ? "Configure system-wide parameters, geofencing coordinates, and offline caching intervals."
              : activeTab === "rolesPermissions"
              ? "Configure customizable roles, menu matrix checklists, reports access, and operational user profiles."
              : "Define multi-level approval hierarchies, delegation matrices, and custom workflows rules."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData} className="font-bold flex items-center gap-1 text-[11px] py-1.5 px-3">
            <span className="material-symbols-outlined text-sm">sync</span>
            Sync Registry Data
          </Button>
        </div>
      </div>

      {/* Access Control Tabs */}
      <div className="flex border-b border-outline-variant gap-1 overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "general"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-xs">settings</span>
          General Configurations
        </button>
        <button
          onClick={() => setActiveTab("rolesPermissions")}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "rolesPermissions"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-xs">shield_person</span>
          User Roles & Permissions
        </button>
        <button
          onClick={() => setActiveTab("workflowManagement")}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "workflowManagement"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-xs">flowsheet</span>
          Approval Workflows Setup
        </button>
      </div>

      {/* Save Success Notice */}
      {showRefreshNotice && (
        <div className="bg-status-success/10 border border-status-success text-status-success p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-lg">info</span>
            <div className="text-[11px] font-bold">
              Configurations Updated! User session changes will reflect instantly. Click below to refresh your own session tokens.
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="xs" onClick={() => {
              if (updateSession) updateSession();
              window.location.reload();
            }} className="font-bold text-[10px]">
              Hot-Reload My Session
            </Button>
            <Button size="xs" variant="secondary" onClick={() => setShowRefreshNotice(false)} className="font-bold text-[10px]">
              Dismiss Notice
            </Button>
          </div>
        </div>
      )}

      {saveSuccess && !showRefreshNotice && (
        <div className="bg-status-success/15 border border-status-success text-status-success p-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{saveSuccess}</span>
        </div>
      )}

      {error && (
        <div className="bg-status-error/15 border border-status-error text-status-error p-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Contents */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4 max-w-none w-full px-0">
          {/* TAB 1: GENERAL SYSTEM CONFIG */}
          {activeTab === "general" && (
            <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm space-y-4 font-semibold">
              <h2 className="text-xs font-black text-primary uppercase border-b border-outline-variant pb-1.5">
                General Parameters Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-primary block mb-1">LATENCY WARNING THRESHOLD (MS)</label>
                  <Input value={latencyThreshold} onChange={(e) => setLatencyThreshold(e.target.value)} className="text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-primary block mb-1">OFFLINE LOCAL CACHE SYNC INTERVAL (S)</label>
                  <Input value={offlineSyncInterval} onChange={(e) => setOfflineSyncInterval(e.target.value)} className="text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-primary block mb-1">MOBILE ATTENDANCE GEOFENCING RADIUS (METERS)</label>
                  <Input value={geofencingRadius} onChange={(e) => setGeofencingRadius(e.target.value)} className="text-xs" />
                </div>
              </div>
              <div className="flex justify-end pt-3 border-t border-outline-variant">
                <Button onClick={() => setSaveSuccess("System general configurations updated!")} className="font-bold text-xs">
                  Save General Settings
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: WORKFLOW MANAGEMENT */}
          {activeTab === "workflowManagement" && (
            <div className="space-y-4 max-w-none w-full px-0">
              <div className="flex border-b border-outline-variant gap-1 overflow-x-auto pb-0.5 mb-2">
                <button
                  onClick={() => setActiveTab("workflowManagement")}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider border-secondary text-secondary bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-xs">flowsheet</span>
                  Approval Workflows
                </button>
                <button
                  onClick={() => setActiveTab("workflowDelegations")}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider border-transparent text-on-surface-variant hover:text-primary"
                >
                  <span className="material-symbols-outlined text-xs">assignment_ind</span>
                  Workflow Delegations
                </button>
              </div>
              <WorkflowManagementTab employees={workforceEmployees} onShowMessage={(type, text) => type === "success" ? setSaveSuccess(text) : setError(text)} />
            </div>
          )}

          {/* TAB 3: WORKFLOW DELEGATIONS */}
          {activeTab === "workflowDelegations" && (
            <div className="space-y-4 max-w-none w-full px-0">
              <div className="flex border-b border-outline-variant gap-1 overflow-x-auto pb-0.5 mb-2">
                <button
                  onClick={() => setActiveTab("workflowManagement")}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider border-transparent text-on-surface-variant hover:text-primary"
                >
                  <span className="material-symbols-outlined text-xs">flowsheet</span>
                  Approval Workflows
                </button>
                <button
                  onClick={() => setActiveTab("workflowDelegations")}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider border-secondary text-secondary bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-xs">assignment_ind</span>
                  Workflow Delegations
                </button>
              </div>
              <WorkflowDelegationsTab employees={workforceEmployees} onShowMessage={(type, text) => type === "success" ? setSaveSuccess(text) : setError(text)} />
            </div>
          )}

          {/* TAB 4: USER ROLES & PERMISSIONS HUB (RBAC) */}
          {activeTab === "rolesPermissions" && (
            <div className="space-y-3 max-w-none w-full px-0">
              {/* Internal Sub-Tabs */}
              <div className="flex border-b border-outline-variant gap-1 overflow-x-auto pb-0.5 mb-2">
                <button
                  onClick={() => setSection("roles")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
                    activeSection === "roles"
                      ? "border-secondary text-secondary bg-surface-container-low"
                      : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">shield_person</span>
                  Roles Registry
                </button>
                <button
                  onClick={() => setSection("menu")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
                    activeSection === "menu"
                      ? "border-secondary text-secondary bg-surface-container-low"
                      : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">table_chart</span>
                  Menu Permissions
                </button>
                <button
                  onClick={() => setSection("reports")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
                    activeSection === "reports"
                      ? "border-secondary text-secondary bg-surface-container-low"
                      : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">analytics</span>
                  Report Permissions
                </button>
                <button
                  onClick={() => setSection("users")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
                    activeSection === "users"
                      ? "border-secondary text-secondary bg-surface-container-low"
                      : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">group</span>
                  Operational Users
                </button>
                <button
                  onClick={() => setSection("preview")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
                    activeSection === "preview"
                      ? "border-secondary text-secondary bg-surface-container-low"
                      : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">preview</span>
                  Permission Preview
                </button>
              </div>

              {/* SECTION A: ROLES REGISTRY */}
              {activeSection === "roles" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left Column: Roles list */}
                  <div className="space-y-2">
                    <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-sm space-y-3">
                      <div className="flex justify-between items-center border-b border-outline-variant pb-1.5">
                        <div>
                          <h3 className="text-xs font-black text-primary uppercase">Registry List</h3>
                          <p className="text-[9px] text-on-surface-variant font-medium mt-0.5">Select a role below</p>
                        </div>
                        <Button size="xs" onClick={() => {
                          setNewRoleName("");
                          setNewRoleCode("");
                          setNewRoleDesc("");
                          setNewRoleScope("General");
                          setNewRoleType("White Collar Operations");
                          setCloneFromRoleId("");
                          setIsCreateRoleOpen(true);
                        }} className="font-bold text-[10px] py-1 px-2">
                          + Custom Role
                        </Button>
                      </div>

                      <Input
                        placeholder="Search roles registry..."
                        value={rolesSearchQuery}
                        onChange={(e) => setRolesSearchQuery(e.target.value)}
                        className="text-xs"
                      />

                      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-0.5">
                        {roles.filter(r => r.name.toLowerCase().includes(rolesSearchQuery.toLowerCase())).map((r) => {
                          const isSelected = r.id === selectedRoleId;
                          const isSys = r.isSystemDefault || r.isEditable === false;
                          return (
                            <div
                              key={r.id}
                              onClick={() => { setSelectedRoleId(r.id); setSaveSuccess(null); setError(null); }}
                              className={`p-2 rounded-lg border cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-primary-container border-primary text-primary"
                                  : "bg-surface hover:bg-surface-container-low border-outline-variant text-on-surface"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold flex items-center gap-1">
                                  {isSys && <span className="material-symbols-outlined text-[12px] text-outline">lock</span>}
                                  {r.name}
                                </span>
                                {isSys ? (
                                  <Badge variant="secondary" className="text-[8px] px-1 py-0.2 font-bold uppercase">System</Badge>
                                ) : (
                                  <Badge variant="primary" className="text-[8px] px-1 py-0.2 font-bold uppercase">Custom</Badge>
                                )}
                              </div>
                              <p className="text-[9px] text-on-surface-variant mt-0.5 line-clamp-2">
                                {r.description || "No description provided."}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Role details */}
                  <div className="md:col-span-2 space-y-2 font-semibold">
                    {selectedRole ? (
                      <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-sm space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-outline-variant pb-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h2 className="text-sm font-black text-primary uppercase flex items-center gap-1">
                                { (selectedRole.isSystemDefault || selectedRole.isEditable === false) && (
                                  <span className="material-symbols-outlined text-[16px] text-outline">lock</span>
                                )}
                                {selectedRole.name}
                              </h2>
                              {selectedRole.isSystemDefault || selectedRole.isEditable === false ? (
                                <Badge variant="secondary" className="text-[9px]">Protected Default Role</Badge>
                              ) : (
                                <Badge variant="primary" className="text-[9px]">Customizable Role</Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-on-surface-variant mt-0.5 font-semibold">
                              Configure basic properties and scope settings for this role.
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => {
                                setNewRoleName(selectedRole.name.replace(/_CLONE\d*$/, ""));
                                setNewRoleCode(`CLONE_${selectedRole.name}`);
                                setNewRoleDesc(`Clone copy of ${selectedRole.name} configurations.`);
                                setNewRoleScope(selectedRole.scope || "General");
                                setNewRoleType(getRoleCategory(selectedRole));
                                setCloneFromRoleId(selectedRole.id);
                                setIsCreateRoleOpen(true);
                              }}
                              className="font-bold text-[10px] py-1 px-2.5"
                            >
                              Clone Role
                            </Button>
                            {!selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => handleDeleteRole(selectedRole.id)}
                                className="font-bold text-[10px] text-status-error hover:bg-status-error/5 py-1 px-2.5"
                              >
                                Delete Role
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Modify Metadata block */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                          <div>
                            <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Role Name (Label)</label>
                            <Input
                              value={selectedRole.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRoles(prev => prev.map(r => r.id === selectedRoleId ? { ...r, name: val } : r));
                              }}
                              disabled={selectedRole.isSystemDefault || selectedRole.isEditable === false}
                              className="text-xs font-semibold"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Role Code (Unique Key)</label>
                            <Input
                              value={selectedRole.name.trim().toUpperCase().replace(/\s+/g, "_")}
                              disabled={true}
                              className="text-xs font-mono font-bold bg-surface-container-low opacity-60"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Description</label>
                            <Input
                              value={selectedRole.description || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRoles(prev => prev.map(r => r.id === selectedRoleId ? { ...r, description: val } : r));
                              }}
                              disabled={selectedRole.isSystemDefault || selectedRole.isEditable === false}
                              className="text-xs font-semibold"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Scope Area / Division Boundary</label>
                            <select
                              value={selectedRole.scope || "General"}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRoles(prev => prev.map(r => r.id === selectedRoleId ? { ...r, scope: val } : r));
                              }}
                              disabled={selectedRole.isSystemDefault || selectedRole.isEditable === false}
                              className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                            >
                              <option value="General">General</option>
                              <option value="HR">HR</option>
                              <option value="Security Guarding">Security Guarding</option>
                              <option value="Facility Management">Facility Management</option>
                              <option value="Reports">Reports</option>
                              <option value="Settings">Settings</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Role Category Type</label>
                            <select
                              value={selectedRole.roleType || getRoleCategory(selectedRole)}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRoles(prev => prev.map(r => r.id === selectedRoleId ? { ...r, roleType: val } : r));
                              }}
                              disabled={selectedRole.isSystemDefault || selectedRole.isEditable === false}
                              className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                            >
                              <option value="Employee Self-Service">Employee Self-Service</option>
                              <option value="White Collar Operations">White Collar Operations</option>
                              <option value="Security Guarding Operations">Security Guarding Operations</option>
                              <option value="Facility Management Operations">Facility Management Operations</option>
                              <option value="IT / System Administration">IT / System Administration</option>
                              <option value="Finance / Reports">Finance / Reports</option>
                              <option value="Read Only">Read Only</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5 pt-1.5 md:col-span-2">
                            <input
                              type="checkbox"
                              id="role-active-chk"
                              checked={selectedRole.isActive}
                              onChange={() => {
                                setRoles(prev => prev.map(r => r.id === selectedRoleId ? { ...r, isActive: !r.isActive } : r));
                              }}
                              disabled={selectedRole.isSystemDefault || selectedRole.isEditable === false}
                              className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer disabled:opacity-40"
                            />
                            <label htmlFor="role-active-chk" className="text-[10px] font-bold text-primary uppercase select-none cursor-pointer">
                              Role is Active (Only active roles contribute permissions)
                            </label>
                          </div>
                        </div>

                        {!selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                          <div className="flex justify-end gap-1.5 pt-2 border-t border-outline-variant">
                            <Button variant="secondary" onClick={fetchData} className="font-bold text-[10px] py-1 px-3">
                              Reset
                            </Button>
                            <Button onClick={handleSaveRoleDetails} className="font-bold text-[10px] py-1 px-3">
                              Save Details
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-sm text-center py-20 text-xs text-on-surface-variant font-medium">
                        No role selected. Choose a role from the registry list to edit.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION B: MENU PERMISSIONS MATRIX */}
              {activeSection === "menu" && (
                <div className="space-y-2 font-semibold max-w-none w-full">
                  <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-outline-variant pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-xs font-black text-primary uppercase">Select Role Context:</span>
                        <select
                          value={selectedRoleId}
                          onChange={(e) => setSelectedRoleId(e.target.value)}
                          className="bg-surface border border-outline-variant rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                        >
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name} {r.isSystemDefault ? "(System)" : "(Custom)"}</option>
                          ))}
                        </select>
                      </div>

                      {/* Search Filter Input */}
                      <Input
                        placeholder="Search matrix by module name or permission key..."
                        value={matrixSearchQuery}
                        onChange={(e) => setMatrixSearchQuery(e.target.value)}
                        className="text-xs w-full sm:w-64"
                      />

                      {selectedRole && !selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                        <div className="flex gap-1.5">
                          <Button variant="secondary" onClick={fetchData} className="font-bold text-[10px] py-1 px-3">
                            Discard Matrix
                          </Button>
                          <Button onClick={handleSaveMenuPermissions} className="font-bold text-[10px] py-1 px-3">
                            Save Matrix
                          </Button>
                        </div>
                      )}
                    </div>

                    {selectedRole?.isSystemDefault && (
                      <div className="bg-status-warning/10 border border-status-warning/30 p-3 rounded-lg text-[11px] text-status-warning font-bold flex items-start gap-1.5">
                        <span className="material-symbols-outlined mt-0.5 text-base">lock</span>
                        <div>
                          <strong>{selectedRole.name}</strong> is a protected system default role. Permissions are fixed and cannot be edited.
                          <br />To customize permissions, clone this role inside the Roles Registry tab.
                        </div>
                      </div>
                    )}

                    {selectedRole && (
                      <div className="space-y-2">
                        {ACCORDION_GROUPS.map((group) => {
                          // Filter modules within this accordion section by search query
                          const filteredModules = group.modules.filter(m => {
                            const query = matrixSearchQuery.toLowerCase();
                            return m.label.toLowerCase().includes(query) ||
                                   Object.values(m.capabilities).some(k => k.toLowerCase().includes(query));
                          });

                          // If search query is present and no modules match in this section, hide this section
                          if (matrixSearchQuery && filteredModules.length === 0) return null;

                          const isExpanded = expandedSections[group.title] !== false;

                          return (
                            <div key={group.title} className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest shadow-sm">
                              {/* Accordion Header */}
                              <div
                                onClick={() => toggleSection(group.title)}
                                className="bg-surface-container-low px-3 py-2 flex items-center justify-between border-b border-outline-variant cursor-pointer select-none"
                              >
                                <div className="flex items-center gap-1.5 text-primary">
                                  <span className="material-symbols-outlined text-base">{group.icon}</span>
                                  <span className="text-xs font-black uppercase tracking-tight">{group.title}</span>
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0.2">
                                    {filteredModules.length} Modules
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                  {!selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleBulkRoleAction("view_all", group.title)}
                                        className="text-[9px] font-black text-primary border border-primary/20 bg-surface rounded px-1.5 py-0.5 hover:bg-primary/5 uppercase"
                                      >
                                        All View
                                      </button>
                                      <button
                                        onClick={() => handleBulkRoleAction("manage_all", group.title)}
                                        className="text-[9px] font-black text-secondary border border-secondary/20 bg-surface rounded px-1.5 py-0.5 hover:bg-secondary/5 uppercase"
                                      >
                                        All Manage
                                      </button>
                                      <button
                                        onClick={() => handleBulkRoleAction("clear_all", group.title)}
                                        className="text-[9px] font-black text-status-error border border-status-error/20 bg-surface rounded px-1.5 py-0.5 hover:bg-status-error/5 uppercase"
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  )}
                                  <span className="material-symbols-outlined text-outline text-lg transition-transform duration-200">
                                    {isExpanded ? "expand_less" : "expand_more"}
                                  </span>
                                </div>
                              </div>

                              {/* Accordion Content Panel */}
                              {isExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-[11px] font-semibold">
                                    <thead>
                                      <tr className="bg-surface-container-low/30 border-b border-outline-variant/60 text-primary font-bold">
                                        <th className="py-2 px-3 pl-4 w-1/3">Submodule Path / Module</th>
                                        <th className="py-2 px-2 text-center">View</th>
                                        <th className="py-2 px-2 text-center">Create</th>
                                        <th className="py-2 px-2 text-center">Edit</th>
                                        <th className="py-2 px-2 text-center">Delete</th>
                                        <th className="py-2 px-2 text-center">Manage / Admin</th>
                                        <th className="py-2 px-2 text-center">Export</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant/40">
                                      {filteredModules.map((row) => {
                                        const getCheckbox = (capName: "view" | "create" | "edit" | "delete" | "manage" | "export") => {
                                          const key = (row.capabilities as any)[capName];
                                          if (!key) return <span className="text-outline-variant/60 font-normal">-</span>;

                                          const perm = permissions.find(p => p.key === key);
                                          const rp = perm ? rolePermissions.find(x => x.roleId === selectedRoleId && x.permissionId === perm.id) : null;
                                          const isChecked = !!(rp?.canView || rp?.canCreate || rp?.canEdit || rp?.canDelete || rp?.canApprove || rp?.canExport);

                                          return (
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              disabled={!perm || selectedRole.isSystemDefault || selectedRole.isEditable === false}
                                              onChange={() => handleToggleMatrixCheckbox(key)}
                                              className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer disabled:opacity-40"
                                            />
                                          );
                                        };

                                        return (
                                          <tr key={row.label} className="hover:bg-surface-container-low/20">
                                            <td className="py-1.5 px-3 pl-4">
                                              <div className="font-bold text-primary">{row.label}</div>
                                              <div className="text-[8px] text-outline font-semibold font-mono tracking-tight leading-none mt-0.5">
                                                {Object.entries(row.capabilities).map(([k, v]) => `${k}:${v}`).join(" | ")}
                                              </div>
                                            </td>
                                            <td className="py-1.5 px-2 text-center">{getCheckbox("view")}</td>
                                            <td className="py-1.5 px-2 text-center">{getCheckbox("create")}</td>
                                            <td className="py-1.5 px-2 text-center">{getCheckbox("edit")}</td>
                                            <td className="py-1.5 px-2 text-center">{getCheckbox("delete")}</td>
                                            <td className="py-1.5 px-2 text-center">{getCheckbox("manage")}</td>
                                            <td className="py-1.5 px-2 text-center">{getCheckbox("export")}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedRole && !selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                      <div className="flex justify-end gap-1.5 pt-3 border-t border-outline-variant">
                        <Button variant="secondary" onClick={fetchData} className="font-bold text-[10px] py-1 px-3">
                          Discard Matrix
                        </Button>
                        <Button onClick={handleSaveMenuPermissions} className="font-bold text-[10px] py-1 px-3">
                          Save Matrix
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION C: REPORT PERMISSIONS */}
              {activeSection === "reports" && (
                <div className="space-y-2 font-semibold max-w-none w-full">
                  <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-outline-variant pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-xs font-black text-primary uppercase">Select Role Context:</span>
                        <select
                          value={selectedRoleId}
                          onChange={(e) => setSelectedRoleId(e.target.value)}
                          className="bg-surface border border-outline-variant rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                        >
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name} {r.isSystemDefault ? "(System)" : "(Custom)"}</option>
                          ))}
                        </select>
                      </div>
                      {selectedRole && !selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                        <div className="flex gap-1.5">
                          <Button variant="secondary" onClick={fetchData} className="font-bold text-[10px] py-1 px-3">
                            Discard Reports
                          </Button>
                          <Button onClick={handleSaveMenuPermissions} className="font-bold text-[10px] py-1 px-3">
                            Save Reports Access
                          </Button>
                        </div>
                      )}
                    </div>

                    {selectedRole?.isSystemDefault && (
                      <div className="bg-status-warning/10 border border-status-warning/30 p-3 rounded-lg text-[11px] text-status-warning font-bold flex items-start gap-1.5">
                        <span className="material-symbols-outlined mt-0.5 text-base">lock</span>
                        <div>
                          <strong>{selectedRole.name}</strong> is a protected system default role. Report permissions are fixed and cannot be edited.
                          <br />Clone this role inside Roles Registry to customize report permissions list.
                        </div>
                      </div>
                    )}

                    {selectedRole && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {REPORTS_LIST.map((report) => {
                          const matchedPermission = permissions.find(p => p.key === report.key);
                          const rp = matchedPermission
                            ? rolePermissions.find(x => x.roleId === selectedRoleId && x.permissionId === matchedPermission.id)
                            : null;
                          const isGranted = !!(rp?.canView || rp?.canCreate || rp?.canEdit || rp?.canDelete || rp?.canApprove || rp?.canExport);

                          return (
                            <div
                              key={report.key}
                              className={`p-2.5 border rounded-lg flex items-center justify-between gap-3 transition-colors ${
                                isGranted ? "border-primary/20 bg-primary-container/5" : "border-outline-variant hover:bg-surface-container-low/50"
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-primary">{report.name}</span>
                                  <Badge variant="secondary" className="text-[7px] font-black uppercase px-1 py-0">
                                    {report.category}
                                  </Badge>
                                </div>
                                <p className="text-[10px] text-on-surface-variant font-medium">
                                  {report.description}
                                </p>
                                <p className="text-[8px] font-mono text-outline font-semibold">
                                  {report.key}
                                </p>
                              </div>

                              <div className="shrink-0 flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  id={`rep-chk-${report.key}`}
                                  checked={isGranted}
                                  disabled={!matchedPermission || selectedRole.isSystemDefault || selectedRole.isEditable === false}
                                  onChange={() => handleToggleMatrixCheckbox(report.key)}
                                  className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer disabled:opacity-40"
                                />
                                <label
                                  htmlFor={`rep-chk-${report.key}`}
                                  className="text-[10px] font-bold text-primary uppercase select-none cursor-pointer"
                                >
                                  OK
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedRole && !selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                      <div className="flex justify-end gap-1.5 pt-3 border-t border-outline-variant">
                        <Button variant="secondary" onClick={fetchData} className="font-bold text-[10px] py-1 px-3">
                          Discard Reports
                        </Button>
                        <Button onClick={handleSaveMenuPermissions} className="font-bold text-[10px] py-1 px-3">
                          Save Reports Access
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION D: OPERATIONAL USERS MULTI-ROLE ASSIGNMENT */}
              {activeSection === "users" && (
                <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-sm space-y-3 font-semibold max-w-none w-full">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-outline-variant pb-2">
                    <div>
                      <h2 className="text-xs font-black text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-secondary text-base">group</span>
                        <span>User Role Assignments Registry</span>
                      </h2>
                      <p className="text-[9px] text-on-surface-variant font-semibold mt-0.5">
                        Supervise employee credentials, configure operation boundaries, and assign multiple roles.
                      </p>
                    </div>
                    <Input
                      placeholder="Search by name, email, employee code..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="text-xs w-full md:w-64"
                    />
                  </div>

                  <div className="overflow-x-auto border border-outline-variant rounded-xl shadow-inner bg-surface-container-lowest">
                    <table className="w-full text-left border-collapse text-xs font-medium">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline-variant text-primary font-bold">
                          <th className="py-2 px-3 pl-4">Operational User</th>
                          <th className="py-2 px-2">Primary / Base</th>
                          <th className="py-2 px-2">Assigned Roles Badges</th>
                          <th className="py-2 px-2 text-center">Perms Count</th>
                          <th className="py-2 px-2 text-center">Division Scopes</th>
                          <th className="py-2 px-2 text-center">Status</th>
                          <th className="py-2 px-3 text-right pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/40">
                        {employees.filter(e => {
                          const query = userSearchQuery.toLowerCase();
                          return e.name.toLowerCase().includes(query) ||
                                 e.id.toLowerCase().includes(query) ||
                                 (e.username || "").toLowerCase().includes(query) ||
                                 (e.email || "").toLowerCase().includes(query);
                        }).map((emp) => {
                          const userAssignments = (emp as any).roleAssignments || [];
                          const roleNames = userAssignments.map((a: any) => {
                            const matchingRole = roles.find(r => r.id === a.roleId);
                            return matchingRole ? matchingRole.name : null;
                          }).filter(Boolean);

                          const access = (emp as any).operationAccess || {};
                          const divisions = [];
                          if (access.allowedWhiteCollar !== false) divisions.push("White Collar");
                          if (access.allowedSecurityGuarding) divisions.push("Security");
                          if (access.allowedFacilityManagement) divisions.push("FM");

                          const isLocked = emp.failedLoginAttempts !== undefined && emp.failedLoginAttempts >= 5;
                          
                          // Calculate effective permissions count for this user
                          const effectiveInfo = calculateEffectivePermissions(emp.id);

                          return (
                            <tr key={emp.id} className="hover:bg-surface-container-low/20">
                              <td className="py-2 px-3 pl-4">
                                <div className="font-bold text-primary text-[11px]">{emp.name}</div>
                                <div className="text-[9px] text-on-surface-variant font-medium leading-none">Code: {emp.id} | Email: {emp.email || "N/A"}</div>
                              </td>
                              <td className="py-2 px-2">
                                <Badge variant="secondary" className="uppercase text-[8px] px-1 py-0.2">{emp.role}</Badge>
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex flex-wrap gap-0.5">
                                  {roleNames.length > 0 ? (
                                    roleNames.map((r: string) => (
                                      <Badge key={r} variant="primary" className="text-[8px] font-black uppercase px-1 py-0.2">
                                        {r}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-[9px] text-outline italic">No custom roles</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center font-bold text-primary font-mono text-[11px]">
                                {effectiveInfo.permissionsKeys.length} keys
                              </td>
                              <td className="py-2 px-2 text-center">
                                <div className="flex justify-center gap-0.5">
                                  {divisions.map(d => (
                                    <Badge key={d} variant="secondary" className="text-[8px] px-1 py-0.2 font-bold">{d}</Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center font-bold">
                                <div className="flex flex-col gap-0.5 items-center">
                                  {emp.isActive !== false ? (
                                    <span className="text-status-success text-[9px] flex items-center gap-0.5">
                                      <span className="material-symbols-outlined text-[10px]">check_circle</span> Active
                                    </span>
                                  ) : (
                                    <span className="text-status-error text-[9px] flex items-center gap-0.5">
                                      <span className="material-symbols-outlined text-[10px]">cancel</span> Inactive
                                    </span>
                                  )}
                                  {isLocked && (
                                    <Badge variant="secondary" className="bg-status-error/10 text-status-error border-status-error/30 text-[7px] px-1 py-0.2">
                                      LOCKED
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right pr-4 space-x-1 whitespace-nowrap">
                                <Button size="xs" onClick={() => handleOpenUserModal(emp)} className="font-bold text-[9px] py-0.5 px-2">
                                  Edit Access
                                </Button>
                                {isLocked ? (
                                  <Button size="xs" variant="secondary" onClick={() => handleLockUnlock(emp, "unlock")} className="font-bold text-[9px] text-status-success py-0.5 px-2">
                                    Unlock
                                  </Button>
                                ) : (
                                  emp.role !== "SUPER_ADMIN" && (
                                    <Button size="xs" variant="secondary" onClick={() => handleLockUnlock(emp, "lock")} className="font-bold text-[9px] text-status-error py-0.5 px-2">
                                      Lock
                                    </Button>
                                  )
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION E: EFFECTIVE ACCESS PREVIEW */}
              {activeSection === "preview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 font-semibold max-w-none w-full px-0">
                  {/* Left panel: select user */}
                  <div className="space-y-2">
                    <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-sm space-y-3">
                      <div className="border-b border-outline-variant pb-1.5">
                        <h3 className="text-xs font-black text-primary uppercase">Diagnose Access</h3>
                        <p className="text-[9px] text-on-surface-variant font-medium mt-0.5">Trace calculations of effective clearance rules.</p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-on-surface-variant uppercase">Select Employee:</label>
                        <select
                          value={previewUserId}
                          onChange={(e) => setPreviewUserId(e.target.value)}
                          className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                        >
                          <option value="">-- Choose User Account --</option>
                          {employees.map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.role || "EMPLOYEE"})</option>
                          ))}
                        </select>
                      </div>

                      {previewUserId && (
                        <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant space-y-2 text-xs">
                          <div>
                            <span className="text-[9px] text-outline block leading-none">Primary base role:</span>
                            <span className="font-bold text-primary uppercase text-[11px] mt-0.5 block">{previewInfo.baseRole}</span>
                          </div>
                          
                          <div>
                            <span className="text-[9px] text-outline block leading-none">Assigned Active Roles:</span>
                            <div className="flex flex-wrap gap-0.5 mt-1">
                              {previewInfo.activeRoles.map(r => (
                                <Badge key={r} variant="primary" className="text-[8px] font-black uppercase px-1 py-0.2">{r}</Badge>
                              ))}
                            </div>
                          </div>

                          {previewInfo.inactiveRoles.length > 0 && (
                            <div>
                              <span className="text-[9px] text-outline block leading-none text-status-error">Assigned Inactive Roles (Ignored):</span>
                              <div className="flex flex-wrap gap-0.5 mt-1">
                                {previewInfo.inactiveRoles.map(r => (
                                  <Badge key={r} variant="secondary" className="bg-status-error/10 text-status-error border-status-error/20 text-[8px] font-black uppercase px-1 py-0.2">{r}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right panel: preview data */}
                  <div className="lg:col-span-2 space-y-4">
                    {previewUserId ? (
                      <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm space-y-4">
                        {/* Allowed / Blocked Menus */}
                        <div className="border-b border-outline-variant/60 pb-3">
                          <h3 className="text-xs font-black text-primary uppercase mb-2">
                            Simulated Navigation Menus Visibility
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[9px] text-status-success font-black uppercase flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">visibility</span> Visible Links
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {previewInfo.visibleMenus.map(m => (
                                  <Badge key={m} variant="secondary" className="bg-status-success/10 text-status-success border-status-success/20 text-[8px] font-bold px-1.5 py-0.2">
                                    {m}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] text-status-error font-black uppercase flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">visibility_off</span> Hidden / Restricted
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {previewInfo.deniedMenus.length > 0 ? (
                                  previewInfo.deniedMenus.map(m => (
                                    <Badge key={m} variant="secondary" className="bg-status-error/10 text-status-error border-status-error/20 text-[8px] font-bold px-1.5 py-0.2">
                                      {m}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-[9px] text-outline font-bold italic leading-none">None (All visible)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Calculated Permissions Keys ledger */}
                        <div>
                          <h3 className="text-xs font-black text-primary uppercase mb-2">
                            Calculated Union Permissions Ledger
                          </h3>
                          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                            {permissions.map((p) => {
                              const isGranted = previewInfo.permissionsKeys.includes(p.key);
                              return (
                                <div key={p.id} className="flex justify-between items-center p-1.5 rounded-lg border border-outline-variant/60 text-[10px] hover:bg-surface-container-low/20">
                                  <div>
                                    <div className="font-bold text-primary">{p.label}</div>
                                    <div className="text-[8px] text-outline font-semibold font-mono leading-none">{p.key}</div>
                                  </div>
                                  <div>
                                    {isGranted ? (
                                      <span className="text-status-success font-bold flex items-center gap-0.5 text-[9px]">
                                        <span className="material-symbols-outlined text-[12px]">check_circle</span> ALLOWED
                                      </span>
                                    ) : (
                                      <span className="text-status-error font-bold flex items-center gap-0.5 text-[9px]">
                                        <span className="material-symbols-outlined text-[12px]">cancel</span> DENIED
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-sm text-center py-24 text-xs text-on-surface-variant font-medium">
                        Please select an employee candidate in the left panel to execute preview diagnosis.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* COMPREHENSIVE USER DETAILS ACCESS EDIT MODAL */}
      {isUserModalOpen && selectedUser && (
        <Modal
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          title={`Edit User Access — ${selectedUser.name}`}
          size="lg"
        >
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 max-h-[85vh] overflow-y-auto p-1 font-semibold text-xs">
            {/* Left panel: credentials, active flags, scope */}
            <div className="lg:col-span-3 space-y-3">
              <h3 className="text-[9px] font-black text-primary uppercase border-b border-outline-variant pb-1">
                Account Credentials & Boundaries
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Username / Active Directory ID</label>
                  <Input value={modalUsername} onChange={(e) => setModalUsername(e.target.value)} className="text-xs" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Authentication Mode</label>
                  <select
                    value={modalAuthMode}
                    onChange={(e) => setModalAuthMode(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                  >
                    <option value="LOCAL">LOCAL (Credentials)</option>
                    <option value="SSO">SSO (Azure AD)</option>
                  </select>
                </div>
              </div>

              {/* Status toggles */}
              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-2 rounded-lg border border-outline-variant">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="m-active-chk"
                      checked={modalIsActive}
                      onChange={() => setModalIsActive(!modalIsActive)}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                    />
                    <label htmlFor="m-active-chk" className="text-[10px] font-bold text-primary select-none cursor-pointer">Active Account</label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="m-login-chk"
                      checked={modalIsLoginEnabled}
                      disabled={selectedUser.role === "SUPER_ADMIN"}
                      onChange={() => setModalIsLoginEnabled(!modalIsLoginEnabled)}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                    />
                    <label htmlFor="m-login-chk" className="text-[10px] font-bold text-primary select-none cursor-pointer">Login Enabled</label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="m-web-chk"
                      checked={modalWebAccessEnabled}
                      onChange={() => setModalWebAccessEnabled(!modalWebAccessEnabled)}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                    />
                    <label htmlFor="m-web-chk" className="text-[10px] font-bold text-primary select-none cursor-pointer">Web Console Access</label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="m-self-chk"
                      checked={modalSelfServiceEnabled}
                      disabled={selectedUser.role === "SUPER_ADMIN"}
                      onChange={() => setModalSelfServiceEnabled(!modalSelfServiceEnabled)}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                    />
                    <label htmlFor="m-self-chk" className="text-[10px] font-bold text-primary select-none cursor-pointer">Self Service Portal</label>
                  </div>
                </div>
              </div>

              {/* Division Boundaries */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-primary uppercase block mb-0.5">Division Scopes / Boundaries</label>
                <div className="flex gap-4 p-2 bg-surface-container-low border border-outline-variant rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="m-white-chk"
                      checked={modalAllowedWhiteCollar}
                      onChange={() => setModalAllowedWhiteCollar(!modalAllowedWhiteCollar)}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                    />
                    <label htmlFor="m-white-chk" className="text-[10px] font-bold text-primary select-none cursor-pointer">White Collar</label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="m-sec-chk"
                      checked={modalAllowedSecurityGuarding}
                      disabled={selectedUser.role === "SUPER_ADMIN"}
                      onChange={() => setModalAllowedSecurityGuarding(!modalAllowedSecurityGuarding)}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                    />
                    <label htmlFor="m-sec-chk" className="text-[10px] font-bold text-primary select-none cursor-pointer">Security Guarding</label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="m-fm-chk"
                      checked={modalAllowedFacilityManagement}
                      disabled={selectedUser.role === "SUPER_ADMIN"}
                      onChange={() => setModalAllowedFacilityManagement(!modalAllowedFacilityManagement)}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                    />
                    <label htmlFor="m-fm-chk" className="text-[10px] font-bold text-primary select-none cursor-pointer">FM</label>
                  </div>
                </div>
              </div>

              {/* Password Reset Section (LOCAL only) */}
              {modalAuthMode === "LOCAL" && (
                <div className="bg-surface-container-low p-2 rounded-lg border border-outline-variant space-y-2">
                  <div className="text-[9px] font-black text-primary uppercase">Reset Local Password Credentials</div>
                  {passwordResetSuccess && (
                    <div className="text-[10px] font-bold text-status-success leading-none">Password reset successfully!</div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Input new password..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="text-xs flex-1"
                    />
                    <Button size="xs" onClick={handleResetPassword} className="font-bold text-[10px] py-1 px-3">
                      Reset
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="m-must-pw-chk"
                      checked={mustChangePassword}
                      onChange={() => setMustChangePassword(!mustChangePassword)}
                      className="w-3 h-3 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                    />
                    <label htmlFor="m-must-pw-chk" className="text-[9px] font-bold text-outline select-none cursor-pointer">
                      Force password reset on next login challenge
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Right panel: Roles multi select */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-[9px] font-black text-primary uppercase border-b border-outline-variant pb-1">
                Assign Roles Checklist
              </h3>
              
              <div className="space-y-1.5 border border-outline-variant rounded-lg p-2 max-h-[250px] overflow-y-auto bg-surface-container-low">
                {roles.filter(r => r.isActive).map((role) => {
                  const isChecked = modalAssignedRoleIds.includes(role.id);
                  return (
                    <div key={role.id} className="flex items-start gap-1.5 py-0.5">
                      <input
                        type="checkbox"
                        id={`m-role-${role.id}`}
                        checked={isChecked}
                        disabled={selectedUser.role === "SUPER_ADMIN" && role.name === "SUPER_ADMIN"}
                        onChange={() => {
                          if (isChecked) {
                            setModalAssignedRoleIds(prev => prev.filter(id => id !== role.id));
                          } else {
                            setModalAssignedRoleIds(prev => [...prev, role.id]);
                          }
                        }}
                        className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant mt-0.5 cursor-pointer"
                      />
                      <label htmlFor={`m-role-${role.id}`} className="text-[11px] cursor-pointer select-none">
                        <div className="font-bold text-primary flex items-center gap-1">
                          {role.name}
                          {role.isSystemDefault && (
                            <span className="text-[7px] border border-outline px-1 rounded text-outline uppercase font-semibold leading-none py-0">sys</span>
                          )}
                        </div>
                        <div className="text-[9px] text-on-surface-variant font-medium leading-tight">{role.description}</div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal footer */}
            <div className="lg:col-span-5 flex justify-end gap-1.5 pt-2 border-t border-outline-variant">
              <Button variant="secondary" onClick={() => setIsUserModalOpen(false)} className="font-bold text-xs">
                Cancel
              </Button>
              <Button onClick={handleSaveUserAccess} className="font-bold text-xs">
                Save Access Config
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CREATE NEW CUSTOM ROLE MODAL */}
      {isCreateRoleOpen && (
        <Modal
          isOpen={isCreateRoleOpen}
          onClose={() => setIsCreateRoleOpen(false)}
          title={cloneFromRoleId ? "Clone / Customize Role Settings" : "Create New Custom Access Role"}
          size="sm"
        >
          <form onSubmit={handleCreateRole} className="space-y-3.5 p-1 font-medium text-xs">
            {createRoleError && (
              <div className="bg-status-error/15 border border-status-error text-status-error p-2.5 rounded-lg text-[11px] font-bold">
                {createRoleError}
              </div>
            )}
            <div>
              <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Role Name (Label)</label>
              <Input
                placeholder="e.g. Assistant HR Manager"
                value={newRoleName}
                onChange={(e) => {
                  setNewRoleName(e.target.value);
                  if (!newRoleCode) {
                    setNewRoleCode(e.target.value.trim().toUpperCase().replace(/\s+/g, "_"));
                  }
                }}
                className="text-xs"
                required
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Role Code (Unique Uppercase Key)</label>
              <Input
                placeholder="e.g. ASSISTANT_HR_MANAGER"
                value={newRoleCode}
                onChange={(e) => setNewRoleCode(e.target.value.toUpperCase())}
                className="text-xs font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Description</label>
              <Input
                placeholder="Description of the role privileges..."
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Scope Area / Division Boundary</label>
              <select
                value={newRoleScope}
                onChange={(e) => setNewRoleScope(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
              >
                <option value="General">General</option>
                <option value="HR">HR</option>
                <option value="Security Guarding">Security Guarding</option>
                <option value="Facility Management">Facility Management</option>
                <option value="Reports">Reports</option>
                <option value="Settings">Settings</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold text-primary uppercase block mb-0.5">Role Category Type</label>
              <select
                value={newRoleType}
                onChange={(e) => setNewRoleType(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
              >
                <option value="Employee Self-Service">Employee Self-Service</option>
                <option value="White Collar Operations">White Collar Operations</option>
                <option value="Security Guarding Operations">Security Guarding Operations</option>
                <option value="Facility Management Operations">Facility Management Operations</option>
                <option value="IT / System Administration">IT / System Administration</option>
                <option value="Finance / Reports">Finance / Reports</option>
                <option value="Read Only">Read Only</option>
              </select>
            </div>
            <div className="flex justify-end gap-1.5 pt-3 border-t border-outline-variant font-bold">
              <Button type="button" variant="secondary" onClick={() => setIsCreateRoleOpen(false)} className="font-bold text-[10px] py-1 px-3">
                Cancel
              </Button>
              <Button type="submit" className="font-bold text-[10px] py-1 px-3">
                Create Role
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
