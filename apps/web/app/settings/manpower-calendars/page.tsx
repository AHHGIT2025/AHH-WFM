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
  restDays?: { dayOfWeek: string }[];
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
  const [opFilter, setOpFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal Control States
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isRamadanModalOpen, setIsRamadanModalOpen] = useState<boolean>(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState<boolean>(false);

  // Form States for Work Profile
  const [profileForm, setProfileForm] = useState({
    id: "",
    code: "",
    name: "",
    workerClass: "WHITE_COLLAR",
    applicability: "GROUP_WIDE",
    applicableCompanyId: "",
    departmentId: "",
    operationType: "",
    appliesToAllPositionCategories: true,
    positionCategoryId: "",
    ordinaryDailyMinutes: "480",
    ordinaryWeeklyMinutes: "2880",
    ramadanDailyMinutes: "360",
    ramadanWeeklyMinutes: "2160",
    ramadanExcessCreatesOtCandidate: false,
    effectiveFrom: new Date().toISOString().split("T")[0],
    effectiveTo: "",
    approvalStatus: "DRAFT",
    restDays: ["FRIDAY"],
    notes: ""
  });

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const userRole = user?.role || "GUEST";
  const userPermissions = user?.permissions || [];
  const canManage = hasPermission(userPermissions, "manpower.calendars.manage") || isAdminUser(userRole);
  const canApprove = hasPermission(userPermissions, "manpower.calendars.approve") || isAdminUser(userRole);

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
    if (authStatus === "authenticated") loadData();
  }, [authStatus, loadData]);

  // Handle Company Selection Dependency Clearing
  const handleCompanyChange = async (companyId: string) => {
    setProfileForm((prev) => ({
      ...prev,
      applicableCompanyId: companyId,
      departmentId: "", // Clear Department dependency
      operationType: "", // Clear Operation Scope dependency
      positionCategoryId: "" // Clear Position Category dependency
    }));

    if (companyId) {
      const [depts, ops] = await Promise.all([
        fetchDepartmentsByCompany(companyId).catch(() => []),
        fetchAllowedOperationTypes(companyId).catch(() => [])
      ]);
      setDepartments(depts);
      setAllowedOpTypes(ops);
    } else {
      setDepartments([]);
      setAllowedOpTypes([]);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...profileForm,
        ordinaryDailyMinutes: profileForm.ordinaryDailyMinutes ? parseInt(profileForm.ordinaryDailyMinutes) : null,
        ordinaryWeeklyMinutes: profileForm.ordinaryWeeklyMinutes ? parseInt(profileForm.ordinaryWeeklyMinutes) : null,
        ramadanDailyMinutes: profileForm.ramadanDailyMinutes ? parseInt(profileForm.ramadanDailyMinutes) : null,
        ramadanWeeklyMinutes: profileForm.ramadanWeeklyMinutes ? parseInt(profileForm.ramadanWeeklyMinutes) : null,
        ownerCompanyId: holdingCompany?.id
      };

      const res = await fetch("/api/v1/manpower/work-calendar-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create profile");

      showToast("Work Calendar Profile created successfully!");
      setIsProfileModalOpen(false);
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

  if (authStatus === "loading" || loading) {
    return <div className="p-8 text-center text-slate-600 dark:text-slate-300">Loading Calendar Administration...</div>;
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
        {canManage && (
          <div className="flex gap-2">
            <Button onClick={() => setIsProfileModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
              + New Work Profile
            </Button>
          </div>
        )}
      </div>

      {toastMessage && (
        <div className={`p-4 rounded-lg text-sm font-medium ${toastMessage.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
          {toastMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-4">
        <button
          onClick={() => setActiveTab("profiles")}
          className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === "profiles" ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          Work Calendar Profiles ({profiles.length})
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

      {/* Profiles Tab */}
      {activeTab === "profiles" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredProfiles.map((p) => (
              <Card key={p.id} className="p-4 space-y-3 border border-slate-200 dark:border-slate-800 hover:border-amber-500 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono text-slate-500">{p.code}</span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{p.name}</h3>
                  </div>
                  <Badge variant={p.approvalStatus === "APPROVED" ? "success" : "secondary"}>
                    {p.approvalStatus} (V{p.version})
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div><strong className="text-slate-500">Worker Class:</strong> {p.workerClass || "WHITE_COLLAR"}</div>
                  <div><strong className="text-slate-500">Applicability:</strong> {p.applicability || "GROUP_WIDE"}</div>
                  {p.applicableCompany && <div><strong className="text-slate-500">Company:</strong> {p.applicableCompany.companyName}</div>}
                  {p.department && <div><strong className="text-slate-500">Department:</strong> {p.department.name}</div>}
                  {p.positionCategory && <div><strong className="text-slate-500">Position:</strong> {p.positionCategory.categoryName}</div>}
                  <div><strong className="text-slate-500">Ordinary Hours:</strong> {p.ordinaryDailyMinutes ? p.ordinaryDailyMinutes / 60 : 8}h daily / {p.ordinaryWeeklyMinutes ? p.ordinaryWeeklyMinutes / 60 : 48}h weekly</div>
                  <div><strong className="text-slate-500">Ramadan Hours:</strong> {p.ramadanDailyMinutes ? p.ramadanDailyMinutes / 60 : 6}h daily / {p.ramadanWeeklyMinutes ? p.ramadanWeeklyMinutes / 60 : 36}h weekly</div>
                  <div><strong className="text-slate-500">Weekly Rest Source:</strong> {p.weeklyRestSource || "PROFILE_FIXED_DAYS"}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* New Profile Modal */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Create Master Work Calendar Profile">
        <form onSubmit={handleCreateProfile} className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Profile Code *</label>
              <Input value={profileForm.code} onChange={(e) => setProfileForm({ ...profileForm, code: e.target.value })} placeholder="e.g. WCP-WC-GROUP-01" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Profile Name *</label>
              <Input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="e.g. White Collar Group Standard" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Worker Class *</label>
              <select
                value={profileForm.workerClass}
                onChange={(e) => setProfileForm({ ...profileForm, workerClass: e.target.value, operationType: "", positionCategoryId: "" })}
                className="w-full text-sm border border-slate-300 rounded-md p-2"
              >
                <option value="WHITE_COLLAR">White Collar</option>
                <option value="BLUE_COLLAR">Blue Collar</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Applicability *</label>
              <select
                value={profileForm.applicability}
                onChange={(e) => setProfileForm({ ...profileForm, applicability: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-md p-2"
              >
                <option value="GROUP_WIDE">Group-wide (Holding)</option>
                <option value="COMPANY">Company Specific</option>
                <option value="DEPARTMENT">Department Specific</option>
              </select>
            </div>
          </div>

          {profileForm.applicability !== "GROUP_WIDE" && (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Applicable Company *</label>
              <select
                value={profileForm.applicableCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md p-2"
                required
              >
                <option value="">Select Company...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName} ({c.companyCode})</option>
                ))}
              </select>
            </div>
          )}

          {profileForm.applicability === "DEPARTMENT" && profileForm.applicableCompanyId && (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Department *</label>
              <select
                value={profileForm.departmentId}
                onChange={(e) => setProfileForm({ ...profileForm, departmentId: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-md p-2"
                required
              >
                <option value="">Select Department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {profileForm.workerClass === "BLUE_COLLAR" && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Derived Operation Scope</label>
                <input
                  type="text"
                  value={allowedOpTypes.join(", ") || "Not Applicable (Contracting/Manufacturing)"}
                  readOnly
                  className="w-full text-sm bg-slate-100 border border-slate-300 rounded-md p-2 font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Position Applicability</label>
                <select
                  value={profileForm.appliesToAllPositionCategories ? "ALL" : "SPECIFIC"}
                  onChange={(e) => setProfileForm({ ...profileForm, appliesToAllPositionCategories: e.target.value === "ALL", positionCategoryId: "" })}
                  className="w-full text-sm border border-slate-300 rounded-md p-2"
                >
                  <option value="ALL">All Position Categories</option>
                  <option value="SPECIFIC">Specific Position Category</option>
                </select>
              </div>

              {!profileForm.appliesToAllPositionCategories && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Position Category *</label>
                  <select
                    value={profileForm.positionCategoryId}
                    onChange={(e) => setProfileForm({ ...profileForm, positionCategoryId: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-md p-2"
                    required
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
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Ordinary Daily Minutes *</label>
              <Input type="number" value={profileForm.ordinaryDailyMinutes} onChange={(e) => setProfileForm({ ...profileForm, ordinaryDailyMinutes: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Ordinary Weekly Minutes *</label>
              <Input type="number" value={profileForm.ordinaryWeeklyMinutes} onChange={(e) => setProfileForm({ ...profileForm, ordinaryWeeklyMinutes: e.target.value })} required />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsProfileModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">Save Profile</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
