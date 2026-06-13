"use client";

import React, { useState } from "react";
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
  { label: "Workforce Directory", path: "/workforce", icon: "group" },
  { label: "Attendance Monitor", path: "/attendance", icon: "fact_check" },
  { label: "Leave Management", path: "/leave", icon: "event_busy" },
  { label: "Reports Hub", path: "/reports", icon: "analytics" },
  { label: "SAP Integration Hub", path: "/sap", icon: "hub" },
  { label: "SAP Field Mapping", path: "/sap/mapping", icon: "account_tree" },
  { label: "Shift Master", path: "/shifts", icon: "schedule" },
  { label: "Master Data Hub", path: "/admin/masters", icon: "database" },
  { label: "Backup & Restore", path: "/admin/backup", icon: "settings_backup_restore" },
  { label: "Settings", path: "/settings", icon: "settings" }
];

export const LayoutShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data: session, status } = useSession();
  const activeNavItems = filterNavigationByPermissions(session?.user as any, navItems);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/" || pathname === "/dashboard";
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
          <span className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">domain</span>
            AHH WFM
          </span>
          <nav className="hidden md:flex items-center gap-6 h-full text-sm font-medium">
            <Link
              href="/"
              className={pathname === "/" || pathname === "/dashboard" ? "text-primary border-b-2 border-primary pb-1 font-bold" : "text-on-surface-variant hover:text-primary transition-colors pb-1"}
            >
              Overview
            </Link>
            <Link
              href="/sap"
              className={pathname.startsWith("/sap") ? "text-primary border-b-2 border-primary pb-1 font-bold" : "text-on-surface-variant hover:text-primary transition-colors pb-1"}
            >
              SAP Integration
            </Link>
            <Link
              href="/shifts"
              className={pathname.startsWith("/shifts") ? "text-primary border-b-2 border-primary pb-1 font-bold" : "text-on-surface-variant hover:text-primary transition-colors pb-1"}
            >
              Rotations
            </Link>
            <Link
              href="/reports"
              className={pathname.startsWith("/reports") ? "text-primary border-b-2 border-primary pb-1 font-bold" : "text-on-surface-variant hover:text-primary transition-colors pb-1"}
            >
              Reports
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors relative">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-status-error rounded-full border-2 border-white"></span>
            </button>
          </div>
          <div className="h-8 w-px bg-outline-variant hidden sm:block"></div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-secondary-container/20 overflow-hidden border border-outline-variant hidden sm:block">
              <img
                alt="Profile"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCNg_eu9oG9o7KjewqM98cvsKuUdEVWVK0s3YKUP9C6iKThWOar1LkwzZ21V0itvr30GNrpeo6Lf-BVTq3zqZHCMLxfsz-Y_883nu06UTnX1NlPJseense4FERMEYMKBnWgZkxjllCzEsptMEVQyR_BW6e8d1k_TlXpycYaweyAXIqm1AlOgG0YExHTAnGoXUNuLeIOHWijpRfTG5lAioKKpJRv3eF27Ox7cFp_XDgHeQzojDiO-wOBydVZ0f1O8GWiz-fnBzwWlQ"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-primary hidden md:block">{session?.user?.name || "System Admin"}</p>
              <p className="text-[10px] text-on-surface-variant leading-none hidden md:block">{(session?.user as any)?.role || "Admin Console"}</p>
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
            <p className="text-xs font-bold text-secondary-container uppercase tracking-widest">WFM Control Suite</p>
            <p className="text-[10px] text-outline-variant opacity-70">SuccessFactors Sync Hub</p>
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
                  <p className="text-xs font-bold text-secondary-container uppercase tracking-widest">WFM Control Suite</p>
                  <p className="text-[10px] text-outline-variant opacity-70">Mobile Drawer</p>
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
