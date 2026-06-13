"use client";

import React, { useState, useEffect } from "react";
import { Card, Button, Input, Modal, Badge } from "@ahh-wfm/ui/src";

type MasterType = "designations" | "trades" | "locations" | "cost-centers" | "projects" | "sites" | "rules" | "standby";

export default function MastersHubPage() {
  const [activeSubMaster, setActiveSubMaster] = useState<MasterType | null>(null);
  const [designations, setDesignations] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [standby, setStandby] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Loading and search states
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal forms states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Unified Form States
  const [formDesignation, setFormDesignation] = useState({ code: "", name: "", description: "", workerCategory: "BLUE_COLLAR", isSupervisorPosition: false, isRelieverEligible: true, isActive: true });
  const [formTrade, setFormTrade] = useState({ code: "", name: "", description: "", linkedDesignationId: "", isActive: true });
  const [formLocation, setFormLocation] = useState({ locationCode: "", locationName: "", address: "", latitude: "", longitude: "", defaultGeofenceRadiusMeters: "150", isActive: true });
  const [formCostCenter, setFormCostCenter] = useState({ costCenterCode: "", costCenterName: "", description: "", sapCostCenterCode: "", isActive: true });
  const [formProject, setFormProject] = useState({ projectCode: "", projectName: "", clientName: "", clientCode: "", contractNumber: "", costCenter: "", locationId: "", status: "ACTIVE" });
  const [formSite, setFormSite] = useState({ projectId: "", siteCode: "", siteName: "", address: "", latitude: "", longitude: "", geofenceRadiusMeters: "150", status: "ACTIVE", locationId: "" });
  const [formRule, setFormRule] = useState({ ruleName: "", designationId: "", tradeClassificationId: "", projectId: "", siteId: "", standbyRequired: false, relieverRequiredForLeave: false, relieverRequiredForOff: false, relieverRequiredForVacation: false, isActive: true });
  const [formStandby, setFormStandby] = useState({ employeeId: "", date: "", startTime: "08:00", endTime: "17:00", reason: "", status: "AVAILABLE" });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [desRes, trdRes, locRes, ccRes, projRes, siteRes, ruleRes, stbyRes, empRes] = await Promise.all([
        fetch("/api/v1/masters/designations"),
        fetch("/api/v1/masters/trade-classifications"),
        fetch("/api/v1/masters/locations"),
        fetch("/api/v1/masters/cost-centers"),
        fetch("/api/v1/projects"),
        fetch("/api/v1/projects/all/sites").then(r => r.ok ? r.json() : fetch("/api/v1/deployments").then(() => [])), // fallback
        fetch("/api/v1/scheduler/relievers"), // rules fallback route or similar
        fetch("/api/v1/standby-pool"),
        fetch("/api/v1/employees")
      ]);

      if (desRes.ok) setDesignations(await desRes.json());
      if (trdRes.ok) setTrades(await trdRes.json());
      if (locRes.ok) setLocations(await locRes.json());
      if (ccRes.ok) setCostCenters(await ccRes.json());
      if (projRes.ok) setProjects(await projRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
      
      // Fallback handlers
      try {
        if (siteRes && Array.isArray(siteRes)) setSites(siteRes);
        else {
          const allS: any[] = [];
          const pr = await projRes.clone().json();
          for (const p of pr) {
            const r = await fetch(`/api/v1/projects/${p.id}/sites`);
            if (r.ok) allS.push(...(await r.json()));
          }
          setSites(allS);
        }
      } catch(e){}

      try {
        if (ruleRes.ok) setRules(await ruleRes.json());
      } catch(e){}

      try {
        if (stbyRes.ok) setStandby(await stbyRes.json());
      } catch(e){}
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubMaster) return;

    let url = "";
    let method = editId ? "PATCH" : "POST";
    let body: any = {};

    if (activeSubMaster === "designations") {
      url = editId ? `/api/v1/masters/designations/${editId}` : "/api/v1/masters/designations";
      body = formDesignation;
    } else if (activeSubMaster === "trades") {
      url = editId ? `/api/v1/masters/trade-classifications/${editId}` : "/api/v1/masters/trade-classifications";
      body = formTrade;
    } else if (activeSubMaster === "locations") {
      url = editId ? `/api/v1/masters/locations/${editId}` : "/api/v1/masters/locations";
      body = {
        ...formLocation,
        latitude: formLocation.latitude ? parseFloat(formLocation.latitude) : null,
        longitude: formLocation.longitude ? parseFloat(formLocation.longitude) : null,
        defaultGeofenceRadiusMeters: parseFloat(formLocation.defaultGeofenceRadiusMeters)
      };
    } else if (activeSubMaster === "cost-centers") {
      url = editId ? `/api/v1/masters/cost-centers/${editId}` : "/api/v1/masters/cost-centers";
      body = formCostCenter;
    } else if (activeSubMaster === "projects") {
      url = editId ? `/api/v1/projects/${editId}` : "/api/v1/projects";
      body = formProject;
    } else if (activeSubMaster === "sites") {
      url = editId ? `/api/v1/project-sites/${editId}` : `/api/v1/projects/${formSite.projectId}/sites`;
      body = {
        ...formSite,
        latitude: formSite.latitude ? parseFloat(formSite.latitude) : null,
        longitude: formSite.longitude ? parseFloat(formSite.longitude) : null,
        geofenceRadiusMeters: parseFloat(formSite.geofenceRadiusMeters)
      };
    } else if (activeSubMaster === "rules") {
      url = editId ? `/api/v1/scheduler/relievers/${editId}` : "/api/v1/scheduler/relievers";
      body = formRule;
    } else if (activeSubMaster === "standby") {
      url = editId ? `/api/v1/standby-pool/${editId}` : "/api/v1/standby-pool";
      body = formStandby;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditId(null);
        fetchAll();
      } else {
        const err = await res.json();
        alert(err.error || "Operation failed");
      }
    } catch (err) {
      alert("Network error occurred.");
    }
  };

  const handleEditClick = (item: any) => {
    setEditId(item.id);
    if (activeSubMaster === "designations") {
      setFormDesignation({
        code: item.code,
        name: item.name,
        description: item.description || "",
        workerCategory: item.workerCategory,
        isSupervisorPosition: item.isSupervisorPosition,
        isRelieverEligible: item.isRelieverEligible,
        isActive: item.isActive
      });
    } else if (activeSubMaster === "trades") {
      setFormTrade({
        code: item.code,
        name: item.name,
        description: item.description || "",
        linkedDesignationId: item.linkedDesignationId || "",
        isActive: item.isActive
      });
    } else if (activeSubMaster === "locations") {
      setFormLocation({
        locationCode: item.locationCode,
        locationName: item.locationName,
        address: item.address || "",
        latitude: item.latitude?.toString() || "",
        longitude: item.longitude?.toString() || "",
        defaultGeofenceRadiusMeters: item.defaultGeofenceRadiusMeters?.toString() || "150",
        isActive: item.isActive
      });
    } else if (activeSubMaster === "cost-centers") {
      setFormCostCenter({
        costCenterCode: item.costCenterCode,
        costCenterName: item.costCenterName,
        description: item.description || "",
        sapCostCenterCode: item.sapCostCenterCode || "",
        isActive: item.isActive
      });
    } else if (activeSubMaster === "projects") {
      setFormProject({
        projectCode: item.projectCode,
        projectName: item.projectName,
        clientName: item.clientName || "",
        clientCode: item.clientCode || "",
        contractNumber: item.contractNumber || "",
        costCenter: item.costCenter,
        locationId: item.locationId || "",
        status: item.status
      });
    } else if (activeSubMaster === "sites") {
      setFormSite({
        projectId: item.projectId,
        siteCode: item.siteCode,
        siteName: item.siteName,
        address: item.address || "",
        latitude: item.latitude?.toString() || "",
        longitude: item.longitude?.toString() || "",
        geofenceRadiusMeters: item.geofenceRadiusMeters?.toString() || "150",
        status: item.status,
        locationId: item.locationId || ""
      });
    } else if (activeSubMaster === "rules") {
      setFormRule({
        ruleName: item.ruleName,
        designationId: item.designationId || "",
        tradeClassificationId: item.tradeClassificationId || "",
        projectId: item.projectId || "",
        siteId: item.siteId || "",
        standbyRequired: item.standbyRequired,
        relieverRequiredForLeave: item.relieverRequiredForLeave,
        relieverRequiredForOff: item.relieverRequiredForOff,
        relieverRequiredForVacation: item.relieverRequiredForVacation,
        isActive: item.isActive
      });
    } else if (activeSubMaster === "standby") {
      setFormStandby({
        employeeId: item.employeeId,
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime,
        reason: item.reason || "",
        status: item.status
      });
    }
    setIsModalOpen(true);
  };

  const handleDeactivateToggle = async (item: any) => {
    if (!activeSubMaster) return;
    const toggledActive = !item.isActive;
    const confirmMsg = `Are you sure you want to ${toggledActive ? "activate" : "deactivate"} this item?`;
    if (!confirm(confirmMsg)) return;

    let url = "";
    if (activeSubMaster === "designations") url = `/api/v1/masters/designations/${item.id}`;
    else if (activeSubMaster === "trades") url = `/api/v1/masters/trade-classifications/${item.id}`;
    else if (activeSubMaster === "locations") url = `/api/v1/masters/locations/${item.id}`;
    else if (activeSubMaster === "cost-centers") url = `/api/v1/masters/cost-centers/${item.id}`;
    else if (activeSubMaster === "projects") url = `/api/v1/projects/${item.id}`;
    else if (activeSubMaster === "sites") url = `/api/v1/project-sites/${item.id}`;
    else if (activeSubMaster === "rules") url = `/api/v1/scheduler/relievers/${item.id}`;
    else if (activeSubMaster === "standby") url = `/api/v1/standby-pool/${item.id}`;

    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: toggledActive, status: toggledActive ? "ACTIVE" : "INACTIVE" })
      });
      if (res.ok) {
        fetchAll();
      } else {
        alert("Action failed.");
      }
    } catch (e) {
      alert("Network error.");
    }
  };

  const getFilteredItems = () => {
    const query = searchQuery.toLowerCase().trim();
    if (activeSubMaster === "designations") {
      return designations.filter(d => d.name.toLowerCase().includes(query) || d.code.toLowerCase().includes(query));
    } else if (activeSubMaster === "trades") {
      return trades.filter(t => t.name.toLowerCase().includes(query) || t.code.toLowerCase().includes(query));
    } else if (activeSubMaster === "locations") {
      return locations.filter(l => l.locationName.toLowerCase().includes(query) || l.locationCode.toLowerCase().includes(query));
    } else if (activeSubMaster === "cost-centers") {
      return costCenters.filter(c => c.costCenterName.toLowerCase().includes(query) || c.costCenterCode.toLowerCase().includes(query));
    } else if (activeSubMaster === "projects") {
      return projects.filter(p => p.projectName.toLowerCase().includes(query) || p.projectCode.toLowerCase().includes(query));
    } else if (activeSubMaster === "sites") {
      return sites.filter(s => s.siteName.toLowerCase().includes(query) || s.siteCode.toLowerCase().includes(query));
    } else if (activeSubMaster === "rules") {
      return rules.filter(r => r.ruleName.toLowerCase().includes(query));
    } else if (activeSubMaster === "standby") {
      return standby.filter(s => s.employeeId.toLowerCase().includes(query) || s.status.toLowerCase().includes(query));
    }
    return [];
  };

  const openNewModal = () => {
    setEditId(null);
    setFormDesignation({ code: "", name: "", description: "", workerCategory: "BLUE_COLLAR", isSupervisorPosition: false, isRelieverEligible: true, isActive: true });
    setFormTrade({ code: "", name: "", description: "", linkedDesignationId: "", isActive: true });
    setFormLocation({ locationCode: "", locationName: "", address: "", latitude: "", longitude: "", defaultGeofenceRadiusMeters: "150", isActive: true });
    setFormCostCenter({ costCenterCode: "", costCenterName: "", description: "", sapCostCenterCode: "", isActive: true });
    setFormProject({ projectCode: "", projectName: "", clientName: "", clientCode: "", contractNumber: "", costCenter: "", locationId: "", status: "ACTIVE" });
    setFormSite({ projectId: projects[0]?.id || "", siteCode: "", siteName: "", address: "", latitude: "", longitude: "", geofenceRadiusMeters: "150", status: "ACTIVE", locationId: "" });
    setFormRule({ ruleName: "", designationId: "", tradeClassificationId: "", projectId: "", siteId: "", standbyRequired: false, relieverRequiredForLeave: false, relieverRequiredForOff: false, relieverRequiredForVacation: false, isActive: true });
    setFormStandby({ employeeId: employees[0]?.id || "", date: new Date().toISOString().split("T")[0], startTime: "08:00", endTime: "17:00", reason: "", status: "AVAILABLE" });
    setIsModalOpen(true);
  };

  const getSubMasterTitle = () => {
    if (activeSubMaster === "designations") return "Designations / Positions";
    if (activeSubMaster === "trades") return "Blue Collar Trades";
    if (activeSubMaster === "locations") return "Locations Master";
    if (activeSubMaster === "cost-centers") return "Cost Centers";
    if (activeSubMaster === "projects") return "Projects Master";
    if (activeSubMaster === "sites") return "Project Sites";
    if (activeSubMaster === "rules") return "Reliever & Standby Rules";
    if (activeSubMaster === "standby") return "Standby Pool Management";
    return "";
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-on-surface-variant mb-2 text-[10px] font-bold">
            <span>SYSTEM ADMIN</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-secondary">MASTER DATA HUB</span>
          </nav>
          <h1 className="text-2xl font-bold text-primary">Master Data Hub</h1>
          <p className="text-sm text-on-surface-variant">Configure foundational operational matrices and global workforce rules</p>
        </div>
        {activeSubMaster && (
          <Button onClick={openNewModal} className="font-bold flex items-center gap-1.5 text-xs">
            <span className="material-symbols-outlined text-[18px]">add</span> Add New Record
          </Button>
        )}
      </div>

      {/* Main Categories Dashboard Grid */}
      {!activeSubMaster ? (
        <>
          {/* Header Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-surface-container-low border border-outline-variant/35 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">analytics</span>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant font-black">TOTAL MASTERS</p>
                <p className="text-lg font-black text-primary">8 Types</p>
              </div>
            </Card>
            <Card className="p-4 bg-surface-container-low border border-outline-variant/35 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center">
                <span className="material-symbols-outlined">done_all</span>
              </div>
              <div>
                <p className="text-lg font-black text-primary">
                  {designations.length + trades.length + locations.length + costCenters.length + projects.length + sites.length + rules.length + standby.length}
                </p>
              </div>
            </Card>
            <Card className="p-4 bg-surface-container-low border border-outline-variant/35 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined">sync</span>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant font-black">PENDING SYNC</p>
                <p className="text-lg font-black text-primary">0 Records</p>
              </div>
            </Card>
            <Card className="p-4 bg-surface-container-low border border-outline-variant/35 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-status-warning/10 text-status-warning flex items-center justify-center">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant font-black">ORPHANED ITEMS</p>
                <p className="text-lg font-black text-primary">0 Issues</p>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Category: Organizational Structure */}
            <div>
              <p className="text-xs font-black text-primary uppercase tracking-wider mb-3">● Organizational Structure</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="material-symbols-outlined text-4xl text-primary bg-primary/5 p-2 rounded-lg">badge</span>
                      <Badge variant="neutral">{designations.length} Records</Badge>
                    </div>
                    <h3 className="font-bold text-primary text-base">Designations / Positions</h3>
                    <p className="text-xs text-on-surface-variant mt-1">Configure white/blue collar job titles, supervisor indicators, and reliever eligibility policies.</p>
                  </div>
                  <Button variant="secondary" onClick={() => setActiveSubMaster("designations")} className="mt-6 font-bold text-xs flex items-center gap-1 w-fit">
                    Manage Master <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Button>
                </Card>
                <Card className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="material-symbols-outlined text-4xl text-primary bg-primary/5 p-2 rounded-lg">construction</span>
                      <Badge variant="neutral">{trades.length} Records</Badge>
                    </div>
                    <h3 className="font-bold text-primary text-base">Blue Collar Trades</h3>
                    <p className="text-xs text-on-surface-variant mt-1">Classify field worker categories (Mason, Electrician, Carpenter) linked directly to position mappings.</p>
                  </div>
                  <Button variant="secondary" onClick={() => setActiveSubMaster("trades")} className="mt-6 font-bold text-xs flex items-center gap-1 w-fit">
                    Manage Master <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Button>
                </Card>
              </div>
            </div>

            {/* Category: Operations & Logistics */}
            <div>
              <p className="text-xs font-black text-primary uppercase tracking-wider mb-3">● Operations &amp; Logistics</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="material-symbols-outlined text-4xl text-primary bg-primary/5 p-2 rounded-lg">location_city</span>
                      <Badge variant="neutral">{projects.length} Records</Badge>
                    </div>
                    <h3 className="font-bold text-primary text-base">Projects Master</h3>
                    <p className="text-xs text-on-surface-variant mt-1">Manage core projects, client data, contracts, timeline boundaries, and default mappings.</p>
                  </div>
                  <Button variant="secondary" onClick={() => setActiveSubMaster("projects")} className="mt-6 font-bold text-xs flex items-center gap-1 w-fit">
                    Manage Master <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Button>
                </Card>
                <Card className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="material-symbols-outlined text-4xl text-primary bg-primary/5 p-2 rounded-lg">map</span>
                      <Badge variant="neutral">{sites.length} Records</Badge>
                    </div>
                    <h3 className="font-bold text-primary text-base">Project Sites</h3>
                    <p className="text-xs text-on-surface-variant mt-1">Register specific sites under a project, configure coordinates geofences, and override rads.</p>
                  </div>
                  <Button variant="secondary" onClick={() => setActiveSubMaster("sites")} className="mt-6 font-bold text-xs flex items-center gap-1 w-fit">
                    Manage Master <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Button>
                </Card>
                <Card className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="material-symbols-outlined text-4xl text-primary bg-primary/5 p-2 rounded-lg">pin_drop</span>
                      <Badge variant="neutral">{locations.length} Records</Badge>
                    </div>
                    <h3 className="font-bold text-primary text-base">Locations Master</h3>
                    <p className="text-xs text-on-surface-variant mt-1">Define geographical coordinates database tables with default fallback geofence radius settings.</p>
                  </div>
                  <Button variant="secondary" onClick={() => setActiveSubMaster("locations")} className="mt-6 font-bold text-xs flex items-center gap-1 w-fit">
                    Manage Master <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Button>
                </Card>
              </div>
            </div>

            {/* Category: Workforce Rules */}
            <div>
              <p className="text-xs font-black text-primary uppercase tracking-wider mb-3">● Workforce Rules</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="material-symbols-outlined text-4xl text-primary bg-primary/5 p-2 rounded-lg">policy</span>
                      <Badge variant="neutral">{rules.length} Rules</Badge>
                    </div>
                    <h3 className="font-bold text-primary text-base">Reliever &amp; Standby Rules</h3>
                    <p className="text-xs text-on-surface-variant mt-1">Configure reliever matching scopes, standby rule definitions, and exceptions covering schedules.</p>
                  </div>
                  <Button variant="secondary" onClick={() => setActiveSubMaster("rules")} className="mt-6 font-bold text-xs flex items-center gap-1 w-fit">
                    Manage Master <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Button>
                </Card>
                <Card className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="material-symbols-outlined text-4xl text-primary bg-primary/5 p-2 rounded-lg">group_work</span>
                      <Badge variant="neutral">{standby.length} Active</Badge>
                    </div>
                    <h3 className="font-bold text-primary text-base">Standby Pool</h3>
                    <p className="text-xs text-on-surface-variant mt-1">Manage pool candidates list, review cover availability slots, and track reliever status logs.</p>
                  </div>
                  <Button variant="secondary" onClick={() => setActiveSubMaster("standby")} className="mt-6 font-bold text-xs flex items-center gap-1 w-fit">
                    Manage Master <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Button>
                </Card>
              </div>
            </div>

            {/* Category: Finance & Compliance */}
            <div>
              <p className="text-xs font-black text-primary uppercase tracking-wider mb-3">● Finance &amp; Compliance</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="material-symbols-outlined text-4xl text-primary bg-primary/5 p-2 rounded-lg">account_balance_wallet</span>
                      <Badge variant="neutral">{costCenters.length} CC</Badge>
                    </div>
                    <h3 className="font-bold text-primary text-base">Cost Centers</h3>
                    <p className="text-xs text-on-surface-variant mt-1">Manage corporate cost codes mapping, export mappings, and sync properties linked to SuccessFactors.</p>
                  </div>
                  <Button variant="secondary" onClick={() => setActiveSubMaster("cost-centers")} className="mt-6 font-bold text-xs flex items-center gap-1 w-fit">
                    Manage Master <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Button>
                </Card>
              </div>
            </div>
          </div>
        </>
      ) : (
        // Sub-Master Table Interface View
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => { setActiveSubMaster(null); setSearchQuery(""); }} className="font-bold text-xs flex items-center gap-1 py-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Hub
            </Button>
            <h2 className="text-lg font-bold text-primary">{getSubMasterTitle()}</h2>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative max-w-sm w-full">
                <span className="material-symbols-outlined absolute left-3 top-2 text-lg text-on-surface-variant">search</span>
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-full bg-surface border border-outline-variant rounded-lg text-xs outline-none font-medium focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-semibold">
                <thead className="bg-surface-container-low text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                  <tr>
                    <th className="p-3">ID / Code</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Description / Metadata</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-primary font-medium">
                  {getFilteredItems().length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center italic text-on-surface-variant">No items found matching the search criteria.</td>
                    </tr>
                  ) : (
                    getFilteredItems().map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low/30 transition-colors">
                        <td className="p-3">
                          <span className="font-mono text-[11px] bg-surface border border-outline-variant/30 px-1.5 py-0.5 rounded">
                            {item.code || item.locationCode || item.costCenterCode || item.projectCode || item.siteCode || item.id.substring(0,8)}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-primary">{item.name || item.locationName || item.costCenterName || item.projectName || item.siteName || item.ruleName || "N/A"}</td>
                        <td className="p-3 text-on-surface-variant font-normal">
                          {item.description || item.address || item.reason || (item.clientName && `Client: ${item.clientName}`) || "No details provided"}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={item.isActive || item.status === "ACTIVE" ? "success" : "neutral"} className="font-bold text-[10px]">
                            {item.isActive || item.status === "ACTIVE" ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="secondary" onClick={() => handleEditClick(item)} className="py-1 px-2.5 text-[10px]">Edit</Button>
                            <Button
                              variant="secondary"
                              onClick={() => handleDeactivateToggle(item)}
                              className={`py-1 px-2.5 text-[10px] ${item.isActive || item.status === "ACTIVE" ? "border-status-error text-status-error hover:bg-status-error/10" : ""}`}
                            >
                              {item.isActive || item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Editor Modal Drawer */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editId ? "Edit Matrix Record" : "Add New Matrix Record"}>
        <form onSubmit={handleCreateOrUpdate} className="space-y-4 text-xs font-semibold">
          {activeSubMaster === "designations" && (
            <>
              <Input label="Code" value={formDesignation.code} onChange={(e) => setFormDesignation({ ...formDesignation, code: e.target.value })} required disabled={!!editId} />
              <Input label="Name" value={formDesignation.name} onChange={(e) => setFormDesignation({ ...formDesignation, name: e.target.value })} required />
              <Input label="Description" value={formDesignation.description} onChange={(e) => setFormDesignation({ ...formDesignation, description: e.target.value })} />
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Worker Category</label>
                <select
                  value={formDesignation.workerCategory}
                  onChange={(e) => setFormDesignation({ ...formDesignation, workerCategory: e.target.value })}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 font-bold outline-none"
                >
                  <option value="WHITE_COLLAR">White Collar</option>
                  <option value="BLUE_COLLAR">Blue Collar</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input type="checkbox" checked={formDesignation.isSupervisorPosition} onChange={(e) => setFormDesignation({ ...formDesignation, isSupervisorPosition: e.target.checked })} />
                  Is Supervisor Position
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input type="checkbox" checked={formDesignation.isRelieverEligible} onChange={(e) => setFormDesignation({ ...formDesignation, isRelieverEligible: e.target.checked })} />
                  Eligible to Act as Reliever
                </label>
              </div>
            </>
          )}

          {activeSubMaster === "trades" && (
            <>
              <Input label="Code" value={formTrade.code} onChange={(e) => setFormTrade({ ...formTrade, code: e.target.value })} required disabled={!!editId} />
              <Input label="Name" value={formTrade.name} onChange={(e) => setFormTrade({ ...formTrade, name: e.target.value })} required />
              <Input label="Description" value={formTrade.description} onChange={(e) => setFormTrade({ ...formTrade, description: e.target.value })} />
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Linked Designation (Optional)</label>
                <select
                  value={formTrade.linkedDesignationId}
                  onChange={(e) => setFormTrade({ ...formTrade, linkedDesignationId: e.target.value })}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 font-bold outline-none"
                >
                  <option value="">None</option>
                  {designations.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeSubMaster === "locations" && (
            <>
              <Input label="Location Code" value={formLocation.locationCode} onChange={(e) => setFormLocation({ ...formLocation, locationCode: e.target.value })} required disabled={!!editId} />
              <Input label="Location Name" value={formLocation.locationName} onChange={(e) => setFormLocation({ ...formLocation, locationName: e.target.value })} required />
              <Input label="Address" value={formLocation.address} onChange={(e) => setFormLocation({ ...formLocation, address: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Latitude" value={formLocation.latitude} onChange={(e) => setFormLocation({ ...formLocation, latitude: e.target.value })} />
                <Input label="Longitude" value={formLocation.longitude} onChange={(e) => setFormLocation({ ...formLocation, longitude: e.target.value })} />
              </div>
              <Input label="Default Geofence Radius (Meters)" type="number" value={formLocation.defaultGeofenceRadiusMeters} onChange={(e) => setFormLocation({ ...formLocation, defaultGeofenceRadiusMeters: e.target.value })} />
            </>
          )}

          {activeSubMaster === "cost-centers" && (
            <>
              <Input label="Cost Center Code" value={formCostCenter.costCenterCode} onChange={(e) => setFormCostCenter({ ...formCostCenter, costCenterCode: e.target.value })} required disabled={!!editId} />
              <Input label="Cost Center Name" value={formCostCenter.costCenterName} onChange={(e) => setFormCostCenter({ ...formCostCenter, costCenterName: e.target.value })} required />
              <Input label="Description" value={formCostCenter.description} onChange={(e) => setFormCostCenter({ ...formCostCenter, description: e.target.value })} />
              <Input label="SAP Cost Center Code Mapping" value={formCostCenter.sapCostCenterCode} onChange={(e) => setFormCostCenter({ ...formCostCenter, sapCostCenterCode: e.target.value })} />
            </>
          )}

          {activeSubMaster === "projects" && (
            <>
              <Input label="Project Code" value={formProject.projectCode} onChange={(e) => setFormProject({ ...formProject, projectCode: e.target.value })} required disabled={!!editId} />
              <Input label="Project Name" value={formProject.projectName} onChange={(e) => setFormProject({ ...formProject, projectName: e.target.value })} required />
              <Input label="Client Name" value={formProject.clientName} onChange={(e) => setFormProject({ ...formProject, clientName: e.target.value })} required />
              <Input label="Cost Center Mapped" value={formProject.costCenter} onChange={(e) => setFormProject({ ...formProject, costCenter: e.target.value })} required />
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Geographic Location</label>
                <select
                  value={formProject.locationId}
                  onChange={(e) => setFormProject({ ...formProject, locationId: e.target.value })}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 font-bold outline-none"
                >
                  <option value="">None</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.locationName}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeSubMaster === "sites" && (
            <>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Select Project Node</label>
                <select
                  value={formSite.projectId}
                  onChange={(e) => setFormSite({ ...formSite, projectId: e.target.value })}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 font-bold outline-none"
                  required
                  disabled={!!editId}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.projectName}</option>
                  ))}
                </select>
              </div>
              <Input label="Site Code" value={formSite.siteCode} onChange={(e) => setFormSite({ ...formSite, siteCode: e.target.value })} required disabled={!!editId} />
              <Input label="Site Name" value={formSite.siteName} onChange={(e) => setFormSite({ ...formSite, siteName: e.target.value })} required />
              <Input label="Address" value={formSite.address} onChange={(e) => setFormSite({ ...formSite, address: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Latitude Override" value={formSite.latitude} onChange={(e) => setFormSite({ ...formSite, latitude: e.target.value })} />
                <Input label="Longitude Override" value={formSite.longitude} onChange={(e) => setFormSite({ ...formSite, longitude: e.target.value })} />
              </div>
              <Input label="Geofence Radius Override (Meters)" type="number" value={formSite.geofenceRadiusMeters} onChange={(e) => setFormSite({ ...formSite, geofenceRadiusMeters: e.target.value })} />
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Fallback Location Link</label>
                <select
                  value={formSite.locationId}
                  onChange={(e) => setFormSite({ ...formSite, locationId: e.target.value })}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 font-bold outline-none"
                >
                  <option value="">Inherit from Project</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.locationName}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeSubMaster === "rules" && (
            <>
              <Input label="Rule Name" value={formRule.ruleName} onChange={(e) => setFormRule({ ...formRule, ruleName: e.target.value })} required />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Apply to Designation</label>
                  <select
                    value={formRule.designationId}
                    onChange={(e) => setFormRule({ ...formRule, designationId: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-2 font-bold outline-none"
                  >
                    <option value="">All Designations</option>
                    {designations.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Apply to Trade</label>
                  <select
                    value={formRule.tradeClassificationId}
                    onChange={(e) => setFormRule({ ...formRule, tradeClassificationId: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-2 font-bold outline-none"
                  >
                    <option value="">All Trades</option>
                    {trades.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input type="checkbox" checked={formRule.standbyRequired} onChange={(e) => setFormRule({ ...formRule, standbyRequired: e.target.checked })} />
                  Standby Coverage Required
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input type="checkbox" checked={formRule.relieverRequiredForLeave} onChange={(e) => setFormRule({ ...formRule, relieverRequiredForLeave: e.target.checked })} />
                  Reliever Cover Needed for Approved Leaves
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input type="checkbox" checked={formRule.relieverRequiredForOff} onChange={(e) => setFormRule({ ...formRule, relieverRequiredForOff: e.target.checked })} />
                  Reliever Cover Needed for Scheduled Off-Days
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input type="checkbox" checked={formRule.relieverRequiredForVacation} onChange={(e) => setFormRule({ ...formRule, relieverRequiredForVacation: e.target.checked })} />
                  Reliever Cover Needed for Annual Vacation
                </label>
              </div>
            </>
          )}

          {activeSubMaster === "standby" && (
            <>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Select Standby Operative</label>
                <select
                  value={formStandby.employeeId}
                  onChange={(e) => setFormStandby({ ...formStandby, employeeId: e.target.value })}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 font-bold outline-none"
                  required
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                  ))}
                </select>
              </div>
              <Input label="Date" type="date" value={formStandby.date} onChange={(e) => setFormStandby({ ...formStandby, date: e.target.value })} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start Time" value={formStandby.startTime} onChange={(e) => setFormStandby({ ...formStandby, startTime: e.target.value })} required />
                <Input label="End Time" value={formStandby.endTime} onChange={(e) => setFormStandby({ ...formStandby, endTime: e.target.value })} required />
              </div>
              <Input label="Standby Duty Notes" value={formStandby.reason} onChange={(e) => setFormStandby({ ...formStandby, reason: e.target.value })} />
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Matrix Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
