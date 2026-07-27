"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { hasPermission, isAdminUser } from "@/lib/permissions";

interface SettingsSidebarItem {
  label: string;
  path: string;
  icon: string;
  permission?: string;
  permissions?: string[];
}

const SIDEBAR_ITEMS: SettingsSidebarItem[] = [
  {
    label: "General Settings",
    path: "/settings?tab=general",
    icon: "settings",
    permission: "settings.view",
  },
  {
    label: "Master Data",
    path: "/settings/masters",
    icon: "database",
    permission: "masterdata.view",
  },
  {
    label: "Work Calendars & Holidays",
    path: "/settings/manpower-calendars",
    icon: "calendar_month",
    permissions: ["manpower.calendars.manage", "manpower.calendars.approve"],
  },
  {
    label: "Workflow Setup",
    path: "/settings?tab=workflowManagement",
    icon: "flowsheet",
    permission: "settings.view",
  },
  {
    label: "User Roles & Permissions",
    path: "/settings?tab=rolesPermissions",
    icon: "shield_person",
    permission: "settings.roles.manage",
  },
  {
    label: "Integration Hub",
    path: "/settings/integration",
    icon: "hub",
    permission: "settings.integration.view",
  },
  {
    label: "Backup & Restore",
    path: "/settings/backup",
    icon: "settings_backup_restore",
    permission: "settings.backup.view",
  },
  {
    label: "User Action Audits",
    path: "/settings/audit",
    icon: "history_toggle_off",
    permission: "settings.audit.view",
  },
  {
    label: "Production Readiness",
    path: "/settings/production",
    icon: "fact_check",
    permission: "settings.productionReadiness.view",
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const user = session?.user as any;

  const isLinkActive = (itemPath: string) => {
    if (itemPath.includes("?tab=")) {
      const tabName = itemPath.split("?tab=")[1];
      return pathname === "/settings" && searchParams.get("tab") === tabName;
    }
    if (itemPath === "/settings") {
      return pathname === "/settings" && (!searchParams.get("tab") || searchParams.get("tab") === "general");
    }
    return pathname.startsWith(itemPath);
  };

  // Filter sidebar items by user permissions (Admins get everything automatically)
  const allowedItems = SIDEBAR_ITEMS.filter((item) => {
    if (!user) return false;
    if (isAdminUser(user)) return true;
    if (item.permissions && item.permissions.length > 0) {
      return item.permissions.some((p) => hasPermission(user, p));
    }
    return item.permission ? hasPermission(user, item.permission) : false;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full px-0 min-h-[calc(100vh-8rem)]">
      {/* Settings Sub-Sidebar */}
      <aside className="w-full lg:w-60 shrink-0 bg-surface-container-lowest border border-border-subtle rounded-xl p-3 flex flex-col gap-1 shadow-sm h-fit">
        <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-outline-variant border-b border-border-subtle mb-1">
          System Administration
        </div>
        <nav className="flex flex-col gap-0.5">
          {allowedItems.map((item) => {
            const active = isLinkActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  active
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Settings Content Area */}
      <div className="flex-1 min-w-0 px-0">
        {children}
      </div>
    </div>
  );
}
