"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface SecfacAssignment {
  id: string;
  operationType: string;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  projectId?: string | null;
  project?: { id: string; name: string } | null;
  siteId: string;
  site?: { id: string; name: string } | null;
  locationUnitId?: string | null;
  locationUnit?: { id: string; name: string } | null;
  checkpointId?: string | null;
  checkpoint?: { id: string; checkpointName: string } | null;
  templateId?: string | null;
  template?: { id: string; templateName: string } | null;
  employeeId: string;
  employee?: { id: string; name: string; email: string } | null;
  supervisorId?: string | null;
  supervisor?: { id: string; name: string; email: string } | null;
  assignmentName: string;
  assignmentCode?: string | null;
  description?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function AssignmentsPlannerPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;

  // Master Data Lists
  const [assignments, setAssignments] = useState<SecfacAssignment[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [locationUnits, setLocationUnits] = useState<any[]>([]);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Selected Assignment details
  const [selectedAssignment, setSelectedAssignment] = useState<SecfacAssignment | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<any>(null);
  const [loadingExecution, setLoadingExecution] = useState(false);

  useEffect(() => {
    if (!selectedAssignment) {
      setSelectedExecution(null);
      return;
    }
    setLoadingExecution(true);
    fetch(`/api/v1/secfac/checklist-executions?assignmentId=${selectedAssignment.id}`)
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data && res.data.length > 0) {
          setSelectedExecution(res.data[0]);
        } else {
          setSelectedExecution(null);
        }
      })
      .catch(() => setSelectedExecution(null))
      .finally(() => setLoadingExecution(false));
  }, [selectedAssignment]);

  // Filters State
  const [search, setSearch] = useState("");
  const [filterOpType, setFilterOpType] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterCheckpoint, setFilterCheckpoint] = useState("");
  const [filterTemplate, setFilterTemplate] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterSupervisor, setFilterSupervisor] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterActive, setFilterActive] = useState("ACTIVE");

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
  const [formCheckpointId, setFormCheckpointId] = useState("");
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formSupervisorId, setFormSupervisorId] = useState("");
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formStatus, setFormStatus] = useState("PENDING");
  const [formIsActive, setFormIsActive] = useState(true);

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
      fetchAssignments();
      fetchMasterData();
    }
  }, [status, user]);

  const fetchAssignments = async () => {
    try {
      const res = await fetch("/api/v1/secfac/assignments");
      const json = await res.json();
      if (json.success) {
        setAssignments(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load assignments:", e);
    }
  };

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
      if (cpJson.success) setCheckpoints(cpJson.data || []);

      // 6. Fetch Checklist Templates
      const tplRes = await fetch("/api/v1/secfac/checklists");
      const tplJson = await tplRes.json();
      if (tplJson.success) setTemplates(tplJson.data || []);

      // 7. Fetch Employees (Workforce directory)
      const empRes = await fetch("/api/v1/employees");
      const empJson = await empRes.json();
      if (Array.isArray(empJson)) setEmployees(empJson);
    } catch (e) {
      console.error("Failed to load master planning data:", e);
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
  const filteredTemplates = templates.filter(t => {
    const siteMatch = !filterSite || t.siteId === filterSite;
    const opMatch = !filterOpType || t.operationType === filterOpType;
    return siteMatch && opMatch;
  });
  const filteredEmployees = employees.filter(e => {
    if (!filterOpType) return true;
    if (filterOpType === "SECURITY_GUARDING") return e.operationType === "SECURITY_GUARDING";
    if (filterOpType === "FACILITY_MANAGEMENT") return e.operationType === "FACILITY_MANAGEMENT";
    return true;
  });

  // Filter main table items
  const visibleAssignments = assignments.filter(a => {
    if (search) {
      const s = search.toLowerCase();
      const matchName = a.assignmentName.toLowerCase().includes(s);
      const matchCode = a.assignmentCode?.toLowerCase().includes(s);
      const matchDesc = a.description?.toLowerCase().includes(s);
      if (!matchName && !matchCode && !matchDesc) return false;
    }
    if (filterOpType && a.operationType !== filterOpType) return false;
    if (filterClient && a.clientId !== filterClient) return false;
    if (filterProject && a.projectId !== filterProject) return false;
    if (filterSite && a.siteId !== filterSite) return false;
    if (filterLocation && a.locationUnitId !== filterLocation) return false;
    if (filterCheckpoint && a.checkpointId !== filterCheckpoint) return false;
    if (filterTemplate && a.templateId !== filterTemplate) return false;
    if (filterEmployee && a.employeeId !== filterEmployee) return false;
    if (filterSupervisor && a.supervisorId !== filterSupervisor) return false;
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (filterActive !== "ALL") {
      const activeBool = filterActive === "ACTIVE";
      if (a.isActive !== activeBool) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalCount = visibleAssignments.length;
  const pendingCount = visibleAssignments.filter(a => a.status === "PENDING").length;
  const inProgressCount = visibleAssignments.filter(a => a.status === "IN_PROGRESS").length;
  const completedCount = visibleAssignments.filter(a => a.status === "COMPLETED").length;
  const overdueCount = visibleAssignments.filter(a => a.status === "OVERDUE").length;
  const checkpointLinkedCount = visibleAssignments.filter(a => a.checkpointId).length;

  // Form lists mapping
  const formFilteredClients = clients.filter(c => c.operationType === formOpType);
  const formFilteredProjects = projects.filter(p => p.operationType === formOpType && (!formClientId || p.clientId === formClientId || p.contract?.clientId === formClientId));
  const formFilteredSites = sites.filter(s => s.operationType === formOpType && (!formProjectId || s.projectId === formProjectId));
  const formFilteredLocations = locationUnits.filter(l => l.siteId === formSiteId);
  const formFilteredCheckpoints = checkpoints.filter(c => c.operationType === formOpType && (!formSiteId || c.siteId === formSiteId));
  const formFilteredTemplates = templates.filter(t => t.operationType === formOpType && (!formSiteId || t.siteId === formSiteId || !t.siteId));
  const formFilteredEmployees = employees.filter(e => e.operationType === formOpType);
  const formFilteredSupervisors = employees.filter(e => e.role === "SUPERVISOR" || e.role === "ADMIN" || e.role === "SUPER_ADMIN");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!formName.trim()) {
      setErrorMsg("Assignment name is required");
      return;
    }
    if (!formEmployeeId) {
      setErrorMsg("Please select an assigned employee");
      return;
    }
    if (!formSiteId) {
      setErrorMsg("Please select an operational site location");
      return;
    }
    if (!formStart || !formEnd) {
      setErrorMsg("Please configure start and end schedule date/time window");
      return;
    }
    if (new Date(formStart).getTime() >= new Date(formEnd).getTime()) {
      setErrorMsg("Scheduled end must be chronologically after scheduled start");
      return;
    }

    const payload = {
      operationType: formOpType,
      clientId: formClientId || null,
      projectId: formProjectId || null,
      siteId: formSiteId,
      locationUnitId: formLocationUnitId || null,
      checkpointId: formCheckpointId || null,
      templateId: formTemplateId || null,
      employeeId: formEmployeeId,
      supervisorId: formSupervisorId || null,
      assignmentName: formName,
      assignmentCode: formCode || null,
      description: formDesc || null,
      scheduledStart: new Date(formStart).toISOString(),
      scheduledEnd: new Date(formEnd).toISOString(),
      status: formStatus,
      isActive: formIsActive
    };

    try {
      const url = isEditMode && selectedAssignment
        ? `/api/v1/secfac/assignments/${selectedAssignment.id}`
        : "/api/v1/secfac/assignments";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(isEditMode ? "Assignment details updated!" : "Assignment published successfully!");
        fetchAssignments();
        setIsDrawerOpen(false);
        resetForm();
      } else {
        setErrorMsg(data.error || data.message || "Failed to save assignment");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred");
    }
  };

  const handleEdit = (a: SecfacAssignment) => {
    setSelectedAssignment(a);
    setIsEditMode(true);
    setErrorMsg("");
    setSuccessMsg("");

    setFormOpType(a.operationType);
    setFormClientId(a.clientId || "");
    setFormProjectId(a.projectId || "");
    setFormSiteId(a.siteId);
    setFormLocationUnitId(a.locationUnitId || "");
    setFormCheckpointId(a.checkpointId || "");
    setFormTemplateId(a.templateId || "");
    setFormEmployeeId(a.employeeId);
    setFormSupervisorId(a.supervisorId || "");
    setFormName(a.assignmentName);
    setFormCode(a.assignmentCode || "");
    setFormDesc(a.description || "");
    setFormStart(a.scheduledStart ? a.scheduledStart.substring(0, 16) : "");
    setFormEnd(a.scheduledEnd ? a.scheduledEnd.substring(0, 16) : "");
    setFormStatus(a.status);
    setFormIsActive(a.isActive);

    setIsDrawerOpen(true);
  };

  const handleDeactivate = async (a: SecfacAssignment) => {
    if (!confirm(`Are you sure you want to deactivate assignment ${a.assignmentName}?`)) return;
    try {
      const res = await fetch(`/api/v1/secfac/assignments/${a.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchAssignments();
        if (selectedAssignment?.id === a.id) {
          setSelectedAssignment(prev => prev ? { ...prev, isActive: false } : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReactivate = async (a: SecfacAssignment) => {
    try {
      const res = await fetch(`/api/v1/secfac/assignments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true })
      });
      if (res.ok) {
        fetchAssignments();
        if (selectedAssignment?.id === a.id) {
          setSelectedAssignment(prev => prev ? { ...prev, isActive: true } : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setSelectedAssignment(null);
    setFormName("");
    setFormCode("");
    setFormDesc("");
    setFormStart("");
    setFormEnd("");
    setFormStatus("PENDING");
    setFormIsActive(true);
    setFormEmployeeId("");
    setFormSupervisorId("");
    setFormTemplateId("");
    setFormCheckpointId("");
    setFormLocationUnitId("");
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (status === "loading") {
    return (
      <div className="flex-1 bg-[#F9F9FF] p-8 flex items-center justify-center min-h-[85vh]">
        <div className="text-[#002D72] text-sm font-bold font-mono animate-pulse">Loading assignments planner...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F9F9FF] p-6 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh] relative overflow-x-hidden">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[#002D72] text-3xl">assignment</span>
            <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Tour & Inspection Assignments</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider bg-[#DAE2FF] text-[#002D72] border border-[#B1C5FF] uppercase">
              Phase 1D
            </span>
          </div>
          <p className="text-xs text-[#444651]">
            Assign security guard patrols, fire safety walks, and facility maintenance inspections to rostered workforce.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsDrawerOpen(true);
          }}
          className="bg-[#002D72] hover:bg-[#001D48] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">edit_calendar</span>
          Schedule Task
        </button>
      </div>

      {/* Notice Banner */}
      <div className="bg-[#E7EEFF] border border-[#B1C5FF] text-[#002D72] px-4 py-2.5 rounded-lg mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">info</span>
        <span className="text-[10px] font-bold font-mono uppercase tracking-wider">
          Phase 1D foundation: Schedule planner only. Mobile checklist execution is disabled.
        </span>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Total scheduled</span>
          <h3 className="text-xl font-bold text-[#001A48] mt-1">{totalCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Pending Tasks</span>
          <h3 className="text-xl font-bold text-slate-700 mt-1">{pendingCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">In Progress</span>
          <h3 className="text-xl font-bold text-[#002D72] mt-1">{inProgressCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Completed</span>
          <h3 className="text-xl font-bold text-green-700 mt-1">{completedCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Overdue Alerts</span>
          <h3 className="text-xl font-bold text-red-700 mt-1">{overdueCount}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-3.5 shadow-sm">
          <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider block">Checkpoint Bound</span>
          <h3 className="text-xl font-bold text-orange-700 mt-1">{checkpointLinkedCount}</h3>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left Side: Table & Filters */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Filter Panel */}
          <div className="bg-white border border-[#C4C6D2] rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1 col-span-1 md:col-span-2">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Search Assignments</label>
              <input
                type="text"
                placeholder="Name, code, notes..."
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
                    setFilterTemplate("");
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
                  setFilterTemplate("");
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
                  setFilterTemplate("");
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
                  setFilterTemplate("");
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
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Checklist Template</label>
              <select
                value={filterTemplate}
                onChange={(e) => setFilterTemplate(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Templates</option>
                {filteredTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.templateName}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Assigned Staff</label>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Employees</option>
                {filteredEmployees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Supervisor</label>
              <select
                value={filterSupervisor}
                onChange={(e) => setFilterSupervisor(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="">All Supervisors</option>
                {reportingManagers().map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
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
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="SKIPPED">Skipped</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Activation</label>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#002D72]"
              >
                <option value="ALL">All</option>
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
                    <th className="px-4 py-3">Assignment details</th>
                    <th className="px-4 py-3">Operation</th>
                    <th className="px-4 py-3">Site Location</th>
                    <th className="px-4 py-3">Checklist Template</th>
                    <th className="px-4 py-3">Assigned Staff</th>
                    <th className="px-4 py-3">Supervisor</th>
                    <th className="px-4 py-3">Schedule Window</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EEFF]">
                  {visibleAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-xs text-[#747782]">
                        No assignments configured yet. Add your first planned schedule to deploy tasks.
                      </td>
                    </tr>
                  ) : (
                    visibleAssignments.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => setSelectedAssignment(a)}
                        className={`hover:bg-[#F0F3FF] cursor-pointer transition-colors text-xs font-semibold ${selectedAssignment?.id === a.id ? "bg-[#E7EEFF] border-l-4 border-[#002D72]" : ""}`}
                      >
                        <td className="px-4 py-3.5 font-bold text-[#001A48]">
                          {a.assignmentName}
                          {a.assignmentCode && (
                            <span className="block font-mono text-[9px] text-[#747782] mt-0.5">{a.assignmentCode}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[#444651]">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${a.operationType === "SECURITY_GUARDING" ? "bg-[#DAE2FF] text-[#002D72]" : "bg-teal-50 text-teal-700"}`}>
                            {a.operationType === "SECURITY_GUARDING" ? "Security" : "Facility"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[#444651]">
                          {a.site?.name || "—"}
                          {a.locationUnit?.name && (
                            <span className="block text-[10px] text-[#747782] font-medium">{a.locationUnit.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[#002D72] font-bold">
                          {a.template?.templateName || <span className="text-[#747782] font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-[#444651] font-bold">
                          {a.employee?.name || "—"}
                          <span className="block font-mono text-[9px] text-[#747782] font-semibold">{a.employeeId}</span>
                        </td>
                        <td className="px-4 py-3.5 text-[#444651]">{a.supervisor?.name || "—"}</td>
                        <td className="px-4 py-3.5 text-[#444651] leading-tight">
                          <span className="block font-medium">Start: {formatDate(a.scheduledStart)}</span>
                          <span className="block text-[#747782] mt-0.5">End: {formatDate(a.scheduledEnd)}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider block w-fit ${
                            a.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                            a.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                            a.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                            a.status === "SKIPPED" ? "bg-orange-100 text-orange-700" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {a.status}
                          </span>
                          {!a.isActive && (
                            <span className="text-[8px] font-bold text-red-600 uppercase block mt-1">Deactivated</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleEdit(a)}
                              className="p-1 hover:bg-[#E7EEFF] rounded text-[#002D72]"
                              title="Edit"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            {a.isActive ? (
                              <button
                                onClick={() => handleDeactivate(a)}
                                className="p-1 hover:bg-red-50 rounded text-red-700"
                                title="Deactivate"
                              >
                                <span className="material-symbols-outlined text-base">block</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(a)}
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

        {/* Right Side: Assignment Details & Checklist Submission Preview */}
        {selectedAssignment && (
          <div className="w-full xl:w-[400px] bg-white border border-[#C4C6D2] rounded-xl p-5 shadow-sm space-y-5 flex flex-col self-start shrink-0">
            <div className="flex justify-between items-start border-b border-[#E7EEFF] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#001A48]">{selectedAssignment.assignmentName}</h3>
                <span className="text-[10px] font-mono text-[#747782]">{selectedAssignment.assignmentCode || "NO CODE"}</span>
              </div>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="text-[#747782] hover:bg-[#DAE2FF] p-1 rounded-full flex items-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-[9px] font-bold text-[#747782] uppercase block tracking-wider">Operation Scope</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold inline-block mt-1 ${selectedAssignment.operationType === "SECURITY_GUARDING" ? "bg-[#DAE2FF] text-[#002D72]" : "bg-teal-50 text-teal-700"}`}>
                  {selectedAssignment.operationType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management"}
                </span>
              </div>

              <div>
                <span className="text-[9px] font-bold text-[#747782] uppercase block tracking-wider">Site Wing</span>
                <p className="font-semibold text-[#444651] mt-0.5">{selectedAssignment.site?.name || "—"}</p>
                {selectedAssignment.locationUnit?.name && (
                  <p className="text-[10px] text-[#747782]">{selectedAssignment.locationUnit.name}</p>
                )}
              </div>

              {selectedAssignment.checkpoint && (
                <div>
                  <span className="text-[9px] font-bold text-[#747782] uppercase block tracking-wider">Checkpoint / NFC Tag</span>
                  <p className="font-semibold text-orange-700 mt-0.5">{selectedAssignment.checkpoint.checkpointName}</p>
                </div>
              )}

              <div>
                <span className="text-[9px] font-bold text-[#747782] uppercase block tracking-wider">Checklist Template</span>
                <p className="font-semibold text-[#002D72] mt-0.5">{selectedAssignment.template?.templateName || "—"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-bold text-[#747782] uppercase block tracking-wider">Assigned Agent</span>
                  <p className="font-semibold text-[#444651] mt-0.5">{selectedAssignment.employee?.name || "—"}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-[#747782] uppercase block tracking-wider">Supervisor</span>
                  <p className="font-semibold text-[#444651] mt-0.5">{selectedAssignment.supervisor?.name || "—"}</p>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-bold text-[#747782] uppercase block tracking-wider">Schedule Time Window</span>
                <p className="text-[#444651] font-semibold mt-0.5">Start: {formatDate(selectedAssignment.scheduledStart)}</p>
                <p className="text-[#747782] mt-0.5">End: {formatDate(selectedAssignment.scheduledEnd)}</p>
              </div>

              <div className="border-t border-[#E7EEFF] pt-4 space-y-3">
                <span className="text-[10px] font-bold text-[#002D72] uppercase block tracking-wider">Checklist Execution Status</span>

                {loadingExecution ? (
                  <div className="text-[10px] font-mono text-[#002D72] animate-pulse">Loading execution details...</div>
                ) : selectedExecution ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-[#F0F3FF] p-2.5 rounded-lg border border-[#B1C5FF]">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#002D72] text-sm">assignment_turned_in</span>
                        <span className="font-bold text-[#001A48]">Status:</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        selectedExecution.status === "SUBMITTED" ? "bg-green-100 text-green-700" :
                        selectedExecution.status === "DRAFT" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {selectedExecution.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-[#747782] space-y-1">
                      <p>Started: {formatDate(selectedExecution.startedAt)}</p>
                      {selectedExecution.submittedAt && (
                        <p>Submitted: {formatDate(selectedExecution.submittedAt)}</p>
                      )}
                      {selectedExecution.deviceInfo && (
                        <p>Device: {selectedExecution.deviceInfo}</p>
                      )}
                      {selectedExecution.latitude && (
                        <p>GPS: {selectedExecution.latitude.toFixed(6)}, {selectedExecution.longitude.toFixed(6)} (Acc: {selectedExecution.gpsAccuracyMeters}m)</p>
                      )}
                    </div>

                    {selectedExecution.remarks && (
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[9px] font-bold text-[#747782] uppercase block mb-1">Remarks</span>
                        <p className="text-[11px] text-[#444651] whitespace-pre-line">{selectedExecution.remarks}</p>
                      </div>
                    )}

                    {/* Responses List */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-[#747782] uppercase block tracking-wider border-b border-[#E7EEFF] pb-1">Checklist Responses Snapshot</span>
                      {selectedExecution.responses && selectedExecution.responses.length > 0 ? (
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                          {selectedExecution.responses.map((resp: any) => (
                            <div key={resp.id} className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-semibold text-[#444651] text-[10px]">{resp.itemTextSnapshot}</span>
                                <span className="text-[8px] font-mono font-bold text-[#747782] uppercase">{resp.itemTypeSnapshot}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] font-bold text-[#002D72]">
                                  Answer: <span className="underline">{resp.answerValue || "—"}</span>
                                </div>
                                {resp.isFlagged && (
                                  <span className="bg-red-100 text-red-700 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[10px]">warning</span> FLAGGED
                                  </span>
                                )}
                              </div>
                              {resp.comment && (
                                <p className="text-[9px] text-slate-500 italic mt-1 font-medium bg-white p-1 rounded border border-slate-100">Comment: {resp.comment}</p>
                              )}
                              {resp.flagReason && (
                                <p className="text-[9px] text-red-600 font-bold bg-red-50 p-1 rounded border border-red-100 mt-1">Reason: {resp.flagReason}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic">No responses recorded in execution.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg text-[#747782] italic text-[11px] text-center border border-slate-200">
                    Checklist execution has not started yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Overlay (Add/Edit Form Sliding Panel) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-[500px] bg-white h-full shadow-2xl flex flex-col animate-slide-in relative border-l border-[#C4C6D2]">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#C4C6D2] flex justify-between items-center bg-[#E7EEFF]">
              <div>
                <h3 className="text-base font-bold text-[#001A48]">
                  {isEditMode ? "Modify Task Assignment" : "Schedule Task Assignment"}
                </h3>
                <span className="text-[10px] font-mono text-[#002D72] uppercase tracking-wider font-bold">
                  {isEditMode ? "Edit Assignment Fields" : "New Duty Specification"}
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

              {/* Specifications Block */}
              <div className="space-y-3.5">
                <span className="text-[10px] font-bold text-[#002D72] uppercase block tracking-wider border-b border-[#E7EEFF] pb-1.5">1. Duty Specifications</span>

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
                        setFormTemplateId("");
                        setFormEmployeeId("");
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
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Assignment Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. West Gate Guard Patrol"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#002D72]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Code / Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. TASK-WG-01"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#002D72] font-mono"
                    />
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
                        setFormTemplateId("");
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
                        setFormTemplateId("");
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
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Site Location *</label>
                    <select
                      required
                      value={formSiteId}
                      onChange={(e) => {
                        setFormSiteId(e.target.value);
                        setFormLocationUnitId("");
                        setFormCheckpointId("");
                        setFormTemplateId("");
                      }}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="">Select Site Location</option>
                      {formFilteredSites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Location Post / Area</label>
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Checkpoint Link</label>
                    <select
                      value={formCheckpointId}
                      onChange={(e) => setFormCheckpointId(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="">Select Checkpoint (Optional)</option>
                      {formFilteredCheckpoints.map((c) => (
                        <option key={c.id} value={c.id}>{c.checkpointName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Checklist Template</label>
                    <select
                      value={formTemplateId}
                      onChange={(e) => setFormTemplateId(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="">Select Checklist (Optional)</option>
                      {formFilteredTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.templateName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Description / Task guidelines</label>
                  <textarea
                    placeholder="Provide overview of duty tasks..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#002D72] min-h-[60px]"
                  />
                </div>
              </div>

              {/* Roster Block */}
              <div className="space-y-3.5">
                <span className="text-[10px] font-bold text-[#002D72] uppercase block tracking-wider border-b border-[#E7EEFF] pb-1.5">2. Staff Allocation & Schedule</span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Assigned Employee *</label>
                    <select
                      required
                      value={formEmployeeId}
                      onChange={(e) => setFormEmployeeId(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="">Select Employee</option>
                      {formFilteredEmployees.map((e) => (
                        <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Supervisor / Manager</label>
                    <select
                      value={formSupervisorId}
                      onChange={(e) => setFormSupervisorId(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72]"
                    >
                      <option value="">Select Supervisor (Optional)</option>
                      {formFilteredSupervisors.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Scheduled Start *</label>
                    <input
                      type="datetime-local"
                      required
                      value={formStart}
                      onChange={(e) => setFormStart(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#002D72] font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Scheduled End *</label>
                    <input
                      type="datetime-local"
                      required
                      value={formEnd}
                      onChange={(e) => setFormEnd(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#002D72] font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Execution Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="bg-[#F0F3FF] border border-[#C4C6D2] rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-[#002D72] font-bold"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="SKIPPED">SKIPPED</option>
                      <option value="OVERDUE">OVERDUE</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#444651] uppercase tracking-wide">Activation</label>
                    <label className="flex items-center gap-2 mt-2 font-semibold text-[#001A48] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="rounded text-[#002D72] focus:ring-[#002D72] w-4 h-4 border-[#C4C6D2]"
                      />
                      Active (Display on Mobile)
                    </label>
                  </div>
                </div>
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
                  {isEditMode ? "Update Duty" : "Publish Duty"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Fallback lists if data not ready
  function reportingManagers() {
    return employees.filter(e => e.role === "SUPERVISOR" || e.role === "ADMIN" || e.role === "SUPER_ADMIN");
  }
}
