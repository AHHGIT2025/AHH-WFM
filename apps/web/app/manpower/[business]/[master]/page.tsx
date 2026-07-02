"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasPermission } from "../../../../lib/permissions";

export default function ManpowerMasterPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const business = params?.business as string; // "security-guarding" | "facility-management"
  const master = params?.master as string; // "clients" | "contracts" | "projects" | "sites" | "zones" | "areas" | "manpower" | "settings"

  const isSecurity = business === "security-guarding";
  const businessLabel = isSecurity ? "Security Guarding" : "Facility Management";
  const masterLabel = master ? master.charAt(0).toUpperCase() + master.slice(1) : "";

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Sub-data for relations
  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [shiftsList, setShiftsList] = useState<any[]>([]);
  const [locationUnits, setLocationUnits] = useState<any[]>([]);
  const [workforceEmployees, setWorkforceEmployees] = useState<any[]>([]);
  const [materialsList, setMaterialsList] = useState<any[]>([]);

  // Security Guarding compliance states
  const [activeSubTab, setActiveSubTab] = useState("directory");
  const [licensesList, setLicensesList] = useState<any[]>([]);
  const [gatePassesList, setGatePassesList] = useState<any[]>([]);
  const [relieverPoolsList, setRelieverPoolsList] = useState<any[]>([]);
  const [relieverAssignmentsList, setRelieverAssignmentsList] = useState<any[]>([]);
  const [deploymentsList, setDeploymentsList] = useState<any[]>([]);
  const [showAddLicenseModal, setShowAddLicenseModal] = useState(false);
  const [showAddGatePassModal, setShowAddGatePassModal] = useState(false);

  // Security Projects states
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectAllocatedMaterials, setProjectAllocatedMaterials] = useState<any[]>([]);
  const [projectShiftRequirements, setProjectShiftRequirements] = useState<any[]>([]);
  const [projectDeployments, setProjectDeployments] = useState<any[]>([]);

  async function loadSecurityComplianceData() {
    try {
      const [licRes, gpRes, poolsRes, poolAsgRes, depRes] = await Promise.all([
        fetch("/api/v1/security/licenses"),
        fetch("/api/v1/security/gate-passes"),
        fetch("/api/v1/security/reliever-pools"),
        fetch("/api/v1/security/reliever-pools/assignments"),
        fetch(`/api/v1/manpower/security-guarding/deployments?date=${new Date().toISOString().split("T")[0]}`)
      ]);
      if (licRes.ok) setLicensesList(await licRes.json());
      if (gpRes.ok) setGatePassesList(await gpRes.json());
      if (poolsRes.ok) setRelieverPoolsList(await poolsRes.json());
      if (poolAsgRes.ok) setRelieverAssignmentsList(await poolAsgRes.json());
      if (depRes.ok) setDeploymentsList(await depRes.json());
    } catch (e) {
      console.error("Failed to load security compliance data", e);
    }
  }

  // Form states
  const [formData, setFormData] = useState<any>({});
  const [formError, setFormError] = useState("");
  const [editItem, setEditItem] = useState<any | null>(null);
  const [filterCustomerType, setFilterCustomerType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selectedClientDetail, setSelectedClientDetail] = useState<any | null>(null);
  const [selectedContractDetail, setSelectedContractDetail] = useState<any | null>(null);
  const [addendumContract, setAddendumContract] = useState<any | null>(null);
  const [addFormLineItems, setAddFormLineItems] = useState<any[]>([]);
  const [addendumForm, setAddendumForm] = useState<any>({
    title: "",
    addendumType: "Manpower Increase",
    addendumDate: new Date().toISOString().substring(0, 10),
    effectiveFrom: new Date().toISOString().substring(0, 10),
    description: "",
    commercialImpact: "",
    status: "DRAFT",
    lineItems: []
  });

  const startEdit = (item: any) => {
    setEditItem(item);
    setFormData({ ...item });
    setFormError("");
  };

  const viewClientDetails = async (clientId: string) => {
    try {
      const res = await fetch(`/api/v1/manpower/${business}/clients/${clientId}`);
      if (res.ok) {
        setSelectedClientDetail(await res.json());
      } else {
        alert("Failed to load customer details");
      }
    } catch (e) {
      alert("Failed to connect to server");
    }
  };

  const viewContractDetails = async (contractId: string) => {
    try {
      const res = await fetch(`/api/v1/manpower/${business}/contracts/${contractId}`);
      if (res.ok) {
        setSelectedContractDetail(await res.json());
      } else {
        alert("Failed to load contract details");
      }
    } catch (e) {
      alert("Failed to connect to server");
    }
  };

  // Permission Checks
  const canView = hasPermission(session?.user as any, "manpower.admin.full_access") ||
                  hasPermission(session?.user as any, isSecurity ? "manpower.security.view" : "manpower.fm.view");
  const canManage = hasPermission(session?.user as any, "manpower.admin.full_access") ||
                    hasPermission(session?.user as any, isSecurity ? "manpower.security.manage" : "manpower.fm.manage");

  const apiBase = master === "coordinators"
    ? `/api/v1/security/coordinators`
    : `/api/v1/manpower/${business}/${master === "areas" ? "areas" : master === "zones" ? "zones" : master}`;

  const [includeInactive, setIncludeInactive] = useState(false);

  async function loadData() {
    if (!canView) return;
    setLoading(true);
    try {
      const url = new URL(apiBase, window.location.origin);
      if (master === "manpower" && includeInactive) {
        url.searchParams.set("includeInactive", "true");
      }
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        setData(json);
        console.log(`[Debug Master Page] Fetched manpower count: ${json.length}`);
      }
    } catch (e) {
      console.error("Failed to load master data", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadRelations() {
    try {
      if (master === "contracts" || master === "projects" || master === "sites" || master === "zones" || master === "areas") {
        const [clientsRes, categoriesRes, materialsRes] = await Promise.all([
          fetch(`/api/v1/manpower/${business}/clients`),
          fetch(`/api/v1/manpower/${business}/categories`),
          fetch(`/api/v1/manpower/${business}/materials`)
        ]);
        if (clientsRes.ok) setClients(await clientsRes.json());
        if (categoriesRes.ok) setCategories(await categoriesRes.json());
        if (materialsRes.ok) setMaterialsList(await materialsRes.json());
      }
      if (master === "projects" || master === "sites" || master === "zones" || master === "areas") {
        const res = await fetch(`/api/v1/manpower/${business}/contracts`);
        if (res.ok) setContracts(await res.json());
      }
      if (master === "sites" || master === "zones" || master === "areas") {
        const res = await fetch(`/api/v1/manpower/${business}/projects`);
        if (res.ok) setProjects(await res.json());
      }
      if (master === "zones" || master === "areas") {
        const res = await fetch(`/api/v1/manpower/${business}/sites`);
        if (res.ok) setSites(await res.json());
      }
      if (master === "manpower") {
        const [catRes, empRes] = await Promise.all([
          fetch(`/api/v1/manpower/${business}/categories`),
          fetch(`/api/v1/employees`)
        ]);
        if (catRes.ok) setCategories(await catRes.json());
        if (empRes.ok) setWorkforceEmployees(await empRes.json());
      }
      if (master === "coordinators") {
        const [projRes, empRes] = await Promise.all([
          fetch(`/api/v1/manpower/${business}/projects`),
          fetch(`/api/v1/employees`)
        ]);
        if (projRes.ok) setProjects(await projRes.json());
        if (empRes.ok) setWorkforceEmployees(await empRes.json());
      }
      if (isSecurity && (master === "manpower" || master === "projects" || master === "coordinators")) {
        loadSecurityComplianceData();
      }
      if (master === "shifts") {
        const [sitesRes, catsRes, shiftsRes, unitsRes] = await Promise.all([
          fetch(`/api/v1/manpower/${business}/sites`),
          fetch(`/api/v1/manpower/${business}/categories`),
          fetch(`/api/v1/shifts`),
          fetch(`/api/v1/manpower/${business}/${isSecurity ? "zones" : "areas"}`)
        ]);
        if (sitesRes.ok) setSites(await sitesRes.json());
        if (catsRes.ok) setCategories(await catsRes.json());
        if (shiftsRes.ok) setShiftsList(await shiftsRes.json());
        if (unitsRes.ok) setLocationUnits(await unitsRes.json());
      }
    } catch (e) {
      console.error("Failed to load relations", e);
    }
  }

  const handleDeleteRequirement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift requirement?")) return;
    try {
      const res = await fetch(`${apiBase}?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        alert("Failed to delete shift requirement");
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (business && master) {
      loadData();
      loadRelations();
    }
  }, [business, master, session, includeInactive]);

  // Support redirecting reliever-pools to manpower directory tab
  useEffect(() => {
    if (master === "reliever-pools") {
      router.replace(`/manpower/${business}/manpower?tab=relieverPools`);
    }
  }, [master, business, router]);

  // Support active sub-tab switching via query param
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get("tab");
      if (tab) {
        setActiveSubTab(tab);
      }
    }
  }, [master]);

  // Support automatic modal triggers from dashboard quick actions (e.g. ?add=true)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("add") === "true") {
        if (isSecurity && master === "manpower") {
          if (activeSubTab === "licenses") {
            setShowAddLicenseModal(true);
          } else if (activeSubTab === "gatePasses") {
            setShowAddGatePassModal(true);
          } else if (activeSubTab === "directory") {
            setShowAddModal(true);
          }
        } else {
          setShowAddModal(true);
        }
      }
    }
  }, [master, isSecurity, activeSubTab]);

  if (!canView) {
    return (
      <div className="p-8 text-center text-status-error font-bold">
        Access Denied: You do not have permission to view {businessLabel} operations.
      </div>
    );
  }

  const handleSyncOperationType = async (employee: any) => {
    const targetCategory = employee.manpowerCategoryId || (isSecurity ? "PM-CAT-SEC-02" : "PM-CAT-FM-01");
    if (!confirm(`Are you sure you want to sync operation type for ${employee.name} (${employee.id})?`)) return;
    try {
      const res = await fetch(`/api/v1/manpower/${business}/manpower`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: employee.id,
          manpowerCategoryId: targetCategory
        })
      });
      if (res.ok) {
        alert("Operation type synchronized successfully!");
        loadData();
        loadRelations();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to sync operation type");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred during synchronization");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({});
        loadData();
      } else {
        const errJson = await res.json();
        setFormError(errJson.error || "Failed to create item");
      }
    } catch (e) {
      setFormError("Server connection failed");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    try {
            const url = master === "materials" ? `${apiBase}/${editItem.id}` : apiBase;
      const method = master === "materials" ? "PUT" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editItem.id, ...formData })
      });
      if (res.ok) {
        setEditItem(null);
        setFormData({});
        loadData();
      } else {
        const errJson = await res.json();
        setFormError(errJson.error || "Failed to update item");
      }
    } catch (e) {
      setFormError("Server connection failed");
    }
  };

  const filteredData = data.filter((item: any) => {
    const term = searchTerm.toLowerCase();
    if (master === "clients") {
      const searchMatch = (
        item.name?.toLowerCase().includes(term) ||
        item.code?.toLowerCase().includes(term) ||
        item.crNumber?.toLowerCase().includes(term) ||
        item.qidNumber?.toLowerCase().includes(term) ||
        item.mainPhone?.toLowerCase().includes(term) ||
        item.mainEmail?.toLowerCase().includes(term) ||
        item.operationContactName?.toLowerCase().includes(term) ||
        item.financeContactName?.toLowerCase().includes(term)
      );
      const typeMatch = filterCustomerType === "ALL" || item.customerType === filterCustomerType;
      const statusMatch = filterStatus === "ALL" || (filterStatus === "ACTIVE" ? item.isActive : !item.isActive);
      return searchMatch && typeMatch && statusMatch;
    }
    if (master === "categories") {
      return item.name?.toLowerCase().includes(term) || item.code?.toLowerCase().includes(term);
    }
    if (master === "contracts") {
      return item.title?.toLowerCase().includes(term) || item.contractNumber?.toLowerCase().includes(term);
    }
    if (master === "projects") {
      return item.name?.toLowerCase().includes(term) || item.code?.toLowerCase().includes(term);
    }
    if (master === "sites" || master === "zones" || master === "areas") {
      return item.name?.toLowerCase().includes(term);
    }
    if (master === "manpower") {
      return item.name?.toLowerCase().includes(term) || item.id?.toLowerCase().includes(term) || item.email?.toLowerCase().includes(term);
    }
    if (master === "coordinators") {
      return item.code?.toLowerCase().includes(term) ||
             item.project?.name?.toLowerCase().includes(term) ||
             item.coordinatorEmployee?.name?.toLowerCase().includes(term);
    }
    return true;
  });

  async function loadProjectDetails(projectId: string) {
    setSelectedProjectId(projectId);
    try {
      const matRes = await fetch(`/api/v1/manpower/material-allocations?projectId=${projectId}`);
      if (matRes.ok) setProjectAllocatedMaterials(await matRes.json());

      const sitesRes = await fetch(`/api/v1/manpower/${business}/sites`);
      if (sitesRes.ok) {
        const allSites = await sitesRes.json();
        const projectSites = allSites.filter((s: any) => s.projectId === projectId);
        const projectSiteIds = projectSites.map((s: any) => s.id);
        
        const shiftsRes = await fetch(`/api/v1/shifts`);
        if (shiftsRes.ok) {
          const allShifts = await shiftsRes.json();
          const filteredShifts = allShifts.filter((s: any) => projectSiteIds.includes(s.siteId));
          setProjectShiftRequirements(filteredShifts);
        }

        const todayStr = new Date().toISOString().split("T")[0];
        const depRes = await fetch(`/api/v1/manpower/${business}/deployments?date=${todayStr}`);
        if (depRes.ok) {
          const allDeps = await depRes.json();
          const filteredDeps = allDeps.filter((d: any) => projectSiteIds.includes(d.shiftRequirement?.siteId));
          setProjectDeployments(filteredDeps);
        }
      }
    } catch (e) {
      console.error("Failed to load project details", e);
    }
  }

  const handleAddLicenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const form = e.target as HTMLFormElement;
    const formDataObj = new FormData(form);
    const payload = {
      employeeId: formDataObj.get("employeeId") as string,
      licenseNumber: formDataObj.get("licenseNumber") as string,
      issueDate: formDataObj.get("issueDate") as string,
      expiryDate: formDataObj.get("expiryDate") as string,
      status: "VALID"
    };

    try {
      const res = await fetch("/api/v1/security/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowAddLicenseModal(false);
        loadSecurityComplianceData();
      } else {
        const err = await res.json();
        setFormError(err.error || "Failed to add license record");
      }
    } catch (err) {
      setFormError("Server connection failed");
    }
  };

  const handleAddGatePassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const form = e.target as HTMLFormElement;
    const formDataObj = new FormData(form);
    const payload = {
      employeeId: formDataObj.get("employeeId") as string,
      siteId: formDataObj.get("siteId") as string,
      passNumber: formDataObj.get("passNumber") as string,
      issueDate: formDataObj.get("issueDate") as string,
      expiryDate: formDataObj.get("expiryDate") as string,
      status: "ACTIVE"
    };

    try {
      const res = await fetch("/api/v1/security/gate-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowAddGatePassModal(false);
        loadSecurityComplianceData();
      } else {
        const err = await res.json();
        setFormError(err.error || "Failed to add gate pass record");
      }
    } catch (err) {
      setFormError("Server connection failed");
    }
  };

  function renderProjectDetailsPanel() {
    const project = data.find(p => p.id === selectedProjectId);
    if (!project) return null;

    const totalRequired = projectShiftRequirements.reduce((sum, s) => sum + (s.requiredCount || 0), 0);
    const totalActual = projectDeployments.reduce((sum, d) => sum + (d.assignments?.length || 0), 0);
    const coveragePercent = totalRequired > 0 ? Math.round((totalActual / totalRequired) * 100) : 100;

    return (
      <div className="w-1/2 bg-surface border border-outline-variant rounded-xl shadow-sm p-6 overflow-y-auto flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-outline-variant/60 pb-3">
          <div>
            <h3 className="text-sm font-black text-primary">{project.name}</h3>
            <p className="text-[10px] text-on-surface-variant">Project Code: {project.code}</p>
          </div>
          <button
            onClick={() => setSelectedProjectId(null)}
            className="w-6 h-6 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Deployment Coverage Widget */}
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2">
          <p className="text-[9px] uppercase font-bold text-on-surface-variant">Daily Deployment Coverage Today</p>
          <div className="flex items-center justify-between text-xs font-black">
            <span className="text-on-surface">Guards Deployed: {totalActual} / {totalRequired}</span>
            <span className={coveragePercent < 100 ? "text-status-error" : "text-status-success"}>
              {coveragePercent}%
            </span>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${coveragePercent < 100 ? "bg-status-error" : "bg-status-success"}`}
              style={{ width: `${Math.min(100, coveragePercent)}%` }}
            ></div>
          </div>
        </div>

        {/* Required vs Actual Ledger */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">equalizer</span>
            Required vs Actual Manpower Ledger
          </h4>
          <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                  <th className="px-3 py-2">Shift/Site</th>
                  <th className="px-3 py-2 text-center">Req.</th>
                  <th className="px-3 py-2 text-center">Act.</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {projectShiftRequirements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-on-surface-variant italic">No shifts configured for this project.</td>
                  </tr>
                ) : (
                  projectShiftRequirements.map((req: any) => {
                    const dep = projectDeployments.find((d: any) => d.shiftRequirementId === req.id);
                    const actCount = dep?.assignments?.length || 0;
                    const reqCount = req.requiredCount || 0;
                    const statusStr = actCount < reqCount ? "UNDER" : actCount > reqCount ? "OVER" : "OK";
                    return (
                      <tr key={req.id} className="hover:bg-surface-container-lowest">
                        <td className="px-3 py-2 font-semibold text-on-surface">
                          {req.shiftCode} <span className="text-[10px] text-on-surface-variant font-normal">({req.site?.name || req.siteId})</span>
                        </td>
                        <td className="px-3 py-2 text-center">{reqCount}</td>
                        <td className="px-3 py-2 text-center font-bold">{actCount}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusStr === "UNDER" ? "bg-status-error/15 text-status-error" : statusStr === "OVER" ? "bg-primary/15 text-primary" : "bg-status-success/15 text-status-success"}`}>
                            {statusStr}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reliever Pools */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">groups</span>
            Reliever Pools
          </h4>
          <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                  <th className="px-3 py-2">Pool Name</th>
                  <th className="px-3 py-2 text-center">Assigned</th>
                  <th className="px-3 py-2 text-center">Target</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {relieverPoolsList.filter(p => p.projectId === selectedProjectId).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-on-surface-variant italic">No reliever pools for this project.</td>
                  </tr>
                ) : (
                  relieverPoolsList.filter(p => p.projectId === selectedProjectId).map((pool: any) => {
                    const assignedCount = relieverAssignmentsList.filter(a => a.poolId === pool.id).length;
                    const reqCount = pool.requiredRelieverCount || 3;
                    const short = Math.max(0, reqCount - assignedCount);
                    return (
                      <tr key={pool.id} className="hover:bg-surface-container-lowest">
                        <td className="px-3 py-2 font-semibold text-on-surface">{pool.poolName}</td>
                        <td className="px-3 py-2 text-center">{assignedCount}</td>
                        <td className="px-3 py-2 text-center">{reqCount}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${short > 0 ? "bg-status-error/15 text-status-error" : "bg-status-success/15 text-status-success"}`}>
                            {short > 0 ? `${short} Short` : "Full"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Material & Equipment Allocations */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">devices_other</span>
            Material & Equipment Allocations
          </h4>
          <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                  <th className="px-3 py-2">Item Name</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-center">Allocated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {projectAllocatedMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-on-surface-variant italic">No equipment allocated to this project.</td>
                  </tr>
                ) : (
                  projectAllocatedMaterials.map((mat: any) => (
                    <tr key={mat.id} className="hover:bg-surface-container-lowest">
                      <td className="px-3 py-2 font-semibold text-on-surface">{mat.contractMaterial?.materialName || "Material"}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{mat.contractMaterial?.category || "Equipment"}</td>
                      <td className="px-3 py-2 text-center font-bold">{mat.quantityAllocated}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderSecurityComplianceTabs() {
    if (activeSubTab === "licenses") {
      return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="flex justify-between items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider">MOI Security Guard Licenses</h2>
            {canManage && (
              <button
                onClick={() => setShowAddLicenseModal(true)}
                className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Record License
              </button>
            )}
          </div>
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-on-surface-variant font-bold">
                  <th className="px-4 py-3">Guard ID</th>
                  <th className="px-4 py-3">License Number</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Status</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {licensesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-on-surface-variant italic">No license records recorded yet.</td>
                  </tr>
                ) : (
                  licensesList.map((lic: any) => {
                    const emp = data.find(e => e.id === lic.employeeId);
                    const todayStr = new Date().toISOString().split("T")[0];
                    const isExpired = lic.expiryDate < todayStr;
                    return (
                      <tr key={lic.id} className="text-xs hover:bg-surface-container-lowest">
                        <td className="px-4 py-3 font-semibold text-on-surface">
                          {emp ? `${emp.name} (${lic.employeeId})` : lic.employeeId}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">{lic.licenseNumber}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{lic.issueDate}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{lic.expiryDate}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isExpired ? "bg-status-error/15 text-status-error" : "bg-status-success/15 text-status-success"}`}>
                            {isExpired ? "Expired" : "Valid"}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                if (confirm("Revoke/delete this license record?")) {
                                  await fetch(`/api/v1/security/licenses/${lic.id}`, { method: "DELETE" });
                                  loadSecurityComplianceData();
                                }
                              }}
                              className="text-status-error hover:underline font-bold"
                            >
                              Revoke
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeSubTab === "gatePasses") {
      return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="flex justify-between items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Site Gate Passes</h2>
            {canManage && (
              <button
                onClick={() => setShowAddGatePassModal(true)}
                className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Record Gate Pass
              </button>
            )}
          </div>
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-on-surface-variant font-bold">
                  <th className="px-4 py-3">Guard ID</th>
                  <th className="px-4 py-3">Worksite</th>
                  <th className="px-4 py-3">Pass Number</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Status</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {gatePassesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-on-surface-variant italic">No gate passes recorded yet.</td>
                  </tr>
                ) : (
                  gatePassesList.map((gp: any) => {
                    const emp = data.find(e => e.id === gp.employeeId);
                    const site = sites.find(s => s.id === gp.siteId);
                    const todayStr = new Date().toISOString().split("T")[0];
                    const isExpired = gp.expiryDate < todayStr;
                    return (
                      <tr key={gp.id} className="text-xs hover:bg-surface-container-lowest">
                        <td className="px-4 py-3 font-semibold text-on-surface">
                          {emp ? `${emp.name} (${gp.employeeId})` : gp.employeeId}
                        </td>
                        <td className="px-4 py-3 text-on-surface">{site?.name || gp.siteId}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{gp.passNumber}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{gp.expiryDate}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isExpired ? "bg-status-error/15 text-status-error" : "bg-status-success/15 text-status-success"}`}>
                            {isExpired ? "Expired" : "Active"}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                if (confirm("Revoke/delete this gate pass record?")) {
                                  await fetch(`/api/v1/security/gate-passes/${gp.id}`, { method: "DELETE" });
                                  loadSecurityComplianceData();
                                }
                              }}
                              className="text-status-error hover:underline font-bold"
                            >
                              Revoke
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeSubTab === "relieverPools") {
      return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Project Reliever Pools</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relieverPoolsList.map((pool: any) => {
              const proj = projects.find(p => p.id === pool.projectId);
              const assigned = relieverAssignmentsList.filter((a: any) => a.poolId === pool.id);
              return (
                <div key={pool.id} className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-black text-primary">{pool.poolName}</h4>
                      <p className="text-[10px] text-on-surface-variant">Project: {proj?.name || pool.projectId}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {assigned.length} / {pool.requiredRelieverCount || 3} Relievers
                    </span>
                  </div>
                  <div className="pt-2 border-t border-outline-variant/40 space-y-1">
                    <p className="text-[9px] uppercase font-bold text-on-surface-variant">Assigned Resource Personnel</p>
                    {assigned.length === 0 ? (
                      <p className="text-[10px] text-on-surface-variant italic">No relievers assigned to this pool.</p>
                    ) : (
                      <ul className="list-disc pl-4 text-xs text-on-surface space-y-0.5">
                        {assigned.map((a: any) => {
                          const emp = data.find(e => e.id === a.employeeId);
                          return (
                            <li key={a.id} className="font-medium">
                              {emp ? emp.name : a.employeeId} ({a.employeeId})
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeSubTab === "overtimeLogs") {
      const overtimeDeployments: any[] = [];
      deploymentsList.forEach((dep: any) => {
        dep.assignments?.forEach((asg: any) => {
          if (asg.isOvertime || asg.deploymentType === "OVERTIME") {
            overtimeDeployments.push({
              id: asg.id,
              date: dep.date,
              employeeId: asg.employeeId,
              siteName: dep.shiftRequirement?.site?.name || dep.shiftRequirement?.siteId,
              shiftCode: dep.shiftRequirement?.shiftCode,
              sourceType: asg.sourceType,
              overtimeReason: asg.overtimeReason,
              warnings: asg.validationWarnings || []
            });
          }
        });
      });

      return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Overtime & Reliever Duty History</h2>
          </div>
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-on-surface-variant font-bold">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Worksite / Shift</th>
                  <th className="px-4 py-3">Allocation Source</th>
                  <th className="px-4 py-3">Overtime Reason</th>
                  <th className="px-4 py-3 text-right">Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {overtimeDeployments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-on-surface-variant italic">No active overtime or special assignments logged today.</td>
                  </tr>
                ) : (
                  overtimeDeployments.map((ot: any) => {
                    const emp = data.find(e => e.id === ot.employeeId);
                    return (
                      <tr key={ot.id} className="text-xs hover:bg-surface-container-lowest">
                        <td className="px-4 py-3 text-on-surface font-semibold">{ot.date}</td>
                        <td className="px-4 py-3 font-semibold text-on-surface">
                          {emp ? emp.name : ot.employeeId} ({ot.employeeId})
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">{ot.siteName} - {ot.shiftCode}</td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          <span className="px-1.5 py-0.5 bg-primary-container/10 text-primary font-bold rounded text-[9px]">
                            {ot.sourceType || "GENERAL_POOL"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-on-surface font-semibold text-status-warning">{ot.overtimeReason || "N/A"}</td>
                        <td className="px-4 py-3 text-right">
                          {ot.warnings.length > 0 ? (
                            <span className="px-1.5 py-0.5 bg-status-error/10 text-status-error rounded text-[9px] font-bold">
                              {ot.warnings.length} Alerts
                            </span>
                          ) : (
                            <span className="text-[10px] text-status-success font-bold">Compliant</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return null;
  }

  const addManpowerRow = () => {
    const list = formData.manpowerRequirements || [];
    setFormData({
      ...formData,
      manpowerRequirements: [...list, { id: `new-mr-${Date.now()}`, position: "", quantity: 1, deploymentType: "Permanent", remarks: "" }]
    });
  };

  const updateManpowerRow = (index: number, field: string, value: any) => {
    const list = [...(formData.manpowerRequirements || [])];
    list[index] = { ...list[index], [field]: value };
    setFormData({ ...formData, manpowerRequirements: list });
  };

  const deleteManpowerRow = (index: number) => {
    const list = [...(formData.manpowerRequirements || [])];
    list.splice(index, 1);
    setFormData({ ...formData, manpowerRequirements: list });
  };

  const addRelieverRow = () => {
    const list = formData.relieverRequirements || [];
    setFormData({
      ...formData,
      relieverRequirements: [...list, { id: `new-rr-${Date.now()}`, position: "", quantity: 1, sourcePreference: "General Pool", remarks: "" }]
    });
  };

  const updateRelieverRow = (index: number, field: string, value: any) => {
    const list = [...(formData.relieverRequirements || [])];
    list[index] = { ...list[index], [field]: value };
    setFormData({ ...formData, relieverRequirements: list });
  };

  const deleteRelieverRow = (index: number) => {
    const list = [...(formData.relieverRequirements || [])];
    list.splice(index, 1);
    setFormData({ ...formData, relieverRequirements: list });
  };

  const addShiftRow = () => {
    const list = formData.shiftRequirements || [];
    setFormData({
      ...formData,
      shiftRequirements: [...list, { id: `new-sr-${Date.now()}`, shiftName: "Day Shift", startTime: "07:00", endTime: "19:00", postsCovered: 1, daysPattern: "Daily", remarks: "" }]
    });
  };

  const updateShiftRow = (index: number, field: string, value: any) => {
    const list = [...(formData.shiftRequirements || [])];
    list[index] = { ...list[index], [field]: value };
    setFormData({ ...formData, shiftRequirements: list });
  };

  const deleteShiftRow = (index: number) => {
    const list = [...(formData.shiftRequirements || [])];
    list.splice(index, 1);
    setFormData({ ...formData, shiftRequirements: list });
  };

  const addAddendumLine = () => {
    const list = addFormLineItems || [];
    setAddFormLineItems([...list, {
      id: `new-ali-${Date.now()}`,
      itemType: "MANPOWER",
      action: "ADD",
      label: "",
      quantity: 1,
      unitPrice: 0,
      billingPeriodCount: 1,
      lineTotal: 0
    }]);
  };

  const updateAddendumLine = (index: number, field: string, value: any) => {
    const list = [...addFormLineItems];
    const item = { ...list[index], [field]: value };
    
    // Recalculate line total
    const qty = parseInt(item.quantity, 10) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const count = parseInt(item.billingPeriodCount, 10) || 1;
    const absVal = qty * price * count;
    item.lineTotal = item.action === "REMOVE" ? -absVal : absVal;

    list[index] = item;
    
    // Calculate total net impact and format commercialImpact string automatically!
    const totalImpact = list.reduce((sum, li) => sum + (li.lineTotal || 0), 0);
    const formattedImpact = (totalImpact >= 0 ? "+" : "") + `QAR ${totalImpact.toFixed(2)}`;

    setAddFormLineItems(list);
    setAddendumForm({
      ...addendumForm,
      lineItems: list,
      commercialImpact: formattedImpact
    });
  };

  const deleteAddendumLine = (index: number) => {
    const list = [...addFormLineItems];
    list.splice(index, 1);
    
    const totalImpact = list.reduce((sum, li) => sum + (li.lineTotal || 0), 0);
    const formattedImpact = (totalImpact >= 0 ? "+" : "") + `QAR ${totalImpact.toFixed(2)}`;

    setAddFormLineItems(list);
    setAddendumForm({
      ...addendumForm,
      lineItems: list,
      commercialImpact: formattedImpact
    });
  };

  const handleSaveContract = async (status: "DRAFT" | "ACTIVE") => {
    setFormError("");
    if (!formData.clientId || !formData.title || !formData.startDate || !formData.endDate) {
      setFormError("Client, Contract Title, Start Date, and End Date are required.");
      return;
    }
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end < start) {
      setFormError("End Date must be greater than or equal to Start Date.");
      return;
    }
    if (status === "ACTIVE") {
      const manpowerRequirements = formData.manpowerRequirements || [];
      if (manpowerRequirements.length === 0) {
        setFormError("At least one manpower requirement line is required to create an Active contract.");
        return;
      }
      if (manpowerRequirements.some((mr: any) => !mr.position || !mr.quantity || mr.quantity <= 0)) {
        setFormError("All manpower requirement lines must have a valid position and quantity greater than 0.");
        return;
      }
      if (formData.relieverRequired === "Yes") {
        const relieverRequirements = formData.relieverRequirements || [];
        if (relieverRequirements.length === 0) {
          setFormError("At least one reliever requirement line is required when Reliever Required is Yes.");
          return;
        }
        if (relieverRequirements.some((rr: any) => !rr.position || !rr.quantity || rr.quantity <= 0)) {
          setFormError("All reliever requirement lines must have a valid position and quantity greater than 0.");
          return;
        }
      }
      const shiftRequirements = formData.shiftRequirements || [];
      if (shiftRequirements.length === 0) {
        setFormError("At least one shift requirement line is required to create an Active contract.");
        return;
      }
      if (shiftRequirements.some((sr: any) => !sr.shiftName || !sr.startTime || !sr.endTime || !sr.postsCovered || sr.postsCovered <= 0)) {
        setFormError("All shift requirement lines must have a shift name, times, and posts covered greater than 0.");
        return;
      }
    }
    try {
      const isEditing = editItem !== null;
      const res = await fetch(apiBase, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing ? { id: editItem.id } : {}),
          ...formData,
          status,
          operationType: "SECURITY_GUARDING"
        })
      });
      if (res.ok) {
        setShowAddModal(false);
        setEditItem(null);
        setFormData({});
        loadData();
        loadRelations();
      } else {
        const errJson = await res.json();
        setFormError(errJson.error || `Failed to ${isEditing ? "save" : "create"} contract`);
      }
    } catch (e) {
      setFormError("Server connection failed");
    }
  };

  function renderSecurityContractForm() {
    const currentScope = isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";
    const filteredClients = clients.filter((c: any) => c.operationType === currentScope);
    
    const secCategories = categories.filter((c: any) => c.operationType === "SECURITY_GUARDING");
    const fallbackCategories = [
      { id: "PM-CAT-SEC-02", name: "Security Guard", code: "SECURITY_GUARD" },
      { id: "PM-CAT-SEC-03", name: "Head Guard", code: "HEAD_GUARD" },
      { id: "PM-CAT-SEC-04", name: "Security Supervisor", code: "SECURITY_SUPERVISOR" },
      { id: "PM-CAT-SEC-05", name: "CCTV Operator", code: "CCTV_OPERATOR" },
      { id: "PM-CAT-SEC-06", name: "Patrolling Supervisor", code: "PATROL_SUPERVISOR" },
      { id: "PM-CAT-SEC-07", name: "Reliever Guard", code: "RELIEVER_GUARD" },
      { id: "PM-CAT-SEC-11", name: "Other Security Manpower", code: "OTHER_SEC" }
    ];
    const displayCategories = secCategories.length > 0 ? secCategories : fallbackCategories;
    
    // Filter materials by scope
    const allowedMaterials = materialsList.filter((m: any) => {
      if (!m.isActive) return false;
      if (m.operationType === "SHARED") return true;
      return m.operationType === currentScope;
    });

    const manpowerReqs = formData.manpowerRequirements || [];
    const totalManpower = manpowerReqs.reduce((sum: number, r: any) => sum + (parseInt(r.quantity, 10) || 0), 0);
    const relieverReqs = formData.relieverRequirements || [];
    const totalRelievers = relieverReqs.reduce((sum: number, r: any) => sum + (parseInt(r.quantity, 10) || 0), 0);
    const shiftReqs = formData.shiftRequirements || [];
    const shiftCount = shiftReqs.length;
    
    const materialReqs = formData.materials || [];

    // Sum of values
    const totalManpowerValue = manpowerReqs.reduce((sum: number, r: any) => {
      if (r.isFoc) return sum;
      const qty = parseInt(r.quantity, 10) || 0;
      const price = parseFloat(r.unitPrice) || 0;
      const periodCount = parseInt(r.billingPeriodCount, 10) || 1;
      return sum + (qty * price * periodCount);
    }, 0);

    const totalMaterialValue = materialReqs.reduce((sum: number, r: any) => {
      if (r.isFoc) return sum;
      const qty = parseInt(r.quantity, 10) || 0;
      const price = parseFloat(r.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);

    const totalContractValue = totalManpowerValue + totalMaterialValue;
    const focManpowerCount = manpowerReqs.reduce((sum: number, r: any) => sum + (r.isFoc ? (parseInt(r.quantity, 10) || 0) : 0), 0);
    const focMaterialCount = materialReqs.reduce((sum: number, r: any) => sum + (r.isFoc ? (parseInt(r.quantity, 10) || 0) : 0), 0);

    const validationErrors: string[] = [];
    if (!formData.clientId) validationErrors.push("Client is required.");
    if (!formData.title) validationErrors.push("Contract Title is required.");
    if (!formData.startDate) validationErrors.push("Start Date is required.");
    if (!formData.endDate) validationErrors.push("End Date is required.");
    if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      validationErrors.push("End Date must be greater than or equal to Start Date.");
    }
    
    const activeErrors: string[] = [];
    if (isSecurity) {
      if (manpowerReqs.length === 0) activeErrors.push("At least one manpower requirement is required.");
      if (manpowerReqs.some((r: any) => !r.position || !r.quantity || r.quantity <= 0)) {
        activeErrors.push("All manpower quantities must be greater than 0.");
      }
      if (formData.relieverRequired === "Yes") {
        if (relieverReqs.length === 0) activeErrors.push("At least one reliever requirement is required when Reliever Required = Yes.");
        if (relieverReqs.some((r: any) => !r.position || !r.quantity || r.quantity <= 0)) {
          activeErrors.push("All reliever quantities must be greater than 0.");
        }
      }
      if (shiftReqs.length === 0) activeErrors.push("At least one shift requirement is required.");
      if (shiftReqs.some((r: any) => !r.shiftName || !r.startTime || !r.endTime || !r.postsCovered || r.postsCovered <= 0)) {
        activeErrors.push("All shifts must have valid name, times, and posts > 0.");
      }
    }

    if (materialReqs.some((m: any) => !m.itemName || !m.quantity || m.quantity <= 0)) {
      activeErrors.push("All material line items must have a valid item selected and quantity > 0.");
    }

    const isDraftDisabled = !formData.clientId || !formData.title || !formData.startDate || !formData.endDate || (new Date(formData.endDate) < new Date(formData.startDate));
    const isCreateDisabled = isDraftDisabled || activeErrors.length > 0 || validationErrors.length > 0;

    return (
      <div className="space-y-6 text-on-surface">
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Basic Contract Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Client *</label>
                <select
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  value={formData.clientId || ""}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                >
                  <option value="">Select Client...</option>
                  {filteredClients.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QP HQ Security Guarding 2026"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  value={formData.title || ""}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks / Notes (Optional)</label>
                <textarea
                  placeholder="Enter remarks..."
                  rows={2}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface resize-none"
                  value={formData.remarks || ""}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract Number</label>
                <input
                  type="text"
                  disabled
                  placeholder="Auto-generated (SCON-XXXX)"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                  value={formData.contractNumber || ""}
                />
              </div>
              
              {/* Duration Auto-Calculation Section */}
              <div className="bg-surface-container/60 border border-outline-variant/40 p-3 rounded-lg space-y-3">
                <span className="block text-[10px] font-bold text-primary uppercase tracking-wider">Contract Duration Calculator</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Start Date *</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                      value={formData.startDate || ""}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const num = parseInt(formData.durationNumber, 10) || 0;
                        const unit = formData.durationUnit || "Month";
                        const newEnd = calculateEndDate(newStart, num, unit);
                        setFormData({
                          ...formData,
                          startDate: newStart,
                          endDate: newEnd || formData.endDate,
                          totalDurationDays: calculateDurationDays(newStart, newEnd || formData.endDate)
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Duration Value</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 12"
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                      value={formData.durationNumber || ""}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10) || 0;
                        const unit = formData.durationUnit || "Month";
                        const newEnd = calculateEndDate(formData.startDate, num, unit);
                        setFormData({
                          ...formData,
                          durationNumber: e.target.value === "" ? null : num,
                          endDate: newEnd || formData.endDate,
                          totalDurationDays: calculateDurationDays(formData.startDate, newEnd || formData.endDate)
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Duration Unit</label>
                    <select
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                      value={formData.durationUnit || "Month"}
                      onChange={(e) => {
                        const unit = e.target.value;
                        const num = parseInt(formData.durationNumber, 10) || 0;
                        const newEnd = calculateEndDate(formData.startDate, num, unit);
                        setFormData({
                          ...formData,
                          durationUnit: unit,
                          endDate: newEnd || formData.endDate,
                          totalDurationDays: calculateDurationDays(formData.startDate, newEnd || formData.endDate)
                        });
                      }}
                    >
                      <option value="Day">Day(s)</option>
                      <option value="Month">Month(s)</option>
                      <option value="Year">Year(s)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">End Date (Inclusive) *</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                      value={formData.endDate || ""}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        setFormData({
                          ...formData,
                          endDate: newEnd,
                          totalDurationDays: calculateDurationDays(formData.startDate, newEnd)
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="text-[10px] text-on-surface-variant text-right italic pt-1">
                  Duration Period: <span className="font-bold text-primary">{formData.totalDurationDays || 0} inclusive days</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract Status</label>
                <select
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  value={formData.status || "DRAFT"}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Manpower Requirements Grid (Security Guarding Only) */}
        {isSecurity && (
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Manpower Requirements *</h4>
              <button
                type="button"
                onClick={addManpowerRow}
                className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">add</span> Add Line
              </button>
            </div>
            {manpowerReqs.length === 0 ? (
              <p className="text-[11px] text-on-surface-variant italic py-2">No manpower requirements added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                      <th className="pb-2 pr-2">Position Category *</th>
                      <th className="pb-2 pr-2 w-16">Qty *</th>
                      <th className="pb-2 pr-2 w-24">Unit Price *</th>
                      <th className="pb-2 pr-2 w-28">Billing Freq *</th>
                      <th className="pb-2 pr-2 w-16">Periods *</th>
                      <th className="pb-2 pr-2 w-14 text-center">FOC</th>
                      <th className="pb-2 pr-2 w-20 text-right">Line Total</th>
                      <th className="pb-2 pr-2">Remarks</th>
                      <th className="pb-2 w-8 text-right">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {manpowerReqs.map((row: any, idx: number) => (
                      <tr key={row.id || idx} className="hover:bg-surface-container-lowest/40">
                        <td className="py-2 pr-2">
                          <select
                            required
                            value={row.position || ""}
                            onChange={(e) => updateManpowerRow(idx, "position", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          >
                            <option value="">Select Position...</option>
                            {displayCategories.map((c: any) => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            required
                            min="1"
                            value={row.quantity || ""}
                            onChange={(e) => updateManpowerRow(idx, "quantity", parseInt(e.target.value, 10))}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={row.unitPrice || 0}
                            onChange={(e) => updateManpowerRow(idx, "unitPrice", parseFloat(e.target.value))}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            required
                            value={row.billingFrequency || "Monthly"}
                            onChange={(e) => updateManpowerRow(idx, "billingFrequency", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                          >
                            <option value="Hourly">Hourly</option>
                            <option value="Daily">Daily</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Lumpsum">Lumpsum</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            required
                            min="1"
                            value={row.billingPeriodCount || 1}
                            onChange={(e) => updateManpowerRow(idx, "billingPeriodCount", parseInt(e.target.value, 10))}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!row.isFoc}
                            onChange={(e) => updateManpowerRow(idx, "isFoc", e.target.checked)}
                            className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                        </td>
                        <td className="py-2 pr-2 text-right font-bold text-[11px] text-on-surface">
                          {(row.lineTotal || 0).toFixed(2)}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={row.remarks || ""}
                            placeholder="Notes"
                            onChange={(e) => updateManpowerRow(idx, "remarks", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none text-[11px]"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => deleteManpowerRow(idx)}
                            className="text-status-error hover:bg-status-error/10 p-1 rounded"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Reliever Requirements Grid (Security Guarding Only) */}
        {isSecurity && (
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1">
              <div className="flex items-center gap-4">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Reliever Requirements</h4>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-[11px] text-on-surface-variant uppercase">Reliever Required?</span>
                  <select
                    value={formData.relieverRequired || "No"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        relieverRequired: val,
                        relieverRequirements: val === "Yes" ? (formData.relieverRequirements || []) : []
                      });
                    }}
                    className="bg-surface-container-lowest border border-outline-variant rounded px-2 py-0.5 text-xs font-bold"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>
              {formData.relieverRequired === "Yes" && (
                <button
                  type="button"
                  onClick={addRelieverRow}
                  className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[12px]">add</span> Add Line
                </button>
              )}
            </div>
            {formData.relieverRequired === "Yes" ? (
              relieverReqs.length === 0 ? (
                <p className="text-[11px] text-on-surface-variant italic py-2">No reliever requirements added yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                        <th className="pb-2 pr-2">Reliever Position *</th>
                        <th className="pb-2 pr-2 w-24">Qty *</th>
                        <th className="pb-2 pr-2 w-48">Source Preference *</th>
                        <th className="pb-2 pr-2">Remarks</th>
                        <th className="pb-2 w-10 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {relieverReqs.map((row: any, idx: number) => (
                        <tr key={row.id || idx} className="hover:bg-surface-container-lowest/40">
                          <td className="py-2 pr-2">
                            <select
                              required
                              value={row.position || ""}
                              onChange={(e) => updateRelieverRow(idx, "position", e.target.value)}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                            >
                              <option value="">Select Reliever Position...</option>
                              <option value="Reliever Guard">Reliever Guard</option>
                              <option value="Head Guard">Head Guard</option>
                              <option value="Supervisor Reliever">Supervisor Reliever</option>
                              <option value="Patrolling Reliever">Patrolling Reliever</option>
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              required
                              min="1"
                              value={row.quantity || ""}
                              onChange={(e) => updateRelieverRow(idx, "quantity", parseInt(e.target.value, 10))}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              required
                              value={row.sourcePreference || "General Pool"}
                              onChange={(e) => updateRelieverRow(idx, "sourcePreference", e.target.value)}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                            >
                              <option value="Fixed Project Reliever">Fixed Project Reliever</option>
                              <option value="Site Reliever">Site Reliever</option>
                              <option value="General Pool">General Pool</option>
                              <option value="Emergency">Emergency</option>
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={row.remarks || ""}
                              placeholder="Optional notes"
                              onChange={(e) => updateRelieverRow(idx, "remarks", e.target.value)}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => deleteRelieverRow(idx)}
                              className="text-status-error hover:bg-status-error/10 p-1 rounded"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <p className="text-[11px] text-on-surface-variant/70 italic">Relievers are not required for this contract.</p>
            )}
          </div>
        )}

        {/* Shift Requirements Grid (Security Guarding Only) */}
        {isSecurity && (
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Shift Requirements *</h4>
              <button
                type="button"
                onClick={addShiftRow}
                className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">add</span> Add Line
              </button>
            </div>
            {shiftReqs.length === 0 ? (
              <p className="text-[11px] text-on-surface-variant italic py-2">No shift requirements added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                      <th className="pb-2 pr-2 w-36">Shift Name *</th>
                      <th className="pb-2 pr-2 w-28">Start *</th>
                      <th className="pb-2 pr-2 w-28">End *</th>
                      <th className="pb-2 pr-2 w-24">Posts Covered *</th>
                      <th className="pb-2 pr-2 w-32">Days Pattern *</th>
                      <th className="pb-2 pr-2">Remarks</th>
                      <th className="pb-2 w-10 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {shiftReqs.map((row: any, idx: number) => (
                      <tr key={row.id || idx} className="hover:bg-surface-container-lowest/40">
                        <td className="py-2 pr-2">
                          <select
                            required
                            value={row.shiftName || "Day Shift"}
                            onChange={(e) => updateShiftRow(idx, "shiftName", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none font-semibold text-on-surface"
                          >
                            <option value="Day Shift">Day Shift</option>
                            <option value="Night Shift">Night Shift</option>
                            <option value="24 Hours">24 Hours</option>
                            <option value="Custom">Custom</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="time"
                            required
                            value={row.startTime || "07:00"}
                            onChange={(e) => updateShiftRow(idx, "startTime", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="time"
                            required
                            value={row.endTime || "19:00"}
                            onChange={(e) => updateShiftRow(idx, "endTime", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            required
                            min="1"
                            value={row.postsCovered || ""}
                            onChange={(e) => updateShiftRow(idx, "postsCovered", parseInt(e.target.value, 10))}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            required
                            value={row.daysPattern || "Daily"}
                            onChange={(e) => updateShiftRow(idx, "daysPattern", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          >
                            <option value="Daily">Daily</option>
                            <option value="Weekdays">Weekdays</option>
                            <option value="Weekend">Weekend</option>
                            <option value="Custom">Custom</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={row.remarks || ""}
                            placeholder="e.g. main entrance"
                            onChange={(e) => updateShiftRow(idx, "remarks", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => deleteShiftRow(idx)}
                            className="text-status-error hover:bg-status-error/10 p-1 rounded"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Contract Material Line Items Grid (Both SG and FM) */}
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
          <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Contract Materials / Consumables</h4>
            <button
              type="button"
              onClick={addMaterialRow}
              className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[12px]">add</span> Add Material
            </button>
          </div>
          {materialReqs.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant italic py-2">No materials added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                    <th className="pb-2 pr-2">Material / Item Name *</th>
                    <th className="pb-2 pr-2 w-20">Qty *</th>
                    <th className="pb-2 pr-2 w-20">UOM</th>
                    <th className="pb-2 pr-2 w-24">Unit Price *</th>
                    <th className="pb-2 pr-2 w-14 text-center">FOC</th>
                    <th className="pb-2 pr-2 w-24 text-right">Line Total</th>
                    <th className="pb-2 pr-2">Remarks</th>
                    <th className="pb-2 w-8 text-right">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {materialReqs.map((row: any, idx: number) => (
                    <tr key={row.id || idx} className="hover:bg-surface-container-lowest/40">
                      <td className="py-2 pr-2">
                        <select
                          required
                          value={row.materialId || ""}
                          onChange={(e) => updateMaterialRow(idx, "materialId", e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                        >
                          <option value="">Select Material...</option>
                          {allowedMaterials.map((m: any) => (
                            <option key={m.id} value={m.id}>{m.materialName} ({m.materialCode})</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          required
                          min="1"
                          value={row.quantity || ""}
                          onChange={(e) => updateMaterialRow(idx, "quantity", parseInt(e.target.value, 10))}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 pr-2 text-on-surface-variant font-semibold">
                        {row.unitOfMeasure || "Each"}
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={row.unitPrice || 0}
                          onChange={(e) => updateMaterialRow(idx, "unitPrice", parseFloat(e.target.value))}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!row.isFoc}
                          onChange={(e) => updateMaterialRow(idx, "isFoc", e.target.checked)}
                          className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right font-bold text-[11px] text-on-surface">
                        {(row.lineTotal || 0).toFixed(2)}
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={row.remarks || ""}
                          placeholder="Notes"
                          onChange={(e) => updateMaterialRow(idx, "remarks", e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none text-[11px]"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteMaterialRow(idx)}
                          className="text-status-error hover:bg-status-error/10 p-1 rounded"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Contract Totals Summary Card (Both SG and FM) */}
        <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl grid grid-cols-3 gap-6 shadow-sm">
          <div className="col-span-2 space-y-4">
            <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider border-b border-primary/10 pb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">summarize</span> Commercial Summary
            </h4>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs">
              <div className="flex justify-between items-center bg-surface-container-lowest/50 px-3 py-2 rounded-lg border border-outline-variant/20">
                <span className="text-on-surface-variant font-medium">Manpower Value:</span>
                <span className="font-bold text-on-surface text-[13px]">{totalManpowerValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center bg-surface-container-lowest/50 px-3 py-2 rounded-lg border border-outline-variant/20">
                <span className="text-on-surface-variant font-medium">Material Value:</span>
                <span className="font-bold text-on-surface text-[13px]">{totalMaterialValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center bg-surface-container-lowest/50 px-3 py-2 rounded-lg border border-outline-variant/20">
                <span className="text-on-surface-variant font-medium">FOC Manpower:</span>
                <span className="font-bold text-status-warning">{focManpowerCount} guards</span>
              </div>
              <div className="flex justify-between items-center bg-surface-container-lowest/50 px-3 py-2 rounded-lg border border-outline-variant/20">
                <span className="text-on-surface-variant font-medium">FOC Materials:</span>
                <span className="font-bold text-status-warning">{focMaterialCount} items</span>
              </div>
            </div>
            
            <div className="bg-primary/10 border border-primary/20 p-3.5 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Total Contract Value:</span>
              <span className="text-lg font-black text-primary">
                QAR {totalContractValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          
          <div className="border-l border-outline-variant/50 pl-6 space-y-4">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status & Blockers</h5>
            {validationErrors.length > 0 ? (
              <div className="space-y-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-status-error/15 text-status-error border border-status-error/20">
                  Missing Details
                </span>
                <ul className="list-disc pl-3 text-[10px] text-status-error font-medium space-y-1">
                  {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            ) : activeErrors.length > 0 ? (
              <div className="space-y-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-status-warning/15 text-status-warning border border-status-warning/20">
                  Ready as Draft Only
                </span>
                <ul className="list-disc pl-3 text-[10px] text-on-surface-variant space-y-1">
                  {activeErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            ) : (
              <div className="space-y-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-status-success/15 text-status-success border border-status-success/20">
                  Validated & Ready
                </span>
                <p className="text-[10px] text-on-surface-variant italic">All mandatory requirements logged. You can finalize contract activation.</p>
              </div>
            )}
            
            <div className="text-[10px] text-on-surface-variant bg-surface-container-low p-2 rounded-lg border border-outline-variant/30">
              <span className="font-bold text-[9px] block text-on-surface uppercase mb-0.5">Timeline Summary</span>
              <span>{formData.startDate || "—"} to {formData.endDate || "—"}</span>
              <span className="block font-bold text-primary mt-0.5">{formData.totalDurationDays || 0} Days</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low -mx-6 -mb-6 rounded-b-xl mt-4">
          <button
            type="button"
            onClick={() => {
              setShowAddModal(false);
              setEditItem(null);
              setFormData({});
            }}
            className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDraftDisabled}
            onClick={() => handleSaveContract("DRAFT")}
            className={`px-3 py-2 text-xs font-bold rounded-lg border border-outline-variant transition-colors ${
              isDraftDisabled ? "opacity-40 cursor-not-allowed text-on-surface-variant" : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface"
            }`}
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={isCreateDisabled}
            onClick={() => handleSaveContract("ACTIVE")}
            className={`px-3 py-2 text-white text-xs font-bold rounded-lg transition-colors ${
              isCreateDisabled ? "opacity-40 cursor-not-allowed bg-primary/40" : "bg-primary hover:bg-primary-container"
            }`}
          >
            Create Contract
          </button>
        </div>
      </div>
    );
  }  const renderEnhancedCustomerForm = (isEdit: boolean) => {
    const customerType = formData.customerType || "COMPANY";
    
    const handleTypeChange = (newType: string) => {
      if (isEdit) {
        let warnMsg = "Changing the customer type will change the profile layout. ";
        if (formData.contracts?.length > 0 || formData.documents?.length > 0) {
          warnMsg += "Warning: This client already has associated contracts or documents. Are you sure you want to change the customer type?";
        } else {
          warnMsg += "Are you sure you want to proceed?";
        }
        if (!confirm(warnMsg)) return;
      }
      setFormData({
        ...formData,
        customerType: newType
      });
    };
    
    return (
      <div className="space-y-6 text-on-surface">
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Customer Type *</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="radio"
                name="customerType"
                value="COMPANY"
                checked={customerType === "COMPANY"}
                onChange={() => handleTypeChange("COMPANY")}
                className="text-primary focus:ring-primary"
              />
              Company / Corporate
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="radio"
                name="customerType"
                value="INDIVIDUAL"
                checked={customerType === "INDIVIDUAL"}
                onChange={() => handleTypeChange("INDIVIDUAL")}
                className="text-primary focus:ring-primary"
              />
              Individual Customer
            </label>
          </div>
        </div>

        {customerType === "COMPANY" ? (
          <>
            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Basic Company Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Customer Code</label>
                  <input
                    type="text"
                    disabled
                    placeholder={isSecurity ? "Auto-generated (SC-XXXX)" : "Auto-generated (FC-XXXX)"}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                    value={formData.code || ""}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Al Hattab Group"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Trading Name / Short Name</label>
                  <input
                    type="text"
                    placeholder="e.g. AHG"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.tradingName || ""}
                    onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Business Type / Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. Construction, Logistics"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.businessType || ""}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Customer Status</label>
                  <select
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.isActive !== false ? "ACTIVE" : "INACTIVE"}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "ACTIVE" })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="General remarks..."
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.remarks || ""}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Company Address</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Building / Street</label>
                  <input
                    type="text"
                    placeholder="e.g. Building 24, St 950"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.addressLine1 || ""}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Zone</label>
                  <input
                    type="text"
                    placeholder="e.g. Zone 25"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.zone || ""}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Area</label>
                  <input
                    type="text"
                    placeholder="e.g. Mansoura"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.area || ""}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Doha"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Country</label>
                  <input
                    type="text"
                    placeholder="e.g. Qatar"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.country || ""}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">PO Box</label>
                  <input
                    type="text"
                    placeholder="e.g. 12345"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.poBox || ""}
                    onChange={(e) => setFormData({ ...formData, poBox: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Google Map Location / Coordinates</label>
                  <input
                    type="text"
                    placeholder="e.g. 25.276987, 51.520008"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.mapLocation || ""}
                    onChange={(e) => setFormData({ ...formData, mapLocation: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Main Contact Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Company Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +974 4444 5555"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.mainPhone || ""}
                    onChange={(e) => setFormData({ ...formData, mainPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Company Email</label>
                  <input
                    type="email"
                    placeholder="e.g. info@company.com"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.mainEmail || ""}
                    onChange={(e) => setFormData({ ...formData, mainEmail: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Website (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. www.company.com"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.website || ""}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Operation Contact Person</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    placeholder="Name"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.operationContactName || ""}
                    onChange={(e) => setFormData({ ...formData, operationContactName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="Designation"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.operationContactDesignation || ""}
                    onChange={(e) => setFormData({ ...formData, operationContactDesignation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="Mobile"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.operationContactMobile || ""}
                    onChange={(e) => setFormData({ ...formData, operationContactMobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.operationContactEmail || ""}
                    onChange={(e) => setFormData({ ...formData, operationContactEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Finance Contact Person</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Finance Contact Name</label>
                  <input
                    type="text"
                    placeholder="Finance Contact Name"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.financeContactName || ""}
                    onChange={(e) => setFormData({ ...formData, financeContactName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="Finance Mobile"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.financeContactMobile || ""}
                    onChange={(e) => setFormData({ ...formData, financeContactMobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Billing Email</label>
                  <input
                    type="email"
                    placeholder="Billing Email"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.billingEmail || ""}
                    onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Payment Terms</label>
                  <input
                    type="text"
                    placeholder="e.g. Net 30 Days"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.paymentTerms || ""}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Company Registration / Legal Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">CR Number</label>
                  <input
                    type="text"
                    placeholder="CR Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.crNumber || ""}
                    onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">CR Expiry Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.crExpiryDate ? formData.crExpiryDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, crExpiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Tax Number / VAT Number</label>
                  <input
                    type="text"
                    placeholder="Tax/VAT Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.taxNumber || ""}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Establishment Card Number</label>
                  <input
                    type="text"
                    placeholder="Establishment Card Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.establishmentCardNumber || ""}
                    onChange={(e) => setFormData({ ...formData, establishmentCardNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Establishment Card Expiry</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.establishmentCardExpiryDate ? formData.establishmentCardExpiryDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, establishmentCardExpiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Authorized Signatory Name</label>
                  <input
                    type="text"
                    placeholder="Authorized Signatory Name"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.authorizedSignatoryName || ""}
                    onChange={(e) => setFormData({ ...formData, authorizedSignatoryName: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Personal Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Customer Code</label>
                  <input
                    type="text"
                    disabled
                    placeholder={isSecurity ? "Auto-generated (SC-XXXX)" : "Auto-generated (FC-XXXX)"}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                    value={formData.code || ""}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Nationality</label>
                  <input
                    type="text"
                    placeholder="e.g. Qatari, British"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.nationality || ""}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Date of Birth</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.dateOfBirth ? formData.dateOfBirth.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Customer Status</label>
                  <select
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.isActive !== false ? "ACTIVE" : "INACTIVE"}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "ACTIVE" })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="Notes..."
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.remarks || ""}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Individual Address</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Building / Street / Villa</label>
                  <input
                    type="text"
                    placeholder="Villa/Bldg details"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.addressLine1 || ""}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Zone</label>
                  <input
                    type="text"
                    placeholder="Zone"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.zone || ""}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Area</label>
                  <input
                    type="text"
                    placeholder="Area"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.area || ""}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">City</label>
                  <input
                    type="text"
                    placeholder="City"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Contact Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="Mobile Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.mainPhone || ""}
                    onChange={(e) => setFormData({ ...formData, mainPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.mainEmail || ""}
                    onChange={(e) => setFormData({ ...formData, mainEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    placeholder="WhatsApp Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.website || ""}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Identity Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">QID Number</label>
                  <input
                    type="text"
                    placeholder="QID Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.qidNumber || ""}
                    onChange={(e) => setFormData({ ...formData, qidNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">QID Expiry Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.qidExpiryDate ? formData.qidExpiryDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, qidExpiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Passport Number</label>
                  <input
                    type="text"
                    placeholder="Passport Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.passportNumber || ""}
                    onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Passport Expiry</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.passportExpiryDate ? formData.passportExpiryDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, passportExpiryDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
          <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Document Metadata Attachments</h4>
            <button
              type="button"
              onClick={() => {
                const list = formData.documents || [];
                setFormData({
                  ...formData,
                  documents: [...list, { id: `doc-meta-${Date.now()}`, documentType: "Agreement / Contract Document", fileName: "document.pdf", remarks: "" }]
                });
              }}
              className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[12px]">add</span> Add Document Row
            </button>
          </div>
          {(formData.documents || []).length === 0 ? (
            <p className="text-[11px] text-on-surface-variant italic py-2">No document metadata logged.</p>
          ) : (
            <div className="space-y-3">
              {(formData.documents || []).map((doc: any, idx: number) => (
                <div key={doc.id || idx} className="grid grid-cols-4 gap-3 bg-surface-container-lowest border border-outline-variant p-3 rounded-lg relative text-xs">
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Doc Type *</label>
                    <select
                      value={doc.documentType || ""}
                      onChange={(e) => {
                        const list = [...formData.documents];
                        list[idx] = { ...list[idx], documentType: e.target.value };
                        setFormData({ ...formData, documents: list });
                      }}
                      className="w-full bg-surface-container-low border border-outline-variant rounded p-1 text-xs text-on-surface"
                    >
                      <option value="CR Copy">CR Copy</option>
                      <option value="Computer Card / Establishment Card">Establishment Card Copy</option>
                      <option value="Tax Certificate">Tax Certificate</option>
                      <option value="QID Copy">QID Copy</option>
                      <option value="Passport Copy">Passport Copy</option>
                      <option value="Authorized Signatory Document">Signatory Doc</option>
                      <option value="Authorization Letter">Authorization Letter</option>
                      <option value="Agreement / Contract Document">Agreement / Contract</option>
                      <option value="Other Documents">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">File Name</label>
                    <input
                      type="text"
                      value={doc.fileName || ""}
                      onChange={(e) => {
                        const list = [...formData.documents];
                        list[idx] = { ...list[idx], fileName: e.target.value };
                        setFormData({ ...formData, documents: list });
                      }}
                      className="w-full bg-surface-container-low border border-outline-variant rounded p-1 text-xs text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Expiry Date</label>
                    <input
                      type="date"
                      value={doc.expiryDate ? doc.expiryDate.substring(0, 10) : ""}
                      onChange={(e) => {
                        const list = [...formData.documents];
                        list[idx] = { ...list[idx], expiryDate: e.target.value };
                        setFormData({ ...formData, documents: list });
                      }}
                      className="w-full bg-surface-container-low border border-outline-variant rounded p-1 text-xs text-on-surface"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Remarks</label>
                      <input
                        type="text"
                        value={doc.remarks || ""}
                        onChange={(e) => {
                          const list = [...formData.documents];
                          list[idx] = { ...list[idx], remarks: e.target.value };
                          setFormData({ ...formData, documents: list });
                        }}
                        className="w-full bg-surface-container-low border border-outline-variant rounded p-1 text-xs text-on-surface"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const list = [...formData.documents];
                        list.splice(idx, 1);
                        setFormData({ ...formData, documents: list });
                      }}
                      className="text-status-error hover:bg-status-error/10 p-1 rounded mt-3"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Internal Sales Person</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Account Manager Name</label>
              <input
                type="text"
                placeholder="Name"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                value={formData.internalSalesPersonName || ""}
                onChange={(e) => setFormData({ ...formData, internalSalesPersonName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mobile Number</label>
              <input
                type="text"
                placeholder="AM Mobile"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                value={formData.internalSalesPersonMobile || ""}
                onChange={(e) => setFormData({ ...formData, internalSalesPersonMobile: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-surface-container-lowest p-6 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/manpower/${business}/dashboard`}
            className="w-8 h-8 rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-primary">{businessLabel} — {masterLabel}</h1>
            <p className="text-[10px] text-on-surface-variant">Manage master rosters and records for {businessLabel}</p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={() => {
              if (isSecurity && master === "manpower") {
                if (activeSubTab === "licenses") {
                  setShowAddLicenseModal(true);
                  return;
                }
                if (activeSubTab === "gatePasses") {
                  setShowAddGatePassModal(true);
                  return;
                }
                if (activeSubTab === "relieverPools" || activeSubTab === "overtimeLogs") {
                  return;
                }
              }
              setFormData(master === "manpower" ? { mode: "promote", isActive: true } : master === "contracts" ? { status: "DRAFT", manpowerRequirements: [], relieverRequirements: [], shiftRequirements: [], relieverRequired: "No" } : {});
              setFormError("");
              setShowAddModal(true);
            }}
            className={`px-3 py-2 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              isSecurity ? "bg-primary hover:bg-primary-container" : "bg-secondary hover:bg-secondary-container"
            } ${
              (isSecurity && master === "manpower" && (activeSubTab === "relieverPools" || activeSubTab === "overtimeLogs")) ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add {isSecurity && master === "manpower" && activeSubTab === "licenses" ? "Security License" : isSecurity && master === "manpower" && activeSubTab === "gatePasses" ? "Gate Pass" : masterLabel.replace(/s$/, "")}
          </button>
        )}
      </div>

      {/* Sub-tabs for Security Manpower Console */}
      {isSecurity && master === "manpower" && (
        <div className="flex border-b border-outline-variant mb-6 gap-2 bg-surface p-1 rounded-xl">
          {[
            { id: "directory", label: "Directory", icon: "badge" },
            { id: "licenses", label: "MOI Security Licenses", icon: "shield" },
            { id: "gatePasses", label: "Site Gate Passes", icon: "badge_card" },
            { id: "relieverPools", label: "Reliever Assignment", icon: "groups" },
            { id: "overtimeLogs", label: "Overtime / Event History", icon: "schedule" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                setSearchTerm("");
              }}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all rounded-lg ${
                activeSubTab === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm mb-6 flex flex-col gap-3">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              placeholder={`Search ${masterLabel}...`}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-9 pr-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {master === "manpower" && activeSubTab === "directory" && (
            <label className="flex items-center gap-1.5 text-xs text-on-surface cursor-pointer select-none whitespace-nowrap font-bold">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary"
              />
              <span>Include Inactive</span>
            </label>
          )}
        </div>

        {master === "manpower" && activeSubTab === "directory" && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/40 items-center">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mr-1">Enforced Filters:</span>
            {isSecurity ? (
              <>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  Company: AHH Security Services
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  Code: HS01
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  Category: Blue Collar
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  Status: Active
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  Source: Workforce Directory
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  Company: Touch Cleaning & Hospitality
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  Code: TC01
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  Category: Blue Collar
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  Status: Active
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  Source: Workforce Directory
                </span>
              </>
            )}
          </div>
        )}

        {master === "clients" && (
          <div className="flex flex-wrap gap-4 pt-2 border-t border-outline-variant/40 items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Customer Type:</span>
              <select
                className="bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                value={filterCustomerType}
                onChange={(e) => setFilterCustomerType(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="COMPANY">Company</option>
                <option value="INDIVIDUAL">Individual</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status:</span>
              <select
                className="bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        )}
      </div>
      {/* Roster Grid / Projects Panel split */}
      <div className="flex gap-6 flex-1 min-h-0">
        <div className={`bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col ${
          (isSecurity && master === "projects" && selectedProjectId) ? "w-1/2" : "w-full"
        }`}>
          {loading ? (
            <div className="h-64 flex items-center justify-center flex-1">
              <div className={`w-8 h-8 border-4 rounded-full animate-spin border-t-transparent ${isSecurity ? "border-primary" : "border-secondary"}`}></div>
            </div>
          ) : (isSecurity && master === "manpower" && activeSubTab !== "directory") ? (
            renderSecurityComplianceTabs()
          ) : filteredData.length === 0 ? (
            <div className="p-8 text-center text-xs text-on-surface-variant flex-1 flex items-center justify-center">No items found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    {master === "clients" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Customer Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Main Contact</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Operations Contact</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Finance Contact</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Docs</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                      </>
                    )}
                    {master === "contracts" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Contract No.</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Title</th>
                        {isSecurity && (
                          <>
                            <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Manpower Req (Lines / Total)</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Relievers (Req? / Total)</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Shifts</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Addendums</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Start Date</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">End Date</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                      </>
                    )}
                    {master === "projects" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Contract</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                      </>
                    )}
                    {master === "sites" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Worksite Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Radius (Meters)</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Gate Pass Req.</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        {canManage && <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>}
                      </>
                    )}
                    {master === "categories" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Category Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Blue Collar</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Deployable</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Overtime</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">MOI License</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Gate Pass</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        {canManage && <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>}
                      </>
                    )}
                    {(master === "zones" || master === "areas") && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Unit Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Worksite</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Unit Type</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                      </>
                    )}
                    {master === "manpower" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ID</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Duty Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions / Status</th>
                      </>
                    )}
                    {master === "shifts" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Worksite</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Location Unit</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Shift Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Required Count</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                      </>
                    )}
                    {master === "coordinators" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Assignment Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Coordinator</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        {canManage && <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>}
                      </>
                    )}
                    {master === "materials" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">UOM</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Default Unit Price</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Scope</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        {canManage && <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>}
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item: any, idx: number) => (
                    <tr
                      key={item.id || idx}
                      onClick={() => {
                        if (isSecurity && master === "projects") {
                          loadProjectDetails(item.id);
                        }
                      }}
                      className={`border-b border-outline-variant/40 hover:bg-surface-container-lowest cursor-pointer ${
                        (isSecurity && master === "projects" && selectedProjectId === item.id) ? "bg-primary/10 font-bold" : ""
                      }`}
                    >
                      {master === "clients" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.code}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">
                            <div className="font-semibold">{item.name}</div>
                            {item.tradingName && <div className="text-[10px] text-on-surface-variant italic">{item.tradingName}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">{item.customerType || "COMPANY"}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">
                            <div>{item.mainPhone || "—"}</div>
                            <div className="text-[10px]">{item.mainEmail || ""}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface">
                            {item.operationContactName ? (
                              <div>
                                <div className="font-medium">{item.operationContactName}</div>
                                <div className="text-[10px] text-on-surface-variant">{item.operationContactMobile || ""}</div>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface">
                            {item.financeContactName ? (
                              <div>
                                <div className="font-medium">{item.financeContactName}</div>
                                <div className="text-[10px] text-on-surface-variant">{item.financeContactMobile || ""}</div>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface font-bold">
                            {item.documentsCount || (item.documents?.length) || 0} docs
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewClientDetails(item.id);
                              }}
                              className="text-primary hover:underline text-[11px] font-bold mr-3"
                            >
                              View
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(item);
                                  }}
                                  className="text-secondary hover:underline text-[11px] font-bold mr-3"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFormData({ clientId: item.id, status: "DRAFT", manpowerRequirements: [], relieverRequirements: [], shiftRequirements: [], relieverRequired: "No" });
                                    router.push(`/manpower/${business}/contracts`);
                                    setShowAddModal(true);
                                  }}
                                  className="text-status-success hover:underline text-[11px] font-bold mr-3"
                                >
                                  Add Contract
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`Are you sure you want to ${item.isActive ? "deactivate" : "activate"} this client?`)) {
                                      await fetch(apiBase, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ id: item.id, isActive: !item.isActive })
                                      });
                                      loadData();
                                    }
                                  }}
                                  className={`${item.isActive ? "text-status-error" : "text-status-success"} hover:underline text-[11px] font-bold`}
                                >
                                  {item.isActive ? "Deactivate" : "Activate"}
                                </button>
                              </>
                            )}
                          </td>
                        </>
                      )}
                      {master === "contracts" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewContractDetails(item.id);
                              }}
                              className="hover:underline text-left text-primary"
                            >
                              {item.contractNumber}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">{item.client?.name || item.clientId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">{item.title}</td>
                          {isSecurity && (
                            <>
                              <td className="px-4 py-3 text-xs text-on-surface-variant">
                                {item.manpowerLineCount || 0} lines ({item.totalManpower || 0} guards)
                              </td>
                              <td className="px-4 py-3 text-xs text-on-surface-variant">
                                {item.relieverRequired || "No"} ({item.totalRelievers || 0} relievers)
                              </td>
                              <td className="px-4 py-3 text-xs text-on-surface-variant">
                                {item.shiftLineCount || 0} shifts
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3 text-xs text-on-surface-variant font-bold">
                            {item.addendumsCount || (item.addendums?.length) || 0} addendums
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.startDate ? new Date(item.startDate).toLocaleDateString() : ""}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.endDate ? new Date(item.endDate).toLocaleDateString() : ""}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === "ACTIVE" ? "bg-status-success/15 text-status-success" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewContractDetails(item.id);
                              }}
                              className="text-primary hover:underline text-[11px] font-bold mr-3"
                            >
                              View
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(item);
                                  }}
                                  className="text-secondary hover:underline text-[11px] font-bold mr-3"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddendumContract(item);
                                    setAddFormLineItems([]);
                                  }}
                                  className="text-status-warning hover:underline text-[11px] font-bold"
                                >
                                  Add Addendum
                                </button>
                              </>
                            )}
                          </td>
                        </>
                      )}
                      {master === "projects" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.code}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.contract?.title || item.contractId}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </>
                      )}
                      {master === "sites" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.project?.name || item.projectId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.radiusMeters}m</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.gatePassRequired ? "bg-primary-container/10 text-primary" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.gatePassRequired ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={() => startEdit(item)}
                                className="text-primary hover:underline text-[11px] font-bold mr-3"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </>
                      )}
                      {master === "categories" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.code}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isBlueCollar ? "bg-primary-container/10 text-primary" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.isBlueCollar ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isDeployableInRoster ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isDeployableInRoster ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.canWorkOvertime ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.canWorkOvertime ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.requiresMoiLicense ? "bg-primary-container/10 text-primary" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.requiresMoiLicense ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.requiresGatePassCheck ? "bg-primary-container/10 text-primary" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.requiresGatePassCheck ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={() => startEdit(item)}
                                className="text-primary hover:underline text-[11px] font-bold mr-3"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </>
                      )}
                      {(master === "zones" || master === "areas") && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.site?.name || item.siteId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.type}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </>
                      )}
                      {master === "manpower" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.id}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.email}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.manpowerCategoryId || "General"}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.dutyStatus === "ON_DUTY" ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.dutyStatus || "OFF_DUTY"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-right">
                            {item.operationType !== (isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT") ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-status-warning/15 text-status-warning border border-status-warning/20 animate-pulse">
                                  Operation Type Needs Sync
                                </span>
                                {canManage && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSyncOperationType(item);
                                    }}
                                    className="bg-primary hover:bg-primary-hover text-on-primary text-[10px] font-bold px-2 py-1 rounded transition-colors"
                                  >
                                    Sync
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-status-success font-bold">Synced</span>
                            )}
                          </td>
                        </>
                      )}
                      {master === "shifts" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-on-surface">{item.site?.name || item.siteId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.locationUnit?.name || "All Site"}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.category?.name || item.categoryId}</td>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.shiftCode}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant font-bold">{item.requiredCount}</td>
                          <td className="px-4 py-3 text-xs">
                            <button
                              onClick={() => handleDeleteRequirement(item.id)}
                              className="text-status-error hover:underline text-[11px] font-bold"
                            >
                              Delete
                            </button>
                          </td>
                        </>
                      )}
                      {master === "coordinators" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.code}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.project?.name || item.projectId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">
                            {item.coordinatorEmployee?.name || item.coordinator?.name || item.coordinatorEmployeeId}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(item);
                                }}
                                className="text-primary hover:underline text-[11px] font-bold mr-3"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this coordinator assignment?")) {
                                    const res = await fetch(`/api/v1/security/coordinators/${item.id}`, { method: "DELETE" });
                                    if (res.ok) {
                                      loadData();
                                    } else {
                                      alert("Failed to delete coordinator assignment");
                                    }
                                  }
                                }}
                                className="text-status-error hover:underline text-[11px] font-bold"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </>
                      )}
                      {master === "materials" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.materialCode}</td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">{item.materialName}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.materialCategory}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.unitOfMeasure}</td>
                          <td className="px-4 py-3 text-xs text-on-surface font-bold">
                            {item.defaultUnitPrice !== null && item.defaultUnitPrice !== undefined ? item.defaultUnitPrice.toFixed(2) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant font-medium uppercase">{item.operationType}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(item);
                                }}
                                className="text-primary hover:underline text-[11px] font-bold mr-3"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isSecurity && master === "projects" && selectedProjectId && renderProjectDetailsPanel()}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`bg-surface rounded-xl border border-outline-variant shadow-lg overflow-hidden transition-all ${
            (master === "clients" || master === "contracts") ? "max-w-5xl w-full" : "max-w-md w-full"
          }`}>
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-sm font-bold text-primary">Add New {masterLabel.replace(/s$/, "")}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className={`p-6 space-y-4 overflow-y-auto ${
                (master === "clients" || master === "contracts") ? "max-h-[80vh]" : "max-h-[60vh]"
              }`}>
                {formError && (
                  <div className="p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold">
                    {formError}
                  </div>
                )}

                {/* Form fields based on master list */}
                {master === "clients" && renderEnhancedCustomerForm(false)}

                {master === "contracts" && (
                  renderSecurityContractForm()
                )}

                {master === "projects" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.contractId || ""}
                        onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
                      >
                        <option value="">Select Contract...</option>
                        {contracts.map(c => <option key={c.id} value={c.id}>{c.title} ({c.contractNumber})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project Code</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.code || ""}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {master === "sites" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site Code</label>
                      <input
                        type="text"
                        disabled
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                        value={formData.code || ""}
                        placeholder="Auto-generated (SSITE-XXXX)"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.projectId || ""}
                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      >
                        <option value="">Select Project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Latitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                          value={formData.lat || ""}
                          onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                          value={formData.lng || ""}
                          onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Radius (m)</label>
                        <input
                          type="number"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                          value={formData.radiusMeters || "100"}
                          onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer mt-2 font-bold">
                        <input
                          type="checkbox"
                          checked={!!formData.gatePassRequired}
                          onChange={(e) => setFormData({ ...formData, gatePassRequired: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Gate Pass Required for Entry/Exit</span>
                      </label>
                      {formData.gatePassRequired && (
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Gate Pass Validation Mode</label>
                          <select
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                            value={formData.gatePassValidationMode || "WARNING"}
                            onChange={(e) => setFormData({ ...formData, gatePassValidationMode: e.target.value })}
                          >
                            <option value="WARNING">WARNING (Log warning but allow punch)</option>
                            <option value="STRICT">STRICT (Block punch without valid pass)</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks</label>
                        <textarea
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                          rows={2}
                          value={formData.remarks || ""}
                          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                          placeholder="Additional worksite details..."
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked={formData.isActive !== false}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Active Worksite</span>
                      </label>
                    </div>
                  </>
                )}

                {master === "categories" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Code</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.code || ""}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Category Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-outline-variant/40">
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.isBlueCollar}
                          onChange={(e) => setFormData({ ...formData, isBlueCollar: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Blue Collar (Roster-based)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.isDeployableInRoster}
                          onChange={(e) => setFormData({ ...formData, isDeployableInRoster: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Deployable in Roster</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.canWorkOvertime}
                          onChange={(e) => setFormData({ ...formData, canWorkOvertime: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Can Work Overtime</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.requiresMoiLicense}
                          onChange={(e) => setFormData({ ...formData, requiresMoiLicense: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Requires MOI Security Guard License</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.requiresGatePassCheck}
                          onChange={(e) => setFormData({ ...formData, requiresGatePassCheck: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Requires Gate Pass Check</span>
                      </label>
                    </div>
                  </>
                )}

                {(master === "zones" || master === "areas") && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.siteId || ""}
                        onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                      >
                        <option value="">Select Site...</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Unit Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Unit Type</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.type || ""}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      >
                        {isSecurity ? (
                          <>
                            <option value="GATE">Gate</option>
                            <option value="POST">Post</option>
                            <option value="ZONE">Zone</option>
                          </>
                        ) : (
                          <>
                            <option value="AREA">Area</option>
                            <option value="FLOOR">Floor</option>
                            <option value="BLOCK">Block</option>
                            <option value="CLEANING_ZONE">Cleaning Zone</option>
                          </>
                        )}
                      </select>
                    </div>
                  </>
                )}

                {master === "manpower" && (
                  <>
                    <div className="flex gap-4 p-2 bg-surface-container-low rounded-lg border border-outline-variant/60 mb-3">
                      <label className="flex items-center gap-1.5 text-xs text-on-surface cursor-pointer font-bold">
                        <input
                          type="radio"
                          name="manpowerMode"
                          value="promote"
                          checked={formData.mode !== "create"}
                          onChange={() => {
                            setFormData({ mode: "promote", isActive: true });
                          }}
                          className="text-primary focus:ring-primary"
                        />
                        <span>Promote Existing Employee</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-on-surface cursor-pointer font-bold">
                        <input
                          type="radio"
                          name="manpowerMode"
                          value="create"
                          checked={formData.mode === "create"}
                          onChange={() => {
                            setFormData({ mode: "create", isActive: true });
                          }}
                          className="text-primary focus:ring-primary"
                        />
                        <span>Create New Employee</span>
                      </label>
                    </div>

                    {formData.mode !== "create" ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Select Employee to Promote</label>
                          <select
                            required
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                            value={formData.id || ""}
                            onChange={(e) => {
                              const emp = workforceEmployees.find(emp => emp.id === e.target.value);
                              if (emp) {
                                setFormData({
                                  ...formData,
                                  id: emp.id,
                                  name: emp.name,
                                  email: emp.email,
                                  mode: "promote"
                                });
                              } else {
                                setFormData({ ...formData, id: "", name: "", email: "", mode: "promote" });
                              }
                            }}
                          >
                            <option value="">-- Choose Employee --</option>
                            {workforceEmployees
                              .filter(emp => {
                                const normalizeCategory = (cat?: string) => {
                                  if (!cat) return "";
                                  return cat.trim().toUpperCase().replace(/[\s_-]+/g, "_");
                                };
                                const normalizeCompanyCode = (code?: string) => {
                                  if (!code) return "";
                                  return code.trim().toUpperCase();
                                };
                                
                                const empCompanyCode = normalizeCompanyCode(emp.company?.companyCode || emp.companyCode);
                                const empCategory = normalizeCategory(emp.employeeCategory);
                                const targetCompanyCode = isSecurity ? "HS01" : "TC01";
                                const targetOperationType = isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";

                                return (
                                  empCompanyCode === targetCompanyCode &&
                                  empCategory === "BLUE_COLLAR" &&
                                  (emp.isActive === true || emp.status === "Active" || emp.employmentStatus === "ACTIVE") &&
                                  emp.operationType !== targetOperationType
                                );
                              })
                              .map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                              ))
                            }
                          </select>
                        </div>
                        {formData.id && (
                          <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/60 space-y-1 text-xs text-on-surface-variant">
                            <p><span className="font-bold text-on-surface">ID:</span> {formData.id}</p>
                            <p><span className="font-bold text-on-surface">Name:</span> {formData.name}</p>
                            <p><span className="font-bold text-on-surface">Email:</span> {formData.email}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Employee ID</label>
                          <input
                            type="text"
                            required
                            placeholder={`e.g. ${isSecurity ? "SEC" : "FM"}-001`}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                            value={formData.id || ""}
                            onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Display Name</label>
                          <input
                            type="text"
                            required
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                            value={formData.name || ""}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Email</label>
                          <input
                            type="email"
                            required
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                            value={formData.email || ""}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Manpower Category</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.manpowerCategoryId || ""}
                        onChange={(e) => setFormData({ ...formData, manpowerCategoryId: e.target.value })}
                      >
                        <option value="">Select Category...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                      </select>
                    </div>
                  </>
                )}

                {master === "coordinators" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.projectId || ""}
                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      >
                        <option value="">Select Project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Coordinator Employee</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.coordinatorEmployeeId || ""}
                        onChange={(e) => setFormData({ ...formData, coordinatorEmployeeId: e.target.value })}
                      >
                        <option value="">Select Coordinator...</option>
                        {workforceEmployees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={formData.isActive !== false}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      <span>Active Assignment</span>
                    </label>
                  </>
                )}
                {master === "materials" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Material Name *</label>
                      <input
                        required
                        type="text"
                        placeholder="Material Name"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.materialName || ""}
                        onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Category *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.materialCategory || ""}
                        onChange={(e) => setFormData({ ...formData, materialCategory: e.target.value })}
                      >
                        <option value="">Select Category...</option>
                        <option value="Uniform">Uniform</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Vehicle">Vehicle</option>
                        <option value="Consumable">Consumable</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Unit of Measure (UOM) *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.unitOfMeasure || ""}
                        onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                      >
                        <option value="">Select UOM...</option>
                        <option value="Each">Each</option>
                        <option value="Pack">Pack</option>
                        <option value="Set">Set</option>
                        <option value="Pair">Pair</option>
                        <option value="Month">Month</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Default Unit Price</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.defaultUnitPrice === null || formData.defaultUnitPrice === undefined ? "" : formData.defaultUnitPrice}
                        onChange={(e) => setFormData({ ...formData, defaultUnitPrice: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Scope / Operation Type *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.operationType || "SHARED"}
                        onChange={(e) => setFormData({ ...formData, operationType: e.target.value })}
                      >
                        <option value="SHARED">SHARED</option>
                        <option value="SECURITY_GUARDING">SECURITY_GUARDING</option>
                        <option value="FACILITY_MANAGEMENT">FACILITY_MANAGEMENT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks</label>
                      <textarea
                        placeholder="Remarks"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.remarks || ""}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="materialIsActive"
                        checked={formData.isActive !== false}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      />
                      <label htmlFor="materialIsActive" className="text-xs text-on-surface">Active</label>
                    </div>
                  </>
                )}

                {master === "shifts" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Worksite</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.siteId || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, siteId: val, locationUnitId: "" });
                        }}
                      >
                        <option value="">Select Site...</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site Zone / Unit (Optional)</label>
                      <select
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.locationUnitId || ""}
                        onChange={(e) => setFormData({ ...formData, locationUnitId: e.target.value })}
                        disabled={!formData.siteId}
                      >
                        <option value="">All Site / General</option>
                        {locationUnits.filter((u: any) => u.siteId === formData.siteId).map((u: any) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.type})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Manpower Category</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.categoryId || ""}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      >
                        <option value="">Select Category...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Shift Reference Code</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.shiftCode || ""}
                        onChange={(e) => setFormData({ ...formData, shiftCode: e.target.value })}
                      >
                        <option value="">Select Shift Reference...</option>
                        {shiftsList.map(s => <option key={s.id} value={s.code}>{s.name} ({s.code}: {s.startTime}-{s.endTime})</option>)}
                        <option value="GEN-001">GEN-001 (General 9:00 - 18:00)</option>
                        <option value="SHF-DS-01">SHF-DS-01 (Day Shift 07:00 - 19:00)</option>
                        <option value="SHF-NS-02">SHF-NS-02 (Night Shift 19:00 - 07:00)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Required Headcount</label>
                      <input
                        type="number"
                        required
                        min="1"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.requiredCount || "1"}
                        onChange={(e) => setFormData({ ...formData, requiredCount: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
              {master !== "contracts" && (
                <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-3 py-2 text-white text-xs font-bold rounded-lg transition-colors ${
                      isSecurity ? "bg-primary hover:bg-primary-container" : "bg-secondary hover:bg-secondary-container"
                    }`}
                  >
                    Create
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editItem && (
        master === "contracts" ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-surface rounded-xl border border-outline-variant shadow-lg max-w-5xl w-full overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                <h3 className="text-sm font-bold text-primary">Edit Contract</h3>
                <button onClick={() => { setEditItem(null); setFormData({}); }} className="text-on-surface-variant hover:text-primary">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[80vh]">
                {renderSecurityContractForm()}
              </div>
            </div>
          </div>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={`bg-surface rounded-xl border border-outline-variant shadow-lg overflow-hidden transition-all ${
              master === "clients" ? "max-w-5xl w-full" : "max-w-md w-full"
            }`}>
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                <h3 className="text-sm font-bold text-primary">Edit {masterLabel.replace(/s$/, "")}</h3>
                <button onClick={() => { setEditItem(null); setFormData({}); }} className="text-on-surface-variant hover:text-primary">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className={`p-6 space-y-4 overflow-y-auto ${
                  master === "clients" ? "max-h-[80vh]" : "max-h-[60vh]"
                }`}>
                  {formError && (
                    <div className="p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold">
                      {formError}
                    </div>
                  )}

                  {/* Form fields based on master list */}
                  {master === "clients" && renderEnhancedCustomerForm(true)}

                {master === "contracts" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Client</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.clientId || ""}
                        onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      >
                        <option value="">Select Client...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract Number</label>
                      <input
                        type="text"
                        disabled
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                        value={formData.contractNumber || ""}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract Title</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.title || ""}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Start Date</label>
                        <input
                          type="date"
                          required
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.startDate ? formData.startDate.substring(0, 10) : ""}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">End Date</label>
                        <input
                          type="date"
                          required
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.endDate ? formData.endDate.substring(0, 10) : ""}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {master === "projects" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.contractId || ""}
                        onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
                      >
                        <option value="">Select Contract...</option>
                        {contracts.map(c => <option key={c.id} value={c.id}>{c.title} ({c.contractNumber})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project Code</label>
                      <input
                        type="text"
                        required
                        disabled
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                        value={formData.code || ""}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {master === "sites" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site Code</label>
                      <input
                        type="text"
                        disabled
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                        value={formData.code || ""}
                        placeholder="Auto-generated (SSITE-XXXX)"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.projectId || ""}
                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      >
                        <option value="">Select Project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Latitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                          value={formData.lat || ""}
                          onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                          value={formData.lng || ""}
                          onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Radius (m)</label>
                        <input
                          type="number"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                          value={formData.radiusMeters || "100"}
                          onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer mt-2 font-bold">
                        <input
                          type="checkbox"
                          checked={!!formData.gatePassRequired}
                          onChange={(e) => setFormData({ ...formData, gatePassRequired: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Gate Pass Required for Entry/Exit</span>
                      </label>
                      {formData.gatePassRequired && (
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Gate Pass Validation Mode</label>
                          <select
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                            value={formData.gatePassValidationMode || "WARNING"}
                            onChange={(e) => setFormData({ ...formData, gatePassValidationMode: e.target.value })}
                          >
                            <option value="WARNING">WARNING (Log warning but allow punch)</option>
                            <option value="STRICT">STRICT (Block punch without valid pass)</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks</label>
                        <textarea
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                          rows={2}
                          value={formData.remarks || ""}
                          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                          placeholder="Additional worksite details..."
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked={formData.isActive !== false}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Active Worksite</span>
                      </label>
                    </div>
                  </>
                )}

                {master === "categories" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Code</label>
                      <input
                        type="text"
                        required
                        disabled
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                        value={formData.code || ""}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Category Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-outline-variant/40">
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.isBlueCollar}
                          onChange={(e) => setFormData({ ...formData, isBlueCollar: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Blue Collar (Roster-based)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.isDeployableInRoster}
                          onChange={(e) => setFormData({ ...formData, isDeployableInRoster: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Deployable in Roster</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.canWorkOvertime}
                          onChange={(e) => setFormData({ ...formData, canWorkOvertime: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Can Work Overtime</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.requiresMoiLicense}
                          onChange={(e) => setFormData({ ...formData, requiresMoiLicense: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Requires MOI Security Guard License</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.requiresGatePassCheck}
                          onChange={(e) => setFormData({ ...formData, requiresGatePassCheck: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Requires Gate Pass Check</span>
                      </label>
                    </div>
                  </>
                )}

                {master === "coordinators" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.projectId || ""}
                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      >
                        <option value="">Select Project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Coordinator Employee</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.coordinatorEmployeeId || ""}
                        onChange={(e) => setFormData({ ...formData, coordinatorEmployeeId: e.target.value })}
                      >
                        <option value="">Select Coordinator...</option>
                        {workforceEmployees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {master === "materials" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Material Name *</label>
                      <input
                        required
                        type="text"
                        placeholder="Material Name"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.materialName || ""}
                        onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Category *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.materialCategory || ""}
                        onChange={(e) => setFormData({ ...formData, materialCategory: e.target.value })}
                      >
                        <option value="">Select Category...</option>
                        <option value="Uniform">Uniform</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Vehicle">Vehicle</option>
                        <option value="Consumable">Consumable</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Unit of Measure (UOM) *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.unitOfMeasure || ""}
                        onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                      >
                        <option value="">Select UOM...</option>
                        <option value="Each">Each</option>
                        <option value="Pack">Pack</option>
                        <option value="Set">Set</option>
                        <option value="Pair">Pair</option>
                        <option value="Month">Month</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Default Unit Price</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.defaultUnitPrice === null || formData.defaultUnitPrice === undefined ? "" : formData.defaultUnitPrice}
                        onChange={(e) => setFormData({ ...formData, defaultUnitPrice: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Scope / Operation Type *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.operationType || "SHARED"}
                        onChange={(e) => setFormData({ ...formData, operationType: e.target.value })}
                      >
                        <option value="SHARED">SHARED</option>
                        <option value="SECURITY_GUARDING">SECURITY_GUARDING</option>
                        <option value="FACILITY_MANAGEMENT">FACILITY_MANAGEMENT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks</label>
                      <textarea
                        placeholder="Remarks"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.remarks || ""}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* Add Status Option for Edits */}
                <div className="pt-2 border-t border-outline-variant/40">
                  <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span>Active Status</span>
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => { setEditItem(null); setFormData({}); }}
                  className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-3 py-2 text-white text-xs font-bold rounded-lg transition-colors ${
                    isSecurity ? "bg-primary hover:bg-primary-container" : "bg-secondary hover:bg-secondary-container"
                  }`}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )
    )}

      {/* Client Detail Drawer */}
      {selectedClientDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 p-0 transition-opacity">
          <div className="bg-surface w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden text-on-surface">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider mr-2">
                  {selectedClientDetail.customerType}
                </span>
                <h3 className="text-base font-bold text-primary inline-block">{selectedClientDetail.name} ({selectedClientDetail.code})</h3>
              </div>
              <button 
                onClick={() => setSelectedClientDetail(null)} 
                className="text-on-surface-variant hover:text-primary w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2 text-xs">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Profile Details</h4>
                  {selectedClientDetail.customerType === "COMPANY" ? (
                    <>
                      <p><span className="text-on-surface-variant font-medium">Trading Name:</span> <span className="font-semibold">{selectedClientDetail.tradingName || "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">Industry Type:</span> <span className="font-semibold">{selectedClientDetail.businessType || "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">CR Number:</span> <span className="font-semibold">{selectedClientDetail.crNumber || "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">CR Expiry:</span> <span className="font-semibold">{selectedClientDetail.crExpiryDate ? new Date(selectedClientDetail.crExpiryDate).toLocaleDateString() : "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">Establishment Card:</span> <span className="font-semibold">{selectedClientDetail.establishmentCardNumber || "N/A"}</span></p>
                    </>
                  ) : (
                    <>
                      <p><span className="text-on-surface-variant font-medium">Nationality:</span> <span className="font-semibold">{selectedClientDetail.nationality || "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">Date of Birth:</span> <span className="font-semibold">{selectedClientDetail.dateOfBirth ? new Date(selectedClientDetail.dateOfBirth).toLocaleDateString() : "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">QID Number:</span> <span className="font-semibold">{selectedClientDetail.qidNumber || "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">QID Expiry:</span> <span className="font-semibold">{selectedClientDetail.qidExpiryDate ? new Date(selectedClientDetail.qidExpiryDate).toLocaleDateString() : "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">Passport Number:</span> <span className="font-semibold">{selectedClientDetail.passportNumber || "N/A"}</span></p>
                    </>
                  )}
                  <p><span className="text-on-surface-variant font-medium">Status:</span> 
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${selectedClientDetail.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                      {selectedClientDetail.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
                
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2 text-xs">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Main Contacts</h4>
                  <p><span className="text-on-surface-variant font-medium">Phone:</span> <span className="font-semibold">{selectedClientDetail.mainPhone || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Email:</span> <span className="font-semibold">{selectedClientDetail.mainEmail || "N/A"}</span></p>
                  {selectedClientDetail.customerType === "COMPANY" ? (
                    <p><span className="text-on-surface-variant font-medium">Website:</span> <span className="font-semibold">{selectedClientDetail.website || "N/A"}</span></p>
                  ) : (
                    <p><span className="text-on-surface-variant font-medium">WhatsApp:</span> <span className="font-semibold">{selectedClientDetail.website || "N/A"}</span></p>
                  )}
                  <p><span className="text-on-surface-variant font-medium">PO Box:</span> <span className="font-semibold">{selectedClientDetail.poBox || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Address:</span> <span className="font-semibold">
                    {[selectedClientDetail.addressLine1, selectedClientDetail.zone, selectedClientDetail.area, selectedClientDetail.city].filter(Boolean).join(", ") || "N/A"}
                  </span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2 text-xs">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Day-to-Day Operations Contact</h4>
                  <p><span className="text-on-surface-variant font-medium">Name:</span> <span className="font-semibold">{selectedClientDetail.operationContactName || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Designation:</span> <span className="font-semibold">{selectedClientDetail.operationContactDesignation || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Mobile:</span> <span className="font-semibold">{selectedClientDetail.operationContactMobile || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Email:</span> <span className="font-semibold">{selectedClientDetail.operationContactEmail || "N/A"}</span></p>
                </div>
                
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2 text-xs">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Finance & Billing Contact</h4>
                  <p><span className="text-on-surface-variant font-medium">Name:</span> <span className="font-semibold">{selectedClientDetail.financeContactName || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Mobile:</span> <span className="font-semibold">{selectedClientDetail.financeContactMobile || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Billing Email:</span> <span className="font-semibold">{selectedClientDetail.billingEmail || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Payment Terms:</span> <span className="font-semibold">{selectedClientDetail.paymentTerms || "N/A"}</span></p>
                </div>
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2 text-xs">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Internal Sales Person / Account Manager</h4>
                <p><span className="text-on-surface-variant font-medium">Account Manager:</span> <span className="font-semibold">{selectedClientDetail.internalSalesPersonName || "N/A"}</span></p>
                <p><span className="text-on-surface-variant font-medium">Mobile:</span> <span className="font-semibold">{selectedClientDetail.internalSalesPersonMobile || "N/A"}</span></p>
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Linked Contracts</h4>
                {(!selectedClientDetail.contracts || selectedClientDetail.contracts.length === 0) ? (
                  <p className="text-[11px] text-on-surface-variant italic">No contracts associated with this customer yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedClientDetail.contracts.map((c: any) => (
                      <div key={c.id} className="flex justify-between items-center bg-surface-container-lowest p-2 border border-outline-variant rounded-lg text-xs">
                        <div>
                          <p className="font-bold text-primary">{c.title} ({c.contractNumber})</p>
                          <p className="text-[10px] text-on-surface-variant">Duration: {new Date(c.startDate).toLocaleDateString()} to {new Date(c.endDate).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === "ACTIVE" ? "bg-status-success/15 text-status-success" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Uploaded Document Metadata</h4>
                {(!selectedClientDetail.documents || selectedClientDetail.documents.length === 0) ? (
                  <p className="text-[11px] text-on-surface-variant italic">No documents attached.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                          <th className="pb-2">Document Type</th>
                          <th className="pb-2">File Name</th>
                          <th className="pb-2">Expiry Date</th>
                          <th className="pb-2">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClientDetail.documents.map((d: any) => (
                          <tr key={d.id} className="border-b border-outline-variant/30 hover:bg-surface-container-lowest">
                            <td className="py-2 font-medium text-on-surface">{d.documentType}</td>
                            <td className="py-2 text-on-surface-variant italic">{d.fileName}</td>
                            <td className="py-2 text-on-surface-variant">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : "N/A"}</td>
                            <td className="py-2 text-on-surface-variant">{d.remarks || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant flex justify-end bg-surface-container-low">
              <button 
                onClick={() => setSelectedClientDetail(null)} 
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-container transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Detail Drawer */}
      {selectedContractDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 p-0 transition-opacity">
          <div className="bg-surface w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden text-on-surface">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider mr-2">
                  Contract
                </span>
                <h3 className="text-base font-bold text-primary inline-block">{selectedContractDetail.title} ({selectedContractDetail.contractNumber})</h3>
              </div>
              <button 
                onClick={() => setSelectedContractDetail(null)} 
                className="text-on-surface-variant hover:text-primary w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-6 flex-1 overflow-y-auto text-xs">
              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Contract Summary</h4>
                <p><span className="text-on-surface-variant font-medium">Client:</span> <span className="font-semibold">{selectedContractDetail.client?.name || selectedContractDetail.clientId}</span></p>
                <p><span className="text-on-surface-variant font-medium">Duration:</span> <span className="font-semibold">{new Date(selectedContractDetail.startDate).toLocaleDateString()} to {new Date(selectedContractDetail.endDate).toLocaleDateString()}</span></p>
                <p><span className="text-on-surface-variant font-medium">Status:</span> 
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${selectedContractDetail.status === "ACTIVE" ? "bg-status-success/15 text-status-success" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                    {selectedContractDetail.status}
                  </span>
                </p>
                {selectedContractDetail.remarks && <p><span className="text-on-surface-variant font-medium">Remarks:</span> <span>{selectedContractDetail.remarks}</span></p>}
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Manpower Requirements</h4>
                {(!selectedContractDetail.manpowerRequirements || selectedContractDetail.manpowerRequirements.length === 0) ? (
                  <p className="text-[11px] text-on-surface-variant italic">No manpower requirements logged.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                          <th className="pb-2">Position</th>
                          <th className="pb-2">Quantity</th>
                          <th className="pb-2">Deployment Type</th>
                          <th className="pb-2">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedContractDetail.manpowerRequirements.map((mr: any) => (
                          <tr key={mr.id} className="border-b border-outline-variant/30 hover:bg-surface-container-lowest">
                            <td className="py-2 font-medium text-on-surface">{mr.position}</td>
                            <td className="py-2 text-on-surface-variant font-bold">{mr.quantity}</td>
                            <td className="py-2 text-on-surface-variant">{mr.deploymentType}</td>
                            <td className="py-2 text-on-surface-variant">{mr.remarks || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Reliever Requirements</h4>
                {(!selectedContractDetail.relieverRequirements || selectedContractDetail.relieverRequirements.length === 0) ? (
                  <p className="text-[11px] text-on-surface-variant italic">No reliever requirements logged.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                          <th className="pb-2">Position</th>
                          <th className="pb-2">Quantity</th>
                          <th className="pb-2">Source Preference</th>
                          <th className="pb-2">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedContractDetail.relieverRequirements.map((rr: any) => (
                          <tr key={rr.id} className="border-b border-outline-variant/30 hover:bg-surface-container-lowest">
                            <td className="py-2 font-medium text-on-surface">{rr.position}</td>
                            <td className="py-2 text-on-surface-variant font-bold">{rr.quantity}</td>
                            <td className="py-2 text-on-surface-variant">{rr.sourcePreference}</td>
                            <td className="py-2 text-on-surface-variant">{rr.remarks || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Shift Requirements</h4>
                {(!selectedContractDetail.shiftRequirements || selectedContractDetail.shiftRequirements.length === 0) ? (
                  <p className="text-[11px] text-on-surface-variant italic">No shift requirements logged.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                          <th className="pb-2">Shift Name</th>
                          <th className="pb-2">Times</th>
                          <th className="pb-2">Posts Covered</th>
                          <th className="pb-2">Days Pattern</th>
                          <th className="pb-2">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedContractDetail.shiftRequirements.map((sr: any) => (
                          <tr key={sr.id} className="border-b border-outline-variant/30 hover:bg-surface-container-lowest">
                            <td className="py-2 font-medium text-on-surface">{sr.shiftName}</td>
                            <td className="py-2 text-on-surface-variant">{sr.startTime} - {sr.endTime}</td>
                            <td className="py-2 text-on-surface-variant font-bold">{sr.postsCovered}</td>
                            <td className="py-2 text-on-surface-variant">{sr.daysPattern}</td>
                            <td className="py-2 text-on-surface-variant">{sr.remarks || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Contract Addendums / Revisions</h4>
                {(!selectedContractDetail.addendums || selectedContractDetail.addendums.length === 0) ? (
                  <p className="text-[11px] text-on-surface-variant italic">No addendums logged for this contract.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedContractDetail.addendums.map((a: any) => (
                      <div key={a.id} className="bg-surface-container-lowest border border-outline-variant p-3 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-primary">{a.title} ({a.addendumNumber})</p>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${a.status === "ACTIVE" ? "bg-status-success/15 text-status-success" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                            {a.status}
                          </span>
                        </div>
                        <p><span className="text-on-surface-variant font-semibold">Type:</span> {a.addendumType}</p>
                        <p><span className="text-on-surface-variant font-semibold">Effective From:</span> {new Date(a.effectiveFrom).toLocaleDateString()}</p>
                        {a.commercialImpact && <p><span className="text-on-surface-variant font-semibold">Commercial Impact:</span> {a.commercialImpact}</p>}
                        {a.description && <p className="text-on-surface-variant italic">{a.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-outline-variant flex justify-end bg-surface-container-low">
              <button 
                onClick={() => setSelectedContractDetail(null)} 
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-container transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Addendum Modal */}
      {addendumContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg max-w-lg w-full overflow-hidden text-on-surface">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-sm font-bold text-primary">Add Contract Addendum</h3>
              <button onClick={() => setAddendumContract(null)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch(`/api/v1/manpower/${business}/contracts/${addendumContract.id}/addendums`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...addendumForm,
                    contractNumber: addendumContract.contractNumber
                  })
                });
                if (res.ok) {
                  setAddendumContract(null);
                  setAddendumForm({
                    title: "",
                    addendumType: "Manpower Increase",
                    addendumDate: new Date().toISOString().substring(0, 10),
                    effectiveFrom: new Date().toISOString().substring(0, 10),
                    description: "",
                    commercialImpact: "",
                    status: "DRAFT"
                  });
                  loadData();
                } else {
                  alert("Failed to save addendum");
                }
              } catch (err) {
                alert("Network error");
              }
            }}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract</label>
                  <input
                    type="text"
                    disabled
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-on-surface-variant"
                    value={`${addendumContract.title} (${addendumContract.contractNumber})`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Addendum Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Revised Rate and Guard Count"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface"
                    value={addendumForm.title || ""}
                    onChange={(e) => setAddendumForm({ ...addendumForm, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Addendum Date *</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface"
                      value={addendumForm.addendumDate || ""}
                      onChange={(e) => setAddendumForm({ ...addendumForm, addendumDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Effective From *</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface"
                      value={addendumForm.effectiveFrom || ""}
                      onChange={(e) => setAddendumForm({ ...addendumForm, effectiveFrom: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Addendum Type *</label>
                  <select
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface"
                    value={addendumForm.addendumType || "Manpower Increase"}
                    onChange={(e) => setAddendumForm({ ...addendumForm, addendumType: e.target.value })}
                  >
                    <option value="Manpower Increase">Manpower Increase</option>
                    <option value="Manpower Reduction">Manpower Reduction</option>
                    <option value="Rate Change">Rate Change</option>
                    <option value="Shift Change">Shift Change</option>
                    <option value="Site Addition">Site Addition</option>
                    <option value="Site Removal">Site Removal</option>
                    <option value="Reliever Change">Reliever Change</option>
                    <option value="Contract Extension">Contract Extension</option>
                    <option value="Contract Termination">Contract Termination</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Description / Reason</label>
                  <textarea
                    placeholder="Provide details..."
                    rows={3}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface resize-none"
                    value={addendumForm.description || ""}
                    onChange={(e) => setAddendumForm({ ...addendumForm, description: e.target.value })}
                  />
                  <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Commercial Impact / Revised Rates</label>
                  <input
                    type="text"
                    placeholder="e.g. +QAR 5,000 / month"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface"
                    value={addendumForm.commercialImpact || ""}
                    onChange={(e) => setAddendumForm({ ...addendumForm, commercialImpact: e.target.value })}
                  />
                </div>

                {/* Addendum Line Items Grid */}
                <div className="bg-surface-container border border-outline-variant p-3.5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1.5">
                    <span className="block text-[10px] font-bold text-primary uppercase tracking-wider">Addendum Commercial Impact Lines</span>
                    <button
                      type="button"
                      onClick={addAddendumLine}
                      className="px-2 py-0.5 bg-primary text-white text-[9px] font-bold rounded flex items-center gap-0.5 hover:bg-primary-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[10px]">add</span> Add Line
                    </button>
                  </div>
                  {addFormLineItems.length === 0 ? (
                    <p className="text-[10px] text-on-surface-variant italic py-1">No impact lines added yet (standard/flat commercial impact).</p>
                  ) : (
                    <div className="space-y-2">
                      {addFormLineItems.map((row: any, idx: number) => (
                        <div key={row.id || idx} className="grid grid-cols-12 gap-1.5 items-center bg-surface-container-low p-2 rounded-lg border border-outline-variant/30 text-on-surface">
                          <div className="col-span-2">
                            <label className="block text-[8px] font-bold text-on-surface-variant uppercase mb-0.5">Type</label>
                            <select
                              value={row.itemType || "MANPOWER"}
                              onChange={(e) => updateAddendumLine(idx, "itemType", e.target.value)}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-0.5 text-[10px] focus:outline-none text-on-surface"
                            >
                              <option value="MANPOWER">Manpower</option>
                              <option value="MATERIAL">Material</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[8px] font-bold text-on-surface-variant uppercase mb-0.5">Action</label>
                            <select
                              value={row.action || "ADD"}
                              onChange={(e) => updateAddendumLine(idx, "action", e.target.value)}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-0.5 text-[10px] focus:outline-none text-on-surface"
                            >
                              <option value="ADD">Add</option>
                              <option value="REMOVE">Remove</option>
                              <option value="UPDATE">Update</option>
                            </select>
                          </div>
                          <div className="col-span-3">
                            <label className="block text-[8px] font-bold text-on-surface-variant uppercase mb-0.5">Item Label *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Guard Rate"
                              value={row.label || ""}
                              onChange={(e) => updateAddendumLine(idx, "label", e.target.value)}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-0.5 text-[10px] focus:outline-none text-on-surface"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-[8px] font-bold text-on-surface-variant uppercase mb-0.5">Qty</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={row.quantity || 1}
                              onChange={(e) => updateAddendumLine(idx, "quantity", parseInt(e.target.value, 10))}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-0.5 py-0.5 text-[10px] focus:outline-none text-center text-on-surface"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[8px] font-bold text-on-surface-variant uppercase mb-0.5">Price</label>
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              value={row.unitPrice || 0}
                              onChange={(e) => updateAddendumLine(idx, "unitPrice", parseFloat(e.target.value))}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-0.5 py-0.5 text-[10px] focus:outline-none text-right text-on-surface"
                            />
                          </div>
                          <div className="col-span-1 text-right font-bold text-[9px] text-on-surface pt-2 pr-1">
                            {(row.lineTotal || 0).toFixed(0)}
                          </div>
                          <div className="col-span-1 text-right pt-2">
                            <button
                              type="button"
                              onClick={() => deleteAddendumLine(idx)}
                              className="text-status-error hover:bg-status-error/10 p-0.5 rounded"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Status</label>
                  <select
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface"
                    value={addendumForm.status || "DRAFT"}
                    onChange={(e) => setAddendumForm({ ...addendumForm, status: e.target.value })}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="APPROVED">Approved</option>
                    <option value="ACTIVE">Active</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => setAddendumContract(null)}
                  className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 text-white bg-primary hover:bg-primary-container text-xs font-bold rounded-lg transition-colors"
                >
                  Save Addendum
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Security License Modal */}
      {showAddLicenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg max-w-md w-full overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-sm font-black text-primary">Record MOI Security License</h3>
              <button onClick={() => setShowAddLicenseModal(false)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleAddLicenseSubmit}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Select Security Guard</label>
                  <select
                    name="employeeId"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="">-- Choose Guard --</option>
                    {data.filter((e: any) => e.manpowerCategoryId === "SECURITY_GUARD" || e.manpowerCategoryId === "SENIOR_GUARD" || !e.manpowerCategoryId).map((emp: any) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">License Number</label>
                  <input
                    type="text"
                    name="licenseNumber"
                    disabled
                    placeholder="Auto-generated (SLIC-XXXX)"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Issue Date</label>
                  <input
                    type="date"
                    name="issueDate"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Expiry Date</label>
                  <input
                    type="date"
                    name="expiryDate"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => setShowAddLicenseModal(false)}
                  className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-variant transition-colors"
                >
                  Record License
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Gate Pass Modal */}
      {showAddGatePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg max-w-md w-full overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-sm font-black text-primary">Record Site Gate Pass</h3>
              <button onClick={() => setShowAddGatePassModal(false)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleAddGatePassSubmit}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Select Security Guard</label>
                  <select
                    name="employeeId"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="">-- Choose Guard --</option>
                    {data.filter((e: any) => e.manpowerCategoryId === "SECURITY_GUARD" || e.manpowerCategoryId === "SENIOR_GUARD" || !e.manpowerCategoryId).map((emp: any) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Select Worksite</label>
                  <select
                    name="siteId"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="">-- Choose Worksite --</option>
                    {sites.map((site: any) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Gate Pass Number</label>
                  <input
                    type="text"
                    name="passNumber"
                    disabled
                    placeholder="Auto-generated (SGP-XXXX)"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Issue Date</label>
                  <input
                    type="date"
                    name="issueDate"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Expiry Date</label>
                  <input
                    type="date"
                    name="expiryDate"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => setShowAddGatePassModal(false)}
                  className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-variant transition-colors"
                >
                  Record Gate Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
