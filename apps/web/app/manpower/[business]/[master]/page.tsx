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

  const apiBase = `/api/v1/manpower/${business}/${master === "areas" ? "areas" : master === "zones" ? "zones" : master}`;

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
        const res = await fetch(`/api/v1/manpower/${business}/categories`);
        if (res.ok) setCategories(await res.json());
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
    return true;
  });

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
            onClick={() => setShowAddModal(true)}
            className={`px-3 py-2 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              isSecurity ? "bg-primary hover:bg-primary-container" : "bg-secondary hover:bg-secondary-container"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add {masterLabel.replace(/s$/, "")}
          </button>
        )}
      </div>

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

      {/* Roster Grid */}
      <div className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className={`w-8 h-8 border-4 rounded-full animate-spin border-t-transparent ${isSecurity ? "border-primary" : "border-secondary"}`}></div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant">No items found.</div>
        ) : (
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
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item: any, idx: number) => (
                <tr key={item.id || idx} className="border-b border-outline-variant/40 hover:bg-surface-container-lowest">
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
                      <td className="px-4 py-3 text-xs text-on-surface">{item.title}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{new Date(item.startDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{new Date(item.endDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-container/10 text-primary">
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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isDeployableInRoster ? "bg-primary-container/10 text-primary" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                          {item.isDeployableInRoster ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.canWorkOvertime ? "bg-primary-container/10 text-primary" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.code || ""}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
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
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.contractNumber || ""}
                        onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
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
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
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
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
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
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.lat || ""}
                          onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.lng || ""}
                          onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Radius (m)</label>
                        <input
                          type="number"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.radiusMeters || "100"}
                          onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={!!formData.gatePassRequired}
                        onChange={(e) => setFormData({ ...formData, gatePassRequired: e.target.checked })}
                        className="rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      <span>Gate Pass Required for Entry/Exit</span>
                    </label>
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
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Employee ID</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SEC-001 or FM-001"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.id || ""}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Display Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Email</label>
                      <input
                        type="email"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.email || ""}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Manpower Category</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.manpowerCategoryId || ""}
                        onChange={(e) => setFormData({ ...formData, manpowerCategoryId: e.target.value })}
                      >
                        <option value="">Select Category...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                      </select>
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
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.contractNumber || ""}
                        onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
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
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
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
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
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
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.lat || ""}
                          onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.lng || ""}
                          onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Radius (m)</label>
                        <input
                          type="number"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.radiusMeters || "100"}
                          onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={!!formData.gatePassRequired}
                        onChange={(e) => setFormData({ ...formData, gatePassRequired: e.target.checked })}
                        className="rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      <span>Gate Pass Required for Entry/Exit</span>
                    </label>
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
    </div>
  );
}
