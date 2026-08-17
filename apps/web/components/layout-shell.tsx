"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { filterNavigationByPermissions } from "@/lib/permissions";


// Class merging helper
const cn = (...classes: (string | undefined | boolean)[]) => classes.filter(Boolean).join(" ");

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/", icon: "dashboard" },
  { label: "Approval Center", path: "/approvals", icon: "task_alt" },
  { label: "Workforce Directory", path: "/workforce", icon: "group" },
  { label: "Security Guarding", path: "/manpower/security-guarding/dashboard", icon: "security" },
  { label: "Facility Management", path: "/manpower/facility-management/dashboard", icon: "business" },
  { label: "Commercial & Contracts", path: "/commercial/dashboard", icon: "handshake" },
  { label: "Attendance Monitor", path: "/attendance", icon: "fact_check" },
  { label: "Leave Management", path: "/leave", icon: "event_busy" },
  { label: "Clearance Management", path: "/clearance", icon: "task" },
  { label: "Reports Hub", path: "/reports", icon: "analytics" },
  { label: "Shift Master", path: "/shifts", icon: "schedule" },
  { label: "Master Data Hub", path: "/settings/masters", icon: "database" },
  { label: "Settings", path: "/settings", icon: "settings" }
];

export const LayoutShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data: session, status } = useSession();
  const isSecurityGuarding = pathname.startsWith("/manpower/security-guarding");
  const isFacilityManagement = pathname.startsWith("/manpower/facility-management");
  const isSecfac = pathname.startsWith("/secfac");
  const isCommercial = pathname.startsWith("/commercial");

  let currentNavItems = navItems;
  let sidebarTitle = "WFM Control Suite";
  let sidebarSubtitle = "SuccessFactors Sync Hub";

  if (isSecurityGuarding) {
    currentNavItems = [
      { label: "← Back to Main Menu", path: "/", icon: "arrow_back" },
      { label: "Security Dashboard", path: "/manpower/security-guarding/dashboard", icon: "dashboard" },
      { label: "Alerts & Escalations", path: "/manpower/security-guarding/alerts", icon: "notification_important" },
      { label: "Clients", path: "/manpower/security-guarding/clients", icon: "handshake" },
      { label: "Contracts", path: "/manpower/security-guarding/contracts", icon: "description" },
      { label: "Projects", path: "/manpower/security-guarding/projects", icon: "business_center" },
      { label: "Sites", path: "/manpower/security-guarding/sites", icon: "pin_drop" },
      { label: "Gates / Posts / Zones", path: "/manpower/security-guarding/zones", icon: "door_sliding" },
      { label: "Manpower Directory", path: "/manpower/security-guarding/manpower", icon: "badge" },
      { label: "Shift Planner", path: "/manpower/security-guarding/deployment-calendar", icon: "calendar_month" },
      { label: "Reliever Pools", path: "/manpower/security-guarding/reliever-pools", icon: "groups" },
      { label: "Project Coordinators", path: "/manpower/security-guarding/coordinators", icon: "assignment_turned_in" },
      { label: "Material Master", path: "/manpower/security-guarding/materials", icon: "inventory_2" },
      { label: "SECFAC Center", path: "/secfac?operationType=SECURITY_GUARDING", icon: "terminal" }
    ];
    sidebarTitle = "Security Guarding";
    sidebarSubtitle = "Operations & Compliance";
  } else if (isFacilityManagement) {
    currentNavItems = [
      { label: "← Back to Main Menu", path: "/", icon: "arrow_back" },
      { label: "FM Dashboard", path: "/manpower/facility-management/dashboard", icon: "dashboard" },
      { label: "Alerts & Escalations", path: "/manpower/facility-management/alerts", icon: "notification_important" },
      { label: "Clients", path: "/manpower/facility-management/clients", icon: "handshake" },
      { label: "Contracts", path: "/manpower/facility-management/contracts", icon: "description" },
      { label: "Projects", path: "/manpower/facility-management/projects", icon: "business_center" },
      { label: "Sites", path: "/manpower/facility-management/sites", icon: "pin_drop" },
      { label: "Facility Areas", path: "/manpower/facility-management/areas", icon: "location_city" },
      { label: "Manpower Directory", path: "/manpower/facility-management/manpower", icon: "badge" },
      { label: "Shift Planner", path: "/manpower/facility-management/deployment-calendar", icon: "calendar_month" },
      { label: "Material Master", path: "/manpower/facility-management/materials", icon: "inventory_2" },
      { label: "SECFAC Center", path: "/secfac?operationType=FACILITY_MANAGEMENT", icon: "terminal" }
    ];
    sidebarTitle = "Facility Management";
    sidebarSubtitle = "Operations & Services";
  } else if (isSecfac) {
    currentNavItems = [
      { label: "← Back to Main Menu", path: "/", icon: "arrow_back" },
      { label: "Control Center Home", path: "/secfac", icon: "terminal" },
      { label: "Control Room", path: "/secfac/control-room", icon: "dashboard" },
      { label: "Checkpoints", path: "/secfac/checkpoints", icon: "location_on" },
      { label: "Checklist Builder", path: "/secfac/checklist-builder", icon: "rule" },
      { label: "Security Post Orders", path: "/secfac/post-orders", icon: "article" },
      { label: "Shift Briefings", path: "/secfac/shift-briefings", icon: "groups" },
      { label: "Patrol Routes", path: "/secfac/patrol-routes", icon: "route" },
      { label: "Assignments", path: "/secfac/assignments", icon: "assignment" },
      { label: "Live Monitoring", path: "/secfac/live-monitoring", icon: "visibility" },
      { label: "SOS Alerts", path: "/secfac/sos-alerts", icon: "emergency" },
      { label: "Incidents & Occurrences", path: "/secfac/incidents", icon: "warning" },
      { label: "Supervisor Inspections", path: "/secfac/supervisor-inspections", icon: "fact_check" },
      { label: "Reports", path: "/secfac/reports", icon: "description" },
      { label: "Audit Trail", path: "/secfac/audit-trail", icon: "history" }
    ];
    sidebarTitle = "SECFAC Control Suite";
    sidebarSubtitle = "Guard Tour & Inspections";
  }
 else if (isCommercial) {
    currentNavItems = [
      { label: "← Back to Main Menu", path: "/", icon: "arrow_back" },
      { label: "Commercial Dashboard", path: "/commercial/dashboard", icon: "dashboard" },
      { label: "Commercial Command Center", path: "/commercial/command-center", icon: "hub" },
      { label: "Roster Coverage Console", path: "/commercial/command-center/roster-coverage", icon: "grid_view" },
      { label: "CRM & Enquiries", path: "/commercial/crm", icon: "chat" },
      { label: "Opportunities", path: "/commercial/opportunities", icon: "lightbulb" },
      { label: "Site Surveys", path: "/commercial/surveys", icon: "explore" },
      { label: "Costing", path: "/commercial/costing", icon: "payments" },
      { label: "Quotations", path: "/commercial/quotations", icon: "request_quote" },
      { label: "Contracts", path: "/commercial/contracts", icon: "description" },
      { label: "Handover", path: "/commercial/handover", icon: "assignment_turned_in" },
      { label: "Contract Amendments", path: "/commercial/amendments", icon: "edit_document" },
      { label: "Contract Renewals", path: "/commercial/renewals", icon: "autorenew" },
      { label: "Activities", path: "/commercial/activities", icon: "history" },
      { label: "Reports", path: "/commercial/reports", icon: "analytics" }
    ];
    sidebarTitle = "Commercial & Contracts";
    sidebarSubtitle = "Sales & Operations Hub";
  }

  const activeNavItems = filterNavigationByPermissions(session?.user as any, currentNavItems);
  const [profile, setProfile] = useState<any>(null);
  const [alertSummary, setAlertSummary] = useState<{ open: number; critical: number } | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/v1/me");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.error("Failed to fetch profile in LayoutShell:", e);
    }
  };

  const fetchAlertCount = useCallback(async () => {
    try {
      const opAccess = (session?.user as any)?.operationAccess;
      let targetOp = "SECURITY_GUARDING";
      if (isFacilityManagement) {
        targetOp = "FACILITY_MANAGEMENT";
      } else if (!isSecurityGuarding && opAccess?.allowedFacilityManagement && !opAccess?.allowedSecurityGuarding) {
        targetOp = "FACILITY_MANAGEMENT";
      }

      const res = await fetch(`/api/v1/secfac/alerts/count?operationType=${targetOp}`);
      if (res.ok) {
        const data = await res.json();
        setAlertSummary({ open: data.open || 0, critical: data.critical || 0 });
      }
    } catch (e) {
      // Quiet fail for header indicator
    }
  }, [session, isSecurityGuarding, isFacilityManagement]);

  useEffect(() => {
    if (session) {
      fetchProfile();
      fetchAlertCount();
    }
  }, [session, fetchAlertCount]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      fetchProfile();
    };
    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, []);

  const alertConsoleTarget = isFacilityManagement
    ? "/manpower/facility-management/alerts"
    : "/manpower/security-guarding/alerts";

  const isActive = (path: string) => {
    if (path === "/commercial/dashboard") {
      return pathname.startsWith("/commercial");
    }
    if (path === "/") {
      return pathname === "/" || pathname === "/dashboard";
    }
    if (path === "/manpower") {
      return pathname === "/manpower";
    }
    if (path === "/settings/masters") {
      return pathname === "/settings/masters" || pathname === "/admin/masters";
    }
    if (path === "/settings") {
      if (pathname === "/settings/masters" || pathname === "/admin/masters") {
        return false;
      }
      return pathname.startsWith("/settings") || 
             pathname === "/sap" || 
             pathname.startsWith("/admin/backup") || 
             pathname.startsWith("/admin/production") || 
             pathname.startsWith("/reports/audit");
    }
    return pathname.startsWith(path);
  };

  const isAuthPage = pathname === "/login" || pathname.startsWith("/login");

  if (isAuthPage) {
    return <div className="min-h-screen bg-surface flex flex-col font-sans">{children}</div>;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center font-sans">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
          <p className="mt-2 text-xs font-bold text-on-surface-variant">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <div className="min-h-screen bg-surface flex flex-col font-sans">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      {/* Header Bar */}
      <header className="bg-surface-container-lowest border-b border-border-subtle fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 md:px-margin-desktop w-full">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <Link href="/" className="text-xl font-bold tracking-tight text-primary flex items-center gap-2 hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-secondary">domain</span>
            AHH WFM
          </Link>
          <nav className="hidden md:flex items-center gap-6 h-full text-sm font-medium">
            <Link
              href="/"
              className={pathname === "/" || pathname === "/dashboard" ? "text-primary border-b-2 border-primary pb-1 font-bold" : "text-on-surface-variant hover:text-primary transition-colors pb-1"}
            >
              Overview
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Link
              href={alertConsoleTarget}
              title="Operational Alerts Console"
              className="p-2 hover:bg-surface-container-low rounded-full transition-colors relative flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {(alertSummary && alertSummary.open > 0) ? (
                <span className="absolute top-1 right-1 px-1.5 py-0.2 min-w-[18px] text-[10px] font-extrabold bg-status-error text-white rounded-full border border-white flex items-center justify-center leading-none">
                  {alertSummary.open > 99 ? "99+" : alertSummary.open}
                </span>
              ) : null}
            </Link>
          </div>

          <div className="h-8 w-px bg-outline-variant hidden sm:block"></div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-secondary-container/20 overflow-hidden border border-outline-variant hidden sm:flex items-center justify-center shrink-0">
              {(profile?.profilePhotoUrl || session?.user?.image) ? (
                <img
                  alt="Profile"
                  className="w-full h-full object-cover"
                  src={`${profile?.profilePhotoUrl || session?.user?.image}?v=${profile?.profilePhotoUpdatedAt || (session?.user as any)?.profilePhotoUpdatedAt || ''}`}
                />
              ) : (
                <span className="text-xs font-bold text-primary">
                  {((profile?.name || session?.user?.name || "System Admin").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2))}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-primary hidden md:block">{profile?.name || session?.user?.name || "System Admin"}</p>
              <p className="text-[10px] text-on-surface-variant leading-none hidden md:block">{profile?.role || (session?.user as any)?.role || "Admin Console"}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-1.5 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-status-error transition-colors flex items-center justify-center"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16 relative">
        {/* Desktop Sidebar Navigation */}
        <aside className="bg-primary fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 border-r border-border-subtle py-6 flex flex-col gap-2 z-40 hidden md:flex text-on-primary">
          <div className="px-6 mb-6">
            <p className="text-xs font-bold text-secondary-container uppercase tracking-widest">{sidebarTitle}</p>
            <p className="text-[10px] text-outline-variant opacity-70">{sidebarSubtitle}</p>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {activeNavItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold transition-all",
                    active
                      ? "bg-secondary text-white shadow-md border-l-4 border-secondary-container"
                      : "text-outline-variant hover:bg-primary-container hover:text-white"
                  )}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="px-4 mt-auto border-t border-primary-container pt-4 space-y-2">
            <Link
              href="https://stitch.withgoogle.com/projects/204664606318977328?pli=1"
              target="_blank"
              className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-outline-variant hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              <span>Open Stitch Project</span>
            </Link>
            <p className="text-[10px] text-outline-variant opacity-50 text-center">Version 1.0.0 (Localhost)</p>
          </div>
        </aside>

        {/* Mobile Slide-over Drawer */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
            {/* Drawer */}
            <aside className="relative bg-primary w-64 h-full py-6 flex flex-col gap-2 text-on-primary z-10 shadow-2xl">
              <div className="px-6 mb-6 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-secondary-container uppercase tracking-widest">{sidebarTitle}</p>
                  <p className="text-[10px] text-outline-variant opacity-70">{isSecurityGuarding ? "Operations & Compliance" : isFacilityManagement ? "Operations & Services" : "Mobile Drawer"}</p>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded-full hover:bg-primary-container text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <nav className="flex-grow px-3 space-y-1">
                {activeNavItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold transition-all",
                        active
                          ? "bg-secondary text-white shadow-md border-l-4 border-secondary-container"
                          : "text-outline-variant hover:bg-primary-container hover:text-white"
                      )}
                    >
                      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content Canvas */}
        <main className="flex-grow ml-0 md:ml-64 p-6 dot-pattern overflow-y-auto min-h-[calc(100vh-4rem)]">
          <div className="max-w-[1400px] mx-auto w-full pb-16">{children}</div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-surface-container-low border-t border-border-subtle py-4 w-full flex flex-col md:flex-row justify-between px-6 md:px-margin-desktop items-center gap-2 z-10 mt-auto md:pl-[18rem]">
        <p className="text-xs text-on-surface-variant font-medium">© 2026 AHH WFM Enterprise. All rights reserved.</p>
        <div className="flex gap-6 text-xs text-on-surface-variant font-medium">
          <Link href="/settings" className="hover:text-primary transition-colors">Settings</Link>
          <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <Link href="/sap" className="hover:text-primary transition-colors">API Docs</Link>
        </div>
      </footer>
    </div>
  );
};
