"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { SecfacPageGuard } from "@/components/secfac-guard";

interface SecfacCheckpoint {
  id: string;
  operationType: string;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  projectId?: string | null;
  project?: { id: string; name: string } | null;
  siteId: string;
  site?: { id: string; name: string; operationType: string } | null;
  locationUnitId?: string | null;
  locationUnit?: { id: string; name: string } | null;
  checkpointName: string;
  checkpointCode?: string | null;
  nfcTagId?: string | null;
  qrCode?: string | null;
  checkpointType: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
  scanRequired: boolean;
  photoRequired: boolean;
  checklistRequired: boolean;
  isActive: boolean;
  updatedAt?: string;
}

export default function CheckpointsPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;

  // State lists
  const [checkpoints, setCheckpoints] = useState<SecfacCheckpoint[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [locationUnits, setLocationUnits] = useState<any[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<SecfacCheckpoint | null>(null);

  // Filter States
  const [search, setSearch] = useState("");
  const [filterOpType, setFilterOpType] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Drawer / Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form Fields
  const [formOpType, setFormOpType] = useState("SECURITY_GUARDING");
  const [formClientId, setFormClientId] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formSiteId, setFormSiteId] = useState("");
  const [formLocationUnitId, setFormLocationUnitId] = useState("");
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formNfcTagId, setFormNfcTagId] = useState("");
  const [formQrCode, setFormQrCode] = useState("");
  const [formType, setFormType] = useState("SECURITY_PATROL");
  const [formDesc, setFormDesc] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [formRadius, setFormRadius] = useState("15");
  const [formScanRequired, setFormScanRequired] = useState(true);
  const [formPhotoRequired, setFormPhotoRequired] = useState(false);
  const [formChecklistRequired, setFormChecklistRequired] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  // RBAC resolution
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const allowedSecurity = isAdmin || user?.operationAccess?.allowedSecurityGuarding === true;
  const allowedFM = isAdmin || user?.operationAccess?.allowedFacilityManagement === true;

  // Determine active view scope
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
      fetchCheckpoints();
      fetchMasterData();
    }
  }, [status, user]);

  // Fetch Master Data based on selected operations
  const fetchMasterData = async () => {
    try {
      // 1. Fetch Clients
      const clientList: any[] = [];
      if (allowedSecurity) {
        const res = await fetch("/api/v1/manpower/security-guarding/clients");
        const json = await res.json();
        if (Array.isArray(json)) clientList.push(...json);
      }
      if (allowedFM) {
        const res = await fetch("/api/v1/manpower/facility-management/clients");
        const json = await res.json();
        if (Array.isArray(json)) clientList.push(...json);
      }
      // De-duplicate
      const uniqueClients = clientList.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      setClients(uniqueClients);

      // 2. Fetch Projects
      const projList: any[] = [];
      if (allowedSecurity) {
        const res = await fetch("/api/v1/manpower/security-guarding/projects");
        const json = await res.json();
        if (Array.isArray(json)) projList.push(...json);
      }
      if (allowedFM) {
        const res = await fetch("/api/v1/manpower/facility-management/projects");
        const json = await res.json();
        if (Array.isArray(json)) projList.push(...json);
      }
      const uniqueProjs = projList.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      setProjects(uniqueProjs);

      // 3. Fetch Sites
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
      const uniqueSites = siteList.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      setSites(uniqueSites);

      // 4. Fetch Location Units (zones + areas)
      const locList: any[] = [];
      if (allowedSecurity) {
        const res = await fetch("/api/v1/manpower/security-guarding/zones");
        const json = await res.json();
        if (Array.isArray(json)) locList.push(...json);
      }
      if (allowedFM) {
        const res = await fetch("/api/v1/manpower/facility-management/areas");
        const json = await res.json();
        if (Array.isArray(json)) locList.push(...json);
      }
      const uniqueLocs = locList.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      setLocationUnits(uniqueLocs);
    } catch (e) {
      console.error("Failed to load master hierarchy lists:", e);
    }
  };

  const fetchCheckpoints = async () => {
    try {
      const res = await fetch("/api/v1/secfac/checkpoints");
      const json = await res.json();
      if (json.success) {
        setCheckpoints(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch checkpoints list:", e);
    }
  };

  // Filter lists based on hierarchy choice
  const filteredClients = clients.filter(c => !filterOpType || c.operationType === filterOpType);
  const filteredProjects = projects.filter(p => {
    const clientMatch = !filterClient || p.clientId === filterClient || p.contract?.clientId === filterClient;
    const opMatch = !filterOpType || p.operationType === filterOpType;
    return clientMatch && opMatch;
  });
  const filteredSites = sites.filter(s => {
    const projMatch = !filterProject || s.projectId === filterProject;
    const opMatch = !filterOpType || s.operationType === filterOpType;
    return projMatch && opMatch;
  });
  const filteredLocations = locationUnits.filter(l => !filterSite || l.siteId === filterSite);

  // Main list filters
  const visibleCheckpoints = checkpoints.filter(cp => {
    if (search) {
      const s = search.toLowerCase();
      const matchName = cp.checkpointName.toLowerCase().includes(s);
      const matchCode = cp.checkpointCode?.toLowerCase().includes(s);
      const matchNfc = cp.nfcTagId?.toLowerCase().includes(s);
      const matchQr = cp.qrCode?.toLowerCase().includes(s);
      if (!matchName && !matchCode && !matchNfc && !matchQr) return false;
    }
    if (filterOpType && cp.operationType !== filterOpType) return false;
    if (filterClient && cp.clientId !== filterClient) return false;
    if (filterProject && cp.projectId !== filterProject) return false;
    if (filterSite && cp.siteId !== filterSite) return false;
    if (filterLocation && cp.locationUnitId !== filterLocation) return false;
    if (filterType && cp.checkpointType !== filterType) return false;
    if (filterStatus !== "ALL") {
      const activeCheck = filterStatus === "ACTIVE";
      if (cp.isActive !== activeCheck) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalCount = visibleCheckpoints.length;
  const activeCount = visibleCheckpoints.filter(c => c.isActive).length;
  const nfcCount = visibleCheckpoints.filter(c => cpHasValue(c.nfcTagId)).length;
  const qrCount = visibleCheckpoints.filter(c => cpHasValue(c.qrCode)).length;
  const photoCount = visibleCheckpoints.filter(c => c.photoRequired).length;
  const checklistCount = visibleCheckpoints.filter(c => c.checklistRequired).length;

  function cpHasValue(val: any) {
    return val && val !== "" && val !== "null";
  }

  // Form hierarchy filters
  const formFilteredClients = clients.filter(c => c.operationType === formOpType);
  const formFilteredProjects = projects.filter(p => p.operationType === formOpType && (!formClientId || p.clientId === formClientId || p.contract?.clientId === formClientId));
  const formFilteredSites = sites.filter(s => s.operationType === formOpType && (!formProjectId || s.projectId === formProjectId));
  const formFilteredLocations = locationUnits.filter(l => l.siteId === formSiteId);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!formName.trim()) {
      setErrorMsg("Checkpoint name is required");
      return;
    }
    if (!formSiteId) {
      setErrorMsg("Site selection is required");
      return;
    }

    // Verify location belongs to site
    if (formLocationUnitId) {
      const selectedLU = locationUnits.find(l => l.id === formLocationUnitId);
      if (selectedLU && selectedLU.siteId !== formSiteId) {
        setErrorMsg("Selected location unit does not belong to the selected site");
        return;
      }
    }

    const payload = {
      operationType: formOpType,
      clientId: formClientId || null,
      projectId: formProjectId || null,
      siteId: formSiteId,
      locationUnitId: formLocationUnitId || null,
      checkpointName: formName,
      checkpointCode: formCode || null,
      nfcTagId: formNfcTagId || null,
      qrCode: formQrCode || null,
      checkpointType: formType,
      description: formDesc || null,
      latitude: formLat ? Number(formLat) : null,
      longitude: formLng ? Number(formLng) : null,
      radiusMeters: formRadius ? Number(formRadius) : null,
      scanRequired: formScanRequired,
      photoRequired: formPhotoRequired,
      checklistRequired: formChecklistRequired,
      isActive: formIsActive
    };

    try {
      const url = isEditMode && selectedCheckpoint 
        ? `/api/v1/secfac/checkpoints/${selectedCheckpoint.id}` 
        : "/api/v1/secfac/checkpoints";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(isEditMode ? "Checkpoint updated successfully!" : "Checkpoint registered successfully!");
        fetchCheckpoints();
        setIsDrawerOpen(false);
        resetForm();
      } else {
        setErrorMsg(data.error || data.message || "Failed to save checkpoint");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred");
    }
  };

  const handleEdit = (cp: SecfacCheckpoint) => {
    setSelectedCheckpoint(cp);
    setIsEditMode(true);
    setErrorMsg("");
    setSuccessMsg("");

    setFormOpType(cp.operationType);
    setFormClientId(cp.clientId || "");
    setFormProjectId(cp.projectId || "");
    setFormSiteId(cp.siteId);
    setFormLocationUnitId(cp.locationUnitId || "");
    setFormName(cp.checkpointName);
    setFormCode(cp.checkpointCode || "");
    setFormNfcTagId(cp.nfcTagId || "");
    setFormQrCode(cp.qrCode || "");
    setFormType(cp.checkpointType);
    setFormDesc(cp.description || "");
    setFormLat(cp.latitude !== null && cp.latitude !== undefined ? String(cp.latitude) : "");
    setFormLng(cp.longitude !== null && cp.longitude !== undefined ? String(cp.longitude) : "");
    setFormRadius(cp.radiusMeters !== null && cp.radiusMeters !== undefined ? String(cp.radiusMeters) : "15");
    setFormScanRequired(cp.scanRequired);
    setFormPhotoRequired(cp.photoRequired);
    setFormChecklistRequired(cp.checklistRequired);
    setFormIsActive(cp.isActive);

    setIsDrawerOpen(true);
  };

  const handleDeactivate = async (cp: SecfacCheckpoint) => {
    if (!confirm(`Are you sure you want to deactivate ${cp.checkpointName}?`)) return;
    try {
      const res = await fetch(`/api/v1/secfac/checkpoints/${cp.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchCheckpoints();
        if (selectedCheckpoint?.id === cp.id) {
          setSelectedCheckpoint(prev => prev ? { ...prev, isActive: false } : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReactivate = async (cp: SecfacCheckpoint) => {
    try {
      const res = await fetch(`/api/v1/secfac/checkpoints/${cp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true })
      });
      if (res.ok) {
        fetchCheckpoints();
        if (selectedCheckpoint?.id === cp.id) {
          setSelectedCheckpoint(prev => prev ? { ...prev, isActive: true } : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setSelectedCheckpoint(null);
    setFormName("");
    setFormCode("");
    setFormNfcTagId("");
    setFormQrCode("");
    setFormDesc("");
    setFormLat("");
    setFormLng("");
    setFormRadius("15");
    setFormScanRequired(true);
    setFormPhotoRequired(false);
    setFormChecklistRequired(false);
    setFormIsActive(true);
  };

  if (status === "loading") {
    return (
      <div className="flex-1 bg-[#F9F9FF] p-8 flex items-center justify-center min-h-[85vh]">
        <div className="text-[#002D72] text-sm font-bold font-mono animate-pulse">Loading master hierarchy...</div>
      </div>
    );
  }

  return (
    <SecfacPageGuard>
      <div className="flex-1 bg-[#F9F9FF] p-6 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh] relative overflow-x-hidden">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[#002D72] text-3xl">location_on</span>
            <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Checkpoints & NFC Tags</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider bg-[#DAE2FF] text-[#002D72] border border-[#B1C5FF] uppercase">
              Phase 1B
            </span>
          </div>
          <p className="text-xs text-[#444651]">
            Manage physical checkpoints, NFC tags, QR fallback codes, and site movement proof points.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsDrawerOpen(true);
          }}
          className="bg-[#002D72] hover:bg-[#001D48] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Checkpoint
        </button>
      </div>

      {/* Notice Banner */}
      <div className="bg-[#E7EEFF] border border-[#B1C5FF] text-[#002D72] px-4 py-2.5 rounded-lg mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">info</span>
        <span className="text-[10px] font-bold font-mono uppercase tracking-wider">
          Phase 1B foundation: Checkpoint master only. NFC scan execution will be enabled in a later phase.
        </span>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Total nodes</span>
          <h3 className="text-xl font-bold text-[#001A48] mt-1">{totalCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Active nodes</span>
          <h3 className="text-xl font-bold text-green-700 mt-1">{activeCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">NFC Registered</span>
          <h3 className="text-xl font-bold font-mono text-[#002D72] mt-1">{nfcCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">QR Fallback</span>
          <h3 className="text-xl font-bold text-orange-700 mt-1">{qrCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Photo Required</span>
          <h3 className="text-xl font-bold text-purple-700 mt-1">{photoCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Checklists linked</span>
          <h3 className="text-xl font-bold text-blue-700 mt-1">{checklistCount}</h3>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Table & Filters */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Filter Panel */}
          <div className="bg-white border border-[#C4C6D2] rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Search Tags</label>
              <input
                type="text"
                placeholder="Name, code, tag ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72] focus:outline-none"
              />
            </div>

            {isAdmin && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Operation Scope</label>
                <select
                  value={filterOpType}
                  onChange={(e) => {
                    setFilterOpType(e.target.value);
                    setFilterClient("");
                    setFilterProject("");
                    setFilterSite("");
                    setFilterLocation("");
                  }}
                  className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
                >
                  <option value="">All Operations</option>
                  <option value="SECURITY_GUARDING">Security Guarding</option>
                  <option value="FACILITY_MANAGEMENT">Facility Management</option>
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Client</label>
              <select
                value={filterClient}
                onChange={(e) => {
                  setFilterClient(e.target.value);
                  setFilterProject("");
                  setFilterSite("");
                  setFilterLocation("");
                }}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Clients</option>
                {filteredClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Project</label>
              <select
                value={filterProject}
                onChange={(e) => {
                  setFilterProject(e.target.value);
                  setFilterSite("");
                  setFilterLocation("");
                }}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Projects</option>
                {filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Site Wing</label>
              <select
                value={filterSite}
                onChange={(e) => {
                  setFilterSite(e.target.value);
                  setFilterLocation("");
                }}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Sites</option>
                {filteredSites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Post / Zone</label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Posts</option>
                {filteredLocations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Node Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Types</option>
                <option value="SECURITY_PATROL">Security Patrol</option>
                <option value="FACILITY_INSPECTION">Facility Inspection</option>
                <option value="FIRE_SAFETY">Fire Safety</option>
                <option value="EQUIPMENT_ROOM">Equipment Room</option>
                <option value="CLEANING_AREA">Cleaning Area</option>
                <option value="MAINTENANCE_POINT">Maintenance Point</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Deactivated Only</option>
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white border border-[#C4C6D2] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#E7EEFF] border-b border-[#C4C6D2] text-[10px] font-bold text-[#001A48] uppercase tracking-wider">
                    <th className="px-4 py-3">Checkpoint Name</th>
                    <th className="px-4 py-3">Operation</th>
                    <th className="px-4 py-3">Site Wing</th>
                    <th className="px-4 py-3">Post / Zone</th>
                    <th className="px-4 py-3">NFC Tag ID</th>
                    <th className="px-4 py-3">QR Code</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Flags</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EEFF]">
                  {visibleCheckpoints.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-xs text-[#747782]">
                        No checkpoints configured yet. Add your first checkpoint to start SECFAC movement proof.
                      </td>
                    </tr>
                  ) : (
                    visibleCheckpoints.map((cp) => (
                      <tr
                        key={cp.id}
                        onClick={() => setSelectedCheckpoint(cp)}
                        className={`hover:bg-[#F0F3FF] cursor-pointer transition-colors text-xs font-semibold ${selectedCheckpoint?.id === cp.id ? "bg-[#E7EEFF] border-l-4 border-[#002D72]" : ""}`}
                      >
                        <td className="px-4 py-3.5 font-bold text-[#001A48]">
                          {cp.checkpointName}
                          {cp.checkpointCode && (
                            <span className="block font-mono text-[9px] text-[#747782] mt-0.5">{cp.checkpointCode}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[#444651]">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${cp.operationType === "SECURITY_GUARDING" ? "bg-[#DAE2FF] text-[#002D72]" : "bg-teal-50 text-teal-700"}`}>
                            {cp.operationType === "SECURITY_GUARDING" ? "Security" : "Facility"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[#444651]">{cp.site?.name || "—"}</td>
                        <td className="px-4 py-3.5 text-[#444651]">{cp.locationUnit?.name || "—"}</td>
                        <td className="px-4 py-3.5 font-mono text-[10px] text-[#002D72]">
                          {cp.nfcTagId ? cp.nfcTagId : <span className="text-[#747782] font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[10px] text-[#444651]">
                          {cp.qrCode ? cp.qrCode : <span className="text-[#747782] font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="bg-[#F0F3FF] text-[#002D72] px-2 py-0.5 rounded text-[9px] uppercase tracking-wide">
                            {cp.checkpointType.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-1.5">
                            {cp.scanRequired && (
                              <span className="text-[10px] material-symbols-outlined text-[#002D72]" title="Scan required">nfc</span>
                            )}
                            {cp.photoRequired && (
                              <span className="text-[10px] material-symbols-outlined text-purple-700" title="Photo required">photo_camera</span>
                            )}
                            {cp.checklistRequired && (
                              <span className="text-[10px] material-symbols-outlined text-blue-700" title="Checklist linked">rule</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 w-fit ${cp.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cp.isActive ? "bg-green-600" : "bg-red-600"}`}></span>
                            {cp.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleEdit(cp)}
                              className="p-1 hover:bg-[#E7EEFF] rounded text-[#002D72]"
                              title="Edit Node"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            {cp.isActive ? (
                              <button
                                onClick={() => handleDeactivate(cp)}
                                className="p-1 hover:bg-red-50 rounded text-red-700"
                                title="Deactivate"
                              >
                                <span className="material-symbols-outlined text-base">block</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(cp)}
                                className="p-1 hover:bg-green-50 rounded text-green-700"
                                title="Reactivate"
                              >
                                <span className="material-symbols-outlined text-base">check_circle</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Selected Details Panel */}
        {selectedCheckpoint && (
          <div className="w-full lg:w-80 bg-white border border-[#C4C6D2] rounded-xl p-5 shadow-sm flex flex-col gap-4 self-start">
            <div className="flex justify-between items-start border-b border-[#E7EEFF] pb-3">
              <div>
                <h4 className="text-sm font-bold text-[#001A48]">{selectedCheckpoint.checkpointName}</h4>
                <span className="font-mono text-[10px] text-[#747782]">{selectedCheckpoint.checkpointCode || "No code"}</span>
              </div>
              <button
                onClick={() => setSelectedCheckpoint(null)}
                className="text-[#747782] hover:bg-[#F0F3FF] p-1 rounded-full"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-[10px] font-bold text-[#747782] uppercase tracking-wider block">Operation Type</span>
                <span className="font-semibold text-[#001A48] block mt-0.5">
                  {selectedCheckpoint.operationType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management"}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#747782] uppercase tracking-wider block">Target site</span>
                <span className="font-semibold text-[#001A48] block mt-0.5">{selectedCheckpoint.site?.name || "—"}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#747782] uppercase tracking-wider block">Post / Zone</span>
                <span className="font-semibold text-[#001A48] block mt-0.5">{selectedCheckpoint.locationUnit?.name || "—"}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#F0F3FF] p-2.5 rounded-lg border border-[#B1C5FF]/30">
                <div>
                  <span className="text-[9px] font-bold text-[#002D72] uppercase block">NFC Tag ID</span>
                  <span className="font-mono font-bold text-[10px] text-[#001A48] mt-0.5 block truncate" title={selectedCheckpoint.nfcTagId || undefined}>
                    {selectedCheckpoint.nfcTagId || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-[#002D72] uppercase block">QR Code</span>
                  <span className="font-mono font-bold text-[10px] text-[#001A48] mt-0.5 block truncate" title={selectedCheckpoint.qrCode || undefined}>
                    {selectedCheckpoint.qrCode || "—"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#747782] uppercase tracking-wider block">Description</span>
                <p className="text-[#444651] mt-0.5 leading-relaxed">{selectedCheckpoint.description || "No description provided."}</p>
              </div>

              {selectedCheckpoint.latitude && selectedCheckpoint.longitude && (
                <div className="bg-slate-50 border border-[#C4C6D2]/60 p-3 rounded-lg flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#747782] uppercase">
                    <span className="material-symbols-outlined text-[12px] text-[#002D72]">gps_fixed</span>
                    Spatial verification
                  </div>
                  <div className="font-mono text-[10px] text-[#444651]">
                    <div>LAT: {selectedCheckpoint.latitude}</div>
                    <div>LNG: {selectedCheckpoint.longitude}</div>
                    <div>RADIUS: {selectedCheckpoint.radiusMeters || 15}M</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#E7EEFF]">
              <button
                onClick={() => handleEdit(selectedCheckpoint)}
                className="flex-1 bg-[#F0F3FF] hover:bg-[#E7EEFF] text-[#002D72] py-2 rounded-lg text-xs font-bold font-mono transition-all text-center"
              >
                Edit
              </button>
              {selectedCheckpoint.isActive ? (
                <button
                  onClick={() => handleDeactivate(selectedCheckpoint)}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-2 rounded-lg text-xs font-bold font-mono transition-all"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={() => handleReactivate(selectedCheckpoint)}
                  className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 py-2 rounded-lg text-xs font-bold font-mono transition-all"
                >
                  Reactivate
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Drawer Overlay (Add/Edit Form Sliding Panel) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-[420px] bg-white h-full shadow-2xl flex flex-col animate-slide-in relative border-l border-[#C4C6D2]">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#C4C6D2] flex justify-between items-center bg-[#E7EEFF]">
              <div>
                <h3 className="text-base font-bold text-[#001A48]">
                  {isEditMode ? "Modify Checkpoint" : "Configure Checkpoint"}
                </h3>
                <span className="text-[10px] font-mono text-[#002D72] uppercase tracking-wider font-bold">
                  {isEditMode ? "Edit Node attributes" : "New Node entry"}
                </span>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-[#747782] hover:bg-[#DAE2FF] p-1.5 rounded-full"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Drawer Form Scrollable */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg font-semibold">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg font-semibold">
                  {successMsg}
                </div>
              )}

              {/* Operation type (Admin only) */}
              {isAdmin && !isEditMode ? (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Operation Scope</label>
                  <select
                    value={formOpType}
                    onChange={(e) => {
                      setFormOpType(e.target.value);
                      setFormClientId("");
                      setFormProjectId("");
                      setFormSiteId("");
                      setFormLocationUnitId("");
                    }}
                    className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-[#002D72]"
                  >
                    <option value="SECURITY_GUARDING">Security Guarding</option>
                    <option value="FACILITY_MANAGEMENT">Facility Management</option>
                  </select>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] font-bold text-[#747782] uppercase tracking-wide block">Operation Scope</span>
                  <span className="font-bold text-[#001A48] mt-1 block">
                    {formOpType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management"}
                  </span>
                </div>
              )}

              {/* Hierarchy Fields */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Client</label>
                <select
                  value={formClientId}
                  onChange={(e) => {
                    setFormClientId(e.target.value);
                    setFormProjectId("");
                    setFormSiteId("");
                    setFormLocationUnitId("");
                  }}
                  className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-[#002D72]"
                >
                  <option value="">Select Client (Optional)</option>
                  {formFilteredClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Project</label>
                <select
                  value={formProjectId}
                  onChange={(e) => {
                    setFormProjectId(e.target.value);
                    setFormSiteId("");
                    setFormLocationUnitId("");
                  }}
                  className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-[#002D72]"
                >
                  <option value="">Select Project (Optional)</option>
                  {formFilteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Site Wing *</label>
                <select
                  value={formSiteId}
                  onChange={(e) => {
                    setFormSiteId(e.target.value);
                    setFormLocationUnitId("");
                  }}
                  required
                  className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-[#002D72]"
                >
                  <option value="">Select Site (Required)</option>
                  {formFilteredSites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Location Post / Zone</label>
                <select
                  value={formLocationUnitId}
                  onChange={(e) => setFormLocationUnitId(e.target.value)}
                  className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-[#002D72]"
                >
                  <option value="">Select Post (Optional)</option>
                  {formFilteredLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Node Metadata attributes */}
              <div className="bg-[#F0F3FF] p-3 rounded-lg border border-[#B1C5FF]/30 space-y-3">
                <span className="text-[9px] font-bold text-[#002D72] uppercase block tracking-wider">Node Attributes</span>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#444651]">Checkpoint Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lab Perimeter North"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="bg-white border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#002D72]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#444651]">Checkpoint Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CP-LAB-NORTH"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="bg-white border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#002D72] font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651]">NFC Tag ID (Hex)</label>
                    <input
                      type="text"
                      placeholder="FE:01:44:A2:99"
                      value={formNfcTagId}
                      onChange={(e) => setFormNfcTagId(e.target.value)}
                      className="bg-white border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#002D72] font-mono text-[11px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651]">QR Fallback Code</label>
                    <input
                      type="text"
                      placeholder="QR-LF-305"
                      value={formQrCode}
                      onChange={(e) => setFormQrCode(e.target.value)}
                      className="bg-white border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#002D72] font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#444651]">Checkpoint Node Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="bg-white border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-[#002D72]"
                  >
                    <option value="SECURITY_PATROL">Security Patrol</option>
                    <option value="FACILITY_INSPECTION">Facility Inspection</option>
                    <option value="FIRE_SAFETY">Fire Safety</option>
                    <option value="EQUIPMENT_ROOM">Equipment Room</option>
                    <option value="CLEANING_AREA">Cleaning Area</option>
                    <option value="MAINTENANCE_POINT">Maintenance Point</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              {/* Node description */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Node Description</label>
                <textarea
                  placeholder="Provide physical description or instructions..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#002D72] min-h-[60px]"
                />
              </div>

              {/* Spatial Verification Attributes */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-[#444651] uppercase block tracking-wider">Spatial verification</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#747782]">Latitude</label>
                    <input
                      type="text"
                      placeholder="e.g. 25.2854"
                      value={formLat}
                      onChange={(e) => setFormLat(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs font-mono text-[11px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#747782]">Longitude</label>
                    <input
                      type="text"
                      placeholder="e.g. 51.5310"
                      value={formLng}
                      onChange={(e) => setFormLng(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#747782]">Radius (Meters): {formRadius}M</label>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={formRadius}
                    onChange={(e) => setFormRadius(e.target.value)}
                    className="w-full accent-[#002D72]"
                  />
                  <div className="flex justify-between text-[9px] text-[#747782] font-mono mt-0.5">
                    <span>5M</span>
                    <span>100M</span>
                  </div>
                </div>
              </div>

              {/* Flags / Requirements */}
              <div className="space-y-2 border-t border-[#E7EEFF] pt-3">
                <span className="text-[10px] font-bold text-[#444651] uppercase block tracking-wider">Operational parameters</span>
                
                <label className="flex items-center gap-2 text-xs font-medium text-[#444651] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formScanRequired}
                    onChange={(e) => setFormScanRequired(e.target.checked)}
                    className="rounded text-[#002D72] focus:ring-[#002D72] w-4 h-4 border-[#C4C6D2]"
                  />
                  Scan Required (Tag or QR fallback scan must be executed)
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-[#444651] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formPhotoRequired}
                    onChange={(e) => setFormPhotoRequired(e.target.checked)}
                    className="rounded text-[#002D72] focus:ring-[#002D72] w-4 h-4 border-[#C4C6D2]"
                  />
                  Photo Verification Required (Attach real-time photo proof)
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-[#444651] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formChecklistRequired}
                    onChange={(e) => setFormChecklistRequired(e.target.checked)}
                    className="rounded text-[#002D72] focus:ring-[#002D72] w-4 h-4 border-[#C4C6D2]"
                  />
                  Task Checklist Required (Prompt task checklist submission on scan)
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-[#444651] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-[#002D72] focus:ring-[#002D72] w-4 h-4 border-[#C4C6D2]"
                  />
                  Checkpoint Node Active
                </label>
              </div>

              {/* Drawer Action buttons */}
              <div className="pt-4 border-t border-[#C4C6D2] grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-[#444651] py-2.5 rounded-lg font-bold text-xs transition-colors"
                >
                  Discard Draft
                </button>
                <button
                  type="submit"
                  className="bg-[#002D72] hover:bg-[#001D48] text-white py-2.5 rounded-lg font-bold text-xs transition-colors shadow"
                >
                  {isEditMode ? "Update Node" : "Provision Tag"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </SecfacPageGuard>
  );
}
