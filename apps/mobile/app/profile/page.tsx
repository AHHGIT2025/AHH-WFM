"use client";

import React, { useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useProfile } from "../../context/ProfileContext";

export default function ProfilePage() {
  const { data: session } = useSession();
  const { profile: data, loading, refreshProfile, computedProfilePhotoSrc } = useProfile();
  
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("File must be smaller than 5MB");
      return;
    }

    setUploading(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/me/profile-photo", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Upload failed");
      }

      // Success, refresh profile globally
      await refreshProfile();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  // Primary title logic: designation.name || positionCategory.name || role || "Employee"
  const primaryTitle = data?.designation?.name || data?.positionCategory?.name || data?.role || "Employee";

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col items-center gap-4 bg-surface p-6 rounded-2xl border border-outline-variant/30 shadow-sm relative overflow-hidden">
        {/* Abstract background shape for premium feel */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/10 to-transparent"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-surface-container-high border-4 border-surface shadow-md overflow-hidden flex items-center justify-center relative group mb-3">
            {computedProfilePhotoSrc ? (
              <img src={computedProfilePhotoSrc} alt={data?.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary text-3xl font-bold">{data?.name?.charAt(0)}</span>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 active:scale-95 transition-all"
          >
            Change Photo
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/jpeg, image/png, image/webp" 
            onChange={handleFileChange}
          />
        </div>
        
        {errorMsg && (
          <div className="text-[10px] text-status-error bg-status-error/10 px-3 py-1.5 rounded-lg w-full text-center">
            {errorMsg}
          </div>
        )}

        <div className="text-center z-10 w-full">
          <h2 className="text-xl font-bold text-on-surface leading-tight">{data?.name}</h2>
          
          {/* Primary Chip is now Designation / Role */}
          <span className="inline-block mt-2 bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide shadow-sm">
            {primaryTitle}
          </span>
          
          <p className="text-[11px] text-on-surface-variant font-medium mt-3">{data?.email}</p>
          {data?.phone && (
            <p className="text-[11px] text-on-surface-variant font-medium">{data?.phone}</p>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant/20 bg-surface-container-lowest flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px] text-primary">work</span>
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Employment Details</h3>
        </div>
        <div className="divide-y divide-outline-variant/20">
          <div className="px-4 py-3.5 flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px] opacity-70">corporate_fare</span>
              Company
            </span>
            <span className="text-[11px] font-bold text-on-surface text-right">{data?.company?.name || "Not set"}</span>
          </div>
          <div className="px-4 py-3.5 flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px] opacity-70">lan</span>
              Department
            </span>
            <span className="text-[11px] font-bold text-on-surface text-right">{data?.department?.name || "Not set"}</span>
          </div>
          <div className="px-4 py-3.5 flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px] opacity-70">badge</span>
              Designation
            </span>
            <span className="text-[11px] font-bold text-on-surface text-right">{data?.designation?.name || "Not set"}</span>
          </div>
          <div className="px-4 py-3.5 flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px] opacity-70">supervisor_account</span>
              Supervisor
            </span>
            <span className="text-[11px] font-bold text-on-surface text-right">{data?.immediateSupervisor?.name || "Not set"}</span>
          </div>
          <div className="px-4 py-3.5 flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px] opacity-70">location_on</span>
              Location
            </span>
            <span className="text-[11px] font-bold text-on-surface text-right">
              {data?.defaultLocation?.name || data?.defaultSite?.name || "Not set"}
            </span>
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

      <div className="text-center mt-6 opacity-60">
        <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">{data?.company?.name || "Al Hattab Holding"}</p>
        <p className="text-[9px] text-on-surface-variant italic">"Endless Confidence"</p>
        <p className="text-[8px] text-on-surface-variant mt-2">App Version 1.0.0 • Mobile Client</p>
      </div>
    </div>
  );
}
