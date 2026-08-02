"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card } from "@ahh-wfm/ui";
import Link from "next/link";

export default function ContractsRedirectPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const user = session?.user as any;
  const opAccess = user?.operationAccess;
  const allowedSecurity = opAccess?.allowedSecurityGuarding || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const allowedFM = opAccess?.allowedFacilityManagement || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (status === "authenticated") {
      if (allowedSecurity && !allowedFM) {
        router.replace("/manpower/security-guarding/contracts");
      } else if (allowedFM && !allowedSecurity) {
        router.replace("/manpower/facility-management/contracts");
      }
    }
  }, [status, allowedSecurity, allowedFM, router]);

  if (status === "loading") {
    return (
      <div className="p-6 text-center text-sm font-medium text-gray-500">
        Checking access rights...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#091426]">Manpower Contracts</h1>
        <p className="text-sm text-gray-500 mt-1">Please select the operational scope to view contracts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allowedSecurity && (
          <Link href="/manpower/security-guarding/contracts">
            <Card className="p-6 hover:shadow-md cursor-pointer border border-[#c5c6cd] transition-all flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-3xl text-[#0058be]">security</span>
                <h2 className="text-lg font-bold text-[#091426]">Security Guarding</h2>
              </div>
              <p className="text-xs text-gray-500 mt-2">Manage security guarding client contracts, shifts, and manpower requirements.</p>
            </Card>
          </Link>
        )}
        {allowedFM && (
          <Link href="/manpower/facility-management/contracts">
            <Card className="p-6 hover:shadow-md cursor-pointer border border-[#c5c6cd] transition-all flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-3xl text-[#0058be]">business</span>
                <h2 className="text-lg font-bold text-[#091426]">Facility Management</h2>
              </div>
              <p className="text-xs text-gray-500 mt-2">Manage facility services contracts, schedules, and manpower allocation.</p>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
