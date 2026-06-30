"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasPermission } from "../../../../lib/permissions";

export default function SecurityGuardingDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeClients: 0,
    activeContracts: 0,
    activeProjects: 0,
    activeSites: 0,
    totalGuards: 0,
    deployedToday: 0,
    missingLicenses: 0,
    licensesExpiringSoon: 0,
    expiringGatePasses: 0,
    relieverShortages: 0,
    underDeployments: 0,
    overDeployments: 0,
    pendingInspections: 0,
    auditComplianceScore: 100
  });

  const [relieverShortagesList, setRelieverShortagesList] = useState<any[]>([]);
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [complianceWarnings, setComplianceWarnings] = useState<string[]>([]);

  const isSecurityUser = hasPermission(session?.user, "manpower.admin.full_access") ||
                         hasPermission(session?.user, "manpower.security.view");

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [
          clientsRes,
          contractsRes,
          projectsRes,
          sitesRes,
          guardsRes,
          licensesRes,
          gatePassesRes,
          inspectionsRes,
          relieverPoolsRes,
          relieverAssignmentsRes,
          deploymentsRes
        ] = await Promise.all([
          fetch("/api/v1/manpower/security-guarding/clients"),
          fetch("/api/v1/manpower/security-guarding/contracts"),
          fetch("/api/v1/manpower/security-guarding/projects"),
          fetch("/api/v1/manpower/security-guarding/sites"),
          fetch("/api/v1/manpower/security-guarding/manpower"),
          fetch("/api/v1/security/licenses"),
          fetch("/api/v1/security/gate-passes"),
          fetch("/api/v1/security/inspections"),
          fetch("/api/v1/security/reliever-pools"),
          fetch("/api/v1/security/reliever-pools/assignments"),
          fetch(`/api/v1/manpower/security-guarding/deployments?date=${new Date().toISOString().split("T")[0]}`)
        ]);

        const clients = clientsRes.ok ? await clientsRes.json() : [];
        const contracts = contractsRes.ok ? await contractsRes.json() : [];
        const projects = projectsRes.ok ? await projectsRes.json() : [];
        const sites = sitesRes.ok ? await sitesRes.json() : [];
        const guards = guardsRes.ok ? await guardsRes.json() : [];
        const licenses = licensesRes.ok ? await licensesRes.json() : [];
        const gatePasses = gatePassesRes.ok ? await gatePassesRes.json() : [];
        const inspections = inspectionsRes.ok ? await inspectionsRes.json() : [];
        const pools = relieverPoolsRes.ok ? await relieverPoolsRes.json() : [];
        const poolAssignments = relieverAssignmentsRes.ok ? await relieverAssignmentsRes.json() : [];
        const deployments = deploymentsRes.ok ? await deploymentsRes.json() : [];

        const todayStr = new Date().toISOString().split("T")[0];

        // 1. Licenses computations
        const licenseRequiredCategories = [
          "Security Guard", "Head Guard", "Security Supervisor",
          "Patrolling Supervisor", "Patrolling Guard", "Reliever Guard"
        ];
        const guardsNeedingLicense = guards.filter((g: any) =>
          licenseRequiredCategories.includes(g.employeeCategory)
        );

        const expiredOrMissing = guardsNeedingLicense.filter((g: any) => {
          const lic = licenses.find((l: any) => l.employeeId === g.id);
          return !lic || !lic.expiryDate || lic.expiryDate < todayStr;
        });

        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
        const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split("T")[0];

        const expiringLicenses = licenses.filter((l: any) => {
          return l.expiryDate && l.expiryDate >= todayStr && l.expiryDate <= thirtyDaysLaterStr;
        });

        // 2. Gate pass computations
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        const sevenDaysLaterStr = sevenDaysLater.toISOString().split("T")[0];

        const expiringGP = gatePasses.filter((gp: any) => {
          return gp.expiryDate && gp.expiryDate >= todayStr && gp.expiryDate <= sevenDaysLaterStr && gp.status === "ACTIVE";
        });

        // 3. Reliever shortages
        let totalRelieverShortage = 0;
        const shortagesList: any[] = [];
        pools.forEach((pool: any) => {
          const target = pool.requiredRelieverCount || 3;
          const assignedCount = poolAssignments.filter((a: any) => a.poolId === pool.id).length;
          const shortage = Math.max(0, target - assignedCount);
          totalRelieverShortage += shortage;
          if (shortage > 0) {
            shortagesList.push({
              project: projects.find((p: any) => p.id === pool.projectId)?.name || pool.projectId,
              poolName: pool.poolName,
              assigned: assignedCount,
              target,
              shortage
            });
          }
        });

        // 4. Deployments analysis
        let underCount = 0;
        let overCount = 0;
        deployments.forEach((dep: any) => {
          const reqCount = dep.shiftRequirement?.requiredCount || 0;
          const activeCount = dep.assignments?.length || 0;
          if (activeCount < reqCount) underCount++;
          if (activeCount > reqCount) overCount++;
        });

        // 5. Inspections
        const pendingIns = inspections.filter((i: any) => i.status === "PENDING" || i.status === "SCHEDULED").length;
        const completedIns = inspections.filter((i: any) => i.score !== undefined && i.score !== null);
        const avgScore = completedIns.length > 0
          ? Math.round(completedIns.reduce((sum: number, i: any) => sum + i.score, 0) / completedIns.length)
          : 100;

        // 6. Warnings building
        const warnings: string[] = [];
        if (expiredOrMissing.length > 0) {
          warnings.push(`${expiredOrMissing.length} deployable guard(s) have missing or expired MOI Security Licenses.`);
        }
        if (expiringGP.length > 0) {
          warnings.push(`${expiringGP.length} gate pass(es) are expiring within the next 7 days.`);
        }
        if (underCount > 0) {
          warnings.push(`${underCount} worksite shift requirements are currently under-deployed today.`);
        }
        if (totalRelieverShortage > 0) {
          warnings.push(`Critical: Reliever force is under-staffed across ${shortagesList.length} pools.`);
        }

        setStats({
          activeClients: clients.filter((x: any) => x.isActive).length,
          activeContracts: contracts.filter((x: any) => x.status === "ACTIVE").length,
          activeProjects: projects.filter((x: any) => x.isActive).length,
          activeSites: sites.filter((x: any) => x.isActive).length,
          totalGuards: guards.length,
          deployedToday: deployments.reduce((acc: number, d: any) => acc + (d.assignments?.length || 0), 0),
          missingLicenses: expiredOrMissing.length,
          licensesExpiringSoon: expiringLicenses.length,
          expiringGatePasses: expiringGP.length,
          relieverShortages: totalRelieverShortage,
          underDeployments: underCount,
          overDeployments: overCount,
          pendingInspections: pendingIns,
          auditComplianceScore: avgScore
        });

        setRelieverShortagesList(shortagesList);
        setRecentInspections(inspections.slice(0, 5));
        setComplianceWarnings(warnings);
      } catch (e) {
        console.error("Error fetching dashboard statistics", e);
      } finally {
        setLoading(false);
      }
    }

    if (isSecurityUser) {
      loadDashboardData();
    }
  }, [isSecurityUser]);

  if (!isSecurityUser) {
    return (
      <div className="p-8 text-center text-status-error font-bold">
        Access Denied: You do not have permission to view Security Guarding operations.
      </div>
    );
  }

  return (
    <div className="flex-1 bg-surface-container-lowest p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary">Security Guarding Command Center</h1>
          <p className="text-[11px] text-on-surface-variant">Live operations compliance, reliever allocations, and inspections ledger</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/manpower/security-guarding/coordinators"
            className="px-3 py-2 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary/90 transition-colors inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
            Coordinator Workspace
          </Link>
          <Link
            href="/manpower/security-guarding/deployment-calendar"
            className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/95 transition-colors inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            Open Deployment Calendar
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Operational Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Active Portfolio</p>
              <p className="text-xl font-black text-primary mt-1">
                {stats.activeClients} <span className="text-xs font-normal text-on-surface-variant">Clients / {stats.activeProjects} Projects</span>
              </p>
            </div>
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Total Guards</p>
              <p className="text-xl font-black text-primary mt-1">
                {stats.totalGuards} <span className="text-xs font-normal text-on-surface-variant">Registered</span>
              </p>
            </div>
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Daily Deployment</p>
              <p className="text-xl font-black text-primary mt-1">
                {stats.deployedToday} <span className="text-xs font-normal text-on-surface-variant">Deployed Today</span>
              </p>
            </div>
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Audit Score</p>
              <p className="text-xl font-black text-status-success mt-1">
                {stats.auditComplianceScore}% <span className="text-xs font-normal text-on-surface-variant">Compliance</span>
              </p>
            </div>
          </div>

          {/* Compliance & Operations Alert Cards */}
          <h2 className="text-xs font-bold text-primary uppercase tracking-widest">Compliance & Safety Alerts</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <div className={`p-4 rounded-xl border ${stats.missingLicenses > 0 ? "bg-status-error/10 border-status-error/30 text-status-error" : "bg-surface border-outline-variant text-on-surface"}`}>
              <p className="text-[9px] uppercase font-bold tracking-wider opacity-80">Missing Licenses</p>
              <p className="text-xl font-black mt-1">{stats.missingLicenses}</p>
            </div>
            <div className={`p-4 rounded-xl border ${stats.licensesExpiringSoon > 0 ? "bg-status-warning/10 border-status-warning/30 text-status-warning" : "bg-surface border-outline-variant text-on-surface"}`}>
              <p className="text-[9px] uppercase font-bold tracking-wider opacity-80">License Expiries</p>
              <p className="text-xl font-black mt-1">{stats.licensesExpiringSoon}</p>
            </div>
            <div className={`p-4 rounded-xl border ${stats.expiringGatePasses > 0 ? "bg-status-warning/10 border-status-warning/30 text-status-warning" : "bg-surface border-outline-variant text-on-surface"}`}>
              <p className="text-[9px] uppercase font-bold tracking-wider opacity-80">GP (7 Days)</p>
              <p className="text-xl font-black mt-1">{stats.expiringGatePasses}</p>
            </div>
            <div className={`p-4 rounded-xl border ${stats.relieverShortages > 0 ? "bg-status-error/10 border-status-error/30 text-status-error" : "bg-surface border-outline-variant text-on-surface"}`}>
              <p className="text-[9px] uppercase font-bold tracking-wider opacity-80">Reliever Short</p>
              <p className="text-xl font-black mt-1">{stats.relieverShortages}</p>
            </div>
            <div className={`p-4 rounded-xl border ${stats.underDeployments > 0 ? "bg-status-error/10 border-status-error/30 text-status-error" : "bg-surface border-outline-variant text-on-surface"}`}>
              <p className="text-[9px] uppercase font-bold tracking-wider opacity-80">Under-Deployed</p>
              <p className="text-xl font-black mt-1">{stats.underDeployments}</p>
            </div>
            <div className={`p-4 rounded-xl border ${stats.pendingInspections > 0 ? "bg-secondary/10 border-secondary/30 text-secondary" : "bg-surface border-outline-variant text-on-surface"}`}>
              <p className="text-[9px] uppercase font-bold tracking-wider opacity-80">Pending Audits</p>
              <p className="text-xl font-black mt-1">{stats.pendingInspections}</p>
            </div>
          </div>

          {/* Compliance Warnings Banner */}
          {complianceWarnings.length > 0 && (
            <div className="bg-status-error/5 border border-status-error/20 p-4 rounded-xl space-y-2">
              <p className="text-xs font-bold text-status-error flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                Attention Required: Compliance Warnings
              </p>
              <ul className="list-disc pl-5 text-[11px] text-status-error space-y-1">
                {complianceWarnings.map((warn, idx) => (
                  <li key={idx}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Dashboard Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reliever Pool Shortages */}
            <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
                <h3 className="text-xs font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">groups</span>
                  Reliever Pool Shortages
                </h3>
                <Link href="/manpower/security-guarding/manpower" className="text-[10px] text-primary font-bold hover:underline">
                  Manage Relievers
                </Link>
              </div>
              <div className="p-4">
                {relieverShortagesList.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic text-center py-6">All reliever pools are fully staffed.</p>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-[10px] uppercase text-on-surface-variant font-bold">
                        <th className="pb-2">Project</th>
                        <th className="pb-2">Pool Name</th>
                        <th className="pb-2 text-center">Assigned</th>
                        <th className="pb-2 text-center">Target</th>
                        <th className="pb-2 text-right text-status-error">Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {relieverShortagesList.map((pool, idx) => (
                        <tr key={idx} className="text-xs">
                          <td className="py-2 text-on-surface font-semibold max-w-[120px] truncate">{pool.project}</td>
                          <td className="py-2 text-on-surface-variant">{pool.poolName}</td>
                          <td className="py-2 text-center font-bold">{pool.assigned}</td>
                          <td className="py-2 text-center text-on-surface-variant">{pool.target}</td>
                          <td className="py-2 text-right text-status-error font-black">-{pool.shortage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Recent Coordinator Site Inspections */}
            <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
                <h3 className="text-xs font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">fact_check</span>
                  Recent Compliance Inspections
                </h3>
                <Link href="/manpower/security-guarding/coordinators" className="text-[10px] text-primary font-bold hover:underline">
                  Coordinator Logs
                </Link>
              </div>
              <div className="p-4">
                {recentInspections.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic text-center py-6">No inspections recorded yet.</p>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-[10px] uppercase text-on-surface-variant font-bold">
                        <th className="pb-2">Site</th>
                        <th className="pb-2">Inspector</th>
                        <th className="pb-2 text-center">Score</th>
                        <th className="pb-2 text-center">Status</th>
                        <th className="pb-2 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {recentInspections.map((ins, idx) => (
                        <tr key={idx} className="text-xs">
                          <td className="py-2 text-on-surface font-semibold">{ins.site?.name || ins.siteId}</td>
                          <td className="py-2 text-on-surface-variant">{ins.inspectorEmployeeId}</td>
                          <td className="py-2 text-center font-bold">{ins.score}%</td>
                          <td className="py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ins.status === "PASSED" ? "bg-status-success/15 text-status-success" : ins.status === "FAILED" ? "bg-status-error/15 text-status-error" : "bg-secondary/15 text-secondary"}`}>
                              {ins.status}
                            </span>
                          </td>
                          <td className="py-2 text-right text-on-surface-variant">
                            {ins.inspectionDate ? new Date(ins.inspectionDate).toLocaleDateString() : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & Console Shortcuts */}
          <h2 className="text-xs font-bold text-primary uppercase tracking-widest">Dashboard Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <Link href="/manpower/security-guarding/clients?add=true" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-md p-3 rounded-xl flex items-center gap-3 transition-all">
              <span className="material-symbols-outlined text-primary text-[20px]">person_add</span>
              <span className="text-xs font-bold text-on-surface">Add Client</span>
            </Link>
            <Link href="/manpower/security-guarding/contracts?add=true" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-md p-3 rounded-xl flex items-center gap-3 transition-all">
              <span className="material-symbols-outlined text-primary text-[20px]">note_add</span>
              <span className="text-xs font-bold text-on-surface">Add Contract</span>
            </Link>
            <Link href="/manpower/security-guarding/projects?add=true" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-md p-3 rounded-xl flex items-center gap-3 transition-all">
              <span className="material-symbols-outlined text-primary text-[20px]">create_new_folder</span>
              <span className="text-xs font-bold text-on-surface">Add Project</span>
            </Link>
            <Link href="/manpower/security-guarding/sites?add=true" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-md p-3 rounded-xl flex items-center gap-3 transition-all">
              <span className="material-symbols-outlined text-primary text-[20px]">add_location_alt</span>
              <span className="text-xs font-bold text-on-surface">Add Site</span>
            </Link>
            <Link href="/manpower/security-guarding/zones?add=true" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-md p-3 rounded-xl flex items-center gap-3 transition-all">
              <span className="material-symbols-outlined text-primary text-[20px]">add_home</span>
              <span className="text-xs font-bold text-on-surface">Add Gate/Post/Zone</span>
            </Link>
            <Link href="/manpower/security-guarding/manpower" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-md p-3 rounded-xl flex items-center gap-3 transition-all">
              <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
              <span className="text-xs font-bold text-on-surface">Manpower Directory</span>
            </Link>
            <Link href="/manpower/security-guarding/deployment-calendar" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-md p-3 rounded-xl flex items-center gap-3 transition-all">
              <span className="material-symbols-outlined text-primary text-[20px]">calendar_month</span>
              <span className="text-xs font-bold text-on-surface">Open Shift Planner</span>
            </Link>
            <Link href="/manpower/security-guarding/reliever-pools" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-md p-3 rounded-xl flex items-center gap-3 transition-all">
              <span className="material-symbols-outlined text-primary text-[20px]">groups</span>
              <span className="text-xs font-bold text-on-surface">Open Reliever Pools</span>
            </Link>
            <Link href="/manpower/security-guarding/coordinators" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-md p-3 rounded-xl flex items-center gap-3 transition-all">
              <span className="material-symbols-outlined text-primary text-[20px]">assignment_turned_in</span>
              <span className="text-xs font-bold text-on-surface">Project Coordinators</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
