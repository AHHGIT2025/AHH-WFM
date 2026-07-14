"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface SecfacChecklistItem {
  id?: string;
  itemText: string;
  itemCode?: string | null;
  itemType: string;
  sortOrder: number;
  isRequired: boolean;
  requiresPhoto: boolean;
  requiresComment: boolean;
  expectedValue?: string | null;
  helpText?: string | null;
  isActive?: boolean;
}

interface SecfacChecklistTemplate {
  id: string;
  operationType: string;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  projectId?: string | null;
  project?: { id: string; name: string } | null;
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  locationUnitId?: string | null;
  locationUnit?: { id: string; name: string } | null;
  checkpointId?: string | null;
  checkpoint?: { id: string; checkpointName: string } | null;
  templateName: string;
  templateCode?: string | null;
  category: string;
  description?: string | null;
  checklistType: string;
  version: number;
  requiresNfcScan: boolean;
  requiresPhoto: boolean;
  requiresGeoFence: boolean;
  isActive: boolean;
  updatedAt?: string;
  items: SecfacChecklistItem[];
}

export default function ChecklistBuilderPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;

  // Master Data Lists
  const [templates, setTemplates] = useState<SecfacChecklistTemplate[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [locationUnits, setLocationUnits] = useState<any[]>([]);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SecfacChecklistTemplate | null>(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [filterOpType, setFilterOpType] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterCheckpoint, setFilterCheckpoint] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Drawer / Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form Fields - Template Metadata
  const [formOpType, setFormOpType] = useState("SECURITY_GUARDING");
  const [formClientId, setFormClientId] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formSiteId, setFormSiteId] = useState("");
  const [formLocationUnitId, setFormLocationUnitId] = useState("");
  const [formCheckpointId, setFormCheckpointId] = useState("");
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formCategory, setFormCategory] = useState("GENERAL");
  const [formChecklistType, setFormChecklistType] = useState("STANDARD");
  const [formDesc, setFormDesc] = useState("");
  const [formRequiresNfc, setFormRequiresNfc] = useState(false);
  const [formRequiresPhoto, setFormRequiresPhoto] = useState(false);
  const [formRequiresGeo, setFormRequiresGeo] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formVersion, setFormVersion] = useState(1);

  // Form Fields - Checklist Items
  const [formItems, setFormItems] = useState<SecfacChecklistItem[]>([]);
  
  // New Item Builder Form Fields
  const [newItemText, setNewItemText] = useState("");
  const [newItemCode, setNewItemCode] = useState("");
  const [newItemType, setNewItemType] = useState("YES_NO");
  const [newItemRequired, setNewItemRequired] = useState(true);
  const [newItemPhoto, setNewItemPhoto] = useState(false);
  const [newItemComment, setNewItemComment] = useState(false);
  const [newItemExpected, setNewItemExpected] = useState("");
  const [newItemHelp, setNewItemHelp] = useState("");

  // RBAC Resolution
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
      fetchTemplates();
      fetchMasterHierarchy();
    }
  }, [status, user]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/v1/secfac/checklists");
      const json = await res.json();
      if (json.success) {
        setTemplates(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load templates:", e);
    }
  };

  const fetchMasterHierarchy = async () => {
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
      setClients(clientList.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));

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
      setProjects(projList.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));

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
      setSites(siteList.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));

      // 4. Fetch Location Units
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
      setLocationUnits(locList.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));

      // 5. Fetch Checkpoints
      const cpRes = await fetch("/api/v1/secfac/checkpoints");
      const cpJson = await cpRes.json();
      if (cpJson.success) {
        setCheckpoints(cpJson.data || []);
      }
    } catch (e) {
      console.error("Failed to load hierarchy data:", e);
    }
  };

  // Filter Master Lists for search panel
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
  const filteredCheckpoints = checkpoints.filter(cp => {
    const siteMatch = !filterSite || cp.siteId === filterSite;
    const opMatch = !filterOpType || cp.operationType === filterOpType;
    return siteMatch && opMatch;
  });

  // Filter main table items
  const visibleTemplates = templates.filter(t => {
    if (search) {
      const s = search.toLowerCase();
      const matchName = t.templateName.toLowerCase().includes(s);
      const matchCode = t.templateCode?.toLowerCase().includes(s);
      const matchDesc = t.description?.toLowerCase().includes(s);
      if (!matchName && !matchCode && !matchDesc) return false;
    }
    if (filterOpType && t.operationType !== filterOpType) return false;
    if (filterClient && t.clientId !== filterClient) return false;
    if (filterProject && t.projectId !== filterProject) return false;
    if (filterSite && t.siteId !== filterSite) return false;
    if (filterLocation && t.locationUnitId !== filterLocation) return false;
    if (filterCheckpoint && t.checkpointId !== filterCheckpoint) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    if (filterType && t.checklistType !== filterType) return false;
    if (filterStatus !== "ALL") {
      const activeBool = filterStatus === "ACTIVE";
      if (t.isActive !== activeBool) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalCount = visibleTemplates.length;
  const activeCount = visibleTemplates.filter(t => t.isActive).length;
  const securityCount = visibleTemplates.filter(t => t.operationType === "SECURITY_GUARDING").length;
  const fmCount = visibleTemplates.filter(t => t.operationType === "FACILITY_MANAGEMENT").length;
  const checkpointLinkedCount = visibleTemplates.filter(t => t.checkpointId).length;
  const photoRequiredItemsCount = visibleTemplates.reduce((acc, t) => {
    return acc + t.items.filter(item => item.requiresPhoto).length;
  }, 0);

  // Form lists mapping
  const formFilteredClients = clients.filter(c => c.operationType === formOpType);
  const formFilteredProjects = projects.filter(p => p.operationType === formOpType && (!formClientId || p.clientId === formClientId || p.contract?.clientId === formClientId));
  const formFilteredSites = sites.filter(s => s.operationType === formOpType && (!formProjectId || s.projectId === formProjectId));
  const formFilteredLocations = locationUnits.filter(l => l.siteId === formSiteId);
  const formFilteredCheckpoints = checkpoints.filter(c => c.operationType === formOpType && (!formSiteId || c.siteId === formSiteId));

  // Checklist Item builder actions
  const handleAddItem = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;

    const newItem: SecfacChecklistItem = {
      itemText: newItemText,
      itemCode: newItemCode || null,
      itemType: newItemType,
      sortOrder: formItems.length,
      isRequired: newItemRequired,
      requiresPhoto: newItemPhoto,
      requiresComment: newItemComment,
      expectedValue: newItemExpected || null,
      helpText: newItemHelp || null,
      isActive: true
    };

    setFormItems([...formItems, newItem]);
    
    // Clear item inputs
    setNewItemText("");
    setNewItemCode("");
    setNewItemType("YES_NO");
    setNewItemRequired(true);
    setNewItemPhoto(false);
    setNewItemComment(false);
    setNewItemExpected("");
    setNewItemHelp("");
  };

  const handleRemoveItem = (index: number) => {
    const updated = formItems.filter((_, idx) => idx !== index).map((item, idx) => ({
      ...item,
      sortOrder: idx
    }));
    setFormItems(updated);
  };

  const handleShiftItem = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === formItems.length - 1) return;

    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const updated = [...formItems];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    // Reset sortOrder
    const final = updated.map((item, idx) => ({ ...item, sortOrder: idx }));
    setFormItems(final);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!formName.trim()) {
      setErrorMsg("Checklist template name is required");
      return;
    }
    if (formItems.length === 0) {
      setErrorMsg("You must add at least one question item to configure the template");
      return;
    }

    const payload = {
      operationType: formOpType,
      clientId: formClientId || null,
      projectId: formProjectId || null,
      siteId: formSiteId || null,
      locationUnitId: formLocationUnitId || null,
      checkpointId: formCheckpointId || null,
      templateName: formName,
      templateCode: formCode || null,
      category: formCategory,
      description: formDesc || null,
      checklistType: formChecklistType,
      version: formVersion,
      requiresNfcScan: formRequiresNfc,
      requiresPhoto: formRequiresPhoto,
      requiresGeoFence: formRequiresGeo,
      isActive: formIsActive,
      items: formItems
    };

    try {
      const url = isEditMode && selectedTemplate
        ? `/api/v1/secfac/checklists/${selectedTemplate.id}`
        : "/api/v1/secfac/checklists";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(isEditMode ? "Checklist template updated!" : "Checklist template published!");
        fetchTemplates();
        setIsDrawerOpen(false);
        resetForm();
      } else {
        setErrorMsg(data.error || data.message || "Failed to save template");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred");
    }
  };

  const handleEdit = (t: SecfacChecklistTemplate) => {
    setSelectedTemplate(t);
    setIsEditMode(true);
    setErrorMsg("");
    setSuccessMsg("");

    setFormOpType(t.operationType);
    setFormClientId(t.clientId || "");
    setFormProjectId(t.projectId || "");
    setFormSiteId(t.siteId || "");
    setFormLocationUnitId(t.locationUnitId || "");
    setFormCheckpointId(t.checkpointId || "");
    setFormName(t.templateName);
    setFormCode(t.templateCode || "");
    setFormCategory(t.category);
    setFormChecklistType(t.checklistType);
    setFormDesc(t.description || "");
    setFormRequiresNfc(t.requiresNfcScan);
    setFormRequiresPhoto(t.requiresPhoto);
    setFormRequiresGeo(t.requiresGeoFence);
    setFormIsActive(t.isActive);
    setFormVersion(t.version);
    setFormItems(t.items || []);

    setIsDrawerOpen(true);
  };

  const handleDeactivate = async (t: SecfacChecklistTemplate) => {
    if (!confirm(`Are you sure you want to deactivate template ${t.templateName}?`)) return;
    try {
      const res = await fetch(`/api/v1/secfac/checklists/${t.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchTemplates();
        if (selectedTemplate?.id === t.id) {
          setSelectedTemplate(prev => prev ? { ...prev, isActive: false } : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReactivate = async (t: SecfacChecklistTemplate) => {
    try {
      const res = await fetch(`/api/v1/secfac/checklists/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true })
      });
      if (res.ok) {
        fetchTemplates();
        if (selectedTemplate?.id === t.id) {
          setSelectedTemplate(prev => prev ? { ...prev, isActive: true } : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setSelectedTemplate(null);
    setFormName("");
    setFormCode("");
    setFormDesc("");
    setFormCategory("GENERAL");
    setFormChecklistType("STANDARD");
    setFormRequiresNfc(false);
    setFormRequiresPhoto(false);
    setFormRequiresGeo(false);
    setFormIsActive(true);
    setFormVersion(1);
    setFormItems([]);
  };

  if (status === "loading") {
    return (
      <div className="flex-1 bg-[#F9F9FF] p-8 flex items-center justify-center min-h-[85vh]">
        <div className="text-[#002D72] text-sm font-bold font-mono animate-pulse">Loading checklist master...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F9F9FF] p-6 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh] relative overflow-x-hidden">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[#002D72] text-3xl">rule</span>
            <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Checklist Builder</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider bg-[#DAE2FF] text-[#002D72] border border-[#B1C5FF] uppercase">
              Phase 1C
            </span>
          </div>
          <p className="text-xs text-[#444651]">
            Create reusable inspection, patrol, safety, cleaning, and maintenance checklist templates for SECFAC operations.
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
          Add Template
        </button>
      </div>

      {/* Notice Banner */}
      <div className="bg-[#E7EEFF] border border-[#B1C5FF] text-[#002D72] px-4 py-2.5 rounded-lg mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">info</span>
        <span className="text-[10px] font-bold font-mono uppercase tracking-wider">
          Phase 1C foundation: Checklist templates only. Mobile checklist execution will be enabled in a later phase.
        </span>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Total templates</span>
          <h3 className="text-xl font-bold text-[#001A48] mt-1">{totalCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Active templates</span>
          <h3 className="text-xl font-bold text-green-700 mt-1">{activeCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Security guards</span>
          <h3 className="text-xl font-bold font-mono text-[#002D72] mt-1">{securityCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Facility Inspection</span>
          <h3 className="text-xl font-bold text-teal-700 mt-1">{fmCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Checkpoint bound</span>
          <h3 className="text-xl font-bold text-orange-700 mt-1">{checkpointLinkedCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Required photo fields</span>
          <h3 className="text-xl font-bold text-purple-700 mt-1">{photoRequiredItemsCount}</h3>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Table & Filters */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Filter Panel */}
          <div className="bg-white border border-[#C4C6D2] rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1 col-span-1 md:col-span-2">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Search Templates</label>
              <input
                type="text"
                placeholder="Name, code, description..."
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
                    setFilterCheckpoint("");
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
                  setFilterCheckpoint("");
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
                  setFilterCheckpoint("");
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
                  setFilterCheckpoint("");
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
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Location Post / Zone</label>
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
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Checkpoint Link</label>
              <select
                value={filterCheckpoint}
                onChange={(e) => setFilterCheckpoint(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Checkpoints</option>
                {filteredCheckpoints.map((cp) => (
                  <option key={cp.id} value={cp.id}>{cp.checkpointName}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Categories</option>
                <option value="GENERAL">General</option>
                <option value="SECURITY_PATROL">Security Patrol</option>
                <option value="FACILITY_INSPECTION">Facility Inspection</option>
                <option value="FIRE_SAFETY">Fire Safety</option>
                <option value="CLEANING">Cleaning</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="EQUIPMENT_ROOM">Equipment Room</option>
                <option value="CLIENT_SPECIFIC">Client Specific</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Checklist Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Types</option>
                <option value="STANDARD">Standard</option>
                <option value="PATROL">Patrol</option>
                <option value="INSPECTION">Inspection</option>
                <option value="SAFETY">Safety</option>
                <option value="CLEANING">Cleaning</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="HANDOVER">Handover</option>
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
                    <th className="px-4 py-3">Template Name</th>
                    <th className="px-4 py-3">Operation</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Site Scope</th>
                    <th className="px-4 py-3">Checkpoint Link</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EEFF]">
                  {visibleTemplates.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-xs text-[#747782]">
                        No checklist templates configured yet. Add your first template to prepare SECFAC inspections.
                      </td>
                    </tr>
                  ) : (
                    visibleTemplates.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTemplate(t)}
                        className={`hover:bg-[#F0F3FF] cursor-pointer transition-colors text-xs font-semibold ${selectedTemplate?.id === t.id ? "bg-[#E7EEFF] border-l-4 border-[#002D72]" : ""}`}
                      >
                        <td className="px-4 py-3.5 font-bold text-[#001A48]">
                          {t.templateName}
                          {t.templateCode && (
                            <span className="block font-mono text-[9px] text-[#747782] mt-0.5">{t.templateCode}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[#444651]">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${t.operationType === "SECURITY_GUARDING" ? "bg-[#DAE2FF] text-[#002D72]" : "bg-teal-50 text-teal-700"}`}>
                            {t.operationType === "SECURITY_GUARDING" ? "Security" : "Facility"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[#444651]">
                          <span className="bg-[#F0F3FF] text-[#002D72] px-2 py-0.5 rounded text-[9px]">
                            {t.category.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[#444651]">{t.checklistType}</td>
                        <td className="px-4 py-3.5 text-[#444651]">{t.site?.name || "—"}</td>
                        <td className="px-4 py-3.5 text-[#444651] font-medium text-[#002D72]">
                          {t.checkpoint?.checkpointName || <span className="text-[#747782] font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-[#444651] font-mono">{t.items?.length || 0} Qs</td>
                        <td className="px-4 py-3.5 text-[#444651] font-mono">v{t.version}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 w-fit ${t.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? "bg-green-600" : "bg-red-600"}`}></span>
                            {t.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleEdit(t)}
                              className="p-1 hover:bg-[#E7EEFF] rounded text-[#002D72]"
                              title="Edit Template"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            {t.isActive ? (
                              <button
                                onClick={() => handleDeactivate(t)}
                                className="p-1 hover:bg-red-50 rounded text-red-700"
                                title="Deactivate"
                              >
                                <span className="material-symbols-outlined text-base">block</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(t)}
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

        {/* Right Side: Preview & Read-Only Simulation Frame */}
        <div className="w-full lg:w-80 bg-white border border-[#C4C6D2] rounded-xl overflow-hidden shadow-sm flex flex-col self-start">
          <div className="p-4 border-b border-[#E7EEFF] bg-slate-50 flex items-center justify-between">
            <span className="text-[10px] font-bold font-mono text-[#002D72] uppercase tracking-wider">Live Preview</span>
            <span className="material-symbols-outlined text-[#747782] text-sm">smartphone</span>
          </div>

          <div className="p-5 flex justify-center bg-slate-100 border-b border-[#E7EEFF]">
            {/* Mobile frame wrapper simulation */}
            <div className="w-[240px] aspect-[9/19] rounded-[2rem] border-[8px] border-slate-800 bg-white shadow-lg overflow-hidden flex flex-col">
              {/* Notch */}
              <div className="h-4 w-24 bg-slate-800 mx-auto rounded-b-xl shrink-0"></div>

              {/* Mobile Viewport Area */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3 font-sans text-[10px]">
                <div className="flex items-center gap-1 text-[#002D72] font-bold">
                  <span className="material-symbols-outlined !text-[12px]">arrow_back</span>
                  <span className="truncate">{selectedTemplate ? selectedTemplate.templateName : "No template selected"}</span>
                </div>

                {!selectedTemplate || !selectedTemplate.items || selectedTemplate.items.length === 0 ? (
                  <div className="py-10 text-center text-[#747782] text-[9px]">
                    Select a checklist template from the table to preview mobile field rendering.
                  </div>
                ) : (
                  selectedTemplate.items.map((item, idx) => (
                    <div key={idx} className="p-2 bg-[#F0F3FF] border border-[#C4C6D2]/60 rounded space-y-1.5">
                      <div className="flex justify-between items-center text-[8px] font-bold text-[#747782]">
                        <span className={item.isRequired ? "text-red-600 font-extrabold" : ""}>
                          {item.isRequired ? "* REQUIRED" : "OPTIONAL"}
                        </span>
                        <span className="font-mono">Q{idx + 1}/{selectedTemplate.items.length}</span>
                      </div>
                      <p className="font-semibold text-slate-800 leading-tight">{item.itemText}</p>
                      {item.helpText && <p className="text-[7.5px] text-slate-500 italic leading-snug">{item.helpText}</p>}

                      {/* Render mock response options depending on itemType */}
                      {item.itemType === "YES_NO" && (
                        <div className="flex gap-1.5 mt-1">
                          <button className="flex-1 py-1 bg-white border border-[#002D72] text-[#002D72] rounded text-[8px] font-bold">YES</button>
                          <button className="flex-1 py-1 bg-white border border-[#C4C6D2] text-[#444651] rounded text-[8px] font-bold">NO</button>
                        </div>
                      )}
                      {item.itemType === "PASS_FAIL" && (
                        <div className="flex gap-1.5 mt-1">
                          <button className="flex-1 py-1 bg-white border border-green-700 text-green-700 rounded text-[8px] font-bold">PASS</button>
                          <button className="flex-1 py-1 bg-white border border-red-700 text-red-700 rounded text-[8px] font-bold">FAIL</button>
                        </div>
                      )}
                      {item.itemType === "TEXT" && (
                        <input type="text" disabled placeholder="Input text response..." className="w-full bg-white border border-[#C4C6D2] rounded p-1 text-[7.5px] cursor-not-allowed" />
                      )}
                      {item.itemType === "NUMBER" && (
                        <input type="number" disabled placeholder="Input numeric reading..." className="w-full bg-white border border-[#C4C6D2] rounded p-1 text-[7.5px] cursor-not-allowed font-mono" />
                      )}
                      {item.itemType === "PHOTO" && (
                        <div className="flex justify-center border border-dashed border-[#B1C5FF] p-2 rounded bg-white text-[#002D72] font-semibold text-[8px] cursor-not-allowed">
                          <span className="material-symbols-outlined !text-[10px] mr-1">photo_camera</span>
                          Snap Photo Proof
                        </div>
                      )}
                      {item.itemType === "SIGNATURE" && (
                        <div className="h-10 bg-slate-50 border border-[#C4C6D2] rounded flex items-center justify-center text-slate-400 text-[8px] font-mono italic">
                          Signature Pad Area
                        </div>
                      )}

                      {/* Evidence indicators */}
                      <div className="flex gap-2 pt-1 text-[7px] font-mono text-[#002D72]">
                        {item.requiresPhoto && (
                          <span className="flex items-center gap-0.5"><span className="material-symbols-outlined !text-[8px]">photo_camera</span>Photo Req.</span>
                        )}
                        {item.requiresComment && (
                          <span className="flex items-center gap-0.5"><span className="material-symbols-outlined !text-[8px]">chat_bubble</span>Comment Req.</span>
                        )}
                        {item.expectedValue && (
                          <span className="flex items-center gap-0.5 text-green-700"><span className="material-symbols-outlined !text-[8px]">check_circle</span>Expect: {item.expectedValue}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Mock submit button */}
              <div className="p-2 border-t border-[#C4C6D2] bg-white shrink-0">
                <button className="w-full bg-[#002D72] text-white py-1.5 rounded-md font-bold text-[9px] cursor-not-allowed opacity-80">
                  SUBMIT REPORT
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 text-[10px] text-[#444651] leading-relaxed">
            <span className="font-bold text-[#001A48] block mb-1">Preview Info</span>
            Simulates dynamic layout seen by patrol officers. Response triggers (photo/GPS check) are rendered according to requirements.
          </div>
        </div>
      </div>

      {/* Drawer Overlay (Add/Edit Form Sliding Panel) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-[500px] bg-white h-full shadow-2xl flex flex-col animate-slide-in relative border-l border-[#C4C6D2]">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#C4C6D2] flex justify-between items-center bg-[#E7EEFF]">
              <div>
                <h3 className="text-base font-bold text-[#001A48]">
                  {isEditMode ? "Modify Checklist Template" : "Build Checklist Template"}
                </h3>
                <span className="text-[10px] font-mono text-[#002D72] uppercase tracking-wider font-bold">
                  {isEditMode ? `Edit Template attributes — v${formVersion}` : "New Checklist Configuration"}
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
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
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

              {/* Template Metadata Block */}
              <div className="space-y-3.5">
                <span className="text-[10px] font-bold text-[#002D72] uppercase block tracking-wider border-b border-[#E7EEFF] pb-1.5">1. Template Specifications</span>

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
                        setFormCheckpointId("");
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Template Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Server Room Fire check"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#002D72]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Template Code</label>
                    <input
                      type="text"
                      placeholder="e.g. TPL-SRV-FIRE"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#002D72] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="GENERAL">General</option>
                      <option value="SECURITY_PATROL">Security Patrol</option>
                      <option value="FACILITY_INSPECTION">Facility Inspection</option>
                      <option value="FIRE_SAFETY">Fire Safety</option>
                      <option value="CLEANING">Cleaning</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="EQUIPMENT_ROOM">Equipment Room</option>
                      <option value="CLIENT_SPECIFIC">Client Specific</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Checklist Type</label>
                    <select
                      value={formChecklistType}
                      onChange={(e) => setFormChecklistType(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="STANDARD">Standard</option>
                      <option value="PATROL">Patrol</option>
                      <option value="INSPECTION">Inspection</option>
                      <option value="SAFETY">Safety</option>
                      <option value="CLEANING">Cleaning</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="HANDOVER">Handover</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Client</label>
                    <select
                      value={formClientId}
                      onChange={(e) => {
                        setFormClientId(e.target.value);
                        setFormProjectId("");
                        setFormSiteId("");
                        setFormLocationUnitId("");
                        setFormCheckpointId("");
                      }}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
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
                        setFormCheckpointId("");
                      }}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="">Select Project (Optional)</option>
                      {formFilteredProjects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Site Wing</label>
                    <select
                      value={formSiteId}
                      onChange={(e) => {
                        setFormSiteId(e.target.value);
                        setFormLocationUnitId("");
                        setFormCheckpointId("");
                      }}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="">Select Site (Optional)</option>
                      {formFilteredSites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Location Post / Zone</label>
                    <select
                      value={formLocationUnitId}
                      onChange={(e) => {
                        setFormLocationUnitId(e.target.value);
                        setFormCheckpointId("");
                      }}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="">Select Post (Optional)</option>
                      {formFilteredLocations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Checkpoint Link</label>
                  <select
                    value={formCheckpointId}
                    onChange={(e) => setFormCheckpointId(e.target.value)}
                    className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                  >
                    <option value="">Select Checkpoint Tag (Optional)</option>
                    {formFilteredCheckpoints.map((c) => (
                      <option key={c.id} value={c.id}>{c.checkpointName}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Description</label>
                  <textarea
                    placeholder="Provide overview of checklist guidelines..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#002D72] min-h-[60px]"
                  />
                </div>
              </div>

              {/* Checklist items list */}
              <div className="space-y-3.5">
                <span className="text-[10px] font-bold text-[#002D72] uppercase block tracking-wider border-b border-[#E7EEFF] pb-1.5">2. Configured Questions ({formItems.length})</span>

                {formItems.length === 0 ? (
                  <div className="py-6 border border-dashed border-[#C4C6D2] rounded-lg text-center text-slate-500 font-semibold italic">
                    No questions added. Add your first item below.
                  </div>
                ) : (
                  <div className="space-y-2 border border-[#C4C6D2]/60 p-3 rounded-lg bg-slate-50 max-h-[220px] overflow-y-auto">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="bg-white border border-[#C4C6D2]/80 p-2.5 rounded-lg flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] bg-[#E7EEFF] text-[#002D72] px-1 py-0.2 rounded font-mono font-bold">Q{idx + 1}</span>
                            <span className="text-[9px] font-mono text-[#747782] font-semibold">{item.itemType}</span>
                          </div>
                          <p className="font-bold text-slate-800 text-[11px] truncate">{item.itemText}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleShiftItem(idx, "up")}
                            disabled={idx === 0}
                            className="p-1 hover:bg-[#F0F3FF] rounded disabled:opacity-30"
                          >
                            <span className="material-symbols-outlined text-sm">arrow_upward</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShiftItem(idx, "down")}
                            disabled={idx === formItems.length - 1}
                            className="p-1 hover:bg-[#F0F3FF] rounded disabled:opacity-30"
                          >
                            <span className="material-symbols-outlined text-sm">arrow_downward</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 hover:bg-red-50 text-red-700 rounded"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklist item builder form */}
              <div className="bg-[#F0F3FF] p-4 rounded-xl border border-[#B1C5FF]/30 space-y-3">
                <span className="text-[9px] font-bold text-[#002D72] uppercase block tracking-wider">Question Designer</span>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#444651]">Question Text *</label>
                  <input
                    type="text"
                    placeholder="e.g. Inspect fire exits..."
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    className="bg-white border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651]">Question Code</label>
                    <input
                      type="text"
                      placeholder="e.g. Q-EXITS"
                      value={newItemCode}
                      onChange={(e) => setNewItemCode(e.target.value)}
                      className="bg-white border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651]">Response Type</label>
                    <select
                      value={newItemType}
                      onChange={(e) => setNewItemType(e.target.value)}
                      className="bg-white border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="YES_NO">Yes / No</option>
                      <option value="PASS_FAIL">Pass / Fail</option>
                      <option value="TEXT">Text Box</option>
                      <option value="NUMBER">Numeric Value</option>
                      <option value="PHOTO">Photo proof only</option>
                      <option value="COMMENT">Text comment only</option>
                      <option value="SELECT">Select Dropdown</option>
                      <option value="MULTI_SELECT">Multi-select checkboxes</option>
                      <option value="DATE_TIME">Date / Time stamp</option>
                      <option value="SIGNATURE">Signature sign</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651]">Expected value</label>
                    <input
                      type="text"
                      placeholder="e.g. YES or PASS"
                      value={newItemExpected}
                      onChange={(e) => setNewItemExpected(e.target.value)}
                      className="bg-white border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651]">Help description</label>
                    <input
                      type="text"
                      placeholder="e.g. Verify lock mechanism"
                      value={newItemHelp}
                      onChange={(e) => setNewItemHelp(e.target.value)}
                      className="bg-white border border-[#C4C6D2] rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[#C4C6D2]/30 pt-2.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#444651] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemRequired}
                      onChange={(e) => setNewItemRequired(e.target.checked)}
                      className="rounded text-[#002D72] focus:ring-[#002D72] w-3.5 h-3.5 border-[#C4C6D2]"
                    />
                    Required Question
                  </label>

                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#444651] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemPhoto}
                      onChange={(e) => setNewItemPhoto(e.target.checked)}
                      className="rounded text-[#002D72] focus:ring-[#002D72] w-3.5 h-3.5 border-[#C4C6D2]"
                    />
                    Photo Evidence
                  </label>

                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#444651] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemComment}
                      onChange={(e) => setNewItemComment(e.target.checked)}
                      className="rounded text-[#002D72] focus:ring-[#002D72] w-3.5 h-3.5 border-[#C4C6D2]"
                    />
                    Remarks comment
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-[#002D72] hover:bg-[#001D48] text-white py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 mt-2"
                >
                  <span className="material-symbols-outlined text-sm">playlist_add</span>
                  Add Question
                </button>
              </div>

              {/* Template Requirements and Activation */}
              <div className="space-y-2 border-t border-[#E7EEFF] pt-3">
                <span className="text-[10px] font-bold text-[#444651] uppercase block tracking-wider">3. Checklist execution specifications</span>
                
                <label className="flex items-center gap-2 text-xs font-medium text-[#444651] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRequiresNfc}
                    onChange={(e) => setFormRequiresNfc(e.target.checked)}
                    className="rounded text-[#002D72] focus:ring-[#002D72] w-4 h-4 border-[#C4C6D2]"
                  />
                  Requires Checkpoint NFC Scan (Tag check required)
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-[#444651] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRequiresPhoto}
                    onChange={(e) => setFormRequiresPhoto(e.target.checked)}
                    className="rounded text-[#002D72] focus:ring-[#002D72] w-4 h-4 border-[#C4C6D2]"
                  />
                  Requires General Photo proof (Attach proof photo)
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-[#444651] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRequiresGeo}
                    onChange={(e) => setFormRequiresGeo(e.target.checked)}
                    className="rounded text-[#002D72] focus:ring-[#002D72] w-4 h-4 border-[#C4C6D2]"
                  />
                  Requires Spatial Geofencing (Verify GPS coordinates on scan)
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-[#444651] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-[#002D72] focus:ring-[#002D72] w-4 h-4 border-[#C4C6D2]"
                  />
                  Template Published (Active)
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
                  {isEditMode ? "Update Template" : "Publish Checklist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
