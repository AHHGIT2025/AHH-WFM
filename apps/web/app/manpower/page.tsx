"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasPermission } from "../../lib/permissions";

export default function ManpowerLandingPage() {
  const { data: session } = useSession();

  const canViewSecurity = hasPermission(session?.user as any, "manpower.admin.full_access") || 
                          hasPermission(session?.user as any, "manpower.security.view");
  const canViewFM = hasPermission(session?.user as any, "manpower.admin.full_access") || 
                    hasPermission(session?.user as any, "manpower.fm.view");

  return (
    <div className="flex-1 bg-surface-container-lowest p-8 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="max-w-4xl w-full text-center mb-12">
        <h1 className="text-3xl font-extrabold text-primary mb-2 tracking-tight">
          Manpower Operations Command Center
        </h1>
        <p className="text-sm text-on-surface-variant max-w-lg mx-auto">
          Manage contract performance, roster planning, and real-time site deployments across corporate security and facility management operations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        {/* Security Guarding Card */}
        <div className={`bg-surface border rounded-xl p-6 shadow-sm flex flex-col justify-between transition-all ${
          canViewSecurity 
            ? "border-outline-variant hover:shadow-md hover:border-primary/20" 
            : "opacity-60 border-outline-variant/30 cursor-not-allowed"
        }`}>
          <div>
            <div className="w-12 h-12 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary mb-5">
              <span className="material-symbols-outlined text-3xl">security</span>
            </div>
            <h2 className="text-lg font-bold text-primary mb-2">Security Guarding Operations</h2>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
              Track client contracts, manage project sites, gates, and post requirements. Build shift deployment schedules, assign security guards, CCTV operators, and supervisors, and monitor coverage.
            </p>
          </div>
          {canViewSecurity ? (
            <Link 
              href="/manpower/security-guarding/dashboard"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-container transition-colors w-full"
            >
              Enter Security Guarding
            </Link>
          ) : (
            <button 
              disabled 
              className="px-4 py-2.5 bg-surface-container-high text-on-surface-variant/40 text-xs font-bold rounded-lg w-full"
            >
              Access Restricted
            </button>
          )}
        </div>

        {/* Facility Management Card */}
        <div className={`bg-surface border rounded-xl p-6 shadow-sm flex flex-col justify-between transition-all ${
          canViewFM 
            ? "border-outline-variant hover:shadow-md hover:border-secondary/20" 
            : "opacity-60 border-outline-variant/30 cursor-not-allowed"
        }`}>
          <div>
            <div className="w-12 h-12 rounded-lg bg-secondary-container/10 flex items-center justify-center text-secondary mb-5">
              <span className="material-symbols-outlined text-3xl">business</span>
            </div>
            <h2 className="text-lg font-bold text-primary mb-2">Facility Management Operations</h2>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
              Organize cleaning zones, floors, areas, and technical blocks. Set shift requirements, assign technicians, cleaning supervisors, cleaners, and office boys, and manage reliever coverage.
            </p>
          </div>
          {canViewFM ? (
            <Link 
              href="/manpower/facility-management/dashboard"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary-container transition-colors w-full"
            >
              Enter Facility Management
            </Link>
          ) : (
            <button 
              disabled 
              className="px-4 py-2.5 bg-surface-container-high text-on-surface-variant/40 text-xs font-bold rounded-lg w-full"
            >
              Access Restricted
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
