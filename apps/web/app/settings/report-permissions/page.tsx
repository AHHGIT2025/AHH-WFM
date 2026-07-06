"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { Card, Button, Badge } from "@ahh-wfm/ui/src";
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

const REPORTS_LIST = [
  {
    key: "reports.executive.view",
    name: "Executive Dashboard",
    description: "Access to high-level executive analytics, charts, and summary reports.",
    category: "Operations"
  },
  {
    key: "reports.attendance.view",
    name: "Attendance Report",
    description: "Detailed timesheet, clock-in/out deviations, and daily attendance records.",
    category: "Workforce"
  },
  {
    key: "reports.leave.view",
    name: "Leave Report",
    description: "Leave balances, approved leaves, pending requests, and leave history analytics.",
    category: "Workforce"
  },
  {
    key: "reports.overtime.view",
    name: "Overtime Report",
    description: "Overtime hours claimed, approved overtime wages, and supervisor approvals.",
    category: "Finance & Payroll"
  },
  {
    key: "reports.shiftRoster.view",
    name: "Shift Roster Report",
    description: "Assigned shifts, schedule distribution, coverage metrics, and vacancy analysis.",
    category: "Operations"
  },
  {
    key: "reports.sapSync.view",
    name: "SAP Sync Report",
    description: "SAP SuccessFactors integration status, API sync logs, and field mapping errors.",
    category: "System Admin"
  },
  {
    key: "reports.audit.view",
    name: "Audit Report",
    description: "History of admin actions, login attempts, credential changes, and system events.",
    category: "System Admin"
  },
  {
    key: "reports.backup.view",
    name: "Backup/Restore Report",
    description: "System database backup archives history, database restore events, and size logs.",
    category: "System Admin"
  },
  {
    key: "reports.productionReadiness.view",
    name: "Production Readiness Report",
    description: "Operational checklists, environment readiness validations, and deploy logs.",
    category: "System Admin"
  }
];

function ReportPermissionsContent() {
  const { data: session, status, update: updateSession } = useSession();
  const user = session?.user as any;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hasAccess = session && (isAdminUser(user) || hasPermission(user, "reports.manage"));

  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [permissions, setPermissions] = useState<SystemPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showRefreshNotice, setShowRefreshNotice] = useState(false);

  // Active Role ID is driven by URL query parameter
  const selectedRoleId = searchParams.get("roleId") || "";

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/roles");
      if (!res.ok) {
        throw new Error("Failed to load settings data");
      }
      const data = await res.json();
      setRoles(data.roles || []);
      setPermissions(data.permissions || []);
      setRolePermissions(data.rolePermissions || []);

      // If no roleId is in URL, select the first custom or non-default role, or just the first role
      if (!searchParams.get("roleId") && data.roles && data.roles.length > 0) {
        const firstRole = data.roles.find((r: any) => !r.isSystemDefault) || data.roles[0];
        const params = new URLSearchParams(searchParams.toString());
        params.set("roleId", firstRole.id);
        router.replace(`${pathname}?${params.toString()}`);
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

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const setSelectedRoleId = (roleId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("roleId", roleId);
    router.push(`${pathname}?${params.toString()}`);
    setSaveSuccess(null);
    setError(null);
  };

  const handleToggleReportPermission = (permId: string) => {
    if (!selectedRole || selectedRole.isSystemDefault || selectedRole.isEditable === false) return;

    setRolePermissions((prev) =>
      prev.map((rp) => {
        if (rp.roleId === selectedRoleId && rp.permissionId === permId) {
          const newState = !rp.canView;
          return {
            ...rp,
            canView: newState,
            canCreate: newState,
            canEdit: newState,
            canDelete: newState,
            canApprove: newState,
            canExport: newState,
          };
        }
        return rp;
      })
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaveSuccess(null);
    setError(null);

    if (selectedRole.isSystemDefault || selectedRole.isEditable === false) {
      setError("Default system roles are protected. Please clone this role under Roles & Permissions to customize report permissions.");
      return;
    }

    try {
      const currentRolePerms = rolePermissions.filter((rp) => rp.roleId === selectedRoleId);

      const res = await fetch("/api/v1/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRoleId,
          permissions: currentRolePerms,
        }),
      });

      if (res.ok) {
        setSaveSuccess(`Report permissions updated successfully for role "${selectedRole.name}"!`);
        setShowRefreshNotice(true);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save report permissions");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-5xl text-primary">sync</span>
          <p className="mt-2 text-xs font-bold text-on-surface-variant font-medium">Loading report permissions console...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center max-w-md p-6 bg-status-error/10 border border-status-error/20 rounded-2xl">
          <span className="material-symbols-outlined text-status-error text-5xl">gpp_bad</span>
          <h2 className="text-lg font-bold text-primary mt-2">Access Denied</h2>
          <p className="text-xs text-on-surface-variant mt-1 font-semibold">
            You do not have the required administrative clearance to configure role-based report permissions.
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8 font-medium">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-primary-container via-surface-container-high to-surface border border-outline-variant rounded-2xl p-6 shadow-md">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2 tracking-tight">
            <span className="material-symbols-outlined text-secondary text-3xl">rule</span>
            <span>Report Permissions Hub</span>
          </h1>
          <p className="text-xs text-on-surface-variant font-semibold mt-1">
            Configure role-based access control for specific analytical reports and system health dashboards.
          </p>
        </div>
        <div>
          <Button variant="secondary" onClick={fetchData} className="font-bold flex items-center gap-1.5 text-xs">
            <span className="material-symbols-outlined text-base">sync</span>
            Sync Roles Registry
          </Button>
        </div>
      </div>

      {/* Save Success / Refresh Notice */}
      {showRefreshNotice && (
        <div className="bg-status-success/10 border border-status-success text-status-success p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">info</span>
            <div className="text-xs font-bold">
              Report permissions saved successfully! Click below to hot-reload your own session tokens if needed.
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

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel: Roles list */}
          <div className="space-y-4">
            <Card className="p-4 space-y-4">
              <div className="border-b border-outline-variant pb-2">
                <h3 className="text-xs font-black text-primary uppercase">System Roles</h3>
                <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Select a role to configure report visibility</p>
              </div>
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {roles.map((r) => {
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
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right Panel: Report Permissions Matrix */}
          <div className="lg:col-span-3 space-y-4">
            {selectedRole ? (
              <Card className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-md font-black text-primary uppercase">{selectedRole.name} Reports Access</h2>
                      {selectedRole.isSystemDefault || selectedRole.isEditable === false ? (
                        <Badge variant="secondary">Protected Role (Read Only)</Badge>
                      ) : (
                        <Badge variant="primary">Customizable Access</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-on-surface-variant font-semibold mt-1">
                      Configure which reports this role is authorized to view.
                    </p>
                  </div>
                  {!selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                    <Button onClick={handleSavePermissions} className="font-bold text-xs">
                      Save Report Permissions
                    </Button>
                  )}
                </div>

                {selectedRole.isSystemDefault || selectedRole.isEditable === false ? (
                  <div className="bg-status-warning/10 border border-status-warning/30 p-4 rounded-xl text-xs text-status-warning font-bold flex items-start gap-2.5">
                    <span className="material-symbols-outlined mt-0.5">lock</span>
                    <div>
                      Default system roles cannot be directly modified. To customize report permissions for a new set of users, please navigate to the{" "}
                      <Link href="/settings?tab=rolesPermissions" className="underline hover:opacity-80">
                        Roles & Permissions Tab
                      </Link>
                      , clone this role, and customize the clone.
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {REPORTS_LIST.map((report) => {
                    const matchedPermission = permissions.find((p) => p.key === report.key);
                    const rp = matchedPermission
                      ? rolePermissions.find(
                          (x) => x.roleId === selectedRoleId && x.permissionId === matchedPermission.id
                        )
                      : null;

                    const isGranted = !!(rp?.canView || rp?.canCreate || rp?.canEdit || rp?.canDelete || rp?.canApprove || rp?.canExport);

                    return (
                      <div
                        key={report.key}
                        className={`p-4 border rounded-xl flex items-center justify-between gap-4 transition-colors ${
                          isGranted
                            ? "border-primary/20 bg-primary-container/10"
                            : "border-outline-variant hover:bg-surface-container-low"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">{report.name}</span>
                            <Badge variant="secondary" className="text-[8px] font-black uppercase">
                              {report.category}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-on-surface-variant font-medium">
                            {report.description}
                          </p>
                          <p className="text-[9px] font-mono text-outline font-semibold">
                            Permission Key: {report.key}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`report-chk-${report.key}`}
                            checked={isGranted}
                            disabled={
                              !matchedPermission ||
                              selectedRole.isSystemDefault ||
                              selectedRole.isEditable === false
                            }
                            onChange={() => {
                              if (matchedPermission) {
                                handleToggleReportPermission(matchedPermission.id);
                              }
                            }}
                            className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer disabled:opacity-40"
                          />
                          <label
                            htmlFor={`report-chk-${report.key}`}
                            className="text-xs font-bold text-primary uppercase select-none cursor-pointer"
                          >
                            Granted
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!selectedRole.isSystemDefault && selectedRole.isEditable !== false && (
                  <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
                    <Button variant="secondary" onClick={fetchData} className="font-bold text-xs">
                      Reset
                    </Button>
                    <Button onClick={handleSavePermissions} className="font-bold text-xs">
                      Save Report Permissions
                    </Button>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="text-center py-16 text-xs text-on-surface-variant font-medium">
                No roles found. Please sync the roles registry or check permissions settings.
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportPermissionsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <ReportPermissionsContent />
    </Suspense>
  );
}
