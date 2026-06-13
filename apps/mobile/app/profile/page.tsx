"use client";

import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/me")
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
      <div className="flex items-center gap-4 bg-surface p-4 rounded-2xl border border-outline-variant/30 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
          {data?.name?.charAt(0)}
        </div>
        <div>
          <h2 className="text-lg font-bold text-on-surface leading-tight">{data?.name}</h2>
          <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{data?.email}</p>
          <span className="inline-block mt-1 bg-secondary-container/30 text-secondary text-[9px] font-bold px-2 py-0.5 rounded uppercase">
            {data?.workerCategory || "Standard"} Worker
          </span>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant/20 bg-surface-container-lowest">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Employment Details</h3>
        </div>
        <div className="divide-y divide-outline-variant/20">
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant">Company</span>
            <span className="text-[11px] font-bold text-on-surface text-right">{data?.company || "Not set"}</span>
          </div>
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant">Department</span>
            <span className="text-[11px] font-bold text-on-surface text-right">{data?.department || "Not set"}</span>
          </div>
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant">Designation</span>
            <span className="text-[11px] font-bold text-on-surface text-right">{data?.designation || "Not set"}</span>
          </div>
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant">Trade</span>
            <span className="text-[11px] font-bold text-on-surface text-right">{data?.trade || "N/A"}</span>
          </div>
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant">System Role</span>
            <span className="text-[11px] font-bold text-primary text-right">{data?.role}</span>
          </div>
        </div>
      </div>

      <button 
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full bg-surface border border-status-error/30 text-status-error font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-[18px]">logout</span>
        <span className="text-[11px]">Sign Out Securely</span>
      </button>

      <div className="text-center mt-6">
        <p className="text-[9px] text-on-surface-variant/40 font-bold uppercase tracking-widest">Al Hattab Holding</p>
        <p className="text-[9px] text-on-surface-variant/40 italic">"Endless Confidence"</p>
        <p className="text-[8px] text-on-surface-variant/30 mt-2">App Version 1.0.0 • Mobile Client</p>
      </div>
    </div>
  );
}
