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

  // Tabs: "general" | "users" | "roles" | "operationAccess"
  const [activeTab, setActiveTab] = useState<"general" | "users" | "roles" | "operationAccess">("users");

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

  // Search & Filter
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userOperationFilter, setUserOperationFilter] = useState("");

  // Edit User Modal state
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [modalAssignedRoleIds, setModalAssignedRoleIds] = useState<string[]>([]);
  const [modalAllowedWhiteCollar, setModalAllowedWhiteCollar] = useState(true);
  const [modalAllowedSecurityGuarding, setModalAllowedSecurityGuarding] = useState(false);
  const [modalAllowedFacilityManagement, setModalAllowedFacilityManagement] = useState(false);
  const [modalDefaultLanding, setModalDefaultLanding] = useState("/dashboard");
  const [modalAllowedCompanyIds, setModalAllowedCompanyIds] = useState<string[]>([]);
  
  // Password reset modal states
  const [newPassword, setNewPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  // Role Management Tab states
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleScope, setNewRoleScope] = useState("Global");
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

      // Default mock companies fallback if empty
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

  // Compute effective permissions for the user currently being edited in the modal
  const getModalEffectivePermissions = () => {
    const grantedPermIds = new Set<string>();
    
    // Union of selected roles
    for (const rId of modalAssignedRoleIds) {
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

  const handleEditUser = (user: Employee) => {
    setSelectedUser(user);
    const userRoleIds = (user as any).assignedRoleIds || [];
    setModalAssignedRoleIds(userRoleIds);

    const access = (user as any).operationAccess || {};
    setModalAllowedWhiteCollar(access.allowedWhiteCollar !== false);
    setModalAllowedSecurityGuarding(!!access.allowedSecurityGuarding);
    setModalAllowedFacilityManagement(!!access.allowedFacilityManagement);
    setModalDefaultLanding(access.defaultLanding || "/dashboard");
    
    // Parse allowed companies Json/array
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
    setIsEditUserOpen(true);
  };

  const handleSaveUserConfig = async () => {
    if (!selectedUser) return;
    setSaveSuccess(null);
    setError(null);

    // Lockout protection warning check
    if (selectedUser.role === "SUPER_ADMIN") {
      // Super Admin must have super admin role
      const saRole = roles.find(r => r.name === "SUPER_ADMIN");
      if (saRole && !modalAssignedRoleIds.includes(saRole.id)) {
        setError("Super Admin role cannot be removed from this account.");
        return;
      }
    }

    try {
      // Find one role to put as the primary role string in the Employee table (compatibility field)
      let primaryRole = selectedUser.role;
      if (modalAssignedRoleIds.length > 0) {
        const matchingRole = roles.find(r => r.id === modalAssignedRoleIds[0]);
        if (matchingRole) {
          primaryRole = matchingRole.name;
        }
      }

      const res = await fetch(`/api/v1/admin/user-accounts/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        setSaveSuccess("User access configuration updated successfully!");
        setShowRefreshNotice(true);
        setIsEditUserOpen(false);
        fetchData();
        
        // If current logged-in user updated themselves, trigger hot refetch
        if (selectedUser.id === session?.user?.id) {
          if (updateSession) updateSession();
        }
      } else {
        const err = await res.json();
        setError(err.error || "Failed to update user configuration");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword.trim()) return;
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
      setError(err.message || "Network error");
    }
  };

  // Role Management Action handlers
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
          name: newRoleName,
          description: newRoleDesc,
          scope: newRoleScope,
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
      setError("Default system roles are read-only. Please create a custom role or use the Clone feature to customize.");
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
            scope: role.scope
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

  // Filter employees for the user accounts grid
  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                          e.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          e.id.toLowerCase().includes(userSearchQuery.toLowerCase());
    
    const assignedRoles = (e as any).assignedRoleIds || [];
    const matchesRole = !userRoleFilter || assignedRoles.includes(userRoleFilter) || e.role === userRoleFilter;

    const opAccess = (e as any).operationAccess || {};
    let matchesOp = true;
    if (userOperationFilter === "WHITE_COLLAR") matchesOp = opAccess.allowedWhiteCollar !== false;
    else if (userOperationFilter === "SECURITY") matchesOp = opAccess.allowedSecurityGuarding;
    else if (userOperationFilter === "FACILITY") matchesOp = opAccess.allowedFacilityManagement;

    return matchesSearch && matchesRole && matchesOp;
  });

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-primary-container via-surface-container-high to-surface border border-outline-variant rounded-2xl p-6 shadow-md">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2 tracking-tight">
            <span className="material-symbols-outlined text-secondary text-3xl">settings</span>
            <span>Settings & Access Management</span>
          </h1>
          <p className="text-xs text-on-surface-variant font-medium mt-1">
            Redesign and manage general configurations, user accounts, custom roles, and cross-operation data boundaries.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData} className="font-bold flex items-center gap-1.5 text-xs">
            <span className="material-symbols-outlined text-base">sync</span>
            Refetch Data
          </Button>
        </div>
      </div>

      {/* Save success / Refresh banner */}
      {showRefreshNotice && (
        <div className="bg-status-success/10 border border-status-success text-status-success p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">info</span>
            <div className="text-xs font-bold">
              Changes Saved! Affected users must log out and log back in, or refresh their session for database permissions to take full effect.
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
              Dismiss
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

      {/* Navigation Sub-tabs */}
      <div className="flex border-b border-outline-variant gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => { setActiveTab("general"); setSaveSuccess(null); setError(null); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "general"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-sm">tune</span>
          General Configurations
        </button>
        <button
          onClick={() => { setActiveTab("users"); setSaveSuccess(null); setError(null); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "users"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-sm">manage_accounts</span>
          Users & Accounts ({employees.length})
        </button>
        <button
          onClick={() => { setActiveTab("roles"); setSaveSuccess(null); setError(null); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-t-lg transition-all border-b-2 uppercase tracking-wider ${
            activeTab === "roles"
              ? "border-primary text-primary bg-surface-container-low"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-sm">shield_person</span>
          Roles & Permissions Matrix
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
          Operation Access Grid
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* GENERAL CONFIGURATIONS TAB */}
          {activeTab === "general" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          {/* USERS & ACCOUNTS TAB */}
          {activeTab === "users" && (
            <Card className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant pb-4">
                <h2 className="text-md font-black text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary">group</span>
                  <span>System Users Directory</span>
                </h2>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <Input
                    placeholder="Search users..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="text-xs w-full md:w-48"
                  />
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Roles</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                  <select
                    value={userOperationFilter}
                    onChange={(e) => setUserOperationFilter(e.target.value)}
                    className="bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Operations</option>
                    <option value="WHITE_COLLAR">White Collar Only</option>
                    <option value="SECURITY">Security Guarding Only</option>
                    <option value="FACILITY">Facility Management Only</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto border border-outline-variant rounded-xl shadow-inner bg-surface-container-lowest">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-primary font-bold">
                      <th className="p-3 pl-4">User Details</th>
                      <th className="p-3">Assigned Roles</th>
                      <th className="p-3">Operational Access</th>
                      <th className="p-3">Allowed Companies</th>
                      <th className="p-3 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-on-surface-variant font-semibold">
                          No users matched search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map(u => {
                        const assignedRoles = (u as any).roleAssignments || [];
                        const opAccess = (u as any).operationAccess || {};

                        // Resolve role names
                        const roleNames = assignedRoles.map((a: any) => {
                          const matchingRole = roles.find(r => r.id === a.roleId);
                          return matchingRole ? matchingRole.name : null;
                        }).filter(Boolean);

                        // If no database roles exist, fall back to employee.role
                        if (roleNames.length === 0) {
                          roleNames.push(u.role);
                        }

                        // Parse companies
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
                          <tr key={u.id} className="hover:bg-surface-container-low border-b border-outline-variant text-primary">
                            <td className="p-3 pl-4 font-bold">
                              <div>{u.name}</div>
                              <div className="text-[10px] text-on-surface-variant font-medium mt-0.5">{u.email}</div>
                              <div className="text-[9px] font-mono text-on-surface-variant mt-0.5">ID: {u.id}</div>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1.5">
                                {roleNames.map((rn: string, idx: number) => (
                                  <Badge key={idx} variant={rn === "SUPER_ADMIN" ? "success" : "secondary"} className="text-[9px] font-black uppercase">
                                    {rn}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {opAccess.allowedWhiteCollar !== false && (
                                  <Badge variant="primary" className="text-[9px]">White Collar</Badge>
                                )}
                                {opAccess.allowedSecurityGuarding && (
                                  <Badge variant="warning" className="text-[9px]">Security</Badge>
                                )}
                                {opAccess.allowedFacilityManagement && (
                                  <Badge variant="info" className="text-[9px]">FM</Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              {companyCodes.length === 0 ? (
                                <span className="text-[10px] text-on-surface-variant font-semibold">Global (All)</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {companyCodes.map((cc, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-[9px]">{cc}</Badge>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right pr-4">
                              <Button size="xs" onClick={() => handleEditUser(u)} className="font-bold flex items-center gap-1.5 ml-auto text-xs">
                                <span className="material-symbols-outlined text-xs">edit_square</span>
                                Edit Settings
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ROLES & PERMISSIONS TAB */}
          {activeTab === "roles" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              {/* Left Column: Roles list */}
              <div className="space-y-4">
                <Card className="p-4 space-y-4">
                  <div className="flex justify-between items-center border-b border-outline-variant pb-2">
                    <h3 className="text-xs font-black text-primary uppercase">Select Role</h3>
                    <Button size="xs" onClick={() => setIsCreateRoleOpen(true)} className="font-bold text-[10px] py-1 px-2">
                      + Add Custom
                    </Button>
                  </div>
                  <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                    {roles.map(r => {
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
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={r.isActive ? "success" : "secondary"} className="text-[8px] px-1">
                              {r.isActive ? "Active" : "Inactive"}
                            </Badge>
                            {r.scope && (
                              <Badge variant="info" className="text-[8px] px-1">
                                {r.scope}
                              </Badge>
                            )}
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
                  <div className="space-y-4">
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
                          <p className="text-xs text-on-surface-variant mt-1 font-medium">
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
                            className="text-xs"
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
                            className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="Global">Global (All Modules)</option>
                            <option value="Security Guarding">Security Guarding</option>
                            <option value="Facility Management">Facility Management</option>
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
                                        <div className="flex items-center gap-1.5">
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
                        Discard
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

          {/* OPERATION ACCESS GRID TAB */}
          {activeTab === "operationAccess" && (
            <Card className="space-y-4">
              <div className="border-b border-outline-variant pb-4">
                <h2 className="text-md font-black text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary">domain_verification</span>
                  <span>Operational Boundaries Access Console</span>
                </h2>
                <p className="text-xs text-on-surface-variant font-medium mt-1">
                  Cross-business division mappings. Assures Security Guarding users are locked out from Facility Management screens and vice versa.
                </p>
              </div>

              <div className="overflow-x-auto border border-outline-variant rounded-xl shadow-inner bg-surface-container-lowest">
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
                    {employees.map(u => {
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
                            <div className="text-[10px] text-on-surface-variant font-medium">ID: {u.id}</div>
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
                              <span className="text-[10px] text-on-surface-variant font-medium">All Companies</span>
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
                            <Button size="xs" onClick={() => handleEditUser(u)} className="font-bold flex items-center gap-1.5 ml-auto text-xs">
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

        </div>
      )}

      {/* EDIT USER ACCOUNT MODAL */}
      {isEditUserOpen && selectedUser && (
        <Modal
          isOpen={isEditUserOpen}
          onClose={() => setIsEditUserOpen(false)}
          title={`Edit User Access — ${selectedUser.name}`}
          size="lg"
        >
          <div className="space-y-5 p-1 max-h-[75vh] overflow-y-auto pr-2">
            {/* Multi-role selection checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-primary uppercase border-b border-outline-variant pb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">shield_person</span>
                <span>Assign Active Roles</span>
              </h4>
              <p className="text-[10px] text-on-surface-variant font-medium">Select one or more active roles. User's permission list is the union of all checked active roles.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-surface-container-low p-3 rounded-lg border border-outline-variant max-h-44 overflow-y-auto">
                {roles.map(r => {
                  const isChecked = modalAssignedRoleIds.includes(r.id);
                  return (
                    <div key={r.id} className="flex items-center gap-2 hover:bg-surface-container-medium p-1 rounded">
                      <input
                        type="checkbox"
                        id={`modal-role-${r.id}`}
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setModalAssignedRoleIds(prev => prev.filter(id => id !== r.id));
                          } else {
                            setModalAssignedRoleIds(prev => [...prev, r.id]);
                          }
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                      />
                      <label htmlFor={`modal-role-${r.id}`} className="text-xs font-bold text-primary select-none cursor-pointer flex items-center gap-1">
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
                <span>Operation Access Restrictions</span>
              </h4>
              <p className="text-[10px] text-on-surface-variant font-medium">Select operational divisions allowed for this user.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modal-op-wc"
                    checked={modalAllowedWhiteCollar}
                    onChange={() => setModalAllowedWhiteCollar(prev => !prev)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                  />
                  <label htmlFor="modal-op-wc" className="text-xs font-bold text-primary select-none cursor-pointer">White Collar</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modal-op-sg"
                    checked={modalAllowedSecurityGuarding}
                    onChange={() => setModalAllowedSecurityGuarding(prev => !prev)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                  />
                  <label htmlFor="modal-op-sg" className="text-xs font-bold text-primary select-none cursor-pointer">Security Guarding</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modal-op-fm"
                    checked={modalAllowedFacilityManagement}
                    onChange={() => setModalAllowedFacilityManagement(prev => !prev)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                  />
                  <label htmlFor="modal-op-fm" className="text-xs font-bold text-primary select-none cursor-pointer">Facility Management</label>
                </div>
              </div>
            </div>

            {/* Default Landing route */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-primary uppercase block mb-1">Default Landing Route</label>
                <Input
                  value={modalDefaultLanding}
                  onChange={(e) => setModalDefaultLanding(e.target.value)}
                  className="text-xs font-mono"
                  placeholder="/dashboard"
                />
              </div>
            </div>

            {/* Allowed Companies multi-select checklist */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-primary uppercase block">Allowed Companies Scope (Select none for Global Access)</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                {companies.map(c => {
                  const isChecked = modalAllowedCompanyIds.includes(c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`modal-comp-${c.id}`}
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setModalAllowedCompanyIds(prev => prev.filter(id => id !== c.id));
                          } else {
                            setModalAllowedCompanyIds(prev => [...prev, c.id]);
                          }
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                      />
                      <label htmlFor={`modal-comp-${c.id}`} className="text-xs font-semibold text-primary select-none cursor-pointer" title={c.companyName}>
                        {c.companyCode}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dynamically Computed Effective Permissions Preview */}
            <div className="bg-surface-container-medium border border-outline-variant rounded-xl p-3.5 space-y-2">
              <h4 className="text-xs font-black text-secondary uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>Live Effective Permissions Preview ({getModalEffectivePermissions().length})</span>
              </h4>
              <p className="text-[10px] text-on-surface-variant font-medium">Computed live from the union of all active assigned roles checked above.</p>
              
              {getModalEffectivePermissions().length === 0 ? (
                <div className="text-center py-6 text-[11px] text-on-surface-variant font-semibold bg-surface rounded border border-dashed border-outline-variant">
                  No permissions active. Check at least one active role above.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-surface rounded border border-outline-variant">
                  {getModalEffectivePermissions().map(p => (
                    <span key={p.id} className="text-[9px] bg-primary-container text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      {p.key}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Password reset controls */}
            <div className="border-t border-outline-variant pt-4 space-y-3">
              <h4 className="text-xs font-black text-primary uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lock_reset</span>
                <span>Account Security Reset</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-container-low p-3.5 rounded-lg border border-outline-variant">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary uppercase block">New Password</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="text-xs"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="must-change-pwd-chk"
                      checked={mustChangePassword}
                      onChange={() => setMustChangePassword(prev => !prev)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                    />
                    <label htmlFor="must-change-pwd-chk" className="text-[10px] font-bold text-primary uppercase cursor-pointer select-none">
                      Force change password on next login
                    </label>
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <Button
                    onClick={handleResetPassword}
                    disabled={!newPassword.trim()}
                    size="sm"
                    className="font-bold text-xs"
                  >
                    Reset Password
                  </Button>
                  {passwordResetSuccess && (
                    <div className="text-status-success text-[10px] font-bold mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      <span>Password reset successfully!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant mt-4">
            <Button variant="secondary" onClick={() => setIsEditUserOpen(false)} className="font-bold text-xs">
              Cancel
            </Button>
            <Button onClick={handleSaveUserConfig} className="font-bold text-xs">
              Save Configuration
            </Button>
          </div>
        </Modal>
      )}

      {/* CREATE / CLONE ROLE MODAL */}
      {isCreateRoleOpen && (
        <Modal
          isOpen={isCreateRoleOpen}
          onClose={() => setIsCreateRoleOpen(false)}
          title={cloneFromRoleId ? "Clone & Customize Role" : "Create Custom Role"}
          size="sm"
        >
          <form onSubmit={handleCreateRole} className="space-y-4 p-1">
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
                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Global">Global (All Modules)</option>
                <option value="Security Guarding">Security Guarding</option>
                <option value="Facility Management">Facility Management</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
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
