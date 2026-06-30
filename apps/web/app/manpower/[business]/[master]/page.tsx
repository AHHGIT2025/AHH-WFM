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

  const startEdit = (item: any) => {
    setEditItem(item);
    setFormData({ ...item });
    setFormError("");
  };

  // Permission Checks
  const canView = hasPermission(session?.user as any, "manpower.admin.full_access") ||
                  hasPermission(session?.user as any, isSecurity ? "manpower.security.view" : "manpower.fm.view");
  const canManage = hasPermission(session?.user as any, "manpower.admin.full_access") ||
                    hasPermission(session?.user as any, isSecurity ? "manpower.security.manage" : "manpower.fm.manage");

  const apiBase = master === "coordinators"
    ? `/api/v1/security/coordinators`
    : `/api/v1/manpower/${business}/${master === "areas" ? "areas" : master === "zones" ? "zones" : master}`;

  async function loadData() {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await fetch(apiBase);
      if (res.ok) {
        const json = await res.json();
        setData(json);
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
        const res = await fetch(`/api/v1/manpower/${business}/clients`);
        if (res.ok) setClients(await res.json());
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
  }, [business, master, session]);

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
      const res = await fetch(apiBase, {
        method: "PATCH",
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
    if (master === "clients" || master === "categories") {
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
      <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm mb-6 flex gap-4">
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
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                      </>
                    )}
                    {master === "contracts" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Contract No.</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Title</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Start Date</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">End Date</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
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
                          <td className="px-4 py-3 text-xs text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </>
                      )}
                      {master === "contracts" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.contractNumber}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.client?.name || item.clientId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">{item.title}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.startDate}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.endDate}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === "ACTIVE" ? "bg-status-success/15 text-status-success" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.status}
                            </span>
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
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-sm font-bold text-primary">Add New {masterLabel.replace(/s$/, "")}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {formError && (
                  <div className="p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold">
                    {formError}
                  </div>
                )}

                {/* Form fields based on master list */}
                {master === "clients" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Code</label>
                      <input
                        type="text"
                        disabled
                        placeholder="Auto-generated (SC-XXXX)"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                        value={formData.code || ""}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Client Name</label>
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
                        placeholder="Auto-generated (SCON-XXXX)"
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
                          value={formData.startDate || ""}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">End Date</label>
                        <input
                          type="date"
                          required
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.endDate || ""}
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
                    {isSecurity ? (
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
                                  .filter(emp => emp.companyId === "COMP-002" && emp.isActive === true && emp.operationType !== "SECURITY_GUARDING")
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
                                placeholder="e.g. SEC-001"
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
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Employee ID</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. FM-001"
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
            </form>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-sm font-bold text-primary">Edit {masterLabel.replace(/s$/, "")}</h3>
              <button onClick={() => { setEditItem(null); setFormData({}); }} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {formError && (
                  <div className="p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold">
                    {formError}
                  </div>
                )}

                {/* Form fields based on master list */}
                {master === "clients" && (
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
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Client Name</label>
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
