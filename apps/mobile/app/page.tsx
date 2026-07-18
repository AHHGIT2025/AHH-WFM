"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SOSOverlay } from "../components/SOSOverlay";

export default function MobileDashboard() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSOS, setShowSOS] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      const updateStatus = () => {
        setIsOffline(!navigator.onLine);
      };
      window.addEventListener("online", updateStatus);
      window.addEventListener("offline", updateStatus);

      // Read initial queue pending count
      const stored = localStorage.getItem("secfac_offline_queue");
      if (stored) {
        try {
          const q = JSON.parse(stored);
          const pending = q.filter((x: any) => x.status === "PENDING").length;
          setPendingCount(pending);
        } catch(e) {}
      }

      return () => {
        window.removeEventListener("online", updateStatus);
        window.removeEventListener("offline", updateStatus);
      };
    }
  }, []);

  useEffect(() => {
    fetch("/api/v1/dashboard")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-4">
      {/* Welcome Card */}
      <div className="bg-primary text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
        <div className="relative z-10">
          <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold mb-1">{data?.designation || "Employee"}</p>
          <h2 className="text-xl font-bold mb-4">{data?.employeeName || session?.user?.name}</h2>
          
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-white/70">Current Duty</span>
              <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                {data?.dutySource === "EMPLOYEE_DEFAULT_LOCATION" || data?.currentDuty?.source === "DEFAULT_LOCATION" ? "OFFICE" : data?.assignmentType?.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm font-bold truncate">
              {data?.dutySource === "EMPLOYEE_DEFAULT_LOCATION"
                ? (data?.currentDuty || "Default Office Not Configured")
                : (data?.currentDuty?.displayName || data?.currentAssignment?.name || "Not Assigned")}
            </p>
            {(data?.dutySource === "EMPLOYEE_DEFAULT_LOCATION" || data?.currentDuty?.source === "DEFAULT_LOCATION") && data?.currentDuty?.locationCode ? (
              <p className="text-[10px] text-white/80 truncate mt-0.5">{data.currentDuty.locationCode}</p>
            ) : (
              <p className="text-[10px] text-white/80 truncate mt-0.5">{data?.currentAssignment?.site}</p>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/punch" className="bg-surface border border-outline-variant/30 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${data?.attendanceStatus === "CHECKED_IN" ? "bg-status-success/10 text-status-success" : "bg-primary/10 text-primary"}`}>
            <span className="material-symbols-outlined text-[24px]">
              {data?.attendanceStatus === "CHECKED_IN" ? "how_to_reg" : "location_on"}
            </span>
          </div>
          <span className="text-[11px] font-bold text-on-surface text-center">
            {data?.attendanceStatus === "CHECKED_IN" ? "Check Out" : "Check In"}
          </span>
        </Link>

        <Link href="/leave" className="bg-surface border border-outline-variant/30 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform">
          <div className="w-12 h-12 rounded-full bg-secondary-container/50 text-secondary flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">flight_takeoff</span>
          </div>
          <span className="text-[11px] font-bold text-on-surface text-center">Request Leave</span>
        </Link>
      </div>
 
      {/* Guard Tour Card */}
      {data?.featureEntitlements?.canViewGuardTour ? (
        <Link href="/guard-tour" className="bg-[#58002a] text-white p-4 rounded-2xl flex items-center justify-between shadow-sm active:scale-95 transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
            <div>
              <p className="text-sm font-bold">Guard Tour Patrol</p>
              <p className="text-[10px] text-white/80">Active duty checkpoint scans</p>
            </div>
          </div>
          <span className="material-symbols-outlined">chevron_right</span>
        </Link>
      ) : null}

      {/* SECFAC Operations Section */}
      <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-primary">security</span>
          SECFAC Operations
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/assigned-tasks" className="bg-surface-container-low border border-outline-variant/20 p-3 rounded-xl flex items-center gap-2 active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-primary text-[20px]">assignment</span>
            <span className="text-[10px] font-bold text-on-surface">Assigned Tasks</span>
          </Link>
          <Link href="/nfc-scan" className="bg-surface-container-low border border-outline-variant/20 p-3 rounded-xl flex items-center gap-2 active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-[#00A3FF] text-[20px]">nfc</span>
            <span className="text-[10px] font-bold text-on-surface">NFC Scan</span>
          </Link>
          <Link href="/facility-inspection" className="bg-surface-container-low border border-outline-variant/20 p-3 rounded-xl flex items-center gap-2 active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-secondary text-[20px]">assignment_turned_in</span>
            <span className="text-[10px] font-bold text-on-surface">Inspection</span>
          </Link>
          <Link href="/incident-report" className="bg-surface-container-low border border-outline-variant/20 p-3 rounded-xl flex items-center gap-2 active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-status-warning text-[20px]">warning</span>
            <span className="text-[10px] font-bold text-on-surface">Incident</span>
          </Link>
          <Link href="/sync-status" className="bg-surface-container-low border border-outline-variant/20 p-3 rounded-xl flex items-center gap-2 col-span-2 active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">cloud_sync</span>
            <span className="text-[10px] font-bold text-on-surface">
              {isOffline ? "Sync Queue (Offline)" : `Sync Queue (Pending: ${pendingCount})`}
            </span>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm">
        <h3 className="text-xs font-bold text-on-surface mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
          Today's Schedule
        </h3>
        <div className="flex items-center justify-between py-2 border-b border-outline-variant/20">
          <span className="text-[11px] text-on-surface-variant">Shift Type</span>
          <span className="text-[11px] font-bold text-on-surface">{data?.todayShift || "Standard"}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-outline-variant/20">
          <span className="text-[11px] text-on-surface-variant">Status</span>
          <span className="text-[11px] font-bold text-status-success">
            {data?.attendanceStatus === "CHECKED_IN" ? "Checked In" : 
             data?.attendanceStatus === "COMPLETED" ? "Shift Completed" : "Not Started"}
          </span>
        </div>
        {data?.todaysAttendance?.checkIn && (
          <div className="flex items-center justify-between py-2 border-b border-outline-variant/20">
            <span className="text-[11px] text-on-surface-variant">In Time</span>
            <span className="text-[11px] font-bold text-on-surface">
              {new Date(data.todaysAttendance.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
        )}
      </div>

      {/* Supervisor Link if Admin/Supervisor */}
      {(session?.user as any)?.role === "SUPERVISOR" || (session?.user as any)?.role === "ADMIN" ? (
        <Link href="/supervisor" className="bg-[#b89d7e] text-white p-4 rounded-2xl flex items-center justify-between shadow-sm active:scale-95 transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">groups</span>
            </div>
            <div>
              <p className="text-sm font-bold">Team Dashboard</p>
              <p className="text-[10px] text-white/80">View today's attendance roster</p>
            </div>
          </div>
          <span className="material-symbols-outlined">chevron_right</span>
        </Link>
      ) : null}

      {/* Floating SOS Trigger Button */}
      <button 
        onClick={() => setShowSOS(true)} 
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#BA1A1A] text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform z-40 hover:brightness-110"
      >
        <span className="material-symbols-outlined text-[28px] animate-pulse">emergency</span>
      </button>

      {/* SOS Overlay */}
      {showSOS && <SOSOverlay onClose={() => setShowSOS(false)} />}
    </div>
  );
}
