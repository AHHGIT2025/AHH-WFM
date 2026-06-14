"use client";

import React, { useState, useEffect } from "react";
import { Card, Button, Input, Modal, Badge } from "@ahh-wfm/ui/src";
import { Employee } from "@ahh-wfm/types";

interface SystemRole {
  id: string;
  name: string;
  description: string;
  isSystemDefault: boolean;
  isActive: boolean;
}

interface SystemPermission {
  id: string;
  key: string;
  label: string;
  module: string;
}

interface RolePermission {
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

export default function SettingsPage() {
  // Global settings states (retaining existing config)
  const [geoFenceAlert, setGeoFenceAlert] = useState(true);
  const [offlineSync, setOfflineSync] = useState(true);
  const [latencyThreshold, setLatencyThreshold] = useState("200");

  // Active Tab: "config" | "roles"
  const [activeTab, setActiveTab] = useState<"config" | "roles">("roles");

  // Role management states
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [permissions, setPermissions] = useState<SystemPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Custom role dialog
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [createRoleError, setCreateRoleError] = useState<string | null>(null);

  // Assign user state
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState("");
  const [selectedEmployeeToAssign, setSelectedEmployeeToAssign] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, empRes] = await Promise.all([
        fetch("/api/v1/admin/roles"),
        fetch("/api/v1/employees")
      ]);

      if (!settingsRes.ok || !empRes.ok) {
        throw new Error("Failed to load settings data");
      }

      const settingsData = await settingsRes.json();
      const empData = await empRes.json();

      setRoles(settingsData.roles || []);
      setPermissions(settingsData.permissions || []);
      setRolePermissions(settingsData.rolePermissions || []);
      setAssignments(settingsData.assignments || []);
      setEmployees(empData || []);

      if (settingsData.roles && settingsData.roles.length > 0) {
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
          description: newRoleDesc
        })
      });

      if (res.ok) {
        const createdRole = await res.json();
        setIsCreateRoleOpen(false);
        setNewRoleName("");
        setNewRoleDesc("");
        // Reload settings data and select the new role
        await fetchData();
        setSelectedRoleId(createdRole.id);
      } else {
        const err = await res.json();
        setCreateRoleError(err.error || "Failed to create role");
      }
    } catch (err) {
      setCreateRoleError("Network error occurred");
    }
  };

  const getSelectedRole = () => roles.find((r) => r.id === selectedRoleId);

  const getRolePermissionsForSelected = () => {
    return rolePermissions.filter((rp) => rp.roleId === selectedRoleId);
  };

  const handlePermissionToggle = (permissionId: string, field: keyof Omit<RolePermission, "roleId" | "permissionId">) => {
    setRolePermissions((prev) =>
      prev.map((rp) => {
        if (rp.roleId === selectedRoleId && rp.permissionId === permissionId) {
          return {
            ...rp,
            [field]: !rp[field]
          };
        }
        return rp;
      })
    );
  };

  const handleRoleDescriptionChange = (desc: string) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id === selectedRoleId) {
          return { ...r, description: desc };
        }
        return r;
      })
    );
  };

  const handleRoleStatusToggle = () => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id === selectedRoleId) {
          return { ...r, isActive: !r.isActive };
        }
        return r;
      })
    );
  };

  const handleAssignUser = () => {
    if (!selectedEmployeeToAssign) return;

    // Check if already assigned
    const exists = assignments.some(
      (a) => a.employeeId === selectedEmployeeToAssign && a.roleId === selectedRoleId
    );

    if (exists) {
      alert("Employee is already assigned to this role");
      return;
    }

    const newAssignment: UserRoleAssignment = {
      id: `assign-${Date.now()}`,
      employeeId: selectedEmployeeToAssign,
      roleId: selectedRoleId,
      isActive: true
    };

    setAssignments((prev) => [...prev, newAssignment]);
    setSelectedEmployeeToAssign("");
  };

  const handleRemoveAssignment = (employeeId: string) => {
    setAssignments((prev) =>
      prev.filter((a) => !(a.employeeId === employeeId && a.roleId === selectedRoleId))
    );
  };

  const handleSaveRoleConfig = async () => {
    const role = getSelectedRole();
    if (!role) return;

    setSaveSuccess(null);
    setError(null);

    const relevantPermissions = getRolePermissionsForSelected();
    const relevantAssignments = assignments
      .filter((a) => a.roleId === selectedRoleId)
      .map((a) => a.employeeId);

    try {
      const res = await fetch("/api/v1/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRoleId,
          permissions: relevantPermissions,
          assignments: relevantAssignments,
          systemRoleData: {
            description: role.description,
            isActive: role.isActive
          }
        })
      });

      if (res.ok) {
        setSaveSuccess("Role settings updated successfully");
        setTimeout(() => setSaveSuccess(null), 3000);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save settings");
      }
    } catch (err) {
      setError("Network error occurred saving roles settings");
    }
  };

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, p) => {
    if (!acc[p.module]) {
      acc[p.module] = [];
    }
    acc[p.module].push(p);
    return acc;
  }, {} as Record<string, SystemPermission[]>);

  const selectedRole = getSelectedRole();
  const selectedAssignments = assignments.filter((a) => a.roleId === selectedRoleId);
  const assignedEmployees = employees.filter((e) =>
    selectedAssignments.some((sa) => sa.employeeId === e.id)
  );

  // Filter employees for the assignment selector (not already assigned to this role)
  const assignableEmployees = employees.filter(
    (e) =>
      !selectedAssignments.some((sa) => sa.employeeId === e.id) &&
      (e.name.toLowerCase().includes(searchEmployeeQuery.toLowerCase()) ||
        e.id.toLowerCase().includes(searchEmployeeQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-3xl">settings</span>
            <span>System Settings</span>
          </h1>
          <p className="text-sm text-on-surface-variant font-medium">
            Configure system rules, role permission matrices, and system integrations
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap gap-1 bg-surface-container-low border border-outline-variant p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("roles")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === "roles"
                ? "bg-secondary text-white shadow"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-base">admin_panel_settings</span>
            Roles & Permissions
          </button>
          
          
          
          <button
            onClick={() => setActiveTab("config")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === "config"
                ? "bg-secondary text-white shadow"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-base">tune</span>
            System Config
          </button>
        </div>
      </div>

      {activeTab === "config" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Geo-fencing and GPS settings */}
          <Card className="space-y-4">
            <h2 className="text-sm font-bold text-primary border-b border-border-subtle pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">location_on</span>
              <span>Geo-Fence Configurations</span>
            </h2>
            <div className="space-y-4 text-xs font-semibold text-primary">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-primary">Strict Geo-Fence Boundary</p>
                  <p className="text-[10px] text-on-surface-variant font-medium">
                    Flag check-ins outside site radius immediately
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={geoFenceAlert}
                  onChange={() => setGeoFenceAlert(!geoFenceAlert)}
                  className="w-4 h-4 rounded text-secondary focus:ring-secondary border-outline-variant cursor-pointer"
                />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-primary">Allow Offline Marking & Buffer</p>
                  <p className="text-[10px] text-on-surface-variant font-medium">
                    Cache check-ins when employee lacks data connection
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={offlineSync}
                  onChange={() => setOfflineSync(!offlineSync)}
                  className="w-4 h-4 rounded text-secondary focus:ring-secondary border-outline-variant cursor-pointer"
                />
              </div>
            </div>
          </Card>

          {/* Sync settings */}
          <Card className="space-y-4">
            <h2 className="text-sm font-bold text-primary border-b border-border-subtle pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">sync</span>
              <span>Integration Sync Parameters</span>
            </h2>
            <div className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-primary">Latency Alert Threshold (ms)</label>
                <input
                  type="number"
                  value={latencyThreshold}
                  onChange={(e) => setLatencyThreshold(e.target.value)}
                  className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs w-28 font-mono font-bold text-primary"
                />
                <p className="text-[10px] text-on-surface-variant">
                  Triggers IT health alerts if sync latency exceeds value
                </p>
              </div>
            </div>
          </Card>

          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" className="font-bold">Reset Defaults</Button>
            <Button className="font-bold" onClick={() => alert("Settings saved successfully!")}>
              Save Settings
            </Button>
          </div>
        </div>
      )}

      {activeTab === "roles" && (
        <div>
          {error && (
            <div className="bg-status-error/10 border border-status-error/20 text-status-error text-xs rounded-lg p-3.5 mb-4 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="bg-status-success/10 border border-status-success/20 text-status-success text-xs rounded-lg p-3.5 mb-4 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{saveSuccess}</span>
            </div>
          )}

          {loading ? (
            <Card className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-on-surface-variant font-bold">Retrieving System Roles Configuration...</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar: Role Selector */}
              <div className="lg:col-span-1 space-y-4">
                <Card className="space-y-4" padded={false}>
                  <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">System Roles</span>
                    <Button
                      size="sm"
                      className="px-2 py-1 font-bold text-[10px] flex items-center gap-1"
                      onClick={() => setIsCreateRoleOpen(true)}
                    >
                      <span className="material-symbols-outlined text-xs">add</span>
                      Add Custom
                    </Button>
                  </div>
                  <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                    {roles.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRoleId(r.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold flex flex-col gap-0.5 transition-all ${
                          selectedRoleId === r.id
                            ? "bg-secondary text-white shadow-sm"
                            : "hover:bg-surface-container-high text-primary"
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="truncate">{r.name}</span>
                          {r.isSystemDefault ? (
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.2 rounded-full border ${
                                selectedRoleId === r.id
                                  ? "bg-white/20 text-white border-white/30"
                                  : "bg-surface-container-highest text-on-surface-variant border-outline-variant"
                              }`}
                            >
                              Default
                            </span>
                          ) : (
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.2 rounded-full border ${
                                selectedRoleId === r.id
                                  ? "bg-white/20 text-white border-white/30"
                                  : "bg-status-warning/10 text-status-warning border-status-warning/20"
                              }`}
                            >
                              Custom
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-[10px] truncate max-w-full font-medium ${
                            selectedRoleId === r.id ? "text-white/80" : "text-on-surface-variant"
                          }`}
                        >
                          {r.description || "No description provided"}
                        </p>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Main Panel: Permission Matrix & User Assignments */}
              <div className="lg:col-span-3 space-y-6">
                {selectedRole ? (
                  <div className="space-y-6">
                    {/* Role Metadata Card */}
                    <Card className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 pb-3 border-b border-outline-variant">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-primary">{selectedRole.name}</h2>
                            <Badge variant={selectedRole.isActive ? "success" : "neutral"}>
                              {selectedRole.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">
                            {selectedRole.isSystemDefault ? "System Read-Only Role Template" : "Customizable Workspace Role"}
                          </p>
                        </div>
                        {!selectedRole.isSystemDefault && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="font-bold text-xs"
                              onClick={handleRoleStatusToggle}
                            >
                              {selectedRole.isActive ? "Deactivate Role" : "Activate Role"}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-primary uppercase">Role Description</label>
                        {selectedRole.isSystemDefault ? (
                          <p className="text-xs text-on-surface-variant bg-surface-container-low p-2.5 rounded-lg border border-outline-variant leading-relaxed">
                            {selectedRole.description}
                          </p>
                        ) : (
                          <Input
                            placeholder="Describe operations allowed for this custom role..."
                            value={selectedRole.description}
                            onChange={(e) => handleRoleDescriptionChange(e.target.value)}
                            className="text-xs font-medium text-primary"
                          />
                        )}
                      </div>
                    </Card>

                    {/* Permissions Matrix */}
                    <Card className="space-y-4">
                      <div className="flex justify-between items-center border-b border-outline-variant pb-2">
                        <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-secondary">grid_on</span>
                          <span>Authorization Rights Matrix</span>
                        </h3>
                        <span className="text-[10px] font-semibold text-on-surface-variant">
                          Toggle action rules for modules
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-outline-variant rounded-lg">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-surface-container-low text-primary font-bold border-b border-outline-variant">
                              <th className="p-3">Module & Permission Rule</th>
                              <th className="p-3 text-center w-16">View</th>
                              <th className="p-3 text-center w-16">Create</th>
                              <th className="p-3 text-center w-16">Edit</th>
                              <th className="p-3 text-center w-16">Delete</th>
                              <th className="p-3 text-center w-16">Approve</th>
                              <th className="p-3 text-center w-16">Export</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(permissionsByModule).map(([moduleName, permList]) => (
                              <React.Fragment key={moduleName}>
                                {/* Module header row */}
                                <tr className="bg-surface-container-medium border-b border-outline-variant">
                                  <td colSpan={7} className="p-2 font-black text-secondary uppercase tracking-wider text-[10px] pl-3">
                                    {moduleName}
                                  </td>
                                </tr>
                                {permList.map((p) => {
                                  const rp = rolePermissions.find(
                                    (x) => x.roleId === selectedRoleId && x.permissionId === p.id
                                  );
                                  return (
                                    <tr key={p.id} className="hover:bg-surface-container-low border-b border-outline-variant">
                                      <td className="p-3 font-semibold text-primary pl-4">
                                        <div>{p.label}</div>
                                        <div className="text-[9px] font-mono text-on-surface-variant font-medium mt-0.5">
                                          {p.key}
                                        </div>
                                      </td>
                                      {(["canView", "canCreate", "canEdit", "canDelete", "canApprove", "canExport"] as const).map(
                                        (field) => (
                                          <td key={field} className="p-3 text-center">
                                            <input
                                              type="checkbox"
                                              disabled={selectedRole.isSystemDefault}
                                              checked={rp ? rp[field] : false}
                                              onChange={() => handlePermissionToggle(p.id, field)}
                                              className="w-4 h-4 rounded text-secondary focus:ring-secondary border-outline-variant cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                            />
                                          </td>
                                        )
                                      )}
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    {/* User Assignments Manager */}
                    <Card className="space-y-4">
                      <h3 className="text-sm font-bold text-primary border-b border-outline-variant pb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-secondary">group</span>
                        <span>Assigned Employees</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Assign New User Form */}
                        <div className="space-y-3 bg-surface-container-low p-3.5 rounded-lg border border-outline-variant">
                           <h4 className="text-xs font-bold text-primary uppercase">Assign Employee</h4>
                           <div className="space-y-2">
                             <Input
                               placeholder="Search employees by name/ID..."
                               value={searchEmployeeQuery}
                               onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                               className="text-xs"
                             />

                             <div className="space-y-1">
                               <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                 Select Employee
                               </label>
                               <select
                                 value={selectedEmployeeToAssign}
                                 onChange={(e) => setSelectedEmployeeToAssign(e.target.value)}
                                 className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                               >
                                 <option value="">-- Choose Employee --</option>
                                 {assignableEmployees.map((e) => (
                                   <option key={e.id} value={e.id}>
                                     {e.name} ({e.id}) - {e.role}
                                   </option>
                                 ))}
                               </select>
                             </div>

                             <Button
                               onClick={handleAssignUser}
                               disabled={!selectedEmployeeToAssign}
                               size="sm"
                               className="w-full font-bold text-xs"
                             >
                               Assign Employee
                             </Button>
                           </div>
                        </div>

                        {/* List of Assigned Users */}
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          <h4 className="text-xs font-bold text-primary uppercase">Current Assignments ({assignedEmployees.length})</h4>
                          {assignedEmployees.length === 0 ? (
                            <div className="text-center py-8 border border-dashed border-outline-variant rounded-lg text-xs text-on-surface-variant font-medium">
                              No employees assigned to this role.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {assignedEmployees.map((e) => (
                                <div
                                  key={e.id}
                                  className="flex items-center justify-between p-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs text-primary font-bold shadow-sm"
                                >
                                  <div>
                                    <div>{e.name}</div>
                                    <div className="text-[10px] text-on-surface-variant font-medium">ID: {e.id} | Dept: {e.departmentId || "Unassigned"}</div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveAssignment(e.id)}
                                    className="p-1 rounded-full hover:bg-status-error/10 text-status-error transition-colors"
                                    title="Unassign user"
                                  >
                                    <span className="material-symbols-outlined text-base">person_remove</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>

                    {/* Footer Save Button */}
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" className="font-bold" onClick={fetchData}>
                        Discard Changes
                      </Button>
                      <Button className="font-bold" onClick={handleSaveRoleConfig}>
                        Save Role Configurations
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Card className="text-center py-12 text-xs text-on-surface-variant font-medium">
                    No roles created or selected. Click "Add Custom" to create one.
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      )}

          </div>
  );
}
