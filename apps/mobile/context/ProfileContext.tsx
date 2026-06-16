"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";

export interface ProfileData {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  employeeCategory?: string;
  profilePhotoUrl?: string;
  profilePhotoUpdatedAt?: string;
  company?: { id: string; name: string; code: string };
  department?: { id: string; name: string; code: string };
  designation?: { id: string; name: string; code: string };
  tradeClassification?: { id: string; name: string };
  positionCategory?: { id: string; name: string };
  immediateSupervisor?: { id: string; name: string };
  reportingManagerId?: string;
  defaultLocation?: { id: string; name: string };
  defaultSite?: { id: string; name: string };
  isSupervisor: boolean;
  qidNumber?: string;
  qidExpiryDate?: string;
  dateOfJoining?: string;
  sponsor?: string;
}

interface ProfileContextProps {
  profile: ProfileData | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  computedProfilePhotoSrc: string | null;
}

const ProfileContext = createContext<ProfileContextProps | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageRefreshKey, setImageRefreshKey] = useState<number>(Date.now());

  const fetchProfile = async () => {
    try {
      if (!session) return;
      const res = await fetch("/api/v1/me");
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setImageRefreshKey(Date.now());
      }
    } catch (error) {
      console.error("Failed to fetch profile", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [session]);

  const computedProfilePhotoSrc = profile?.profilePhotoUrl
    ? `${profile.profilePhotoUrl}?v=${profile.profilePhotoUpdatedAt || imageRefreshKey}`
    : null;

  return (
    <ProfileContext.Provider value={{ profile, loading, refreshProfile: fetchProfile, computedProfilePhotoSrc }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};
