"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { SecfacPageGuard } from "@/components/secfac-guard";
import { hasPermission } from "@/lib/permissions";

interface PatrolCheckpoint {
  id: string;
  checkpointId: string;
  sequenceNo: number;
  required: boolean;
  checkpoint?: {
    id: string;
    checkpointName: string;
    checkpointCode?: string | null;
  } | null;
}

interface PatrolRoute {
  id: string;
  operationType: string;
  routeName: string;
  routeCode?: string | null;
  description?: string | null;
  siteId: string;
  site?: { id: string; name: string } | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  checkpoints: PatrolCheckpoint[];
}

export default function PatrolRoutesPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;

  // Master Lists
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form / Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<PatrolRoute | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSiteId, setFormSiteId] = useState("");
  const [formOpType, setFormOpType] = useState("SECURITY_GUARDING");
  const [formCheckpoints, setFormCheckpoints] = useState<{ checkpointId: string; sequenceNo: number; required: boolean }[]>([]);

  // Filters State
  const [filterOpType, setFilterOpType] = useState("ALL");
  const [filterSite, setFilterSite] = useState("");
  const [filterActive, setFilterActive] = useState("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");

  // RBAC permissions
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const allowedSecurity = isAdmin || user?.operationAccess?.allowedSecurityGuarding === true;
  const allowedFM = isAdmin || user?.operationAccess?.allowedFacilityManagement === true;

  useEffect(() => {
    if (status === "authenticated") {
      if (!isAdmin) {
        if (allowedSecurity && !allowedFM) {
          setFilterOpType("SECURITY_GUARDING");
          setFormOpType("SECURITY_GUARDING");
        } else if (allowedFM && !allowedSecurity) {
          setFilterOpType("FACILITY_MANAGEMENT");
          setFormOpType("FACILITY_MANAGEMENT");
        }
      }
      fetchRoutes();
      fetchSites();
      fetchCheckpoints();
    }
  }, [status, user]);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/patrol-routes");
      const json = await res.json();
      if (json.success) {
        setRoutes(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load patrol routes:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const siteList: any[] = [];
      if (allowedSecurity) {
        const res = await fetch("/api/v1/manpower/security-guarding/sites");
        const json = await res.json();
        if (Array.isArray(json)) siteList.push(...json);
      }
      if (allowedFM) {
        const res = await fetch("/api/v1/manpower/facility-management/sites");
        const json = await res.json();
        if (Array.isArray(json)) siteList.push(...json);
      }
      // Deduplicate
      setSites(siteList.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));
    } catch (e) {
      console.error("Failed to load sites:", e);
    }
  };

  const fetchCheckpoints = async () => {
    try {
      const res = await fetch("/api/v1/secfac/checkpoints?isActive=true");
      const json = await res.json();
      if (json.success) {
        setCheckpoints(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load checkpoints:", e);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormCode("");
    setFormDesc("");
    setFormSiteId("");
    if (isAdmin) {
      setFormOpType("SECURITY_GUARDING");
    } else if (allowedSecurity && !allowedFM) {
      setFormOpType("SECURITY_GUARDING");
    } else if (allowedFM && !allowedSecurity) {
      setFormOpType("FACILITY_MANAGEMENT");
    }
    setFormCheckpoints([]);
    setErrorMsg("");
    setSuccessMsg("");
    setSelectedRoute(null);
  };

  const handleOpenCreate = () => {
    setIsEditMode(false);
    resetForm();
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (route: PatrolRoute) => {
    setIsEditMode(true);
    setSelectedRoute(route);
    setFormName(route.routeName);
    setFormCode(route.routeCode || "");
    setFormDesc(route.description || "");
    setFormSiteId(route.siteId);
    setFormOpType(route.operationType);
    setFormCheckpoints(
      route.checkpoints.map(c => ({
        checkpointId: c.checkpointId,
        sequenceNo: c.sequenceNo,
        required: c.required
      }))
    );
    setErrorMsg("");
    setSuccessMsg("");
    setIsDrawerOpen(true);
  };

  const handleDelete = async (route: PatrolRoute) => {
    if (!confirm(`Delete patrol route "${route.routeName}"?\n\nThis is allowed only when the route has no assignment or execution history.`)) return;
    try {
      const res = await fetch(`/api/v1/secfac/patrol-routes/${route.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Patrol route "${route.routeName}" deleted successfully.`);
        fetchRoutes();
      } else if (res.status === 409 && data.error === "DELETE_BLOCKED") {
        if (confirm(`${data.message}\n\nWould you like to DEACTIVATE "${route.routeName}" instead to preserve historical records?`)) {
          await handleDeactivate(route);
        }
      } else {
        alert(data.message || data.error || "Failed to delete patrol route");
      }
    } catch (e: any) {
      alert("Error deleting patrol route: " + e.message);
    }
  };

  const handleDeactivate = async (route: PatrolRoute) => {
    const reason = prompt(`Deactivate patrol route "${route.routeName}"?\n\nPlease enter a reason:`, "Operational deactivation");
    if (reason === null) return;

    try {
      const res = await fetch(`/api/v1/secfac/patrol-routes/${route.id}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchRoutes();
      } else {
        alert(data.message || data.error || "Failed to deactivate route");
      }
    } catch (e: any) {
      alert("Error deactivating route: " + e.message);
    }
  };

  const handleAddCheckpointToForm = () => {
    setFormCheckpoints(prev => [
      ...prev,
      { checkpointId: "", sequenceNo: prev.length + 1, required: true }
    ]);
  };

  const handleRemoveCheckpointFromForm = (index: number) => {
    setFormCheckpoints(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Re-sequence sequence numbers
      return updated.map((c, i) => ({ ...c, sequenceNo: i + 1 }));
    });
  };

  const handleCheckpointFieldChange = (index: number, field: string, value: any) => {
    setFormCheckpoints(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!formName.trim()) {
      setErrorMsg("Route name is required");
      return;
    }
    if (!formSiteId) {
      setErrorMsg("Site location is required");
      return;
    }
    if (formCheckpoints.length === 0) {
      setErrorMsg("At least one checkpoint is required for a patrol route");
      return;
    }
    if (formCheckpoints.some(c => !c.checkpointId)) {
      setErrorMsg("All selected checkpoint rows must have a checkpoint selected");
      return;
    }

    const payload = {
      routeName: formName,
      routeCode: formCode || null,
      description: formDesc || null,
      siteId: formSiteId,
      operationType: formOpType,
      checkpoints: formCheckpoints
    };

    try {
      const url = isEditMode && selectedRoute
        ? `/api/v1/secfac/patrol-routes/${selectedRoute.id}`
        : "/api/v1/secfac/patrol-routes";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(isEditMode ? "Patrol route updated successfully!" : "Patrol route created successfully!");
        fetchRoutes();
        setTimeout(() => {
          setIsDrawerOpen(false);
          resetForm();
        }, 1200);
      } else {
        setErrorMsg(data.error || data.message || "Failed to save patrol route");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred");
    }
  };

  // Filter routes on client
  const filteredRoutes = routes.filter(r => {
    if (filterOpType !== "ALL" && r.operationType !== filterOpType) return false;
    if (filterSite && r.siteId !== filterSite) return false;
    if (filterActive === "ACTIVE" && !r.isActive) return false;
    if (filterActive === "INACTIVE" && r.isActive) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = r.routeName.toLowerCase().includes(q);
      const matchCode = r.routeCode?.toLowerCase().includes(q);
      const matchSite = r.site?.name?.toLowerCase().includes(q);
      return matchName || matchCode || matchSite;
    }

    return true;
  });

  // Filter checkpoints dropdown by site and opType
  const filteredCheckpointsForDropdown = checkpoints.filter(c => {
    return c.siteId === formSiteId && c.operationType === formOpType;
  });

  return (
    <SecfacPageGuard>
      <div className="flex-1 bg-[#F5F5FA] p-6 text-[#001A48]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#001A48]">Patrol Routes</h1>
            <p className="text-xs text-[#747782] font-medium font-mono mt-0.5">
              SECFAC Operations &gt; Guard Tour Patrol Routing Master
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="bg-[#002D72] hover:bg-[#001A48] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Create Patrol Route
          </button>
        </div>

        {/* Filters Panel */}
        <div className="bg-white border border-[#C4C6D2] rounded-2xl p-4 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Op Type */}
            {isAdmin && (
              <div>
                <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Operation Type</label>
                <select
                  value={filterOpType}
                  onChange={(e) => setFilterOpType(e.target.value)}
                  className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
                >
                  <option value="ALL">All Operations</option>
                  <option value="SECURITY_GUARDING">Security Guarding</option>
                  <option value="FACILITY_MANAGEMENT">Facility Management</option>
                </select>
              </div>
            )}

            {/* Site */}
            <div>
              <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Site Location</label>
              <select
                value={filterSite}
                onChange={(e) => setFilterSite(e.target.value)}
                className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
              >
                <option value="">All Sites</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Active Status */}
            <div>
              <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Active Status</label>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
              >
                <option value="ACTIVE">Active Routes</option>
                <option value="INACTIVE">Deactivated Routes</option>
                <option value="ALL">All</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Free Text Search</label>
              <input
                type="text"
                placeholder="Search route name, code, site..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
              />
            </div>
          </div>
        </div>

        {/* Routes Grid */}
        {loading ? (
          <div className="bg-white border border-[#C4C6D2] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-2 shadow-sm">
            <div className="w-8 h-8 border-4 border-[#002D72] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-[#747782] font-mono">Loading patrol routes...</span>
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="bg-white border border-[#C4C6D2] rounded-2xl p-12 text-center shadow-sm">
            <span className="material-symbols-outlined text-4xl text-[#C4C6D2] mb-2">route</span>
            <p className="text-xs font-bold text-[#747782] font-mono">No patrol routes configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRoutes.map(r => (
              <div key={r.id} className="bg-white border border-[#C4C6D2] rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
                <div className="p-5 space-y-4">
                  {/* Status & Scope Indicators */}
                  <div className="flex justify-between items-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      r.operationType === "SECURITY_GUARDING" ? "bg-blue-50 text-blue-800 border border-blue-200" : "bg-purple-50 text-purple-800 border border-purple-200"
                    }`}>
                      {r.operationType === "SECURITY_GUARDING" ? "Security" : "FM Operations"}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                      r.isActive ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {r.isActive ? "Active" : "Deactivated"}
                    </span>
                  </div>

                  {/* Route Details */}
                  <div>
                    <h3 className="text-sm font-bold text-[#001A48] truncate">{r.routeName}</h3>
                    {r.routeCode && <span className="text-[10px] font-mono text-[#747782]">Code: {r.routeCode}</span>}
                    <p className="text-[11px] text-[#747782] mt-1 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-xs">location_on</span>
                      {r.site?.name || "Unknown Site Location"}
                    </p>
                  </div>

                  {/* Checkpoints snapshot */}
                  <div className="bg-[#F9F9FF] border border-[#E1E2EC] p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-[#747782] font-mono uppercase tracking-wider">Ordered Checkpoints ({r.checkpoints?.length || 0})</span>
                    <div className="mt-2 space-y-1">
                      {r.checkpoints?.slice(0, 3).map(c => (
                        <div key={c.id} className="flex justify-between items-center text-[10px] text-slate-700">
                          <span className="font-semibold">{c.sequenceNo}. {c.checkpoint?.checkpointName}</span>
                          {c.required && <span className="text-[8px] font-extrabold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-200 uppercase">Required</span>}
                        </div>
                      ))}
                      {r.checkpoints && r.checkpoints.length > 3 && (
                        <div className="text-[9px] text-slate-500 italic mt-1">+ {r.checkpoints.length - 3} more checkpoints</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="bg-slate-50 border-t border-[#C4C6D2]/60 px-5 py-3 flex gap-2 justify-end">
                  {hasPermission(user, "secfac.patrolRoutes.delete") && (
                    <button
                      onClick={() => handleDelete(r)}
                      className="border border-red-400 text-red-800 hover:bg-red-100 px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all"
                    >
                      Delete
                    </button>
                  )}
                  {r.isActive && (
                    <button
                      onClick={() => handleDeactivate(r)}
                      className="border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all"
                    >
                      Deactivate
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenEdit(r)}
                    className="bg-[#002D72] hover:bg-[#001A48] text-white px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all shadow-sm"
                  >
                    Edit Route
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Drawer Form (Create/Edit) */}
        {isDrawerOpen && (
          <div className="fixed inset-0 bg-[#001A48]/40 backdrop-blur-xs flex justify-end z-50 transition-all">
            <div className="w-full max-w-lg bg-white h-full flex flex-col justify-between shadow-2xl relative animate-slide-in">
              {/* Head */}
              <div className="bg-[#002D72] p-5 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold tracking-tight">{isEditMode ? "Edit Patrol Route" : "Create Patrol Route"}</h2>
                  <p className="text-[10px] opacity-80 font-mono mt-0.5">{isEditMode && selectedRoute ? `Route ID: ${selectedRoute.id}` : "Configure new patrol route master"}</p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
                {errorMsg && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-250 text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 rounded-lg bg-green-50 text-green-800 border border-green-250 text-xs font-semibold">
                    {successMsg}
                  </div>
                )}

                {/* Op Type */}
                {isAdmin && (
                  <div>
                    <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Operation Type</label>
                    <select
                      value={formOpType}
                      disabled={isEditMode}
                      onChange={(e) => {
                        setFormOpType(e.target.value);
                        setFormCheckpoints([]);
                      }}
                      className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72] disabled:opacity-65"
                    >
                      <option value="SECURITY_GUARDING">Security Guarding</option>
                      <option value="FACILITY_MANAGEMENT">Facility Management</option>
                    </select>
                  </div>
                )}

                {/* Site Selection */}
                <div>
                  <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Site Location</label>
                  <select
                    value={formSiteId}
                    disabled={isEditMode}
                    onChange={(e) => {
                      setFormSiteId(e.target.value);
                      setFormCheckpoints([]);
                    }}
                    className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72] disabled:opacity-65"
                  >
                    <option value="">Select Site Location...</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Route Name */}
                <div>
                  <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Route Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Perimeter Patrol Route A"
                    className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
                  />
                </div>

                {/* Route Code */}
                <div>
                  <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Route Code</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. PR-001"
                    className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Description</label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Enter patrol routing detail notes..."
                    rows={3}
                    className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg p-2.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
                  />
                </div>

                {/* Checkpoint ordering */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#444651] uppercase font-mono">Ordered Checkpoints</span>
                    <button
                      type="button"
                      disabled={!formSiteId}
                      onClick={handleAddCheckpointToForm}
                      className="border border-[#002D72] hover:bg-[#002D72]/5 text-[#002D72] px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                    >
                      + Add Checkpoint
                    </button>
                  </div>

                  {!formSiteId && (
                    <p className="text-[10.5px] text-[#747782] italic">Please select a Site Location first to add checkpoints.</p>
                  )}

                  {formSiteId && formCheckpoints.length === 0 && (
                    <p className="text-[10.5px] text-[#747782] italic">No checkpoints added to this route yet.</p>
                  )}

                  {formSiteId && formCheckpoints.length > 0 && (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {formCheckpoints.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center bg-slate-50 border border-[#C4C6D2]/60 p-2 rounded-lg">
                          <span className="text-[11px] font-bold font-mono text-slate-400 w-5 text-center">{item.sequenceNo}</span>
                          
                          <select
                            value={item.checkpointId}
                            onChange={(e) => handleCheckpointFieldChange(index, "checkpointId", e.target.value)}
                            className="flex-1 bg-white border border-[#C4C6D2] rounded-lg px-2 py-1 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
                          >
                            <option value="">Select Checkpoint...</option>
                            {filteredCheckpointsForDropdown.map(cp => (
                              <option key={cp.id} value={cp.id}>{cp.checkpointName}</option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1">
                            <label className="text-[9px] font-bold text-slate-500 font-mono">REQ</label>
                            <input
                              type="checkbox"
                              checked={item.required}
                              onChange={(e) => handleCheckpointFieldChange(index, "required", e.target.checked)}
                              className="w-3.5 h-3.5 text-[#002D72] focus:ring-[#002D72] rounded"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCheckpointFromForm(index)}
                            className="text-red-500 hover:text-red-700 w-6 h-6 rounded hover:bg-red-50 flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>

              {/* Drawer Foot */}
              <div className="bg-slate-50 border-t border-[#C4C6D2]/60 p-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="border border-[#C4C6D2] hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="bg-[#002D72] hover:bg-[#001A48] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Save Route
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SecfacPageGuard>
  );
}
