"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { isAdminUser } from "@/lib/permissions";
import Link from "next/link";

interface SecfacPageGuardProps {
  children: React.ReactNode;
  requiredScope?: "SECURITY" | "FM";
}

export function SecfacPageGuard({ children, requiredScope }: SecfacPageGuardProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex h-96 items-center justify-center bg-[#F9F9FF] min-h-[85vh] w-full">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-5xl text-[#002D72]">sync</span>
          <p className="mt-2 text-xs font-bold text-[#747782]">Verifying access permissions...</p>
        </div>
      </div>
    );
  }

  const user = session?.user as any;
  const isAdmin = isAdminUser(user);

  // 1. Authenticated user check
  if (!session || !user) {
    return (
      <div className="flex h-96 items-center justify-center bg-[#F9F9FF] min-h-[85vh] w-full">
        <div className="text-center max-w-md p-6 bg-white border border-[#C4C6D2] rounded-2xl shadow-sm">
          <span className="material-symbols-outlined text-[#BA1A1A] text-5xl">gpp_bad</span>
          <h2 className="text-lg font-bold text-[#001A48] mt-2">Authentication Required</h2>
          <p className="text-xs text-[#747782] mt-1">
            Please sign in to access the SECFAC Command Center.
          </p>
        </div>
      </div>
    );
  }

  const operationAccess = user.operationAccess || {};
  const hasSecurityScope = operationAccess.allowedSecurityGuarding === true;
  const hasFacilityScope = operationAccess.allowedFacilityManagement === true;

  // 2. Standard field employee restriction
  const isStandardEmployee = user.role?.toUpperCase() === "EMPLOYEE" || user.role?.toUpperCase() === "EMPLOYEE_SELF_SERVICE";
  if (isStandardEmployee && !isAdmin) {
    const hasExplicitPerm = (user.permissions || []).some((p: string) => 
      p === "manpower.security.view" || 
      p === "manpower.fm.view" || 
      p === "manpower.view" || 
      p === "manpower.admin.full_access" ||
      p === "security.view" ||
      p === "security.patrols.view"
    );
    if (!hasExplicitPerm) {
      return <AccessDeniedView reason="Standard field employees do not have authorization to access the web configuration or control room console." />;
    }
  }

  // 3. SECFAC General Access check (either Security or FM allowed)
  if (!isAdmin && !hasSecurityScope && !hasFacilityScope) {
    return <AccessDeniedView reason="Your user profile does not have permission to access Security Guarding or Facility Management operations." />;
  }

  // 4. Operation context restriction
  if (requiredScope === "SECURITY" && !isAdmin && !hasSecurityScope) {
    return <AccessDeniedView reason="You do not have permission to view Security Guarding SECFAC operations." />;
  }
  if (requiredScope === "FM" && !isAdmin && !hasFacilityScope) {
    return <AccessDeniedView reason="You do not have permission to view Facility Management SECFAC operations." />;
  }

  return <>{children}</>;
}

function AccessDeniedView({ reason }: { reason: string }) {
  return (
    <div className="flex-1 bg-[#F9F9FF] flex items-center justify-center p-8 min-h-[85vh] w-full font-['IBM_Plex_Sans',_sans-serif]">
      <div className="text-center max-w-md p-6 bg-white border border-[#C4C6D2] rounded-2xl shadow-sm">
        <span className="material-symbols-outlined text-[#BA1A1A] text-5xl">gpp_bad</span>
        <h2 className="text-lg font-bold text-[#001A48] mt-2">Access Denied</h2>
        <p className="text-xs text-[#747782] mt-2 leading-relaxed">
          {reason}
        </p>
        <div className="mt-6">
          <Link href="/" className="bg-[#002D72] text-white font-bold text-xs px-6 py-2.5 rounded-lg inline-block hover:bg-[#002D72]/95 transition-all">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
