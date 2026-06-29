"use client";

import React, { useState, useEffect } from "react";
import { Card, Button, Input, Modal, Badge } from "@ahh-wfm/ui/src";
import { useSession } from "next-auth/react";
import { Employee } from "@ahh-wfm/types";

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

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  
  // General configurations
  const [latencyThreshold, setLatencyThreshold] = useState("200");
  const [offlineSyncInterval, setOfflineSyncInterval] = useState("60");
  const [geofencingRadius, setGeofencingRadius] = useState("100");

  // Tabs: "employeeLogin" | "operationalUsers" | "rolesPermissions" | "operationAccess" | "itAdminAccess" | "general"
  const [activeTab, setActiveTab] = useState<
    "employeeLogin" | "operationalUsers" | "rolesPermissions" | "operationAccess" | "itAdminAccess" | "general"
  >("employeeLogin");

  // Loaded DB data
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [permissions, setPermissions] = useState<SystemPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showRefreshNotice, setShowRefreshNotice] = useState(false);

  // Search & Filter States
  const [loginSearchQuery, setLoginSearchQuery] = useState("");
  const [opSearchQuery, setOpSearchQuery] = useState("");
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  // Manage Login Modal
  const [selectedEmpLogin, setSelectedEmpLogin] = useState<Employee | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [modalUsername, setModalUsername] = useState("");
  const [modalIsLoginEnabled, setModalIsLoginEnabled] = useState(true);
  const [modalSelfServiceEnabled, setModalSelfServiceEnabled] = useState(true);
  const [modalWebAccessEnabled, setModalWebAccessEnabled] = useState(true);
  const [modalMobileAccessEnabled, setModalMobileAccessEnabled] = useState(true);

  // Operational User Modal
  const [selectedOpUser, setSelectedOpUser] = useState<Employee | null>(null);
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [opAssignedRoleIds, setOpAssignedRoleIds] = useState<string[]>([]);
  const [opAllowedWhiteCollar, setOpAllowedWhiteCollar] = useState(true);
  const [opAllowedSecurityGuarding, setOpAllowedSecurityGuarding] = useState(false);
  const [opAllowedFacilityManagement, setOpAllowedFacilityManagement] = useState(false);
  const [opDefaultLanding, setOpDefaultLanding] = useState("/dashboard");
  const [opAllowedCompanyIds, setOpAllowedCompanyIds] = useState<string[]>([]);
  const [isPromotingOp, setIsPromotingOp] = useState(false);
  const [promoteCandidateId, setPromoteCandidateId] = useState("");

  // IT/Admin Modal
  const [selectedAdminUser, setSelectedAdminUser] = useState<Employee | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminAssignedRoleIds, setAdminAssignedRoleIds] = useState<string[]>([]);
  const [isPromotingAdmin, setIsPromotingAdmin] = useState(false);
  const [promoteAdminCandidateId, setPromoteAdminCandidateId] = useState("");

  // Password reset states
  const [newPassword, setNewPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  // Role Management Tab states
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleScope, setNewRoleScope] = useState("Global");
  const [newRoleType, setNewRoleType] = useState("White Collar Operations");
  const [cloneFromRoleId, setCloneFromRoleId] = useState("");
  const [createRoleError, setCreateRoleError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, accountsRes, companiesRes] = await Promise.all([
        fetch("/api/v1/admin/roles"),
        fetch("/api/v1/admin/user-accounts"),
        fetch("/api/v1/companies").catch(() => null)
      ]);

      if (!settingsRes.ok || !accountsRes.ok) {
        throw new Error("Failed to load settings data");
      }

      const settingsData = await settingsRes.json();
      const accountsData = await accountsRes.json();
      const companiesData = companiesRes && companiesRes.ok ? await companiesRes.json() : [];

      setRoles(settingsData.roles || []);
      setPermissions(settingsData.permissions || []);
      setRolePermissions(settingsData.rolePermissions || []);
      setAssignments(settingsData.assignments || []);
      setEmployees(accountsData || []);

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
    fetchData();
  }, []);

  // Helper to categorize roles by roleType
  const getRoleCategory = (r: SystemRole) => {
    if (r.roleType) return r.roleType;
    const name = r.name.toUpperCase();
    if (["SUPER_ADMIN", "SYSTEM_ADMIN", "IT_ADMIN", "APPLICATION_ADMIN", "SETTINGS_ADMIN", "AUDIT_VIEWER", "SAP_ADMIN"].includes(name)) {
      return "IT / System Administration";
    }
    if (["EMPLOYEE_SELF_SERVICE", "EMPLOYEE"].includes(name)) {
      return "Employee Self-Service";
    }
    if (name.startsWith("SECURITY_")) {
      return "Security Guarding Operations";
    }
    if (name.startsWith("FM_")) {
      return "Facility Management Operations";
    }
    if (name.includes("FINANCE") || name.includes("PAYROLL") || name.includes("REPORT")) {
      return "Finance / Reports";
    }
    if (name.includes("READ_ONLY") || name.includes("VIEWER")) {
      return "Read Only";
    }
    return "White Collar Operations";
  };

  // Check if user is an Operational User
  const isUserOperational = (u: Employee) => {
    const userRoleAssignments = (u as any).assignedRoleIds || [];
    const opAccess = (u as any).operationAccess || {};
    
    // Check if user has at least one operational role
    const hasOpRole = userRoleAssignments.some((rId: string) => {
      const role = roles.find(r => r.id === rId);
      if (!role) return false;
      const cat = getRoleCategory(role);
      return cat !== "Employee Self-Service" && cat !== "IT / System Administration";
    });

    const hasOpScope = !!(opAccess.allowedSecurityGuarding || opAccess.allowedFacilityManagement || opAccess.allowedWhiteCollar);
    
    // Fallback: check if the primary employee role is operational
    const primaryRoleCat = u.role ? getRoleCategory({ name: u.role } as any) : "Employee Self-Service";
    const isPrimaryOp = primaryRoleCat !== "Employee Self-Service" && primaryRoleCat !== "IT / System Administration";

    return hasOpRole || hasOpScope || isPrimaryOp;
  };

  // Check if user is an IT/Admin User
  const isUserAdmin = (u: Employee) => {
    const userRoleAssignments = (u as any).assignedRoleIds || [];
    const hasAdminRole = userRoleAssignments.some((rId: string) => {
      const role = roles.find(r => r.id === rId);
      if (!role) return false;
      return getRoleCategory(role) === "IT / System Administration";
    });

    const primaryRoleCat = u.role ? getRoleCategory({ name: u.role } as any) : "Employee Self-Service";
    const isPrimaryAdmin = primaryRoleCat === "IT / System Administration";

    return hasAdminRole || isPrimaryAdmin;
  };

  // 1. Employee Login Access Modal Actions
  const handleOpenLoginModal = (emp: Employee) => {
    setSelectedEmpLogin(emp);
    setModalUsername(emp.username || "");
    setModalIsLoginEnabled(emp.isLoginEnabled !== false);
    setModalSelfServiceEnabled(emp.selfServiceEnabled !== false);
    setModalWebAccessEnabled(emp.webAccessEnabled !== false);
    setModalMobileAccessEnabled(emp.mobileAccessEnabled !== false);
    setNewPassword("");
    setMustChangePassword(false);
    setPasswordResetSuccess(false);
    setIsLoginModalOpen(true);
  };

  const handleSaveLoginAccess = async () => {
    if (!selectedEmpLogin) return;
    setSaveSuccess(null);
    setError(null);

    // Safeguard: Do not allow disabling Super Admin login access
    if (selectedEmpLogin.role === "SUPER_ADMIN" && !modalIsLoginEnabled) {
      setError("Super Admin login access cannot be disabled.");
      return;
    }

    try {
      const userAssignments = (selectedEmpLogin as any).assignedRoleIds || [];
      let newAssignments = [...userAssignments];

      // Auto-assign EMPLOYEE_SELF_SERVICE if enabling login and no roles exist
      if (modalIsLoginEnabled && newAssignments.length === 0) {
        const essRole = roles.find(r => r.name === "EMPLOYEE_SELF_SERVICE");
        if (essRole) newAssignments.push(essRole.id);
      }

      const res = await fetch(`/api/v1/admin/user-accounts/${selectedEmpLogin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: modalUsername.trim() || null,
          isLoginEnabled: modalIsLoginEnabled,
          selfServiceEnabled: modalSelfServiceEnabled,
          webAccessEnabled: modalWebAccessEnabled,
          mobileAccessEnabled: modalMobileAccessEnabled,
          assignedRoleIds: newAssignments
        })
      });

      if (res.ok) {
        setSaveSuccess("Employee login access configuration updated!");
        setShowRefreshNotice(true);
        setIsLoginModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to update login access configuration");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  // 2. Operational Access Modal Actions
  const handleOpenOpModal = (emp: Employee) => {
    setSelectedOpUser(emp);
    const userRoleIds = (emp as any).assignedRoleIds || [];
    setOpAssignedRoleIds(userRoleIds);

    const access = (emp as any).operationAccess || {};
    setOpAllowedWhiteCollar(access.allowedWhiteCollar !== false);
    setOpAllowedSecurityGuarding(!!access.allowedSecurityGuarding);
    setOpAllowedFacilityManagement(!!access.allowedFacilityManagement);
    setOpDefaultLanding(access.defaultLanding || "/dashboard");

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
    setOpAllowedCompanyIds(allowedCompanies);
    setIsOpModalOpen(true);
  };

  const handleSaveOpAccess = async () => {
    if (!selectedOpUser) return;
    setSaveSuccess(null);
    setError(null);

    try {
      let primaryRole = selectedOpUser.role;
      if (opAssignedRoleIds.length > 0) {
        const matchingRole = roles.find(r => r.id === opAssignedRoleIds[0]);
        if (matchingRole) primaryRole = matchingRole.name;
      }

      const res = await fetch(`/api/v1/admin/user-accounts/${selectedOpUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: primaryRole,
          assignedRoleIds: opAssignedRoleIds,
          operationAccess: {
            allowedWhiteCollar: opAllowedWhiteCollar,
            allowedSecurityGuarding: opAllowedSecurityGuarding,
            allowedFacilityManagement: opAllowedFacilityManagement,
            defaultLanding: opDefaultLanding,
            allowedCompanyIds: opAllowedCompanyIds
          }
        })
      });

      if (res.ok) {
        setSaveSuccess("Operational access configuration updated!");
        setShowRefreshNotice(true);
        setIsOpModalOpen(false);
        setIsPromotingOp(false);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save operational configuration");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  const handleRemoveOpAccess = async (emp: Employee) => {
    if (!confirm(`Are you sure you want to remove all operational access from ${emp.name}? This will clear their operational roles and operational scopes, leaving them as a self-service only user.`)) {
      return;
    }
    setSaveSuccess(null);
    setError(null);

    try {
      // Find EMPLOYEE_SELF_SERVICE role to leave as their only role
      const essRole = roles.find(r => r.name === "EMPLOYEE_SELF_SERVICE");
      const assignedRoleIds = essRole ? [essRole.id] : [];

      const res = await fetch(`/api/v1/admin/user-accounts/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "EMPLOYEE_SELF_SERVICE",
          assignedRoleIds,
          operationAccess: {
            allowedWhiteCollar: true,
            allowedSecurityGuarding: false,
            allowedFacilityManagement: false,
            defaultLanding: "/dashboard",
            allowedCompanyIds: []
          }
        })
      });

      if (res.ok) {
        setSaveSuccess(`Operational access removed from ${emp.name}.`);
        setShowRefreshNotice(true);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to demote operational user");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  // 3. IT / Admin Access Modal Actions
  const handleOpenAdminModal = (emp: Employee) => {
    setSelectedAdminUser(emp);
    const userRoleIds = (emp as any).assignedRoleIds || [];
    setAdminAssignedRoleIds(userRoleIds);
    setIsAdminModalOpen(true);
  };

  const handleSaveAdminAccess = async () => {
    if (!selectedAdminUser) return;
    setSaveSuccess(null);
    setError(null);

    // Safeguard: Super Admin cannot be demoted from Super Admin role
    if (selectedAdminUser.role === "SUPER_ADMIN") {
      const saRole = roles.find(r => r.name === "SUPER_ADMIN");
      if (saRole && !adminAssignedRoleIds.includes(saRole.id)) {
        setError("Super Admin role cannot be unassigned from this account.");
        return;
      }
    }

    try {
      let primaryRole = selectedAdminUser.role;
      if (adminAssignedRoleIds.length > 0) {
        const matchingRole = roles.find(r => r.id === adminAssignedRoleIds[0]);
        if (matchingRole) primaryRole = matchingRole.name;
      }

      const res = await fetch(`/api/v1/admin/user-accounts/${selectedAdminUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: primaryRole,
          assignedRoleIds: adminAssignedRoleIds
        })
      });

      if (res.ok) {
        setSaveSuccess("IT/Admin roles configurations updated!");
        setShowRefreshNotice(true);
        setIsAdminModalOpen(false);
        setIsPromotingAdmin(false);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save admin roles");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  const handleRemoveAdminAccess = async (emp: Employee) => {
    // Safeguard: Block removing Super Admin admin role
    if (emp.role === "SUPER_ADMIN") {
      alert("Super Admin account cannot be disabled or demoted from IT/Admin console.");
      return;
    }

    if (!confirm(`Are you sure you want to remove all system administration access from ${emp.name}?`)) {
      return;
    }
    setSaveSuccess(null);
    setError(null);

    try {
      // Filter out any IT/Admin roles from role assignments
      const userAssignments = (emp as any).assignedRoleIds || [];
      const nonAdminRoleIds = userAssignments.filter((rId: string) => {
        const r = roles.find(x => x.id === rId);
        return r && getRoleCategory(r) !== "IT / System Administration";
      });

      // Default fallback if all roles are cleared
      if (nonAdminRoleIds.length === 0) {
        const essRole = roles.find(r => r.name === "EMPLOYEE_SELF_SERVICE");
        if (essRole) nonAdminRoleIds.push(essRole.id);
      }

      const matchingRole = roles.find(r => r.id === nonAdminRoleIds[0]);
      const primaryRole = matchingRole ? matchingRole.name : "EMPLOYEE_SELF_SERVICE";

      const res = await fetch(`/api/v1/admin/user-accounts/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: primaryRole,
          assignedRoleIds: nonAdminRoleIds
        })
      });

      if (res.ok) {
        setSaveSuccess(`System administration access removed from ${emp.name}.`);
        setShowRefreshNotice(true);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to demote IT admin user");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  // Password reset helper
  const handleResetPassword = async (empId: string) => {
    if (!newPassword.trim()) return;
    setPasswordResetSuccess(false);
    setError(null);

    try {
      const res = await fetch(`/api/v1/admin/user-accounts/${empId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempPassword: newPassword,
          forceChange: mustChangePassword
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
      setError(err.message || "Network error");
    }
  };

  // Compute live effective permissions preview for edit modal
  const getOpEffectivePermissions = () => {
    const grantedPermIds = new Set<string>();
    for (const rId of opAssignedRoleIds) {
      const role = roles.find(r => r.id === rId);
      if (!role || !role.isActive) continue;

      const rolePerms = rolePermissions.filter(rp => rp.roleId === rId);
      for (const rp of rolePerms) {
        if (rp.canView || rp.canCreate || rp.canEdit || rp.canDelete || rp.canApprove || rp.canExport) {
          grantedPermIds.add(rp.permissionId);
        }
      }
    }
    return permissions.filter(p => grantedPermIds.has(p.id));
  };

  const getAdminEffectivePermissions = () => {
    const grantedPermIds = new Set<string>();
    for (const rId of adminAssignedRoleIds) {
      const role = roles.find(r => r.id === rId);
      if (!role || !role.isActive) continue;

      const rolePerms = rolePermissions.filter(rp => rp.roleId === rId);
      for (const rp of rolePerms) {
        if (rp.canView || rp.canCreate || rp.canEdit || rp.canDelete || rp.canApprove || rp.canExport) {
          grantedPermIds.add(rp.permissionId);
        }
      }
    }
    return permissions.filter(p => grantedPermIds.has(p.id));
  };

  // Roles Tab Methods
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateRoleError(null);
    if (!newRoleName.trim()) {
      setCreateRoleError("Role name is required");
      return;
    }

    try {
      const res = await fetch("/api/v1/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDesc.trim(),
          scope: newRoleScope,
          roleType: newRoleType,
          cloneFromRoleId: cloneFromRoleId || undefined
        })
      });

      if (res.ok) {
        const createdRole = await res.json();
        setIsCreateRoleOpen(false);
        setNewRoleName("");
        setNewRoleDesc("");
        setNewRoleScope("Global");
        setCloneFromRoleId("");
        await fetchData();
        setSelectedRoleId(createdRole.id);
        setSaveSuccess(`Role "${createdRole.name}" created successfully!`);
      } else {
        const err = await res.json();
        setCreateRoleError(err.error || "Failed to create role");
      }
    } catch (err) {
      setCreateRoleError("Network error occurred");
    }
  };

  const handleSaveRoleMatrix = async () => {
    const role = roles.find(r => r.id === selectedRoleId);
    if (!role) return;
    
    setSaveSuccess(null);
    setError(null);

    if (role.isSystemDefault || role.isEditable === false) {
      setError("Default system roles are read-only. Please create a custom role or clone it to customize.");
      return;
    }

    try {
      const currentRolePerms = rolePermissions.filter(rp => rp.roleId === selectedRoleId);
      
      const res = await fetch("/api/v1/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRoleId,
          systemRoleData: {
            description: role.description,
            isActive: role.isActive,
            scope: role.scope,
            roleType: role.roleType
          },
          permissions: currentRolePerms
        })
      });

      if (res.ok) {
        setSaveSuccess("Role permissions matrix saved successfully!");
        setShowRefreshNotice(true);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save permissions matrix");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    if (role.isSystemDefault || role.isEditable === false) {
      alert("Default system roles cannot be deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete custom role "${role.name}"? This will unassign it from all users.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/roles?roleId=${roleId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setSaveSuccess("Role deleted successfully.");
        setSelectedRoleId(roles[0]?.id || "");
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete role");
      }
    } catch (err) {
      alert("Network error");
    }
  };

  const handleToggleMatrixCheckbox = (permId: string, field: keyof Omit<RolePermission, "id" | "roleId" | "permissionId">) => {
    setRolePermissions(prev =>
      prev.map(rp => {
        if (rp.roleId === selectedRoleId && rp.permissionId === permId) {
          return { ...rp, [field]: !rp[field] };
        }
        return rp;
      })
    );
  };

  const handleModuleBulkToggle = (moduleName: string, state: boolean) => {
    const modulePermIds = permissions.filter(p => p.module === moduleName).map(p => p.id);
    setRolePermissions(prev =>
      prev.map(rp => {
        if (rp.roleId === selectedRoleId && modulePermIds.includes(rp.permissionId)) {
          return {
            ...rp,
            canView: state,
            canCreate: state,
            canEdit: state,
            canDelete: state,
            canApprove: state,
            canExport: state
          };
        }
        return rp;
      })
    );
  };

  // Group permissions by module
  const permissionsByModule = permissions.reduce<Record<string, SystemPermission[]>>((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  // Filters candidates for promotion who are NOT currently operational
  const nonOpEmployees = employees.filter(e => e.isLoginEnabled && !isUserOperational(e));

  // Filters candidates for IT/Admin who are NOT currently admins
  const nonAdminEmployees = employees.filter(e => e.isLoginEnabled && !isUserAdmin(e));

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-primary-container via-surface-container-high to-surface border border-outline-variant rounded-2xl p-6 shadow-md">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2 tracking-tight">
            <span className="material-symbols-outlined text-secondary text-3xl">admin_panel_settings</span>
            <span>User Access Management Console</span>
          </h1>
          <p className="text-xs text-on-surface-variant font-medium mt-1">
            Configure employee login attributes, manage operational boundaries, define granular role privileges, and supervise IT admin access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData} className="font-bold flex items-center gap-1.5 text-xs">
            <span className="material-symbols-outlined text-base">sync</span>
            Refetch System Data
          </Button>
        </div>
      </div>

      {/* Save Success Notice */}
      {showRefreshNotice && (
        <div className="bg-status-success/10 border border-status-success text-status-success p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">info</span>
            <div className="text-xs font-bold">
              Configurations Updated! User session changes will reflect instantly. Click below to refresh your own session tokens.
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="xs" onClick={() => {
              if (updateSession) updateSession();
              window.location.reload();
            }} className="font-bold">
              Hot-Reload My Session
            </Button>
            <Button size="xs" variant="secondary" onClick={() => setShowRefreshNotice(false)} className="font-bold">
              Dismiss Notice
            </Button>
          </div>
        </div>
      )}

      {saveSuccess && !showRefreshNotice && (
        <div className="bg-status-success/15 border border-status-success text-status-success p-3 rounded-lg text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          <span>{saveSuccess}</span>
        </div>
      )}

      {error && (
        <div className="bg-status-error/15 border border-status-error text-status-error p-3 rounded-lg text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Access Management Sub-Tabs */}
      <div className="flex border-b border-outline-variant gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => { setActiveTab("employeeLogin"); setSaveSuccess(null); setError(null); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "employeeLogin"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-sm">login</span>
          Employee Login Access
        </button>
        <button
          onClick={() => { setActiveTab("operationalUsers"); setSaveSuccess(null); setError(null); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "operationalUsers"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-sm">engineering</span>
          Operational Users
        </button>
        <button
          onClick={() => { setActiveTab("rolesPermissions"); setSaveSuccess(null); setError(null); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "rolesPermissions"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-sm">shield_person</span>
          Roles & Permissions
        </button>
        <button
          onClick={() => { setActiveTab("operationAccess"); setSaveSuccess(null); setError(null); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "operationAccess"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-sm">domain_verification</span>
          Operation Access
        </button>
        <button
          onClick={() => { setActiveTab("itAdminAccess"); setSaveSuccess(null); setError(null); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "itAdminAccess"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
          IT / Admin Access
        </button>
        <button
          onClick={() => { setActiveTab("general"); setSaveSuccess(null); setError(null); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "general"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-sm">settings</span>
          General Settings
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* 1. EMPLOYEE LOGIN ACCESS TAB */}
          {activeTab === "employeeLogin" && (
            <Card className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant pb-4">
                <div>
                  <h2 className="text-md font-black text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-secondary">login</span>
                    <span>Employee Login Access Management</span>
                  </h2>
                  <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                    Manage active directory credentials, system logins, self-service scopes, and app access formats.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Input
                    placeholder="Search employees by name/ID..."
                    value={loginSearchQuery}
                    onChange={(e) => setLoginSearchQuery(e.target.value)}
                    className="text-xs w-full md:w-64"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-outline-variant rounded-xl shadow-inner bg-surface-container-lowest font-medium">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-primary font-bold">
                      <th className="p-3 pl-4">Employee</th>
                      <th className="p-3">Username / Identity</th>
                      <th className="p-3 text-center">Login Access</th>
                      <th className="p-3 text-center">Self-Service Access</th>
                      <th className="p-3 text-center">Web Access</th>
                      <th className="p-3 text-center">Mobile App Access</th>
                      <th className="p-3 text-right pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter(e => {
                      return e.name.toLowerCase().includes(loginSearchQuery.toLowerCase()) || 
                             e.id.toLowerCase().includes(loginSearchQuery.toLowerCase()) ||
                             (e.username && e.username.toLowerCase().includes(loginSearchQuery.toLowerCase()));
                    }).map(e => (
                      <tr key={e.id} className="hover:bg-surface-container-low border-b border-outline-variant text-primary">
                        <td className="p-3 pl-4 font-bold">
                          <div>{e.name}</div>
                          <div className="text-[9px] text-on-surface-variant font-semibold">ID: {e.id} | {e.department}</div>
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {e.username || <span className="text-on-surface-variant italic">Not Set</span>}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={e.isLoginEnabled !== false ? "success" : "secondary"}>
                            {e.isLoginEnabled !== false ? "Enabled" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={e.selfServiceEnabled !== false ? "primary" : "secondary"}>
                            {e.selfServiceEnabled !== false ? "Active" : "Locked"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <span className="material-symbols-outlined text-base">
                            {e.webAccessEnabled !== false ? "check_circle" : "cancel"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="material-symbols-outlined text-base">
                            {e.mobileAccessEnabled !== false ? "check_circle" : "cancel"}
                          </span>
                        </td>
                        <td className="p-3 text-right pr-4">
                          <Button size="xs" onClick={() => handleOpenLoginModal(e)} className="font-bold text-xs ml-auto flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">settings_accessibility</span>
                            Manage Access
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* 2. OPERATIONAL USERS TAB */}
          {activeTab === "operationalUsers" && (
            <Card className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant pb-4">
                <div>
                  <h2 className="text-md font-black text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-secondary">engineering</span>
                    <span>Operational Responsibilities Console</span>
                  </h2>
                  <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                    Displays employees promoted to operational roles. All operation users reside strictly within the Workforce Directory.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Input
                    placeholder="Search operational users..."
                    value={opSearchQuery}
                    onChange={(e) => setOpSearchQuery(e.target.value)}
                    className="text-xs w-full md:w-48"
                  />
                  <Button size="sm" onClick={() => setIsPromotingOp(true)} className="font-bold text-xs whitespace-nowrap">
                    + Promote Operational User
                  </Button>
                </div>
              </div>

              {/* Promote Candidate Bar */}
              {isPromotingOp && (
                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-primary uppercase">Promote Employee to Operational Access</h4>
                    <button onClick={() => setIsPromotingOp(false)} className="text-xs text-on-surface-variant hover:underline font-bold">
                      Cancel
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-on-surface-variant uppercase">Select Candidate (Has Login Enabled)</label>
                      <select
                        value={promoteCandidateId}
                        onChange={(e) => setPromoteCandidateId(e.target.value)}
                        className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                      >
                        <option value="">-- Select Employee --</option>
                        {nonOpEmployees.map(e => (
                          <option key={e.id} value={e.id}>{e.name} ({e.id}) - {e.role || "EMPLOYEE"}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      disabled={!promoteCandidateId}
                      onClick={() => {
                        const target = employees.find(e => e.id === promoteCandidateId);
                        if (target) handleOpenOpModal(target);
                      }}
                      className="font-bold text-xs"
                    >
                      Assign Operational Scope
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border border-outline-variant rounded-xl shadow-inner bg-surface-container-lowest">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-primary font-bold">
                      <th className="p-3 pl-4">Operational User</th>
                      <th className="p-3">Assigned Operational Roles</th>
                      <th className="p-3 text-center">Division Scopes</th>
                      <th className="p-3">Landing</th>
                      <th className="p-3 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter(u => isUserOperational(u)).filter(u => {
                      return u.name.toLowerCase().includes(opSearchQuery.toLowerCase()) || 
                             u.id.toLowerCase().includes(opSearchQuery.toLowerCase());
                    }).map(u => {
                      const userAssignments = (u as any).roleAssignments || [];
                      const roleNames = userAssignments.map((a: any) => {
                        const matchingRole = roles.find(r => r.id === a.roleId);
                        return matchingRole ? matchingRole.name : null;
                      }).filter(Boolean);

                      if (roleNames.length === 0) roleNames.push(u.role);
                      const opAccess = (u as any).operationAccess || {};

                      return (
                        <tr key={u.id} className="hover:bg-surface-container-low border-b border-outline-variant text-primary">
                          <td className="p-3 pl-4 font-bold">
                            <div>{u.name}</div>
                            <div className="text-[10px] text-on-surface-variant font-semibold">ID: {u.id} | {u.role}</div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {roleNames.map((rn: string, idx: number) => (
                                <Badge key={idx} variant="primary" className="text-[9px] font-black uppercase">
                                  {rn}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {opAccess.allowedWhiteCollar !== false && <Badge variant="secondary" className="text-[8px]">WHITE_COLLAR</Badge>}
                              {opAccess.allowedSecurityGuarding && <Badge variant="warning" className="text-[8px]">SECURITY</Badge>}
                              {opAccess.allowedFacilityManagement && <Badge variant="info" className="text-[8px]">FM</Badge>}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-[10px] text-on-surface-variant">
                            {opAccess.defaultLanding || "/dashboard"}
                          </td>
                          <td className="p-3 text-right pr-4 flex gap-1.5 justify-end">
                            <Button size="xs" onClick={() => handleOpenOpModal(u)} className="font-bold text-xs">
                              Edit Access
                            </Button>
                            <Button size="xs" variant="secondary" onClick={() => handleRemoveOpAccess(u)} className="font-bold text-xs text-status-error hover:bg-status-error/5 border-status-error/20">
                              Remove Access
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* 3. ROLES & PERMISSIONS TAB */}
          {activeTab === "rolesPermissions" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Left Column: Roles list */}
              <div className="space-y-4">
                <Card className="p-4 space-y-4">
                  <div className="flex justify-between items-center border-b border-outline-variant pb-2">
                    <div className="space-y-1">
                      <h3 className="text-xs font-black text-primary uppercase">Select Role</h3>
                      <div className="flex items-center gap-1.5">
                        <label className="text-[8px] font-bold text-on-surface-variant uppercase">Filter Type</label>
                        <select
                          value={roleFilter}
                          onChange={(e) => setRoleFilter(e.target.value)}
                          className="bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[9px] text-primary focus:outline-none font-bold"
                        >
                          <option value="All">All Types</option>
                          <option value="Employee Self-Service">Self-Service</option>
                          <option value="White Collar Operations">White Collar</option>
                          <option value="Security Guarding Operations">Security</option>
                          <option value="Facility Management Operations">FM</option>
                          <option value="IT / System Administration">IT/Admin</option>
                          <option value="Finance / Reports">Finance</option>
                          <option value="Read Only">Read Only</option>
                        </select>
                      </div>
                    </div>
                    <Button size="xs" onClick={() => {
                      setNewRoleName("");
                      setNewRoleDesc("");
                      setNewRoleScope("Global");
                      setNewRoleType("White Collar Operations");
                      setCloneFromRoleId("");
                      setIsCreateRoleOpen(true);
                    }} className="font-bold text-[9px] py-1 px-1.5">
                      + Custom
                    </Button>
                  </div>
                  <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                    {roles.filter(r => roleFilter === "All" || getRoleCategory(r) === roleFilter).map(r => {
                      const isSelected = r.id === selectedRoleId;
                      return (
                        <div
                          key={r.id}
                          onClick={() => setSelectedRoleId(r.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-primary-container border-primary text-primary"
                              : "bg-surface hover:bg-surface-container-low border-outline-variant text-on-surface"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{r.name}</span>
                            {r.isSystemDefault || r.isEditable === false ? (
                              <Badge variant="secondary" className="text-[8px] px-1 py-0.5">System</Badge>
                            ) : (
                              <Badge variant="primary" className="text-[8px] px-1 py-0.5">Custom</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-on-surface-variant font-medium mt-1 line-clamp-1">
                            {r.description || "No description provided."}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Badge variant="info" className="text-[8px] px-1">{getRoleCategory(r)}</Badge>
                            <Badge variant={r.isActive ? "success" : "secondary"} className="text-[8px] px-1">
                              {r.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Right Column: Matrix details */}
              <div className="md:col-span-3 space-y-4">
                {selectedRole ? (
                  <div className="space-y-4 font-medium">
                    <Card className="space-y-4">
                      {/* Selected Role Meta Details */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-md font-black text-primary uppercase">{selectedRole.name}</h2>
                            {selectedRole.isSystemDefault || selectedRole.isEditable === false ? (
                              <Badge variant="secondary">Protected Default Role</Badge>
                            ) : (
                              <Badge variant="primary">Customizable Role</Badge>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant mt-1 font-semibold">
                            Configure permissions capability checklist and operational boundaries.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setNewRoleName(`CLONE_${selectedRole.name}`);
                              setNewRoleDesc(`Clone copy of ${selectedRole.name} configurations.`);
                              setNewRoleScope(selectedRole.scope || "Global");
                              setNewRoleType(getRoleCategory(selectedRole));
                              setCloneFromRoleId(selectedRole.id);
                              setIsCreateRoleOpen(true);
                            }}
                            className="font-bold text-xs"
                          >
                            Clone Role
                          </Button>
                          {!selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDeleteRole(selectedRole.id)}
                              className="font-bold text-xs text-status-error hover:bg-status-error/5"
                            >
                              Delete Role
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Modify Metadata block */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-primary uppercase block mb-1">Description</label>
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
                          <label className="text-[10px] font-bold text-primary uppercase block mb-1">Scope</label>
                          <select
                            value={selectedRole.scope || "Global"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRoles(prev => prev.map(r => r.id === selectedRoleId ? { ...r, scope: val } : r));
                            }}
                            disabled={selectedRole.isSystemDefault || selectedRole.isEditable === false}
                            className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                          >
                            <option value="Global">Global (All Modules)</option>
                            <option value="Security Guarding">Security Guarding</option>
                            <option value="Facility Management">Facility Management</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-primary uppercase block mb-1 font-black">Role Category Type</label>
                          <select
                            value={selectedRole.roleType || getRoleCategory(selectedRole)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRoles(prev => prev.map(r => r.id === selectedRoleId ? { ...r, roleType: val } : r));
                            }}
                            disabled={selectedRole.isSystemDefault || selectedRole.isEditable === false}
                            className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
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
                        <div className="flex items-center gap-2 pt-2 md:col-span-3">
                          <input
                            type="checkbox"
                            id="role-active-chk"
                            checked={selectedRole.isActive}
                            onChange={() => {
                              setRoles(prev => prev.map(r => r.id === selectedRoleId ? { ...r, isActive: !r.isActive } : r));
                            }}
                            disabled={selectedRole.isSystemDefault || selectedRole.isEditable === false}
                            className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer disabled:opacity-40"
                          />
                          <label htmlFor="role-active-chk" className="text-xs font-bold text-primary uppercase select-none cursor-pointer">
                            Role is Active (Only active roles contribute permissions)
                          </label>
                        </div>
                      </div>
                    </Card>

                    {/* Grouped Permissions Checklist Matrix */}
                    <Card className="space-y-4">
                      <div className="flex justify-between items-center border-b border-outline-variant pb-2">
                        <h3 className="text-xs font-black text-primary uppercase">Granular Permissions Matrix</h3>
                        {selectedRole.isSystemDefault || selectedRole.isEditable === false && (
                          <span className="text-[10px] text-status-warning font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">lock</span>
                            Read Only Matrix
                          </span>
                        )}
                      </div>

                      <div className="space-y-6">
                        {Object.entries(permissionsByModule).map(([moduleName, permList]) => {
                          const isModuleScopeRestricted = 
                            (selectedRole.scope === "Security Guarding" && moduleName === "Facility Management") ||
                            (selectedRole.scope === "Facility Management" && moduleName === "Security Guarding");

                          if (isModuleScopeRestricted) return null;

                          return (
                            <div key={moduleName} className="border border-outline-variant rounded-xl overflow-hidden shadow-sm bg-surface-container-lowest">
                              <div className="bg-surface-container-low px-4 py-2.5 border-b border-outline-variant flex justify-between items-center">
                                <h4 className="text-xs font-black text-secondary uppercase tracking-wider">{moduleName}</h4>
                                {!selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleModuleBulkToggle(moduleName, true)}
                                      className="text-[9px] font-black text-primary hover:underline uppercase"
                                    >
                                      Select All
                                    </button>
                                    <span className="text-[9px] text-outline">|</span>
                                    <button
                                      onClick={() => handleModuleBulkToggle(moduleName, false)}
                                      className="text-[9px] font-black text-status-error hover:underline uppercase"
                                    >
                                      Clear All
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="divide-y divide-outline-variant max-h-72 overflow-y-auto">
                                {permList.map(p => {
                                  const rp = rolePermissions.find(x => x.roleId === selectedRoleId && x.permissionId === p.id);
                                  const isChecked = !!(rp?.canView || rp?.canCreate || rp?.canEdit || rp?.canDelete || rp?.canApprove || rp?.canExport);

                                  return (
                                    <div key={p.id} className="p-3 hover:bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                      <div>
                                        <div className="font-bold text-primary">{p.label}</div>
                                        <div className="text-[9px] font-mono text-on-surface-variant font-medium mt-0.5">{p.key}</div>
                                      </div>
                                      <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-1.5 font-bold">
                                          <input
                                            type="checkbox"
                                            id={`chk-${p.id}`}
                                            checked={isChecked}
                                            disabled={selectedRole.isSystemDefault || selectedRole.isEditable === false}
                                            onChange={() => handleToggleMatrixCheckbox(p.id, "canView")}
                                            className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer disabled:opacity-40"
                                          />
                                          <label htmlFor={`chk-${p.id}`} className="font-bold text-primary select-none cursor-pointer uppercase text-[10px]">
                                            Grant Capability
                                          </label>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    {/* Footer buttons */}
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={fetchData} className="font-bold text-xs">
                        Discard Changes
                      </Button>
                      <Button
                        onClick={handleSaveRoleMatrix}
                        disabled={selectedRole.isSystemDefault || selectedRole.isEditable === false}
                        className="font-bold text-xs"
                      >
                        Save Role Configurations
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Card className="text-center py-16 text-xs text-on-surface-variant font-medium">
                    No roles created or selected. Click "Add Custom" to create one.
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* 4. OPERATION ACCESS GRID TAB */}
          {activeTab === "operationAccess" && (
            <Card className="space-y-4">
              <div className="border-b border-outline-variant pb-4">
                <h2 className="text-md font-black text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary">domain_verification</span>
                  <span>Operational Boundaries Access Console</span>
                </h2>
                <p className="text-xs text-on-surface-variant font-medium mt-1">
                  Cross-business division mappings. Controls which company portfolios and divisions (White Collar, Security, FM) employees can query.
                </p>
              </div>

              <div className="overflow-x-auto border border-outline-variant rounded-xl shadow-inner bg-surface-container-lowest font-medium">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-primary font-bold">
                      <th className="p-3 pl-4">User Details</th>
                      <th className="p-3 text-center">White Collar Access</th>
                      <th className="p-3 text-center">Security Guarding</th>
                      <th className="p-3 text-center">Facility Management</th>
                      <th className="p-3">Allowed Companies Scope</th>
                      <th className="p-3">Landing Route</th>
                      <th className="p-3 text-right pr-4">Edit Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter(e => isUserOperational(e)).map(u => {
                      const opAccess = (u as any).operationAccess || {};
                      
                      let companyCodes: string[] = [];
                      if (opAccess.allowedCompanyIds) {
                        const companyIds: string[] = Array.isArray(opAccess.allowedCompanyIds) 
                          ? opAccess.allowedCompanyIds 
                          : JSON.parse(opAccess.allowedCompanyIds || "[]");
                        
                        companyCodes = companyIds.map(cId => {
                          const c = companies.find(comp => comp.id === cId);
                          return c ? c.companyCode : null;
                        }).filter(Boolean) as string[];
                      }

                      return (
                        <tr key={u.id} className="hover:bg-surface-container-low border-b border-outline-variant text-primary font-bold">
                          <td className="p-3 pl-4">
                            <div>{u.name}</div>
                            <div className="text-[10px] text-on-surface-variant font-semibold">ID: {u.id}</div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="material-symbols-outlined text-base text-status-success">
                              {opAccess.allowedWhiteCollar !== false ? "check_circle" : "cancel"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="material-symbols-outlined text-base text-status-warning">
                              {opAccess.allowedSecurityGuarding ? "check_circle" : "cancel"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="material-symbols-outlined text-base text-status-info">
                              {opAccess.allowedFacilityManagement ? "check_circle" : "cancel"}
                            </span>
                          </td>
                          <td className="p-3">
                            {companyCodes.length === 0 ? (
                              <span className="text-[10px] text-on-surface-variant font-medium">All Companies (Global)</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {companyCodes.map((cc, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-[9px]">{cc}</Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[10px] text-on-surface-variant">
                            {opAccess.defaultLanding || "/dashboard"}
                          </td>
                          <td className="p-3 text-right pr-4">
                            <Button size="xs" onClick={() => handleOpenOpModal(u)} className="font-bold text-xs ml-auto flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">edit</span>
                              Edit Access
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* 5. IT / ADMIN ACCESS TAB */}
          {activeTab === "itAdminAccess" && (
            <Card className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant pb-4">
                <div>
                  <h2 className="text-md font-black text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-secondary">admin_panel_settings</span>
                    <span>System Administration & IT Access Control</span>
                  </h2>
                  <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                    Separate control panel for IT administrators. System admin access does NOT automatically grant business operation scope access.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Input
                    placeholder="Search admin users..."
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    className="text-xs w-full md:w-48"
                  />
                  <Button size="sm" onClick={() => setIsPromotingAdmin(true)} className="font-bold text-xs whitespace-nowrap bg-secondary text-on-secondary">
                    + Grant IT / Admin Access
                  </Button>
                </div>
              </div>

              {/* Promote Candidate for Admin Access */}
              {isPromotingAdmin && (
                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-primary uppercase">Grant System Administration Privileges</h4>
                    <button onClick={() => setIsPromotingAdmin(false)} className="text-xs text-on-surface-variant hover:underline font-bold">
                      Cancel
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-on-surface-variant uppercase">Select Candidate (Has Login Enabled)</label>
                      <select
                        value={promoteAdminCandidateId}
                        onChange={(e) => setPromoteAdminCandidateId(e.target.value)}
                        className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                      >
                        <option value="">-- Select Employee --</option>
                        {nonAdminEmployees.map(e => (
                          <option key={e.id} value={e.id}>{e.name} ({e.id}) - {e.role || "EMPLOYEE"}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      disabled={!promoteAdminCandidateId}
                      onClick={() => {
                        const target = employees.find(e => e.id === promoteAdminCandidateId);
                        if (target) handleOpenAdminModal(target);
                      }}
                      className="font-bold text-xs"
                    >
                      Configure Admin Role
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border border-outline-variant rounded-xl shadow-inner bg-surface-container-lowest font-medium">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-primary font-bold">
                      <th className="p-3 pl-4">Administrator</th>
                      <th className="p-3">Assigned IT / Admin Roles</th>
                      <th className="p-3">Profile Link</th>
                      <th className="p-3 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter(u => isUserAdmin(u)).filter(u => {
                      return u.name.toLowerCase().includes(adminSearchQuery.toLowerCase()) || 
                             u.id.toLowerCase().includes(adminSearchQuery.toLowerCase());
                    }).map(u => {
                      const userAssignments = (u as any).roleAssignments || [];
                      const adminRoles = userAssignments.filter((a: any) => {
                        const r = roles.find(x => x.id === a.roleId);
                        return r && getRoleCategory(r) === "IT / System Administration";
                      }).map((a: any) => {
                        const matchingRole = roles.find(r => r.id === a.roleId);
                        return matchingRole ? matchingRole.name : null;
                      }).filter(Boolean);

                      if (adminRoles.length === 0 && u.role) adminRoles.push(u.role);

                      return (
                        <tr key={u.id} className="hover:bg-surface-container-low border-b border-outline-variant text-primary">
                          <td className="p-3 pl-4 font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-secondary text-md">shield</span>
                            <div>
                              <div>{u.name}</div>
                              <div className="text-[9px] text-on-surface-variant font-semibold">ID: {u.id}</div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {adminRoles.map((rn: string, idx: number) => (
                                <Badge key={idx} variant={rn === "SUPER_ADMIN" ? "success" : "secondary"} className="text-[9px] font-black uppercase bg-primary-container text-primary border border-primary/20">
                                  {rn}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-on-surface-variant underline">
                            <a href={`/workforce#employee-${u.id}`} className="hover:text-primary">
                              View Directory Profile
                            </a>
                          </td>
                          <td className="p-3 text-right pr-4 flex gap-1.5 justify-end">
                            <Button size="xs" onClick={() => handleOpenAdminModal(u)} className="font-bold text-xs">
                              Change Role
                            </Button>
                            {u.role !== "SUPER_ADMIN" && (
                              <Button size="xs" variant="secondary" onClick={() => handleRemoveAdminAccess(u)} className="font-bold text-xs text-status-error hover:bg-status-error/5 border-status-error/20">
                                Remove Admin Role
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* 6. GENERAL CONFIGURATIONS TAB */}
          {activeTab === "general" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-medium">
              <Card className="space-y-4">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">wifi_tethering</span>
                  <span>Network Settings</span>
                </h3>
                <p className="text-[11px] text-on-surface-variant">Configure max acceptable API request latency thresholds.</p>
                <div>
                  <label className="text-[10px] font-bold text-primary uppercase block mb-1">Latency Alert Threshold (ms)</label>
                  <Input
                    type="number"
                    value={latencyThreshold}
                    onChange={(e) => setLatencyThreshold(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </Card>

              <Card className="space-y-4">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">sync_alt</span>
                  <span>Offline Sync Policies</span>
                </h3>
                <p className="text-[11px] text-on-surface-variant">Configures frequency of device caches offline syncing in seconds.</p>
                <div>
                  <label className="text-[10px] font-bold text-primary uppercase block mb-1">Sync Interval (seconds)</label>
                  <Input
                    type="number"
                    value={offlineSyncInterval}
                    onChange={(e) => setOfflineSyncInterval(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </Card>

              <Card className="space-y-4">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">share_location</span>
                  <span>Geofencing Radius</span>
                </h3>
                <p className="text-[11px] text-on-surface-variant">Max clock in distance deviation permitted in meters.</p>
                <div>
                  <label className="text-[10px] font-bold text-primary uppercase block mb-1">Geofence Distance Limit (meters)</label>
                  <Input
                    type="number"
                    value={geofencingRadius}
                    onChange={(e) => setGeofencingRadius(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </Card>
              
              <div className="md:col-span-3 flex justify-end">
                <Button onClick={() => setSaveSuccess("System general configurations saved successfully!")} className="font-bold text-xs">
                  Save General Settings
                </Button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* A. EMPLOYEE LOGIN ACCESS MODAL */}
      {isLoginModalOpen && selectedEmpLogin && (
        <Modal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          title={`Manage Credentials & Login Access — ${selectedEmpLogin.name}`}
          size="sm"
        >
          <div className="space-y-4 p-1 max-h-[75vh] overflow-y-auto pr-2 font-medium">
            <div className="space-y-2 bg-surface-container-low p-3.5 rounded-lg border border-outline-variant">
              <h4 className="text-[10px] font-black text-secondary uppercase tracking-wider">Account Credentials</h4>
              
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-primary uppercase">Username / ID</label>
                <Input
                  value={modalUsername}
                  onChange={(e) => setModalUsername(e.target.value)}
                  placeholder="manual_username"
                  className="text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label htmlFor="modal-login-toggle" className="text-xs font-bold text-primary cursor-pointer select-none">
                  Enable Login Access
                </label>
                <input
                  type="checkbox"
                  id="modal-login-toggle"
                  checked={modalIsLoginEnabled}
                  onChange={() => setModalIsLoginEnabled(prev => !prev)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label htmlFor="modal-ss-toggle" className="text-xs font-bold text-primary cursor-pointer select-none">
                  Enable Self-Service Features
                </label>
                <input
                  type="checkbox"
                  id="modal-ss-toggle"
                  checked={modalSelfServiceEnabled}
                  onChange={() => setModalSelfServiceEnabled(prev => !prev)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2 bg-surface-container-low p-3.5 rounded-lg border border-outline-variant">
              <h4 className="text-[10px] font-black text-secondary uppercase tracking-wider">Platform Permissions</h4>
              
              <div className="flex items-center justify-between">
                <label htmlFor="modal-web-toggle" className="text-xs font-bold text-primary cursor-pointer select-none">
                  Allow Web Terminal Portal
                </label>
                <input
                  type="checkbox"
                  id="modal-web-toggle"
                  checked={modalWebAccessEnabled}
                  onChange={() => setModalWebAccessEnabled(prev => !prev)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label htmlFor="modal-mobile-toggle" className="text-xs font-bold text-primary cursor-pointer select-none">
                  Allow Mobile Application
                </label>
                <input
                  type="checkbox"
                  id="modal-mobile-toggle"
                  checked={modalMobileAccessEnabled}
                  onChange={() => setModalMobileAccessEnabled(prev => !prev)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                />
              </div>
            </div>

            {/* Reset Password Form */}
            <div className="bg-surface-container-low p-3.5 rounded-lg border border-outline-variant space-y-2.5">
              <h4 className="text-[10px] font-black text-secondary uppercase tracking-wider">Change / Reset Password</h4>
              
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-primary uppercase">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="modal-reset-force-chk"
                  checked={mustChangePassword}
                  onChange={() => setMustChangePassword(prev => !prev)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                />
                <label htmlFor="modal-reset-force-chk" className="text-[10px] font-bold text-primary uppercase cursor-pointer select-none">
                  Force password change next login
                </label>
              </div>

              <Button
                onClick={() => handleResetPassword(selectedEmpLogin.id)}
                disabled={!newPassword.trim()}
                size="sm"
                className="w-full font-bold text-xs"
              >
                Trigger Password Reset
              </Button>

              {passwordResetSuccess && (
                <div className="text-status-success text-[10px] font-bold mt-1.5 flex items-center gap-1 justify-center">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  <span>Credentials updated successfully!</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
              <Button variant="secondary" onClick={() => setIsLoginModalOpen(false)} className="font-bold text-xs">
                Cancel
              </Button>
              <Button onClick={handleSaveLoginAccess} className="font-bold text-xs">
                Save Login Attributes
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* B. OPERATIONAL ACCESS MODAL */}
      {isOpModalOpen && selectedOpUser && (
        <Modal
          isOpen={isOpModalOpen}
          onClose={() => setIsOpModalOpen(false)}
          title={`Operational Access Management — ${selectedOpUser.name}`}
          size="lg"
        >
          <div className="space-y-5 p-1 max-h-[75vh] overflow-y-auto pr-2 font-medium">
            
            {/* Multi-role selection checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-primary uppercase border-b border-outline-variant pb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">shield_person</span>
                <span>Select Operational Roles</span>
              </h4>
              <p className="text-[10px] text-on-surface-variant font-medium">Check one or more active roles. User's permission list is the union of all checked active roles.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-surface-container-low p-3 rounded-lg border border-outline-variant max-h-44 overflow-y-auto">
                {roles.filter(r => {
                  const cat = getRoleCategory(r);
                  return cat !== "Employee Self-Service" && cat !== "IT / System Administration";
                }).map(r => {
                  const isChecked = opAssignedRoleIds.includes(r.id);
                  return (
                    <div key={r.id} className="flex items-center gap-2 hover:bg-surface-container-medium p-1 rounded">
                      <input
                        type="checkbox"
                        id={`op-role-${r.id}`}
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setOpAssignedRoleIds(prev => prev.filter(id => id !== r.id));
                          } else {
                            setOpAssignedRoleIds(prev => [...prev, r.id]);
                          }
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                      />
                      <label htmlFor={`op-role-${r.id}`} className="text-xs font-bold text-primary select-none cursor-pointer flex items-center gap-1">
                        <span>{r.name}</span>
                        {!r.isActive && <Badge variant="secondary" className="text-[8px] scale-90">Inactive</Badge>}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Operation Access Flags checkboxes */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-primary uppercase border-b border-outline-variant pb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">domain_verification</span>
                <span>Allowed Operation Scopes</span>
              </h4>
              <p className="text-[10px] text-on-surface-variant font-medium">Select business scopes user is permitted to query data from.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="op-wc-toggle"
                    checked={opAllowedWhiteCollar}
                    onChange={() => setOpAllowedWhiteCollar(prev => !prev)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                  />
                  <label htmlFor="op-wc-toggle" className="text-xs font-bold text-primary select-none cursor-pointer">WHITE_COLLAR</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="op-sg-toggle"
                    checked={opAllowedSecurityGuarding}
                    onChange={() => setOpAllowedSecurityGuarding(prev => !prev)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                  />
                  <label htmlFor="op-sg-toggle" className="text-xs font-bold text-primary select-none cursor-pointer">SECURITY_GUARDING</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="op-fm-toggle"
                    checked={opAllowedFacilityManagement}
                    onChange={() => setOpAllowedFacilityManagement(prev => !prev)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                  />
                  <label htmlFor="op-fm-toggle" className="text-xs font-bold text-primary select-none cursor-pointer">FACILITY_MANAGEMENT</label>
                </div>
              </div>
            </div>

            {/* Default Landing route */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-primary uppercase block mb-1">Default Landing Route</label>
                <Input
                  value={opDefaultLanding}
                  onChange={(e) => setOpDefaultLanding(e.target.value)}
                  className="text-xs font-mono"
                  placeholder="/dashboard"
                />
              </div>
            </div>

            {/* Allowed Companies multi-select checklist */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-primary uppercase block">Allowed Company Scope (Select none for Global Access)</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                {companies.map(c => {
                  const isChecked = opAllowedCompanyIds.includes(c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`op-comp-${c.id}`}
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setOpAllowedCompanyIds(prev => prev.filter(id => id !== c.id));
                          } else {
                            setOpAllowedCompanyIds(prev => [...prev, c.id]);
                          }
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                      />
                      <label htmlFor={`op-comp-${c.id}`} className="text-xs font-semibold text-primary select-none cursor-pointer" title={c.companyName}>
                        {c.companyCode}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Effective Permissions Preview */}
            <div className="bg-surface-container-medium border border-outline-variant rounded-xl p-3.5 space-y-2">
              <h4 className="text-xs font-black text-secondary uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>Live Effective Permissions Preview ({getOpEffectivePermissions().length})</span>
              </h4>
              
              {getOpEffectivePermissions().length === 0 ? (
                <div className="text-center py-6 text-[11px] text-on-surface-variant font-semibold bg-surface rounded border border-dashed border-outline-variant">
                  No permissions active. Check at least one active operational role above.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-surface rounded border border-outline-variant">
                  {getOpEffectivePermissions().map(p => (
                    <span key={p.id} className="text-[9px] bg-primary-container text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      {p.key}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
              <Button variant="secondary" onClick={() => setIsOpModalOpen(false)} className="font-bold text-xs">
                Cancel
              </Button>
              <Button onClick={handleSaveOpAccess} className="font-bold text-xs">
                Save Operational Attributes
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* C. IT / ADMIN ACCESS MODAL */}
      {isAdminModalOpen && selectedAdminUser && (
        <Modal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          title={`Configure IT / Admin Access — ${selectedAdminUser.name}`}
          size="lg"
        >
          <div className="space-y-5 p-1 max-h-[75vh] overflow-y-auto pr-2 font-medium">
            
            <div className="bg-status-warning/10 border border-status-warning/30 p-3 rounded-lg text-xs text-status-warning font-bold flex items-start gap-2">
              <span className="material-symbols-outlined mt-0.5">warning</span>
              <div>
                IT/Admin access grants full administrative capabilities. This does NOT automatically grant access to business data/dashboards (Security or FM) unless operational scopes are configured.
              </div>
            </div>

            {/* Select IT admin roles */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-primary uppercase border-b border-outline-variant pb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                <span>Select Admin Roles</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-surface-container-low p-3 rounded-lg border border-outline-variant max-h-44 overflow-y-auto">
                {roles.filter(r => getRoleCategory(r) === "IT / System Administration").map(r => {
                  const isChecked = adminAssignedRoleIds.includes(r.id);
                  return (
                    <div key={r.id} className="flex items-center gap-2 hover:bg-surface-container-medium p-1 rounded">
                      <input
                        type="checkbox"
                        id={`admin-role-${r.id}`}
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setAdminAssignedRoleIds(prev => prev.filter(id => id !== r.id));
                          } else {
                            setAdminAssignedRoleIds(prev => [...prev, r.id]);
                          }
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                      />
                      <label htmlFor={`admin-role-${r.id}`} className="text-xs font-bold text-primary select-none cursor-pointer flex items-center gap-1">
                        <span>{r.name}</span>
                        {!r.isActive && <Badge variant="secondary" className="text-[8px] scale-90">Inactive</Badge>}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Effective Admin Permissions Preview */}
            <div className="bg-surface-container-medium border border-outline-variant rounded-xl p-3.5 space-y-2">
              <h4 className="text-xs font-black text-secondary uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>System Administration Permissions Preview ({getAdminEffectivePermissions().length})</span>
              </h4>
              
              {getAdminEffectivePermissions().length === 0 ? (
                <div className="text-center py-6 text-[11px] text-on-surface-variant font-semibold bg-surface rounded border border-dashed border-outline-variant">
                  No admin permissions active. Check at least one active IT/Admin role above.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-surface rounded border border-outline-variant">
                  {getAdminEffectivePermissions().map(p => (
                    <span key={p.id} className="text-[9px] bg-secondary text-on-secondary px-2 py-0.5 rounded-full font-bold">
                      {p.key}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
              <Button variant="secondary" onClick={() => setIsAdminModalOpen(false)} className="font-bold text-xs">
                Cancel
              </Button>
              <Button onClick={handleSaveAdminAccess} className="font-bold text-xs">
                Save IT / Admin Configurations
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* D. CREATE / CLONE ROLE MODAL */}
      {isCreateRoleOpen && (
        <Modal
          isOpen={isCreateRoleOpen}
          onClose={() => setIsCreateRoleOpen(false)}
          title={cloneFromRoleId ? "Clone & Customize Role" : "Create Custom Role"}
          size="sm"
        >
          <form onSubmit={handleCreateRole} className="space-y-4 p-1 font-medium">
            {createRoleError && (
              <div className="bg-status-error/15 border border-status-error text-status-error p-3 rounded-lg text-xs font-bold">
                {createRoleError}
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold text-primary uppercase block mb-1">Role Name</label>
              <Input
                placeholder="e.g. ASSISTANT_HR_MANAGER"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="text-xs"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-primary uppercase block mb-1">Description</label>
              <Input
                placeholder="Description of the responsibilities..."
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-primary uppercase block mb-1">Scope</label>
              <select
                value={newRoleScope}
                onChange={(e) => setNewRoleScope(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
              >
                <option value="Global">Global (All Modules)</option>
                <option value="Security Guarding">Security Guarding</option>
                <option value="Facility Management">Facility Management</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-primary uppercase block mb-1">Role Category Type</label>
              <select
                value={newRoleType}
                onChange={(e) => setNewRoleType(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
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
            <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant font-bold">
              <Button type="button" variant="secondary" onClick={() => setIsCreateRoleOpen(false)} className="font-bold text-xs">
                Cancel
              </Button>
              <Button type="submit" className="font-bold text-xs">
                Create Role
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
