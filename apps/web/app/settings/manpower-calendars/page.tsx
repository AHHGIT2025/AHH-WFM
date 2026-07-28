"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { Button, Modal, Card, Badge, Input } from "@ahh-wfm/ui/src";
import {
  fetchActiveCompanies,
  fetchDepartmentsByCompany,
  fetchBlueCollarPositionCategories,
  fetchAllowedOperationTypes,
  fetchHoldingCompany
} from "@/lib/client/master-data-client";

interface Profile {
  id: string;
  code: string;
  name: string;
  ownerCompanyId?: string;
  workerClass?: string;
  applicability?: string;
  applicableCompanyId?: string | null;
  departmentId?: string | null;
  operationType: string | null;
  workerCategory: string | null;
  appliesToAllPositionCategories?: boolean | null;
  positionCategoryId?: string | null;
  ordinaryDailyMinutes: number | null;
  ordinaryWeeklyMinutes: number | null;
  ramadanDailyMinutes: number | null;
  ramadanWeeklyMinutes: number | null;
  ramadanExcessCreatesOtCandidate?: boolean | null;
  weeklyRestSource?: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvalStatus: string;
  version: number;
  supersedesProfileId?: string | null;
  notes?: string | null;
  ownerCompany?: { companyName: string } | null;
  applicableCompany?: { companyName: string } | null;
  department?: { name: string } | null;
  positionCategory?: { categoryName: string } | null;
  restDays?: { dayOfWeek: string; id?: string; profileId?: string }[];
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
  isHoldingCompany?: boolean;
}

interface Department {
  id: string;
  name: string;
}

interface PositionCategory {
  id: string;
  categoryCode: string;
  categoryName: string;
}

export default function ManpowerCalendarsPage() {
  const { data: session, status: authStatus } = useSession();
  const user = session?.user as any;

  const [activeTab, setActiveTab] = useState<"profiles" | "ramadan" | "holidays">("profiles");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Master Data States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ramadanPeriods, setRamadanPeriods] = useState<RamadanPeriod[]>([]);
  const [holidayCalendars, setHolidayCalendars] = useState<HolidayCalendar[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [holdingCompany, setHoldingCompany] = useState<Company | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positionCategories, setPositionCategories] = useState<PositionCategory[]>([]);
  const [allowedOpTypes, setAllowedOpTypes] = useState<string[]>([]);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal Control States
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isRamadanModalOpen, setIsRamadanModalOpen] = useState<boolean>(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState<boolean>(false);

  const [editingProfile, setEditingProfile] = useState<Partial<Profile> | null>(null);
  const [editingRamadan, setEditingRamadan] = useState<Partial<RamadanPeriod> | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<Partial<HolidayCalendar> | null>(null);

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

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const userRole = user?.role || "GUEST";
  const canManage = hasPermission(user, "manpower.calendars.manage");
  const canApprove = hasPermission(user, "manpower.calendars.approve");
  const canAccessPage = canManage || canApprove;

  // Load Master Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compData, holdingData, posCatData] = await Promise.all([
        fetchActiveCompanies().catch(() => []),
        fetchHoldingCompany().catch(() => null),
        fetchBlueCollarPositionCategories().catch(() => [])
      ]);

      setCompanies(compData);
      setHoldingCompany(holdingData);
      setPositionCategories(posCatData);

      const [pRes, rRes, hRes] = await Promise.all([
        fetch("/api/v1/manpower/work-calendar-profiles").then((r) => r.json()),
        fetch("/api/v1/manpower/ramadan-periods").then((r) => r.json()),
        fetch("/api/v1/manpower/holiday-calendars").then((r) => r.json())
      ]);

      if (pRes.success) setProfiles(pRes.profiles || []);
      if (rRes.success) setRamadanPeriods(rRes.periods || []);
      if (hRes.success) setHolidayCalendars(hRes.calendars || []);
    } catch (err: any) {
      setError(err.message || "Failed to load master calendar configuration data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated" && canAccessPage) {
      loadData();
    }
  }, [authStatus, loadData, canAccessPage]);

  // Pre-load dependent data when editing a profile with an existing company ID
  useEffect(() => {
    if (editingProfile?.applicableCompanyId) {
      Promise.all([
        fetchDepartmentsByCompany(editingProfile.applicableCompanyId).catch(() => []),
        fetchAllowedOperationTypes(editingProfile.applicableCompanyId).catch(() => [])
      ]).then(([depts, ops]) => {
        setDepartments(depts);
        setAllowedOpTypes(ops);
      });
    } else {
      setDepartments([]);
      setAllowedOpTypes([]);
    }
  }, [editingProfile?.applicableCompanyId]);

  // Handle Company Selection Dependency Clearing
  const handleCompanyChange = async (companyId: string) => {
    if (editingProfile) {
      setEditingProfile({
        ...editingProfile,
        applicableCompanyId: companyId,
        departmentId: "",
        operationType: "",
        positionCategoryId: ""
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    if (!editingProfile.code || !editingProfile.name || !editingProfile.effectiveFrom) {
      showToast("Please fill in all mandatory fields (Code, Name, Effective From)", "error");
      return;
    }

    if (editingProfile.effectiveTo && new Date(editingProfile.effectiveTo) < new Date(editingProfile.effectiveFrom)) {
      showToast("Effective To date cannot precede Effective From date", "error");
      return;
    }

    try {
      const isEdit = !!editingProfile.id;
      const url = isEdit ? `/api/v1/manpower/work-calendar-profiles/${editingProfile.id}` : "/api/v1/manpower/work-calendar-profiles";
      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        ...editingProfile,
        ordinaryDailyMinutes: editingProfile.ordinaryDailyMinutes ? Number(editingProfile.ordinaryDailyMinutes) : null,
        ordinaryWeeklyMinutes: editingProfile.ordinaryWeeklyMinutes ? Number(editingProfile.ordinaryWeeklyMinutes) : null,
        ramadanDailyMinutes: editingProfile.ramadanDailyMinutes ? Number(editingProfile.ramadanDailyMinutes) : null,
        ramadanWeeklyMinutes: editingProfile.ramadanWeeklyMinutes ? Number(editingProfile.ramadanWeeklyMinutes) : null,
        ownerCompanyId: holdingCompany?.id,
        restDays: editingProfile.restDays?.map(r => r.dayOfWeek) || []
      };

      if (payload.workerClass === "WHITE_COLLAR") {
        delete payload.appliesToAllPositionCategories;
        delete payload.positionCategoryId;
        delete payload.operationType;
        delete payload.workerCategory;
        payload.weeklyRestSource = "PROFILE_FIXED_DAYS";
      } else if (payload.workerClass === "BLUE_COLLAR") {
        delete payload.restDays;
        payload.weeklyRestSource = "ROSTER_MANAGED";
      }

      if (payload.applicability === "GROUP_WIDE") {
        delete payload.applicableCompanyId;
        delete payload.departmentId;
      } else if (payload.applicability === "COMPANY") {
        delete payload.departmentId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save Work Calendar Profile");
      }

      showToast(`Work Calendar Profile ${isEdit ? "updated" : "created"} successfully`);
      setIsProfileModalOpen(false);
      setEditingProfile(null);
      loadData();
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
        body = { action: "approve" }; 
        url = `/api/v1/manpower/work-calendar-profiles/${id}/approve`;
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
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to ${action} profile`);
      }

      showToast(`Profile status updated: ${action.toUpperCase()}`);
      loadData();
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
      loadData();
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
      loadData();
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
      loadData();
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
      loadData();
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
      loadData();
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

      const refRes = await fetch(`/api/v1/manpower/holiday-calendars/${editingHoliday.id}`);
      if (refRes.ok) {
        const refData = await refRes.json();
        setEditingHoliday(refData.calendar);
      }
      loadData();
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
      loadData();
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
      loadData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (statusFilter !== "ALL" && p.approvalStatus !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredRamadan = ramadanPeriods.filter(r => {
    const statusMatch = statusFilter === "ALL" || r.approvalStatus === statusFilter;
    const searchMatch = !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.year.toString().includes(searchQuery);
    return statusMatch && searchMatch;
  });

  const filteredHolidays = holidayCalendars.filter(h => {
    const statusMatch = statusFilter === "ALL" || h.approvalStatus === statusFilter;
    const searchMatch = !searchQuery || h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.year.toString().includes(searchQuery);
    return statusMatch && searchMatch;
  });

  if (authStatus === "loading") {
    return <div className="p-8 text-center text-slate-600 dark:text-slate-300">Loading Calendar Administration...</div>;
  }

  if (!canAccessPage) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="border-red-500/30 bg-red-500/5 text-center p-8">
          <span className="material-symbols-outlined text-4xl text-red-500 mb-2">lock_clock</span>
          <h2 className="text-lg font-bold">403 Forbidden</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            You do not have authorization to view or administer Manpower Work Calendars.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Work Calendar & Holiday Administration</h1>
            {holdingCompany && (
              <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                Holding: {holdingCompany.companyName}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative Master-driven calendar profiles, Ramadan threshold overlays, and holiday rules.
          </p>
        </div>
        
        {/* Dynamic Action Buttons based on Active Tab */}
        {canManage && (
          <div className="flex gap-2">
            {activeTab === "profiles" && (
              <Button onClick={() => {
                setEditingProfile({
                  code: `WCP-${Date.now().toString().slice(-4)}`,
                  name: "",
                  workerClass: "WHITE_COLLAR",
                  applicability: "GROUP_WIDE",
                  ordinaryDailyMinutes: 480,
                  ordinaryWeeklyMinutes: 2880,
                  ramadanDailyMinutes: 360,
                  ramadanWeeklyMinutes: 2160,
                  weeklyRestSource: "PROFILE_FIXED_DAYS",
                  effectiveFrom: new Date().toISOString().split("T")[0],
                  approvalStatus: "DRAFT",
                  restDays: [{ dayOfWeek: "FRIDAY" }]
                });
                setIsProfileModalOpen(true);
              }} className="bg-amber-600 hover:bg-amber-700 text-white">
                <span className="material-symbols-outlined text-sm mr-1">add</span>
                Add Work Profile
              </Button>
            )}
            {activeTab === "ramadan" && (
              <Button onClick={() => {
                setEditingRamadan({
                  year: new Date().getFullYear(),
                  name: `Ramadan ${new Date().getFullYear()}`,
                  startDate: `${new Date().getFullYear()}-03-01`,
                  endDate: `${new Date().getFullYear()}-03-30`
                });
                setIsRamadanModalOpen(true);
              }} className="bg-amber-600 hover:bg-amber-700 text-white">
                <span className="material-symbols-outlined text-sm mr-1">add</span>
                Add Ramadan Period
              </Button>
            )}
            {activeTab === "holidays" && (
              <Button onClick={() => {
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
              }} className="bg-amber-600 hover:bg-amber-700 text-white">
                <span className="material-symbols-outlined text-sm mr-1">add</span>
                Add Holiday Calendar
              </Button>
            )}
          </div>
        )}
      </div>

      {toastMessage && (
        <div className={`p-4 rounded-lg text-sm font-medium ${toastMessage.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
          {toastMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("profiles")}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === "profiles" ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            Work Profiles ({profiles.length})
          </button>
          <button
            onClick={() => setActiveTab("ramadan")}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === "ramadan" ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            Ramadan Periods ({ramadanPeriods.length})
          </button>
          <button
            onClick={() => setActiveTab("holidays")}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === "holidays" ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            Holiday Calendars ({holidayCalendars.length})
          </button>
        </div>
        <div className="flex gap-2 items-center mb-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-md p-1 text-sm bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="SUPERSEDED">SUPERSEDED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 text-sm"
          />
        </div>
      </div>

      {/* Profiles Tab */}
      {activeTab === "profiles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.length === 0 ? (
            <div className="col-span-full text-center text-slate-500 py-8">No profiles found</div>
          ) : (
            filteredProfiles.map((p) => (
              <Card key={p.id} className="p-4 space-y-3 border border-slate-200 hover:border-amber-500 transition-colors flex flex-col">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono text-slate-500">{p.code}</span>
                    <h3 className="font-bold text-slate-900 text-base">{p.name}</h3>
                  </div>
                  <Badge variant={p.approvalStatus === "APPROVED" ? "success" : p.approvalStatus === "SUPERSEDED" ? "neutral" : p.approvalStatus === "REJECTED" ? "error" : p.approvalStatus === "SUBMITTED" ? "warning" : "secondary"}>
                    {p.approvalStatus} (V{p.version})
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 space-y-1 flex-1">
                  <div><strong className="text-slate-500">Worker Class:</strong> {p.workerClass || "WHITE_COLLAR"}</div>
                  <div><strong className="text-slate-500">Applicability:</strong> {p.applicability || "GROUP_WIDE"}</div>
                  {p.applicableCompany && <div><strong className="text-slate-500">Company:</strong> {p.applicableCompany.companyName}</div>}
                  {p.department && <div><strong className="text-slate-500">Department:</strong> {p.department.name}</div>}
                  {p.positionCategory && <div><strong className="text-slate-500">Position:</strong> {p.positionCategory.categoryName}</div>}
                  <div><strong className="text-slate-500">Hours:</strong> {p.ordinaryDailyMinutes ? p.ordinaryDailyMinutes / 60 : 8}h daily / {p.ordinaryWeeklyMinutes ? p.ordinaryWeeklyMinutes / 60 : 48}h weekly</div>
                  <div><strong className="text-slate-500">Rest Days:</strong> {p.restDays?.map(r => r.dayOfWeek).join(", ") || "None"}</div>
                </div>
                {/* Profile Card Actions */}
                <div className="flex gap-2 justify-end border-t pt-3">
                  {p.approvalStatus === "DRAFT" && canManage && (
                    <>
                      <Button size="xs" variant="secondary" onClick={() => { setEditingProfile(p); setIsProfileModalOpen(true); }}>Edit</Button>
                      <Button size="xs" variant="primary" onClick={() => handleProfileApprovalAction(p.id, "submit")}>Submit</Button>
                      <Button size="xs" variant="error" onClick={() => handleDeleteProfile(p.id)}>Delete</Button>
                    </>
                  )}
                  {p.approvalStatus === "SUBMITTED" && (
                    <>
                      {canApprove && <Button size="xs" variant="success" onClick={() => handleProfileApprovalAction(p.id, "approve")}>Approve</Button>}
                      {canManage && <Button size="xs" variant="error" onClick={() => handleProfileApprovalAction(p.id, "reject")}>Reject</Button>}
                    </>
                  )}
                  {p.approvalStatus === "REJECTED" && canManage && (
                    <Button size="xs" variant="secondary" onClick={() => { setEditingProfile(p); setIsProfileModalOpen(true); }}>Edit</Button>
                  )}
                  {p.approvalStatus === "APPROVED" && canManage && (
                    <Button size="xs" variant="secondary" onClick={() => handleProfileApprovalAction(p.id, "supersede")}>Supersede (V{p.version + 1})</Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Ramadan Tab */}
      {activeTab === "ramadan" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRamadan.length === 0 ? (
            <div className="col-span-full text-center text-slate-500 py-8">No Ramadan periods found</div>
          ) : (
            filteredRamadan.map((r) => (
              <Card key={r.id} className="p-4 space-y-3 flex flex-col">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-900">{r.name}</h3>
                  <Badge variant={r.approvalStatus === "APPROVED" ? "success" : "secondary"}>
                    {r.approvalStatus}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 space-y-1 flex-1">
                  <div><strong className="text-slate-500">Start Date:</strong> {new Date(r.startDate).toLocaleDateString()}</div>
                  <div><strong className="text-slate-500">End Date:</strong> {new Date(r.endDate).toLocaleDateString()}</div>
                </div>
                {/* Ramadan Card Actions */}
                <div className="flex gap-2 justify-end border-t pt-3">
                  {r.approvalStatus === "DRAFT" && canManage && (
                    <>
                      <Button size="xs" variant="secondary" onClick={() => { setEditingRamadan(r); setIsRamadanModalOpen(true); }}>Edit</Button>
                      <Button size="xs" variant="primary" onClick={() => handleRamadanAction(r.id, "submit")}>Submit</Button>
                      <Button size="xs" variant="error" onClick={() => handleDeleteRamadan(r.id)}>Delete</Button>
                    </>
                  )}
                  {r.approvalStatus === "SUBMITTED" && (
                    <>
                      {canApprove && <Button size="xs" variant="success" onClick={() => handleRamadanAction(r.id, "approve")}>Approve</Button>}
                      {canManage && <Button size="xs" variant="error" onClick={() => handleRamadanAction(r.id, "reject")}>Reject</Button>}
                    </>
                  )}
                  {r.approvalStatus === "REJECTED" && canManage && (
                    <Button size="xs" variant="secondary" onClick={() => { setEditingRamadan(r); setIsRamadanModalOpen(true); }}>Edit</Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Holidays Tab */}
      {activeTab === "holidays" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredHolidays.length === 0 ? (
            <div className="col-span-full text-center text-slate-500 py-8">No Holiday calendars found</div>
          ) : (
            filteredHolidays.map((h) => (
              <Card key={h.id} className="p-4 space-y-3 flex flex-col">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono text-slate-500">{h.code}</span>
                    <h3 className="font-bold text-slate-900">{h.name}</h3>
                  </div>
                  <Badge variant={h.approvalStatus === "APPROVED" ? "success" : "secondary"}>
                    {h.approvalStatus} (V{h.version})
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 space-y-1 flex-1">
                  <div><strong className="text-slate-500">Scope:</strong> {h.scope}</div>
                  <div><strong className="text-slate-500">Dates:</strong> {new Date(h.effectiveFrom).toLocaleDateString()} to {h.effectiveTo ? new Date(h.effectiveTo).toLocaleDateString() : 'N/A'}</div>
                </div>
                {/* Holiday Card Actions */}
                <div className="flex gap-2 justify-end border-t pt-3">
                  {h.approvalStatus === "DRAFT" && canManage && (
                    <>
                      <Button size="xs" variant="secondary" onClick={() => { setEditingHoliday(h); setIsHolidayModalOpen(true); }}>Edit / Dates</Button>
                      <Button size="xs" variant="primary" onClick={() => handleHolidayAction(h.id, "submit")}>Submit</Button>
                    </>
                  )}
                  {h.approvalStatus === "SUBMITTED" && (
                    <>
                      {canApprove && <Button size="xs" variant="success" onClick={() => handleHolidayAction(h.id, "approve")}>Approve</Button>}
                      {canManage && <Button size="xs" variant="error" onClick={() => handleHolidayAction(h.id, "reject")}>Reject</Button>}
                    </>
                  )}
                  {h.approvalStatus === "REJECTED" && canManage && (
                    <Button size="xs" variant="secondary" onClick={() => { setEditingHoliday(h); setIsHolidayModalOpen(true); }}>Edit</Button>
                  )}
                  {h.approvalStatus === "APPROVED" && canManage && (
                    <Button size="xs" variant="secondary" onClick={() => handleHolidayAction(h.id, "supersede")}>Supersede</Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Profile Modal */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Work Calendar Profile" size="2xl">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Profile Code *</label>
              <Input value={editingProfile?.code || ""} onChange={(e) => setEditingProfile({ ...editingProfile, code: e.target.value })} required disabled={editingProfile?.approvalStatus === "APPROVED"} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Profile Name *</label>
              <Input value={editingProfile?.name || ""} onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })} required disabled={editingProfile?.approvalStatus === "APPROVED"} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Worker Class *</label>
              <select
                value={editingProfile?.workerClass || "WHITE_COLLAR"}
                onChange={(e) => {
                  const wc = e.target.value;
                  setEditingProfile({
                    ...editingProfile,
                    workerClass: wc,
                    operationType: "",
                    positionCategoryId: "",
                    weeklyRestSource: wc === "WHITE_COLLAR" ? "PROFILE_FIXED_DAYS" : "ROSTER_MANAGED",
                    restDays: wc === "WHITE_COLLAR" ? [{ dayOfWeek: "FRIDAY" }] : []
                  });
                }}
                className="w-full text-sm border rounded-md p-2"
                disabled={editingProfile?.approvalStatus === "APPROVED"}
              >
                <option value="WHITE_COLLAR">White Collar</option>
                <option value="BLUE_COLLAR">Blue Collar</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Applicability *</label>
              <select
                value={editingProfile?.applicability || "GROUP_WIDE"}
                onChange={(e) => setEditingProfile({ ...editingProfile, applicability: e.target.value })}
                className="w-full text-sm border rounded-md p-2"
                disabled={editingProfile?.approvalStatus === "APPROVED"}
              >
                <option value="GROUP_WIDE">Group-wide (Holding)</option>
                <option value="COMPANY">Company Specific</option>
                <option value="DEPARTMENT">Department Specific</option>
              </select>
            </div>
          </div>

          {editingProfile?.applicability !== "GROUP_WIDE" && (
            <div>
              <label className="text-xs font-semibold block mb-1">Applicable Company *</label>
              <select
                value={editingProfile?.applicableCompanyId || ""}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full text-sm border rounded-md p-2"
                required
                disabled={editingProfile?.approvalStatus === "APPROVED"}
              >
                <option value="">Select Company...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName} ({c.companyCode})</option>
                ))}
              </select>
            </div>
          )}

          {editingProfile?.applicability === "DEPARTMENT" && editingProfile?.applicableCompanyId && (
            <div>
              <label className="text-xs font-semibold block mb-1">Department *</label>
              <select
                value={editingProfile?.departmentId || ""}
                onChange={(e) => setEditingProfile({ ...editingProfile, departmentId: e.target.value })}
                className="w-full text-sm border rounded-md p-2"
                required
                disabled={editingProfile?.approvalStatus === "APPROVED"}
              >
                <option value="">Select Department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {editingProfile?.workerClass === "BLUE_COLLAR" && (
            <>
              <div>
                <label className="text-xs font-semibold block mb-1">Derived Operation Scope</label>
                <input
                  type="text"
                  value={allowedOpTypes.join(", ") || "Not Applicable"}
                  readOnly
                  className="w-full text-sm bg-slate-100 border rounded-md p-2"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Position Applicability</label>
                <select
                  value={editingProfile?.appliesToAllPositionCategories ? "ALL" : "SPECIFIC"}
                  onChange={(e) => setEditingProfile({ ...editingProfile, appliesToAllPositionCategories: e.target.value === "ALL", positionCategoryId: "" })}
                  className="w-full text-sm border rounded-md p-2"
                  disabled={editingProfile?.approvalStatus === "APPROVED"}
                >
                  <option value="ALL">All Position Categories</option>
                  <option value="SPECIFIC">Specific Position Category</option>
                </select>
              </div>

              {!editingProfile?.appliesToAllPositionCategories && (
                <div>
                  <label className="text-xs font-semibold block mb-1">Position Category *</label>
                  <select
                    value={editingProfile?.positionCategoryId || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, positionCategoryId: e.target.value })}
                    className="w-full text-sm border rounded-md p-2"
                    required
                    disabled={editingProfile?.approvalStatus === "APPROVED"}
                  >
                    <option value="">Select Position Category...</option>
                    {positionCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.categoryName} ({cat.categoryCode})</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Ordinary Daily Minutes *</label>
              <Input type="number" value={editingProfile?.ordinaryDailyMinutes || ""} onChange={(e) => setEditingProfile({ ...editingProfile, ordinaryDailyMinutes: Number(e.target.value) })} required disabled={editingProfile?.approvalStatus === "APPROVED"} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Ordinary Weekly Minutes *</label>
              <Input type="number" value={editingProfile?.ordinaryWeeklyMinutes || ""} onChange={(e) => setEditingProfile({ ...editingProfile, ordinaryWeeklyMinutes: Number(e.target.value) })} required disabled={editingProfile?.approvalStatus === "APPROVED"} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Effective From *</label>
              <Input type="date" value={editingProfile?.effectiveFrom ? new Date(editingProfile.effectiveFrom).toISOString().split("T")[0] : ""} onChange={(e) => setEditingProfile({ ...editingProfile, effectiveFrom: e.target.value })} required disabled={editingProfile?.approvalStatus === "APPROVED"} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Effective To</label>
              <Input type="date" value={editingProfile?.effectiveTo ? new Date(editingProfile.effectiveTo).toISOString().split("T")[0] : ""} onChange={(e) => setEditingProfile({ ...editingProfile, effectiveTo: e.target.value })} disabled={editingProfile?.approvalStatus === "APPROVED"} />
            </div>
          </div>
          
          {editingProfile?.workerClass === "WHITE_COLLAR" && (
            <div>
              <label className="text-xs font-semibold block mb-1">Rest Day *</label>
              <select
                value={editingProfile?.restDays?.[0]?.dayOfWeek || "FRIDAY"}
                onChange={(e) => setEditingProfile({ ...editingProfile, restDays: [{ dayOfWeek: e.target.value }] })}
                className="w-full text-sm border rounded-md p-2"
                disabled={editingProfile?.approvalStatus === "APPROVED"}
              >
                {["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsProfileModalOpen(false)}>Cancel</Button>
            {editingProfile?.approvalStatus !== "APPROVED" && (
              <Button type="submit" variant="primary">Save Profile</Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Ramadan Modal */}
      <Modal isOpen={isRamadanModalOpen} onClose={() => setIsRamadanModalOpen(false)} title="Ramadan Period">
        <form onSubmit={handleSaveRamadan} className="space-y-4 p-4">
          <div>
            <label className="text-xs font-semibold block mb-1">Year *</label>
            <Input type="number" value={editingRamadan?.year || ""} onChange={(e) => setEditingRamadan({ ...editingRamadan, year: Number(e.target.value) })} required disabled={editingRamadan?.approvalStatus === "APPROVED"} />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Name *</label>
            <Input value={editingRamadan?.name || ""} onChange={(e) => setEditingRamadan({ ...editingRamadan, name: e.target.value })} required disabled={editingRamadan?.approvalStatus === "APPROVED"} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Start Date *</label>
              <Input type="date" value={editingRamadan?.startDate ? new Date(editingRamadan.startDate).toISOString().split("T")[0] : ""} onChange={(e) => setEditingRamadan({ ...editingRamadan, startDate: e.target.value })} required disabled={editingRamadan?.approvalStatus === "APPROVED"} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">End Date *</label>
              <Input type="date" value={editingRamadan?.endDate ? new Date(editingRamadan.endDate).toISOString().split("T")[0] : ""} onChange={(e) => setEditingRamadan({ ...editingRamadan, endDate: e.target.value })} required disabled={editingRamadan?.approvalStatus === "APPROVED"} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsRamadanModalOpen(false)}>Cancel</Button>
            {editingRamadan?.approvalStatus !== "APPROVED" && (
              <Button type="submit" variant="primary">Save Ramadan Period</Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Holiday Modal */}
      <Modal isOpen={isHolidayModalOpen} onClose={() => setIsHolidayModalOpen(false)} title="Holiday Calendar" size="4xl">
        <div className="space-y-6">
          <form onSubmit={handleSaveHolidayCalendar} className="space-y-4 border-b pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Year *</label>
                <Input type="number" value={editingHoliday?.year || ""} onChange={(e) => setEditingHoliday({ ...editingHoliday, year: Number(e.target.value) })} required disabled={editingHoliday?.approvalStatus === "APPROVED"} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Code *</label>
                <Input value={editingHoliday?.code || ""} onChange={(e) => setEditingHoliday({ ...editingHoliday, code: e.target.value })} required disabled={editingHoliday?.approvalStatus === "APPROVED"} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Name *</label>
                <Input value={editingHoliday?.name || ""} onChange={(e) => setEditingHoliday({ ...editingHoliday, name: e.target.value })} required disabled={editingHoliday?.approvalStatus === "APPROVED"} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Applicability Scope</label>
                <select
                  value={editingHoliday?.scope || "BOTH"}
                  onChange={(e) => setEditingHoliday({ ...editingHoliday, scope: e.target.value })}
                  className="w-full border rounded-md p-2 text-sm"
                  disabled={editingHoliday?.approvalStatus === "APPROVED"}
                >
                  <option value="BOTH">Both (Security & FM)</option>
                  <option value="SECURITY_GUARDING">Security Guarding Only</option>
                  <option value="FACILITY_MANAGEMENT">Facility Management Only</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold block mb-1">Effective From *</label>
                  <Input type="date" value={editingHoliday?.effectiveFrom ? new Date(editingHoliday.effectiveFrom).toISOString().split("T")[0] : ""} onChange={(e) => setEditingHoliday({ ...editingHoliday, effectiveFrom: e.target.value })} required disabled={editingHoliday?.approvalStatus === "APPROVED"} />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Effective To</label>
                  <Input type="date" value={editingHoliday?.effectiveTo ? new Date(editingHoliday.effectiveTo).toISOString().split("T")[0] : ""} onChange={(e) => setEditingHoliday({ ...editingHoliday, effectiveTo: e.target.value })} disabled={editingHoliday?.approvalStatus === "APPROVED"} />
                </div>
              </div>
            </div>

            {editingHoliday?.approvalStatus !== "APPROVED" && (
              <div className="flex justify-end gap-2">
                <Button type="submit" variant="primary">Save Calendar Metadata</Button>
              </div>
            )}
          </form>

          {/* Holiday Dates Table */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold">Holiday Dates in Calendar ({editingHoliday?.holidayDates?.length || 0})</h4>

            {holidayDateError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold">
                {holidayDateError}
              </div>
            )}

            {editingHoliday?.id && editingHoliday.approvalStatus !== "APPROVED" && (
              <div className="p-3 bg-slate-50 border rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Date</label>
                    <Input type="date" value={newHolidayDate.holidayDate} onChange={(e) => setNewHolidayDate({ ...newHolidayDate, holidayDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Holiday Name</label>
                    <Input placeholder="e.g. National Day" value={newHolidayDate.holidayName} onChange={(e) => setNewHolidayDate({ ...newHolidayDate, holidayName: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Type</label>
                    <select
                      value={newHolidayDate.holidayType}
                      onChange={(e) => setNewHolidayDate({ ...newHolidayDate, holidayType: e.target.value })}
                      className="w-full border rounded-md p-2 text-sm"
                    >
                      <option value="NATIONAL">National</option>
                      <option value="RELIGIOUS">Religious</option>
                      <option value="EMPLOYER_DESIGNATED">Employer Designated</option>
                      <option value="SPECIAL">Special</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" size="xs" variant="secondary" onClick={handleAddHolidayDate}>+ Add Date</Button>
                </div>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Holiday Name</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Scope</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(!editingHoliday?.holidayDates || editingHoliday.holidayDates.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500">No holiday dates added.</td>
                    </tr>
                  ) : (
                    editingHoliday.holidayDates.map((d) => (
                      <tr key={d.id || d.holidayDate}>
                        <td className="p-2 font-bold">{new Date(d.holidayDate).toISOString().split("T")[0]}</td>
                        <td className="p-2">{d.holidayName}</td>
                        <td className="p-2"><Badge variant="neutral">{d.holidayType}</Badge></td>
                        <td className="p-2">{d.operationApplicability}</td>
                        <td className="p-2 text-right">
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
    </div>
  );
}
