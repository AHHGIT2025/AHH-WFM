"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ProfileProvider, useProfile } from "../context/ProfileContext";
import { hasClientPermission } from "../lib/client-permissions";

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

const MobileShellInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { profile, computedProfilePhotoSrc } = useProfile();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const isLoginPage = pathname === "/login";
  const isChangePasswordPage = pathname === "/change-password";

  return (
    <div className="min-h-screen bg-slate-100 sm:py-6 sm:px-4 flex items-center justify-center font-sans antialiased">
      {/* Smartphone Frame Simulator Container */}
      <div className="w-full h-screen sm:h-[884px] sm:max-w-[430px] bg-background sm:border-[8px] sm:border-slate-800 sm:rounded-[40px] sm:shadow-2xl relative flex flex-col overflow-hidden">
        {/* Dynamic Island / Device Notch - Displayed on desktop simulator only */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-full z-[100] hidden sm:flex items-center justify-center">
          <div className="w-3.5 h-3.5 bg-slate-900 rounded-full ml-auto mr-3 border border-slate-700"></div>
        </div>

        {/* Top App Header */}
        {!isLoginPage && !isChangePasswordPage && (
          <header className="flex justify-between items-center px-4 sm:pt-10 pt-4 pb-3 w-full sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#093FA6]/10 flex items-center justify-center overflow-hidden border border-[#093FA6]/20">
                {computedProfilePhotoSrc ? (
                  <img
                    alt="Profile"
                    className="w-full h-full object-cover"
                    src={computedProfilePhotoSrc}
                  />
                ) : (
                  <span className="text-[#031751] text-sm font-bold">
                    {(profile?.name || session?.user?.name || "A").charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <p className="text-[10px] text-slate-500 leading-tight">Welcome back,</p>
                <h1 className="text-xs font-bold text-[#031751]">{profile?.name || session?.user?.name || "Employee"}</h1>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hasClientPermission(session?.user as any, "commercial.commandCenter.view") && (
                <Link
                  href="/command-center"
                  className={`p-2 rounded-full transition-colors relative flex items-center justify-center ${
                    pathname.startsWith("/command-center")
                      ? "bg-[#031751] text-white font-bold shadow-sm"
                      : "hover:bg-slate-100 text-[#031751]"
                  }`}
                  title="Mobile Command Suite"
                >
                  <span className="material-symbols-outlined text-[20px]">space_dashboard</span>
                </Link>
              )}
              <Link
                href="/approvals"
                className={`p-2 rounded-full transition-colors relative flex items-center justify-center ${
                  pathname.startsWith("/approvals")
                    ? "bg-[#4643F3] text-white font-bold shadow-sm"
                    : "hover:bg-slate-100 text-[#031751]"
                }`}
                title="Universal Approval Center"
              >
                <span className="material-symbols-outlined text-[20px]">approval</span>
              </Link>
              <button className="p-2 rounded-full hover:bg-slate-100 text-[#031751] transition-colors relative">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#DC2626] rounded-full"></span>
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-[#DC2626] transition-colors"
                title="Sign Out"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </header>
        )}

        {isChangePasswordPage && (
          <header className="flex justify-between items-center px-4 sm:pt-10 pt-4 pb-3 w-full sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#031751] text-[20px]">lock_reset</span>
              <h1 className="text-xs font-bold text-[#031751]">Change Password Required</h1>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-[#DC2626] transition-colors"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </header>
        )}

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          <div className={`px-4 py-4 ${(isLoginPage || isChangePasswordPage) ? "" : "pb-28"}`}>{children}</div>
        </main>

        {/* Persistent Bottom Mobile Navigation Bar */}
        {!isLoginPage && !isChangePasswordPage && (
          <nav className="absolute bottom-0 left-0 w-full z-50 flex justify-around items-center pt-2 pb-6 px-2 bg-white rounded-t-xl border-t border-slate-200 shadow-[0_-4px_16px_rgba(3,23,81,0.06)]">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 duration-150 relative ${
                    active ? "text-[#093FA6] font-semibold" : "text-slate-500 opacity-80 hover:text-[#031751]"
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
                    <span className="w-1 h-1 bg-[#093FA6] rounded-full absolute bottom-[-4px] left-1/2 -translate-x-1/2"></span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
};

export const MobileShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProfileProvider>
      <MobileShellInner>{children}</MobileShellInner>
    </ProfileProvider>
  );
};
