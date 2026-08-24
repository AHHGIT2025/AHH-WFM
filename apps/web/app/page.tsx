"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { hasPermission, isAdminUser } from "../lib/permissions";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";
import { MyApprovalsWidget } from "@/components/dashboard/my-approvals-widget";

interface DashboardData {
  workforceSummary: {
    totalActive: number;
    presentToday: number;
    absentToday: number;
    onDutyNow: number;
    lateToday: number;
    onLeaveToday: number;
    openIncidents: number;
    pendingApprovals: number;
    activeContracts: number;
    activeDeployments: number;
  };
  workforceOverview: {
    whiteCollar: ClusterStats;
    securityGuarding: ClusterStats;
    facilityManagement: ClusterStats;
  };
  securitySummary: {
    activeContracts: number;
    activeSites: number;
    guardsDeployed: number;
    vacantPosts: number;
    patrolsToday: number;
    openIncidents: number;
    feedbackPending: number;
  };
  facilitySummary: {
    activeProjects: number;
    staffDeployed: number;
    openWorkReports: number;
    feedbackPending: number;
    openIncidents: number;
    relieverRequests: number;
  };
  corporateSummary: {
    activeStaff: number;
    presentToday: number;
    onLeave: number;
    lateToday: number;
    pendingLeaveApprovals: number;
    pendingClearances: number;
  };
  attendanceSummary: {
    present: number;
    absent: number;
    late: number;
    earlyCheckout: number;
    missingCheckout: number;
    overtimePending: number;
  };
  leaveSummary: {
    pendingApproval: number;
    approvedToday: number;
    onLeaveToday: number;
    upcomingNext7Days: number;
  };
  shiftDeploymentSummary: {
    activeShiftsToday: number;
    deployedToday: number;
    openGaps: number;
    relieverAssignments: number;
    unassignedManpower: number;
  };
  contractSummary: {
    active: number;
    draft: number;
    pendingApproval: number;
    expiring30Days: number;
    activeProjects: number;
    pendingAddendums: number;
  };
  approvalSummary: {
    leaveApprovals: number;
    attendanceCorrections: number;
    overtime: number;
    deployments: number;
    contracts: number;
    addendums: number;
    clearances: number;
  };
  exceptionSummary: {
    noDefaultLocation: number;
    noActiveDeployment: number;
    expiringQid30: number;
    expiringQid60: number;
    expiringPassport30: number;
    expiringPassport60: number;
    expiringVisa30: number;
    expiringMoiLicense30: number;
    expiringGatePass30: number;
    expiringHealthCard30: number;
    missingCheckout: number;
    activeWithDisabledLogin: number;
  };
  reportSnapshot: {
    attendanceReport: string;
    leaveReport: string;
    deploymentReport: string;
    securityReport: string;
    facilityReport: string;
    auditActivityToday: number;
    backupReady: string;
  };
  regionalActivity: Array<{ name: string; count: number }>;
  lastUpdated: string;
}

interface ClusterStats {
  total: number;
  active: number;
  onDutyNow: number;
  presentToday: number;
  absentToday: number;
  onLeave: number;
  pendingDeployment: number;
  utilization: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isSuperOrAdmin = isAdminUser(user);

  // Permission guards for dashboard components
  const canViewSecurity = isSuperOrAdmin || hasPermission(user, "manpower.security.view") || hasPermission(user, "manpower.security.manage");
  const canViewFM = isSuperOrAdmin || hasPermission(user, "manpower.fm.view") || hasPermission(user, "manpower.fm.manage");
  const canViewCorporate = isSuperOrAdmin || hasPermission(user, "settings.view") || hasPermission(user, "employees.view");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [degraded, setDegraded] = useState(false);

  // Filter lists from master endpoints
  const [companyList, setCompanyList] = useState<any[]>([]);
  const [locationList, setLocationList] = useState<any[]>([]);
  const [projectList, setProjectList] = useState<any[]>([]);

  // Filter selections
  const [companyFilter, setCompanyFilter] = useState("all");
  const [opTypeFilter, setOpTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  const [locationFilter, setLocationFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const fetchMasters = async () => {
    try {
      const [compRes, locRes, projRes] = await Promise.all([
        fetch("/api/v1/masters/companies"),
        fetch("/api/v1/masters/locations"),
        fetch("/api/v1/masters/projects")
      ]);
      if (compRes.ok) setCompanyList(await compRes.json());
      if (locRes.ok) setLocationList(await locRes.json());
      if (projRes.ok) setProjectList(await projRes.json());
    } catch (e) {
      console.error("Failed to load master filters dynamically:", e);
    }
  };

  const fetchSummary = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (companyFilter && companyFilter !== "all") params.set("companyId", companyFilter);
      if (opTypeFilter && opTypeFilter !== "all") params.set("operationType", opTypeFilter);
      if (dateFilter) params.set("period", dateFilter);
      if (locationFilter && locationFilter !== "all") params.set("locationId", locationFilter);
      if (projectFilter && projectFilter !== "all") params.set("projectId", projectFilter);
      
      const res = await fetch(`/api/v1/dashboard/summary?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.success) {
          setData(json.data);
          setDegraded(!!json.degraded);
        } else {
          console.error("Dashboard Summary API returned unsuccessful:", json);
        }
      }
    } catch (e) {
      console.error("Failed to load dashboard summary payload", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateUrl = (company: string, opType: string, period: string, location: string, project: string) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (company && company !== "all") params.set("companyId", company);
    if (opType && opType !== "all") params.set("operationType", opType);
    if (period) params.set("period", period);
    if (location && location !== "all") params.set("locationId", location);
    if (project && project !== "all") params.set("projectId", project);
    const search = params.toString();
    const newUrl = window.location.pathname + (search ? "?" + search : "");
    window.history.pushState({ path: newUrl }, "", newUrl);
  };

  // 1. Initial Mount: Load masters and query string parameters
  useEffect(() => {
    fetchMasters();
    
    const params = new URLSearchParams(window.location.search);
    if (params.get("companyId")) setCompanyFilter(params.get("companyId")!);
    if (params.get("operationType")) setOpTypeFilter(params.get("operationType")!);
    if (params.get("period")) setDateFilter(params.get("period")!);
    if (params.get("locationId")) setLocationFilter(params.get("locationId")!);
    if (params.get("projectId")) setProjectFilter(params.get("projectId")!);
  }, []);

  // 2. Fetch data automatically whenever any filter selection changes
  useEffect(() => {
    fetchSummary(true);
    updateUrl(companyFilter, opTypeFilter, dateFilter, locationFilter, projectFilter);
    
    const interval = setInterval(() => {
      fetchSummary(false);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [companyFilter, opTypeFilter, dateFilter, locationFilter, projectFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
        <p className="text-sm font-semibold text-on-surface-variant">Loading Executive Operations Summary...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl text-status-error mb-2">error</span>
        <p className="text-sm font-bold">Failed to load dashboard summary.</p>
      </div>
    );
  }

  // Handle personal employee view if user is a normal employee with no operational scopes
  const isNormalEmployee = user && user.role === "EMPLOYEE" && !isSuperOrAdmin && !canViewSecurity && !canViewFM && !canViewCorporate;

  if (isNormalEmployee) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-6">
        <Card className="p-6 flex flex-col gap-4 border-l-4 border-l-primary">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-primary">Welcome back, {user.name || "Employee"}</h1>
              <p className="text-xs text-on-surface-variant">Personal Employee Self-Service Dashboard</p>
            </div>
            <Badge variant="success">Active ESS</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <Card className="p-4 bg-surface-container-low flex flex-col gap-1">
              <span className="material-symbols-outlined text-primary text-2xl">schedule</span>
              <h3 className="text-xs font-bold text-on-surface">My Attendance</h3>
              <p className="text-[11px] text-on-surface-variant mt-1">Punch check-in/out, view timesheets and corrections.</p>
              <Button className="mt-3 text-[10px] py-1 font-bold" variant="secondary" onClick={() => window.location.href = "/employee/punch"}>Access Punch</Button>
            </Card>
            <Card className="p-4 bg-surface-container-low flex flex-col gap-1">
              <span className="material-symbols-outlined text-primary text-2xl">calendar_month</span>
              <h3 className="text-xs font-bold text-on-surface">My Leaves</h3>
              <p className="text-[11px] text-on-surface-variant mt-1">Apply for leave, check balances, and track approvals.</p>
              <Button className="mt-3 text-[10px] py-1 font-bold" variant="secondary" onClick={() => window.location.href = "/leave"}>Manage Leaves</Button>
            </Card>
            <Card className="p-4 bg-surface-container-low flex flex-col gap-1">
              <span className="material-symbols-outlined text-primary text-2xl">password</span>
              <h3 className="text-xs font-bold text-on-surface">Security Settings</h3>
              <p className="text-[11px] text-on-surface-variant mt-1">Change account password or review device linkages.</p>
              <Button className="mt-3 text-[10px] py-1 font-bold" variant="secondary" onClick={() => window.location.href = "/change-password"}>Change Password</Button>
            </Card>
          </div>
        </Card>
      </div>
    );
  }

  // Format Helper
  const fmt = (val: number | undefined | null) => (val !== undefined && val !== null ? val : "No data");

  return (
    <div className="space-y-6">
      {/* Executive Command Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-surface-container-low p-4 rounded-xl border border-border-subtle">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse"></span>
            <h1 className="text-lg font-bold text-primary tracking-tight">Executive Operations Dashboard</h1>
            {degraded && (
              <Badge variant="warning" className="ml-2 animate-pulse">
                Some dashboard sections are using fallback data
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-0.5">WFM Global Command Console · Last Updated: {new Date(data.lastUpdated).toLocaleTimeString()}</p>
        </div>

        {/* Global Operations Dynamic Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Company filter */}
          <select
            className="bg-surface-container text-[11px] rounded-lg border-none py-1.5 px-3 font-semibold text-primary focus:ring-1 focus:ring-primary cursor-pointer max-w-[180px]"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="all">All Companies</option>
            {companyList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name || c.id}
              </option>
            ))}
          </select>

          {/* Operation type cluster filter */}
          <select
            className="bg-surface-container text-[11px] rounded-lg border-none py-1.5 px-3 font-semibold text-primary focus:ring-1 focus:ring-primary cursor-pointer"
            value={opTypeFilter}
            onChange={(e) => setOpTypeFilter(e.target.value)}
          >
            <option value="all">All Clusters</option>
            <option value="white">White Collar</option>
            <option value="security">Security Guarding</option>
            <option value="fm">Facility Management</option>
          </select>

          {/* Location filter */}
          <select
            className="bg-surface-container text-[11px] rounded-lg border-none py-1.5 px-3 font-semibold text-primary focus:ring-1 focus:ring-primary cursor-pointer max-w-[150px]"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="all">All Locations</option>
            {locationList.map((l) => (
              <option key={l.id} value={l.id}>
                {l.locationName || l.name || l.id}
              </option>
            ))}
          </select>

          {/* Project filter */}
          <select
            className="bg-surface-container text-[11px] rounded-lg border-none py-1.5 px-3 font-semibold text-primary focus:ring-1 focus:ring-primary cursor-pointer max-w-[150px]"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">All Projects</option>
            {projectList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectName || p.name || p.id}
              </option>
            ))}
          </select>

          {/* Time period filter */}
          <select
            className="bg-surface-container text-[11px] rounded-lg border-none py-1.5 px-3 font-semibold text-primary focus:ring-1 focus:ring-primary cursor-pointer"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <Button
            onClick={() => fetchSummary(true)}
            disabled={refreshing}
            variant="secondary"
            size="sm"
            className="font-bold flex items-center gap-1 text-[11px] py-1.5 bg-primary/10 text-primary hover:bg-primary/20"
          >
            <span className={`material-symbols-outlined text-[15px] ${refreshing ? "animate-spin" : ""}`}>refresh</span>
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* Main Content Layout with Refreshing Transition */}
      <div className={`space-y-6 transition-all duration-300 ${refreshing ? "opacity-50 pointer-events-none scale-[0.995]" : ""}`}>
        {/* 1. Top Executive KPI Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
          <Card className="p-3 flex flex-col justify-between border-l-2 border-l-primary bg-surface-container-lowest">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Workforce</p>
            <h2 className="text-lg font-extrabold text-primary mt-1">{fmt(data.workforceSummary.totalActive)}</h2>
            <span className="text-[9px] text-status-success font-bold mt-1">Active Staff</span>
          </Card>

          <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-success bg-surface-container-lowest">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Present</p>
            <h2 className="text-lg font-extrabold text-status-success mt-1">{fmt(data.workforceSummary.presentToday)}</h2>
            <span className="text-[9px] text-on-surface-variant font-medium mt-1">Today</span>
          </Card>

          <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-error bg-surface-container-lowest">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Absent</p>
            <h2 className="text-lg font-extrabold text-status-error mt-1">{fmt(data.workforceSummary.absentToday)}</h2>
            <span className="text-[9px] text-on-surface-variant font-medium mt-1">Unreported</span>
          </Card>

          <Card className="p-3 flex flex-col justify-between border-l-2 border-l-secondary bg-surface-container-lowest">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">On Duty</p>
            <h2 className="text-lg font-extrabold text-secondary mt-1">{fmt(data.workforceSummary.onDutyNow)}</h2>
            <span className="text-[9px] text-status-success font-bold mt-1">Live Punch</span>
          </Card>

          <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-warning bg-surface-container-lowest">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Late</p>
            <h2 className="text-lg font-extrabold text-status-warning mt-1">{fmt(data.workforceSummary.lateToday)}</h2>
            <span className="text-[9px] text-on-surface-variant font-medium mt-1">Check-in</span>
          </Card>

          <Card className="p-3 flex flex-col justify-between border-l-2 border-l-pending bg-surface-container-lowest">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">On Leave</p>
            <h2 className="text-lg font-extrabold text-pending mt-1">{fmt(data.workforceSummary.onLeaveToday)}</h2>
            <span className="text-[9px] text-on-surface-variant font-medium mt-1">Approved</span>
          </Card>

          <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-error bg-surface-container-lowest">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Incidents</p>
            <h2 className="text-lg font-extrabold text-status-error mt-1">
              {data.workforceSummary.openIncidents > 0 ? data.workforceSummary.openIncidents : "0"}
            </h2>
            <span className="text-[9px] text-on-surface-variant font-medium mt-1">Open Issues</span>
          </Card>

          <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-warning bg-surface-container-lowest">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Approvals</p>
            <h2 className={`text-lg font-extrabold mt-1 ${data.workforceSummary.pendingApprovals > 0 ? "text-status-warning" : "text-primary"}`}>
              {fmt(data.workforceSummary.pendingApprovals)}
            </h2>
            <span className="text-[9px] text-on-surface-variant font-medium mt-1">Pending</span>
          </Card>

          <Card className="p-3 flex flex-col justify-between border-l-2 border-l-primary bg-surface-container-lowest">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Contracts</p>
            <h2 className="text-lg font-extrabold text-primary mt-1">{fmt(data.workforceSummary.activeContracts)}</h2>
            <span className="text-[9px] text-on-surface-variant font-medium mt-1">Active</span>
          </Card>

          <Card className="p-3 flex flex-col justify-between border-l-2 border-l-secondary bg-surface-container-lowest">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Deployments</p>
            <h2 className="text-lg font-extrabold text-secondary mt-1">{fmt(data.workforceSummary.activeDeployments)}</h2>
            <span className="text-[9px] text-on-surface-variant font-medium mt-1">Active Sites</span>
          </Card>
        </section>

        {/* 2. Workforce Overview Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* White Collar Cluster */}
          {(opTypeFilter === "all" || opTypeFilter === "white") && (
            <Card className="p-4 flex flex-col justify-between border-t-2 border-t-primary">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold text-primary uppercase">White Collar / Corporate</h3>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">Management, IT, HR, and Admin Staff</p>
                  </div>
                  <Badge variant="neutral">{data.workforceOverview.whiteCollar.utilization}% Util</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-surface-container-low p-2 rounded">
                    <p className="text-[9px] font-semibold text-on-surface-variant uppercase">Total</p>
                    <p className="text-sm font-extrabold text-primary mt-0.5">{fmt(data.workforceOverview.whiteCollar.total)}</p>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded">
                    <p className="text-[9px] font-semibold text-on-surface-variant uppercase">Present</p>
                    <p className="text-sm font-extrabold text-status-success mt-0.5">{fmt(data.workforceOverview.whiteCollar.presentToday)}</p>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded">
                    <p className="text-[9px] font-semibold text-on-surface-variant uppercase">On Leave</p>
                    <p className="text-sm font-extrabold text-pending mt-0.5">{fmt(data.workforceOverview.whiteCollar.onLeave)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border-subtle flex justify-between text-[10px] font-medium text-on-surface-variant">
                <span>On Duty Now: <strong>{data.workforceOverview.whiteCollar.onDutyNow}</strong></span>
                <span>Absent: <strong>{data.workforceOverview.whiteCollar.absentToday}</strong></span>
              </div>
            </Card>
          )}

          {/* Security Guarding Cluster */}
          {(opTypeFilter === "all" || opTypeFilter === "security") && (
            <Card className="p-4 flex flex-col justify-between border-t-2 border-t-secondary">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold text-secondary uppercase">Security Guarding</h3>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">MOI Licensed Guards & Coordinators</p>
                  </div>
                  <Badge variant="success">{data.workforceOverview.securityGuarding.utilization}% Util</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-surface-container-low p-2 rounded">
                    <p className="text-[9px] font-semibold text-on-surface-variant uppercase">Total</p>
                    <p className="text-sm font-extrabold text-primary mt-0.5">{fmt(data.workforceOverview.securityGuarding.total)}</p>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded">
                    <p className="text-[9px] font-semibold text-on-surface-variant uppercase">Present</p>
                    <p className="text-sm font-extrabold text-status-success mt-0.5">{fmt(data.workforceOverview.securityGuarding.presentToday)}</p>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded">
                    <p className="text-[9px] font-semibold text-on-surface-variant uppercase">Unassigned</p>
                    <p className="text-sm font-extrabold text-status-warning mt-0.5">{fmt(data.workforceOverview.securityGuarding.pendingDeployment)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border-subtle flex justify-between text-[10px] font-medium text-on-surface-variant">
                <span>On Duty Now: <strong>{data.workforceOverview.securityGuarding.onDutyNow}</strong></span>
                <span>On Leave: <strong>{data.workforceOverview.securityGuarding.onLeave}</strong></span>
              </div>
            </Card>
          )}

          {/* Facility Management Cluster */}
          {(opTypeFilter === "all" || opTypeFilter === "fm") && (
            <Card className="p-4 flex flex-col justify-between border-t-2 border-t-status-success">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold text-status-success uppercase">Facility Management</h3>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">FM Supervisors & Professional Trade Labor</p>
                  </div>
                  <Badge variant="success">{data.workforceOverview.facilityManagement.utilization}% Util</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-surface-container-low p-2 rounded">
                    <p className="text-[9px] font-semibold text-on-surface-variant uppercase">Total</p>
                    <p className="text-sm font-extrabold text-primary mt-0.5">{fmt(data.workforceOverview.facilityManagement.total)}</p>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded">
                    <p className="text-[9px] font-semibold text-on-surface-variant uppercase">Present</p>
                    <p className="text-sm font-extrabold text-status-success mt-0.5">{fmt(data.workforceOverview.facilityManagement.presentToday)}</p>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded">
                    <p className="text-[9px] font-semibold text-on-surface-variant uppercase">Unassigned</p>
                    <p className="text-sm font-extrabold text-status-warning mt-0.5">{fmt(data.workforceOverview.facilityManagement.pendingDeployment)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border-subtle flex justify-between text-[10px] font-medium text-on-surface-variant">
                <span>On Duty Now: <strong>{data.workforceOverview.facilityManagement.onDutyNow}</strong></span>
                <span>On Leave: <strong>{data.workforceOverview.facilityManagement.onLeave}</strong></span>
              </div>
            </Card>
          )}
        </section>

        {/* 3. Operations Health Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Security Guarding Details */}
          {(opTypeFilter === "all" || opTypeFilter === "security") && (
            canViewSecurity ? (
              <Card className="p-4 flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-subtle pb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-secondary">security</span>
                  <span>Security Guarding Operations</span>
                </h3>
                <ul className="space-y-2 text-[11px] font-medium text-on-surface">
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Active Guarding Contracts</span>
                    <strong className="text-primary">{fmt(data.securitySummary.activeContracts)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Active Sites / Guarding Posts</span>
                    <strong className="text-primary">{fmt(data.securitySummary.activeSites)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Guards Deployed Today</span>
                    <strong className="text-status-success">{fmt(data.securitySummary.guardsDeployed)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Uncovered / Vacant Posts</span>
                    <strong className="text-status-error">{data.securitySummary.vacantPosts || "0 (Healthy)"}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Patrol Visits Recorded Today</span>
                    <strong className="text-secondary">{fmt(data.securitySummary.patrolsToday)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Open Incident Reports</span>
                    <strong className={data.securitySummary.openIncidents > 0 ? "text-status-error" : "text-on-surface"}>
                      {data.securitySummary.openIncidents > 0 ? `${data.securitySummary.openIncidents} Open` : "0 (No incidents)"}
                    </strong>
                  </li>
                </ul>
              </Card>
            ) : (
              <Card className="p-4 flex items-center justify-center text-center bg-surface-container-low text-on-surface-variant">
                <p className="text-[11px] italic">Not authorized to view Security Guarding Operations</p>
              </Card>
            )
          )}

          {/* Facility Management Details */}
          {(opTypeFilter === "all" || opTypeFilter === "fm") && (
            canViewFM ? (
              <Card className="p-4 flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-subtle pb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-status-success">home_repair_service</span>
                  <span>Facility Management Operations</span>
                </h3>
                <ul className="space-y-2 text-[11px] font-medium text-on-surface">
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Active FM Projects</span>
                    <strong className="text-primary">{fmt(data.facilitySummary.activeProjects)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Staff Deployed Today</span>
                    <strong className="text-status-success">{fmt(data.facilitySummary.staffDeployed)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Open Maintenance Reports</span>
                    <strong className="text-on-surface">{data.facilitySummary.openWorkReports || "0 (No reports)"}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Pending Client Feedback</span>
                    <strong className="text-status-warning">{data.facilitySummary.feedbackPending || "0 (None)"}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Reliever / Standby Assignments</span>
                    <strong className="text-secondary">{fmt(data.facilitySummary.relieverRequests)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Open Site Issues</span>
                    <strong className="text-on-surface">{data.facilitySummary.openIncidents || "0 (No issues)"}</strong>
                  </li>
                </ul>
              </Card>
            ) : (
              <Card className="p-4 flex items-center justify-center text-center bg-surface-container-low text-on-surface-variant">
                <p className="text-[11px] italic">Not authorized to view Facility Management Operations</p>
              </Card>
            )
          )}

          {/* White Collar / Corporate Health */}
          {(opTypeFilter === "all" || opTypeFilter === "white") && (
            canViewCorporate ? (
              <Card className="p-4 flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-subtle pb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">corporate_fare</span>
                  <span>Corporate & White Collar</span>
                </h3>
                <ul className="space-y-2 text-[11px] font-medium text-on-surface">
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Active Office Staff</span>
                    <strong className="text-primary">{fmt(data.corporateSummary.activeStaff)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Present Office Today</span>
                    <strong className="text-status-success">{fmt(data.corporateSummary.presentToday)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Approved Leaves Today</span>
                    <strong className="text-pending">{fmt(data.corporateSummary.onLeave)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Late Arrivals Today</span>
                    <strong className="text-status-warning">{fmt(data.corporateSummary.lateToday)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Pending Leave Requisitions</span>
                    <strong className="text-status-warning">{fmt(data.corporateSummary.pendingLeaveApprovals)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-on-surface-variant">Pending HR Clearance Actions</span>
                    <strong className="text-on-surface">{data.corporateSummary.pendingClearances || "0 (No backlog)"}</strong>
                  </li>
                </ul>
              </Card>
            ) : (
              <Card className="p-4 flex items-center justify-center text-center bg-surface-container-low text-on-surface-variant">
                <p className="text-[11px] italic">Not authorized to view Corporate Details</p>
              </Card>
            )
          )}
        </section>

        {/* 4. Attendance, Leave, Shift & Contract Summaries */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Attendance Summary */}
          <Card className="p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-primary border-b border-border-subtle pb-2 flex justify-between items-center">
              <span>Attendance Log Summary</span>
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">how_to_reg</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
              <div className="bg-surface-container p-2 rounded">
                <span className="text-on-surface-variant uppercase text-[8px]">Present</span>
                <p className="text-sm text-status-success mt-0.5">{fmt(data.attendanceSummary.present)}</p>
              </div>
              <div className="bg-surface-container p-2 rounded">
                <span className="text-on-surface-variant uppercase text-[8px]">Absent</span>
                <p className="text-sm text-status-error mt-0.5">{fmt(data.attendanceSummary.absent)}</p>
              </div>
              <div className="bg-surface-container p-2 rounded">
                <span className="text-on-surface-variant uppercase text-[8px]">Late</span>
                <p className="text-sm text-status-warning mt-0.5">{fmt(data.attendanceSummary.late)}</p>
              </div>
              <div className="bg-surface-container p-2 rounded">
                <span className="text-on-surface-variant uppercase text-[8px]">Missing Out</span>
                <p className="text-sm text-status-error mt-0.5">{fmt(data.attendanceSummary.missingCheckout)}</p>
              </div>
            </div>
          </Card>

          {/* Leave Summary */}
          <Card className="p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-primary border-b border-border-subtle pb-2 flex justify-between items-center">
              <span>Leave Summary</span>
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">calendar_today</span>
            </h3>
            <ul className="space-y-2 text-[11px] font-medium text-on-surface">
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Pending Approvals</span>
                <strong className="text-status-warning">{fmt(data.leaveSummary.pendingApproval)}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Approved in Period</span>
                <strong className="text-pending">{fmt(data.leaveSummary.approvedToday)}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Currently On Leave</span>
                <strong className="text-pending">{fmt(data.leaveSummary.onLeaveToday)}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Upcoming (Next 7 Days)</span>
                <strong className="text-primary">{fmt(data.leaveSummary.upcomingNext7Days)}</strong>
              </li>
            </ul>
          </Card>

          {/* Shift & Deployment */}
          <Card className="p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-primary border-b border-border-subtle pb-2 flex justify-between items-center">
              <span>Shift & Deployment</span>
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">calendar_view_week</span>
            </h3>
            <ul className="space-y-2 text-[11px] font-medium text-on-surface">
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Active Shifts in Period</span>
                <strong className="text-primary">{fmt(data.shiftDeploymentSummary.activeShiftsToday)}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Employees Deployed</span>
                <strong className="text-status-success">{fmt(data.shiftDeploymentSummary.deployedToday)}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Open Deployment Gaps</span>
                <strong className="text-status-error">{data.shiftDeploymentSummary.openGaps || "0 (No gaps)"}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Relievers Deployed</span>
                <strong className="text-secondary">{fmt(data.shiftDeploymentSummary.relieverAssignments)}</strong>
              </li>
            </ul>
          </Card>

          {/* Contracts & Projects */}
          <Card className="p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-primary border-b border-border-subtle pb-2 flex justify-between items-center">
              <span>Contracts & Projects</span>
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">file_copy</span>
            </h3>
            <ul className="space-y-2 text-[11px] font-medium text-on-surface">
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Active Contracts</span>
                <strong className="text-primary">{fmt(data.contractSummary.active)}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Draft / Pending Approvals</span>
                <strong className="text-status-warning">{fmt(data.contractSummary.draft)} / {fmt(data.contractSummary.pendingApproval)}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Expiring (Within 30 Days)</span>
                <strong className="text-status-error">{fmt(data.contractSummary.expiring30Days)}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-on-surface-variant">Active Projects / Sites</span>
                <strong className="text-primary">{fmt(data.contractSummary.activeProjects)}</strong>
              </li>
            </ul>
          </Card>
        </section>

        {/* Universal Approval Center Widget */}
        <section>
          <MyApprovalsWidget />
        </section>

        {/* 5. Approval Center & Exception Risk Control */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Risk & Exceptions Center */}
          <Card className="p-4 flex flex-col gap-3 md:col-span-2 border-l-4 border-l-status-error bg-status-error/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-status-error pb-2 border-b border-status-error/20 flex justify-between items-center">
              <span>Executive Risk & Compliance Exception Ledger</span>
              <span className="material-symbols-outlined text-status-error text-[18px]">warning</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-medium text-on-surface">
              <div className="space-y-2">
                <div className="flex justify-between bg-white p-2 rounded border border-border-subtle shadow-sm">
                  <span className="text-on-surface-variant">Employees Without Default Location</span>
                  <Badge variant={data.exceptionSummary.noDefaultLocation > 0 ? "error" : "success"}>
                    {data.exceptionSummary.noDefaultLocation} Records
                  </Badge>
                </div>
                <div className="flex justify-between bg-white p-2 rounded border border-border-subtle shadow-sm">
                  <span className="text-on-surface-variant">Active Blue Collar Without Deployment Today</span>
                  <Badge variant={data.exceptionSummary.noActiveDeployment > 0 ? "warning" : "success"}>
                    {data.exceptionSummary.noActiveDeployment} Staff
                  </Badge>
                </div>
                <div className="flex justify-between bg-white p-2 rounded border border-border-subtle shadow-sm">
                  <span className="text-on-surface-variant">Qatar IDs Expiring Within 30/60 Days</span>
                  <Badge variant={data.exceptionSummary.expiringQid30 > 0 ? "error" : "success"}>
                    {data.exceptionSummary.expiringQid30} / {data.exceptionSummary.expiringQid60}
                  </Badge>
                </div>
                <div className="flex justify-between bg-white p-2 rounded border border-border-subtle shadow-sm">
                  <span className="text-on-surface-variant">Passports Expiring Within 30/60 Days</span>
                  <Badge variant={data.exceptionSummary.expiringPassport30 > 0 ? "warning" : "success"}>
                    {data.exceptionSummary.expiringPassport30} / {data.exceptionSummary.expiringPassport60}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between bg-white p-2 rounded border border-border-subtle shadow-sm">
                  <span className="text-on-surface-variant">Visa & Work Permits Expiring (30 days)</span>
                  <Badge variant={data.exceptionSummary.expiringVisa30 > 0 ? "error" : "success"}>
                    {data.exceptionSummary.expiringVisa30} Records
                  </Badge>
                </div>
                <div className="flex justify-between bg-white p-2 rounded border border-border-subtle shadow-sm">
                  <span className="text-on-surface-variant">MOI Licenses & Gate Passes Expiring</span>
                  <Badge variant={data.exceptionSummary.expiringMoiLicense30 > 0 ? "error" : "success"}>
                    {data.exceptionSummary.expiringMoiLicense30} / {data.exceptionSummary.expiringGatePass30}
                  </Badge>
                </div>
                <div className="flex justify-between bg-white p-2 rounded border border-border-subtle shadow-sm">
                  <span className="text-on-surface-variant">Health Cards Expiring (30 days)</span>
                  <Badge variant={data.exceptionSummary.expiringHealthCard30 > 0 ? "warning" : "success"}>
                    {data.exceptionSummary.expiringHealthCard30} Records
                  </Badge>
                </div>
                <div className="flex justify-between bg-white p-2 rounded border border-border-subtle shadow-sm">
                  <span className="text-on-surface-variant">Active Employees with Disabled Login Access</span>
                  <Badge variant={data.exceptionSummary.activeWithDisabledLogin > 0 ? "warning" : "success"}>
                    {data.exceptionSummary.activeWithDisabledLogin} Users
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Approval Center Summary */}
          <Card className="p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-subtle pb-2 flex justify-between items-center">
              <span>Pending Approvals Portal</span>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">verified_user</span>
            </h3>
            <ul className="space-y-2 text-[11px] font-medium text-on-surface">
              <li className="flex justify-between items-center">
                <span className="text-on-surface-variant">Leave Requests</span>
                <Badge variant={data.approvalSummary.leaveApprovals > 0 ? "warning" : "neutral"}>{data.approvalSummary.leaveApprovals} Pending</Badge>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-on-surface-variant">Attendance Corrections</span>
                <Badge variant="neutral">{data.approvalSummary.attendanceCorrections} Pending</Badge>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-on-surface-variant">Overtime Approvals</span>
                <Badge variant="neutral">{data.approvalSummary.overtime} Pending</Badge>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-on-surface-variant">Deployment Plans</span>
                <Badge variant={data.approvalSummary.deployments > 0 ? "warning" : "neutral"}>{data.approvalSummary.deployments} Pending</Badge>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-on-surface-variant">Manpower Contracts</span>
                <Badge variant={data.approvalSummary.contracts > 0 ? "warning" : "neutral"}>{data.approvalSummary.contracts} Pending</Badge>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-on-surface-variant">Contract Addendums</span>
                <Badge variant={data.approvalSummary.addendums > 0 ? "warning" : "neutral"}>{data.approvalSummary.addendums} Pending</Badge>
              </li>
            </ul>
          </Card>
        </section>

        {/* 6. Report Snapshot Section */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-3 bg-surface-container-low border border-border-subtle flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Attendance Report</span>
              <Badge variant="success">{data.reportSnapshot.attendanceReport}</Badge>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2 font-medium">Daily register ready & updated.</p>
          </Card>

          <Card className="p-3 bg-surface-container-low border border-border-subtle flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Leave Status</span>
              <Badge variant="success">{data.reportSnapshot.leaveReport}</Badge>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2 font-medium">Leave balances matched with payroll.</p>
          </Card>

          <Card className="p-3 bg-surface-container-low border border-border-subtle flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Security Operations</span>
              <Badge variant="success">{data.reportSnapshot.securityReport}</Badge>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2 font-medium">Patrols and supervisor inspections logged.</p>
          </Card>

          <Card className="p-3 bg-surface-container-low border border-border-subtle flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Audit Log Activity</span>
              <Badge variant="neutral">{data.reportSnapshot.auditActivityToday} actions</Badge>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2 font-medium">System activity tracked today.</p>
          </Card>
        </section>

        {/* 7. Live Regional Activity — Moved to Bottom */}
        <Card className="overflow-hidden relative p-0 min-h-[400px] flex flex-col border border-border-subtle bg-slate-950">
          <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md p-3 rounded-lg border border-border-subtle shadow-md">
            <h3 className="text-xs font-bold text-primary">Live Regional Activity (Doha Grid)</h3>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-on-surface-variant">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-status-success shadow-[0_0_8px_#1E8E3E]"></span>
                <span>Active Duty</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-status-warning shadow-[0_0_8px_#F9AB00]"></span>
                <span>On Break</span>
              </div>
            </div>
          </div>

          {/* Interactive SVG Doha Map */}
          <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center p-6 min-h-[350px]">
            <div className="absolute inset-0 opacity-10 dot-pattern"></div>
            {/* Mock Map Shapes */}
            <svg viewBox="0 0 500 350" className="w-full h-full text-slate-800 opacity-40">
              <path d="M 50,50 Q 150,120 250,50 T 450,50 L 450,300 Q 300,320 250,280 T 50,300 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M 120,80 Q 200,160 280,100 T 400,120" fill="none" stroke="currentColor" strokeWidth="1" />
              {/* Doha Bay Curve */}
              <path d="M 320,180 Q 380,240 480,220" fill="none" stroke="#0058be" strokeWidth="6" className="opacity-30" />
            </svg>

            {/* Dynamic location pins from actual attendance / deployment geodata */}
            {data.regionalActivity.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-slate-400 text-xs font-bold p-4 text-center">
                <div>
                  <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">map</span>
                  <p>Location activity available when attendance/deployment location data is recorded.</p>
                </div>
              </div>
            ) : (
              data.regionalActivity.map((reg, idx) => {
                const xPos = [180, 260, 120, 310, 210, 380][idx % 6];
                const yPos = [120, 210, 160, 260, 80, 180][idx % 6];
                return (
                  <div
                    key={reg.name}
                    className="absolute flex flex-col items-center group/pin"
                    style={{ left: `${xPos}px`, top: `${yPos}px` }}
                  >
                    <div className="w-5 h-5 rounded-full bg-status-success shadow-[0_0_12px_#1E8E3E] animate-pulse border-2 border-white flex items-center justify-center text-[9px] font-extrabold text-white cursor-help">
                      {reg.count}
                    </div>
                    <div className="absolute top-6 z-20 bg-slate-900 text-white text-[10px] p-2 rounded shadow-xl whitespace-nowrap flex flex-col border border-slate-700 pointer-events-none opacity-0 group-hover/pin:opacity-100 transition-opacity">
                      <p className="font-bold">{reg.name}</p>
                      <p className="opacity-75">{reg.count} operatives on duty</p>
                    </div>
                  </div>
                );
              })
            )}

            <div className="absolute bottom-4 right-4 z-10 flex gap-2">
              <button className="bg-primary text-on-primary w-8 h-8 flex items-center justify-center rounded shadow-lg hover:scale-105 active:scale-95 transition-transform"><span className="material-symbols-outlined text-[18px]">add</span></button>
              <button className="bg-primary text-on-primary w-8 h-8 flex items-center justify-center rounded shadow-lg hover:scale-105 active:scale-95 transition-transform"><span className="material-symbols-outlined text-[18px]">remove</span></button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
