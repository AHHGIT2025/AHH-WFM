"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface MobileNavItem {
  label: string;
  path: string;
  icon: string;
}

const navItems: MobileNavItem[] = [
  { label: "Home", path: "/", icon: "home" },
  { label: "History", path: "/history", icon: "calendar_month" },
  { label: "Leave", path: "/leave", icon: "event_note" },
  { label: "News", path: "/news", icon: "campaign" },
  { label: "Profile", path: "/profile", icon: "person" }
];

export const MobileShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center py-6 px-4 font-sans antialiased">
      {/* Smartphone Frame Simulator Container */}
      <div className="w-full max-w-[430px] h-[884px] bg-background border-[8px] border-slate-800 rounded-[40px] shadow-2xl relative flex flex-col overflow-hidden">
        {/* Dynamic Island / Device Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-full z-[100] flex items-center justify-center">
          <div className="w-3.5 h-3.5 bg-slate-900 rounded-full ml-auto mr-3 border border-slate-700"></div>
        </div>

        {/* Top App Header */}
        <header className="flex justify-between items-center px-4 pt-10 pb-3 w-full sticky top-0 z-50 bg-surface border-b border-outline-variant/30 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center overflow-hidden border border-primary/10">
              <img
                alt="Profile"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBI8AYNQCuyz0kweSJSi7Y8gdzGADFnb0MEDP2qMp-OrNoV1hiCPa_QWDrDVFGtuI2RtnZsyx_cEOjbGdHP6Alde0Prd16qZLmfzZVmUK0ZodsQRiV_PbbPoIpP-npUgqEv_fdc0si7mYvAed0MgEhkY1-v0-k2hd18qvFspNuJDP9p1DQEtUes9llqyGSQo-zZeC2QHndBpvirj-HBM7hZu7k5ahS_yTFSZw-KhSIcDM8d2g6O9M7WhfMMoiNY-IaJX34D3KZ14AI"
              />
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant leading-tight">Welcome back,</p>
              <h1 className="text-xs font-bold text-primary">Ahmed Ali</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-full hover:bg-surface-container-high text-primary transition-colors relative">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-error rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-background">
          <div className="px-4 py-4 pb-28">{children}</div>
        </main>

        {/* Persistent Bottom Mobile Navigation Bar */}
        <nav className="absolute bottom-0 left-0 w-full z-50 flex justify-around items-center pt-2 pb-6 px-2 bg-surface rounded-t-xl border-t border-outline-variant/30 shadow-[0_-4px_16px_rgba(88,0,42,0.06)]">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 duration-150 relative ${
                  active ? "text-primary font-semibold" : "text-on-surface-variant opacity-60"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] tracking-wide mt-0.5">{item.label}</span>
                {active && (
                  <span className="w-1 h-1 bg-primary rounded-full absolute bottom-[-4px] left-1/2 -translate-x-1/2"></span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
