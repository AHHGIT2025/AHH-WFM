"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { Button, Modal, Card, Badge, Input } from "@ahh-wfm/ui/src";

interface Profile {
  id: string;
  code: string;
  name: string;
  operationType: string;
  workerCategory: string;
  ordinaryDailyMinutes: number | null;
  ordinaryWeeklyMinutes: number | null;
  ramadanDailyMinutes: number | null;
  ramadanWeeklyMinutes: number | null;
  weeklyRestConfigType: string;
  weeklyRestFixedDay: string | null;
  weeklyRestCustomSchedule: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  companyId: string | null;
  approvalStatus: string;
  version: number;
  supersedesProfileId?: string | null;
  notes?: string | null;
  company?: { companyName: string } | null;
}

interface RamadanPeriod {
  id: string;
  year: number;
  name: string;
  startDate: string;
  endDate: string;
  version: number;
  approvalStatus: string;
  supersedesPeriodId?: string | null;
  notes?: string | null;
}

interface HolidayCalendar {
  id: string;
  year: number;
  code: string;
  name: string;
  scopeKey: string;
  scope: string;
  companyId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  approvalStatus: string;
  supersedesCalendarId?: string | null;
  notes?: string | null;
  company?: { companyName: string } | null;
  holidayDates?: HolidayDate[];
}

interface HolidayDate {
  id?: string;
  calendarId?: string;
  holidayDate: string;
  holidayCode?: string;
  holidayName: string;
  holidayType: string;
  operationApplicability: string;
  rosterOperational?: boolean;
  payrollAdvisoryTreatment?: string;
  notes?: string | null;
}

interface Company {
  id: string;
  companyCode: string;
  companyName: string;
}

export default function ManpowerCalendarsPage() {
  const { data: session, status: authStatus } = useSession();
  const user = session?.user as any;

  const [activeTab, setActiveTab] = useState<"profiles" | "ramadan" | "holidays">("profiles");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Data states
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ramadanPeriods, setRamadanPeriods] = useState<RamadanPeriod[]>([]);
  const [holidayCalendars, setHolidayCalendars] = useState<HolidayCalendar[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Filter states
  const [opFilter, setOpFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal control states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRamadanModalOpen, setIsRamadanModalOpen] = useState(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Active items for edit / view / history
  const [editingProfile, setEditingProfile] = useState<Partial<Profile> | null>(null);
  const [editingRamadan, setEditingRamadan] = useState<Partial<RamadanPeriod> | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<Partial<HolidayCalendar> | null>(null);
  const [historyItems, setHistoryItems] = useState<{ title: string; versions: any[] }>({ title: "", versions: [] });

  // Holiday date form state inside holiday modal
  const [newHolidayDate, setNewHolidayDate] = useState<HolidayDate>({
    holidayDate: "",
    holidayName: "",
    holidayCode: "",
    holidayType: "NATIONAL",
    operationApplicability: "BOTH",
    rosterOperational: true,
    payrollAdvisoryTreatment: "STANDARD_HOLIDAY"
  });
  const [holidayDateError, setHolidayDateError] = useState<string | null>(null);

  // Permissions
  const canManage = user ? (isAdminUser(user) || hasPermission(user, "manpower.calendars.manage")) : false;
  const canApprove = user ? (isAdminUser(user) || hasPermission(user, "manpower.calendars.approve")) : false;
  const canAccessPage = canManage || canApprove;

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, ramRes, holRes, compRes] = await Promise.all([
        fetch("/api/v1/manpower/work-calendar-profiles"),
        fetch("/api/v1/manpower/ramadan-periods"),
        fetch("/api/v1/manpower/holiday-calendars"),
        fetch("/api/v1/companies").catch(() => null)
      ]);

      if (profRes.status === 403 || ramRes.status === 403 || holRes.status === 403) {
        setError("HTTP 403 Forbidden: You do not have permission to access Manpower Calendars.");
        setLoading(false);
        return;
      }

      const profData = profRes.ok ? await profRes.json() : { profiles: [] };
      const ramData = ramRes.ok ? await ramRes.json() : { periods: [] };
      const holData = holRes.ok ? await holRes.json() : { calendars: [] };
      const compData = compRes && compRes.ok ? await compRes.json() : { companies: [] };

      setProfiles(profData.profiles || profData.data || []);
      setRamadanPeriods(ramData.periods || ramData.data || []);
      setHolidayCalendars(holData.calendars || holData.data || []);
      setCompanies(compData.companies || compData.data || []);
    } catch (e: any) {
      console.error("Failed to load manpower calendars:", e);
      setError(e.message || "Failed to load calendar configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session && canAccessPage) {
      fetchData();
    }
  }, [session, canAccessPage, fetchData]);

  if (authStatus === "loading") {
    return (
      <div className="p-8 text-center text-on-surface-variant flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary mr-3">sync</span>
        <span className="font-semibold text-sm">Authenticating calendar session...</span>
      </div>
    );
  }

  if (!canAccessPage) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="border-status-error/30 bg-status-error/5 text-center p-8">
          <span className="material-symbols-outlined text-4xl text-status-error mb-2">lock_clock</span>
          <h2 className="text-lg font-bold text-on-surface">403 Forbidden</h2>
          <p className="text-xs text-on-surface-variant mt-1 max-w-md mx-auto">
            You do not have authorization to view or administer Manpower Work Calendars, Ramadan Periods, or Holiday Calendars. Required permissions: <code className="bg-surface-container-high px-1 rounded">manpower.calendars.manage</code> or <code className="bg-surface-container-high px-1 rounded">manpower.calendars.approve</code>.
          </p>
        </Card>
      </div>
    );
  }

  // --- Work Profile Operations ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    if (!editingProfile.code || !editingProfile.name || !editingProfile.operationType || !editingProfile.workerCategory || !editingProfile.effectiveFrom || !editingProfile.effectiveTo) {
      showToast("Please fill in all mandatory fields (Code, Name, Operation, Category, Effective Dates)", "error");
      return;
    }

    if (new Date(editingProfile.effectiveTo!) < new Date(editingProfile.effectiveFrom!)) {
      showToast("Effective To date cannot precede Effective From date", "error");
      return;
    }

    try {
      const isEdit = !!editingProfile.id;
      const url = isEdit ? `/api/v1/manpower/work-calendar-profiles/${editingProfile.id}` : "/api/v1/manpower/work-calendar-profiles";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProfile)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save Work Calendar Profile");
      }

      showToast(`Work Calendar Profile ${isEdit ? "updated" : "created"} successfully`);
      setIsProfileModalOpen(false);
      setEditingProfile(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleProfileApprovalAction = async (id: string, action: "approve" | "submit" | "reject" | "supersede") => {
    try {
      let url = `/api/v1/manpower/work-calendar-profiles/${id}`;
      let method = "PATCH";
      let body: any = {};

      if (action === "approve") {
        url = `/api/v1/manpower/work-calendar-profiles/${id}/approve`;
        method = "POST";
      } else if (action === "submit") {
        body = { action: "submit" };
      } else if (action === "reject") {
        body = { action: "reject" };
      } else if (action === "supersede") {
        body = { action: "supersede" };
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to ${action} profile`);
      }

      showToast(`Profile status updated: ${action.toUpperCase()}`);
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm("Are you sure you want to delete this DRAFT profile?")) return;
    try {
      const res = await fetch(`/api/v1/manpower/work-calendar-profiles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete profile");
      showToast("Draft profile deleted successfully");
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // --- Ramadan Period Operations ---
  const handleSaveRamadan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRamadan) return;

    if (!editingRamadan.year || !editingRamadan.name || !editingRamadan.startDate || !editingRamadan.endDate) {
      showToast("Please fill in all mandatory Ramadan fields", "error");
      return;
    }

    try {
      const isEdit = !!editingRamadan.id;
      const url = isEdit ? `/api/v1/manpower/ramadan-periods/${editingRamadan.id}` : "/api/v1/manpower/ramadan-periods";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRamadan)
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save Ramadan Period");

      showToast(`Ramadan Period ${isEdit ? "updated" : "created"} successfully`);
      setIsRamadanModalOpen(false);
      setEditingRamadan(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleRamadanAction = async (id: string, action: "approve" | "submit" | "reject" | "supersede") => {
    try {
      let url = `/api/v1/manpower/ramadan-periods/${id}`;
      let method = "PATCH";
      let body: any = {};

      if (action === "approve") {
        url = `/api/v1/manpower/ramadan-periods/${id}/approve`;
        method = "POST";
      } else {
        body = { action };
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed to ${action} Ramadan Period`);

      showToast(`Ramadan Period status updated: ${action.toUpperCase()}`);
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteRamadan = async (id: string) => {
    if (!confirm("Are you sure you want to delete this DRAFT Ramadan Period?")) return;
    try {
      const res = await fetch(`/api/v1/manpower/ramadan-periods/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete Ramadan period");
      showToast("Ramadan period deleted");
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // --- Holiday Calendar Operations ---
  const handleSaveHolidayCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHoliday) return;

    if (!editingHoliday.year || !editingHoliday.name || !editingHoliday.effectiveFrom || !editingHoliday.effectiveTo) {
      showToast("Please fill in all mandatory Holiday Calendar fields", "error");
      return;
    }

    try {
      const isEdit = !!editingHoliday.id;
      const url = isEdit ? `/api/v1/manpower/holiday-calendars/${editingHoliday.id}` : "/api/v1/manpower/holiday-calendars";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingHoliday)
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save Holiday Calendar");

      showToast(`Holiday Calendar ${isEdit ? "updated" : "created"} successfully`);
      setIsHolidayModalOpen(false);
      setEditingHoliday(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleAddHolidayDate = async () => {
    if (!editingHoliday?.id) {
      showToast("Save the calendar DRAFT first before adding holiday dates", "error");
      return;
    }
    if (!newHolidayDate.holidayDate || !newHolidayDate.holidayName) {
      setHolidayDateError("Holiday date and name are required");
      return;
    }

    setHolidayDateError(null);
    try {
      const res = await fetch(`/api/v1/manpower/holiday-calendars/${editingHoliday.id}/dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHolidayDate)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add holiday date");
      }

      showToast("Holiday date added successfully");
      setNewHolidayDate({
        holidayDate: "",
        holidayName: "",
        holidayCode: "",
        holidayType: "NATIONAL",
        operationApplicability: "BOTH",
        rosterOperational: true,
        payrollAdvisoryTreatment: "STANDARD_HOLIDAY"
      });

      // Refresh editing holiday calendar detail
      const refRes = await fetch(`/api/v1/manpower/holiday-calendars/${editingHoliday.id}`);
      if (refRes.ok) {
        const refData = await refRes.json();
        setEditingHoliday(refData.calendar);
      }
      fetchData();
    } catch (err: any) {
      setHolidayDateError(err.message);
    }
  };

  const handleDeleteHolidayDate = async (dateId: string) => {
    if (!editingHoliday?.id) return;
    try {
      const res = await fetch(`/api/v1/manpower/holiday-calendars/${editingHoliday.id}/dates?dateId=${dateId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to remove holiday date");

      showToast("Holiday date removed");
      const refRes = await fetch(`/api/v1/manpower/holiday-calendars/${editingHoliday.id}`);
      if (refRes.ok) {
        const refData = await refRes.json();
        setEditingHoliday(refData.calendar);
      }
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleHolidayAction = async (id: string, action: "approve" | "submit" | "reject" | "supersede") => {
    try {
      let url = `/api/v1/manpower/holiday-calendars/${id}`;
      let method = "PATCH";
      let body: any = {};

      if (action === "approve") {
        url = `/api/v1/manpower/holiday-calendars/${id}/approve`;
        method = "POST";
      } else {
        body = { action };
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed to ${action} Holiday Calendar`);

      showToast(`Holiday Calendar status updated: ${action.toUpperCase()}`);
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // --- Filtering Logic ---
  const filteredProfiles = profiles.filter(p => {
    const opMatch = opFilter === "ALL" || p.operationType === opFilter;
    const statusMatch = statusFilter === "ALL" || p.approvalStatus === statusFilter;
    const searchMatch = !searchQuery || p.code.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return opMatch && statusMatch && searchMatch;
  });

  const filteredRamadan = ramadanPeriods.filter(r => {
    const statusMatch = statusFilter === "ALL" || r.approvalStatus === statusFilter;
    const searchMatch = !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.year.toString().includes(searchQuery);
    return statusMatch && searchMatch;
  });

  const filteredHolidays = holidayCalendars.filter(h => {
    const opMatch = opFilter === "ALL" || h.scope === opFilter || h.scope === "BOTH";
    const statusMatch = statusFilter === "ALL" || h.approvalStatus === statusFilter;
    const searchMatch = !searchQuery || h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.year.toString().includes(searchQuery);
    return opMatch && statusMatch && searchMatch;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast feedback banner */}
      {toastMessage && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
          toastMessage.type === "success" ? "bg-status-success/15 border-status-success/30 text-status-success" : "bg-status-error/15 border-status-error/30 text-status-error"
        }`}>
          <span className="material-symbols-outlined text-lg">{toastMessage.type === "success" ? "check_circle" : "error"}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Prominent Operational Scope Header */}
      <div className="bg-gradient-to-r from-primary to-primary-container p-6 rounded-2xl text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-white/20 backdrop-blur-md mb-2 border border-white/20">
            <span className="material-symbols-outlined text-sm text-secondary-container">verified_user</span>
            <span>Operational Calendar Configuration — Used for Payroll Input Advisory Only</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Manpower Work Calendars & Holidays</h1>
          <p className="text-xs text-white/80 mt-1 max-w-2xl">
            White Collar current duty comes from Employee Default Location. Blue Collar current duty comes from Shift Planner or Deployment Worksite. Approved calendars are immutable and drive non-monetary advisory thresholds.
          </p>
        </div>

        {/* Global Action Button */}
        {canManage && (
          <div className="shrink-0 flex gap-2">
            {activeTab === "profiles" && (
              <Button
                variant="primary"
                onClick={() => {
                  setEditingProfile({
                    code: `PROF-${Date.now().toString().slice(-4)}`,
                    name: "",
                    operationType: "SECURITY_GUARDING",
                    workerCategory: "SECURITY_GUARDING",
                    ordinaryDailyMinutes: 480,
                    ordinaryWeeklyMinutes: 2880,
                    ramadanDailyMinutes: 360,
                    ramadanWeeklyMinutes: 2160,
                    weeklyRestConfigType: "FIXED_DAY",
                    weeklyRestFixedDay: "FRIDAY",
                    effectiveFrom: new Date().toISOString().split("T")[0],
                    effectiveTo: "2026-12-31"
                  });
                  setIsProfileModalOpen(true);
                }}
              >
                <span className="material-symbols-outlined text-sm mr-1.5">add</span>
                Add Work Profile
              </Button>
            )}
            {activeTab === "ramadan" && (
              <Button
                variant="primary"
                onClick={() => {
                  setEditingRamadan({
                    year: new Date().getFullYear(),
                    name: `Ramadan ${new Date().getFullYear()}`,
                    startDate: `${new Date().getFullYear()}-03-01`,
                    endDate: `${new Date().getFullYear()}-03-30`
                  });
                  setIsRamadanModalOpen(true);
                }}
              >
                <span className="material-symbols-outlined text-sm mr-1.5">add</span>
                Add Ramadan Period
              </Button>
            )}
            {activeTab === "holidays" && (
              <Button
                variant="primary"
                onClick={() => {
                  setEditingHoliday({
                    year: new Date().getFullYear(),
                    code: `HOL-CAL-${Date.now().toString().slice(-4)}`,
                    name: `Holiday Calendar ${new Date().getFullYear()}`,
                    scope: "BOTH",
                    effectiveFrom: `${new Date().getFullYear()}-01-01`,
                    effectiveTo: `${new Date().getFullYear()}-12-31`,
                    holidayDates: []
                  });
                  setIsHolidayModalOpen(true);
                }}
              >
                <span className="material-symbols-outlined text-sm mr-1.5">add</span>
                Add Holiday Calendar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs & Search / Filter Controls */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant pb-4">
          <div className="flex gap-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant">
            <button
              onClick={() => setActiveTab("profiles")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "profiles" ? "bg-secondary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base">badge</span>
              <span>Work Profiles ({profiles.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("ramadan")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "ramadan" ? "bg-secondary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base">nightlight</span>
              <span>Ramadan Periods ({ramadanPeriods.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("holidays")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "holidays" ? "bg-secondary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base">event</span>
              <span>Holiday Calendars ({holidayCalendars.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {activeTab !== "ramadan" && (
              <select
                value={opFilter}
                onChange={(e) => setOpFilter(e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface font-semibold focus:outline-none"
              >
                <option value="ALL">All Operations</option>
                <option value="SECURITY_GUARDING">Security Guarding</option>
                <option value="FACILITY_MANAGEMENT">Facility Management</option>
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface font-semibold focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="SUPERSEDED">SUPERSEDED</option>
              <option value="REJECTED">REJECTED</option>
            </select>

            <Input
              placeholder="Search code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 text-xs py-1"
            />
          </div>
        </div>

        {/* Tab 1: Work Calendar Profiles Grid */}
        {activeTab === "profiles" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant font-bold border-b border-outline-variant uppercase tracking-wider">
                <tr>
                  <th className="p-3">Profile Code & Name</th>
                  <th className="p-3">Operation / Category</th>
                  <th className="p-3">Ordinary Thresholds</th>
                  <th className="p-3">Ramadan Thresholds</th>
                  <th className="p-3">Weekly Rest</th>
                  <th className="p-3">Effective Dates</th>
                  <th className="p-3">Status / Version</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60 font-medium">
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-on-surface-variant opacity-70">
                      No Work Calendar Profiles found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-on-surface">{p.code}</div>
                        <div className="text-[11px] text-on-surface-variant">{p.name}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant={p.operationType === "SECURITY_GUARDING" ? "primary" : "secondary"}>
                          {p.operationType}
                        </Badge>
                        <div className="text-[10px] text-on-surface-variant mt-0.5">{p.workerCategory}</div>
                      </td>
                      <td className="p-3 text-on-surface font-semibold">
                        {p.ordinaryDailyMinutes != null ? `${p.ordinaryDailyMinutes}m/day (${p.ordinaryDailyMinutes / 60}h) · ${p.ordinaryWeeklyMinutes}m/wk` : <span className="text-status-warning">Incomplete</span>}
                      </td>
                      <td className="p-3 text-on-surface-variant">
                        {p.ramadanDailyMinutes != null ? `${p.ramadanDailyMinutes}m/day · ${p.ramadanWeeklyMinutes}m/wk` : "N/A"}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-on-surface">{p.weeklyRestConfigType}</span>
                        {p.weeklyRestFixedDay && <div className="text-[10px] text-secondary font-bold">Fixed: {p.weeklyRestFixedDay}</div>}
                      </td>
                      <td className="p-3 text-on-surface-variant text-[11px]">
                        {new Date(p.effectiveFrom).toISOString().split("T")[0]} to {p.effectiveTo ? new Date(p.effectiveTo).toISOString().split("T")[0] : "Ongoing"}
                      </td>
                      <td className="p-3">
                        <Badge variant={
                          p.approvalStatus === "APPROVED" ? "success" :
                          p.approvalStatus === "SUPERSEDED" ? "neutral" :
                          p.approvalStatus === "SUBMITTED" ? "warning" :
                          p.approvalStatus === "REJECTED" ? "error" : "pending"
                        }>
                          v{p.version} · {p.approvalStatus}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          {p.approvalStatus === "DRAFT" && canManage && (
                            <>
                              <Button size="xs" variant="secondary" onClick={() => { setEditingProfile(p); setIsProfileModalOpen(true); }}>
                                Edit
                              </Button>
                              <Button size="xs" variant="primary" onClick={() => handleProfileApprovalAction(p.id, "submit")}>
                                Submit
                              </Button>
                              <Button size="xs" variant="error" onClick={() => handleDeleteProfile(p.id)}>
                                Delete
                              </Button>
                            </>
                          )}
                          {p.approvalStatus === "SUBMITTED" && (
                            <>
                              {canApprove && (
                                <Button size="xs" variant="success" onClick={() => handleProfileApprovalAction(p.id, "approve")}>
                                  Approve
                                </Button>
                              )}
                              {canManage && (
                                <Button size="xs" variant="error" onClick={() => handleProfileApprovalAction(p.id, "reject")}>
                                  Reject
                                </Button>
                              )}
                            </>
                          )}
                          {p.approvalStatus === "APPROVED" && canManage && (
                            <Button size="xs" variant="secondary" onClick={() => handleProfileApprovalAction(p.id, "supersede")}>
                              Create V{p.version + 1}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Ramadan Periods Grid */}
        {activeTab === "ramadan" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant font-bold border-b border-outline-variant uppercase tracking-wider">
                <tr>
                  <th className="p-3">Year & Name</th>
                  <th className="p-3">Start Date</th>
                  <th className="p-3">End Date</th>
                  <th className="p-3">Duration (Days)</th>
                  <th className="p-3">Status / Version</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60 font-medium">
                {filteredRamadan.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant opacity-70">
                      No Ramadan Periods configured.
                    </td>
                  </tr>
                ) : (
                  filteredRamadan.map((r) => {
                    const days = Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    return (
                      <tr key={r.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-on-surface">{r.name}</div>
                          <div className="text-[10px] text-on-surface-variant">Year {r.year}</div>
                        </td>
                        <td className="p-3 font-semibold text-on-surface">{new Date(r.startDate).toISOString().split("T")[0]}</td>
                        <td className="p-3 font-semibold text-on-surface">{new Date(r.endDate).toISOString().split("T")[0]}</td>
                        <td className="p-3 text-on-surface-variant">{days} Days</td>
                        <td className="p-3">
                          <Badge variant={
                            r.approvalStatus === "APPROVED" ? "success" :
                            r.approvalStatus === "SUPERSEDED" ? "neutral" : "pending"
                          }>
                            v{r.version} · {r.approvalStatus}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            {r.approvalStatus === "DRAFT" && canManage && (
                              <>
                                <Button size="xs" variant="secondary" onClick={() => { setEditingRamadan(r); setIsRamadanModalOpen(true); }}>Edit</Button>
                                <Button size="xs" variant="primary" onClick={() => handleRamadanAction(r.id, "submit")}>Submit</Button>
                                <Button size="xs" variant="error" onClick={() => handleDeleteRamadan(r.id)}>Delete</Button>
                              </>
                            )}
                            {r.approvalStatus === "SUBMITTED" && canApprove && (
                              <Button size="xs" variant="success" onClick={() => handleRamadanAction(r.id, "approve")}>Approve</Button>
                            )}
                            {r.approvalStatus === "APPROVED" && canManage && (
                              <Button size="xs" variant="secondary" onClick={() => handleRamadanAction(r.id, "supersede")}>Create V{r.version + 1}</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Holiday Calendars Grid */}
        {activeTab === "holidays" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant font-bold border-b border-outline-variant uppercase tracking-wider">
                <tr>
                  <th className="p-3">Year / Code & Name</th>
                  <th className="p-3">Scope Key</th>
                  <th className="p-3">Holiday Applicability</th>
                  <th className="p-3">Holiday Dates</th>
                  <th className="p-3">Status / Version</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60 font-medium">
                {filteredHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant opacity-70">
                      No Holiday Calendars found.
                    </td>
                  </tr>
                ) : (
                  filteredHolidays.map((h) => (
                    <tr key={h.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-on-surface">{h.name}</div>
                        <div className="text-[10px] text-on-surface-variant">{h.code} · Year {h.year}</div>
                      </td>
                      <td className="p-3 text-on-surface font-mono text-[11px]">
                        {h.scopeKey || "GLOBAL"}
                      </td>
                      <td className="p-3">
                        <Badge variant="primary">{h.scope || "BOTH"}</Badge>
                      </td>
                      <td className="p-3 font-semibold text-on-surface">
                        {h.holidayDates ? `${h.holidayDates.length} Dates Configured` : "0 Dates"}
                      </td>
                      <td className="p-3">
                        <Badge variant={
                          h.approvalStatus === "APPROVED" ? "success" :
                          h.approvalStatus === "SUPERSEDED" ? "neutral" : "pending"
                        }>
                          v{h.version} · {h.approvalStatus}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          {canManage && h.approvalStatus === "DRAFT" && (
                            <>
                              <Button size="xs" variant="secondary" onClick={() => { setEditingHoliday(h); setIsHolidayModalOpen(true); }}>Edit Dates</Button>
                              <Button size="xs" variant="primary" onClick={() => handleHolidayAction(h.id, "submit")}>Submit</Button>
                            </>
                          )}
                          {h.approvalStatus === "SUBMITTED" && canApprove && (
                            <Button size="xs" variant="success" onClick={() => handleHolidayAction(h.id, "approve")}>Approve</Button>
                          )}
                          {h.approvalStatus === "APPROVED" && canManage && (
                            <Button size="xs" variant="secondary" onClick={() => handleHolidayAction(h.id, "supersede")}>Create V{h.version + 1}</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* --- MODAL 1: Work Calendar Profile Modal --- */}
      {isProfileModalOpen && editingProfile && (
        <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title={editingProfile.id ? "Edit Work Calendar Profile" : "Create Work Calendar Profile"} size="xl">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Profile Code" value={editingProfile.code || ""} onChange={(e) => setEditingProfile({ ...editingProfile, code: e.target.value })} required />
              <Input label="Profile Name" value={editingProfile.name || ""} onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })} required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Operation Scope</label>
                <select
                  value={editingProfile.operationType || "SECURITY_GUARDING"}
                  onChange={(e) => setEditingProfile({ ...editingProfile, operationType: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface"
                >
                  <option value="SECURITY_GUARDING">Security Guarding</option>
                  <option value="FACILITY_MANAGEMENT">Facility Management</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Worker Category</label>
                <select
                  value={editingProfile.workerCategory || "SECURITY_GUARDING"}
                  onChange={(e) => setEditingProfile({ ...editingProfile, workerCategory: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface"
                >
                  <option value="SECURITY_GUARDING">Security Guarding</option>
                  <option value="CLEANING">Cleaning</option>
                  <option value="HOSPITALITY">Hospitality</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="ROPE_ACCESS">Rope Access</option>
                  <option value="LANDSCAPING">Landscaping</option>
                  <option value="WHITE_COLLAR">White Collar</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Ordinary Daily Minutes" type="number" value={editingProfile.ordinaryDailyMinutes ?? ""} onChange={(e) => setEditingProfile({ ...editingProfile, ordinaryDailyMinutes: parseInt(e.target.value) || 0 })} placeholder="e.g. 480" />
              <Input label="Ordinary Weekly Minutes" type="number" value={editingProfile.ordinaryWeeklyMinutes ?? ""} onChange={(e) => setEditingProfile({ ...editingProfile, ordinaryWeeklyMinutes: parseInt(e.target.value) || 0 })} placeholder="e.g. 2880" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Ramadan Daily Minutes" type="number" value={editingProfile.ramadanDailyMinutes ?? ""} onChange={(e) => setEditingProfile({ ...editingProfile, ramadanDailyMinutes: parseInt(e.target.value) || 0 })} placeholder="e.g. 360" />
              <Input label="Ramadan Weekly Minutes" type="number" value={editingProfile.ramadanWeeklyMinutes ?? ""} onChange={(e) => setEditingProfile({ ...editingProfile, ramadanWeeklyMinutes: parseInt(e.target.value) || 0 })} placeholder="e.g. 2160" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Weekly Rest Config Type</label>
                <select
                  value={editingProfile.weeklyRestConfigType || "FIXED_DAY"}
                  onChange={(e) => setEditingProfile({ ...editingProfile, weeklyRestConfigType: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface"
                >
                  <option value="FIXED_DAY">Fixed Day</option>
                  <option value="ROTATING">Rotating</option>
                  <option value="CUSTOM_SCHEDULE">Custom Schedule</option>
                </select>
              </div>

              {editingProfile.weeklyRestConfigType === "FIXED_DAY" && (
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Fixed Weekly Rest Day</label>
                  <select
                    value={editingProfile.weeklyRestFixedDay || "FRIDAY"}
                    onChange={(e) => setEditingProfile({ ...editingProfile, weeklyRestFixedDay: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface"
                  >
                    <option value="FRIDAY">Friday</option>
                    <option value="SATURDAY">Saturday</option>
                    <option value="SUNDAY">Sunday</option>
                    <option value="THURSDAY">Thursday</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Effective From" type="date" value={editingProfile.effectiveFrom ? new Date(editingProfile.effectiveFrom).toISOString().split("T")[0] : ""} onChange={(e) => setEditingProfile({ ...editingProfile, effectiveFrom: e.target.value })} required />
              <Input label="Effective To" type="date" value={editingProfile.effectiveTo ? new Date(editingProfile.effectiveTo).toISOString().split("T")[0] : ""} onChange={(e) => setEditingProfile({ ...editingProfile, effectiveTo: e.target.value })} required />
            </div>

            <div className="flex justify-end gap-2 border-t border-outline-variant pt-4 mt-6">
              <Button type="button" variant="secondary" onClick={() => setIsProfileModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Work Profile</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- MODAL 2: Ramadan Period Modal --- */}
      {isRamadanModalOpen && editingRamadan && (
        <Modal isOpen={isRamadanModalOpen} onClose={() => setIsRamadanModalOpen(false)} title="Ramadan Period Configuration" size="md">
          <form onSubmit={handleSaveRamadan} className="space-y-4">
            <Input label="Year" type="number" value={editingRamadan.year || new Date().getFullYear()} onChange={(e) => setEditingRamadan({ ...editingRamadan, year: parseInt(e.target.value) })} required />
            <Input label="Period Name" value={editingRamadan.name || ""} onChange={(e) => setEditingRamadan({ ...editingRamadan, name: e.target.value })} required />
            <Input label="Start Date" type="date" value={editingRamadan.startDate ? new Date(editingRamadan.startDate).toISOString().split("T")[0] : ""} onChange={(e) => setEditingRamadan({ ...editingRamadan, startDate: e.target.value })} required />
            <Input label="End Date" type="date" value={editingRamadan.endDate ? new Date(editingRamadan.endDate).toISOString().split("T")[0] : ""} onChange={(e) => setEditingRamadan({ ...editingRamadan, endDate: e.target.value })} required />

            <div className="flex justify-end gap-2 border-t border-outline-variant pt-4 mt-6">
              <Button type="button" variant="secondary" onClick={() => setIsRamadanModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Ramadan Period</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- MODAL 3: Holiday Calendar & Dates Editor Modal --- */}
      {isHolidayModalOpen && editingHoliday && (
        <Modal isOpen={isHolidayModalOpen} onClose={() => setIsHolidayModalOpen(false)} title="Holiday Calendar & Dates Configuration" size="4xl">
          <div className="space-y-6">
            <form onSubmit={handleSaveHolidayCalendar} className="space-y-4 border-b border-outline-variant pb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Year" type="number" value={editingHoliday.year || new Date().getFullYear()} onChange={(e) => setEditingHoliday({ ...editingHoliday, year: parseInt(e.target.value) })} required />
                <Input label="Calendar Code" value={editingHoliday.code || ""} onChange={(e) => setEditingHoliday({ ...editingHoliday, code: e.target.value })} required />
                <Input label="Calendar Name" value={editingHoliday.name || ""} onChange={(e) => setEditingHoliday({ ...editingHoliday, name: e.target.value })} required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Applicability Scope</label>
                  <select
                    value={editingHoliday.scope || "BOTH"}
                    onChange={(e) => setEditingHoliday({ ...editingHoliday, scope: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface"
                  >
                    <option value="BOTH">Both (Security & FM)</option>
                    <option value="SECURITY_GUARDING">Security Guarding Only</option>
                    <option value="FACILITY_MANAGEMENT">Facility Management Only</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input label="Effective From" type="date" value={editingHoliday.effectiveFrom ? new Date(editingHoliday.effectiveFrom).toISOString().split("T")[0] : ""} onChange={(e) => setEditingHoliday({ ...editingHoliday, effectiveFrom: e.target.value })} required />
                  <Input label="Effective To" type="date" value={editingHoliday.effectiveTo ? new Date(editingHoliday.effectiveTo).toISOString().split("T")[0] : ""} onChange={(e) => setEditingHoliday({ ...editingHoliday, effectiveTo: e.target.value })} required />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="submit" variant="primary" size="sm">Save Calendar Metadata</Button>
              </div>
            </form>

            {/* Holiday Dates Table & Inline Creator */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">event_note</span>
                  <span>Holiday Dates in Calendar ({editingHoliday.holidayDates?.length || 0})</span>
                </h4>
              </div>

              {holidayDateError && (
                <div className="p-3 bg-status-error/10 border border-status-error/30 text-status-error rounded-xl text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  <span>{holidayDateError}</span>
                </div>
              )}

              {/* Add New Date Row Form */}
              {editingHoliday.id && (
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant space-y-3">
                  <div className="text-xs font-bold text-on-surface-variant uppercase">Add Holiday Date Row</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input label="Date" type="date" value={newHolidayDate.holidayDate} onChange={(e) => setNewHolidayDate({ ...newHolidayDate, holidayDate: e.target.value })} />
                    <Input label="Holiday Name" placeholder="e.g. Qatar National Day" value={newHolidayDate.holidayName} onChange={(e) => setNewHolidayDate({ ...newHolidayDate, holidayName: e.target.value })} />
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Type</label>
                      <select
                        value={newHolidayDate.holidayType}
                        onChange={(e) => setNewHolidayDate({ ...newHolidayDate, holidayType: e.target.value })}
                        className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface"
                      >
                        <option value="NATIONAL">National</option>
                        <option value="RELIGIOUS">Religious</option>
                        <option value="EMPLOYER_DESIGNATED">Employer Designated</option>
                        <option value="SPECIAL">Special</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" size="xs" variant="secondary" onClick={handleAddHolidayDate}>
                      + Add Date Row
                    </Button>
                  </div>
                </div>
              )}

              {/* Table of Holiday Dates */}
              <div className="border border-outline-variant rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low font-bold text-on-surface-variant border-b border-outline-variant uppercase">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Holiday Name</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Scope</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {(!editingHoliday.holidayDates || editingHoliday.holidayDates.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-on-surface-variant opacity-70">
                          No holiday dates added to this calendar yet.
                        </td>
                      </tr>
                    ) : (
                      editingHoliday.holidayDates.map((d) => (
                        <tr key={d.id || d.holidayDate}>
                          <td className="p-2.5 font-bold text-on-surface">{new Date(d.holidayDate).toISOString().split("T")[0]}</td>
                          <td className="p-2.5 text-on-surface">{d.holidayName}</td>
                          <td className="p-2.5"><Badge variant="neutral">{d.holidayType}</Badge></td>
                          <td className="p-2.5 text-on-surface-variant">{d.operationApplicability}</td>
                          <td className="p-2.5 text-right">
                            {editingHoliday.approvalStatus === "DRAFT" && d.id && (
                              <Button size="xs" variant="error" onClick={() => handleDeleteHolidayDate(d.id!)}>Remove</Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
