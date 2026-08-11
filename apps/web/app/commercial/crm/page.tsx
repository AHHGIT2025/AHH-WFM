"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";
import CommercialActivityFeedPanel from "../../../components/commercial/CommercialActivityFeedPanel";

interface ProspectClient {
  id: string;
  name: string;
  contactPersonName: string | null;
  contactPersonEmail: string | null;
  contactPersonPhone: string | null;
  crNumber: string | null;
  address: string | null;
  companyId: string | null;
  operationType: string | null;
  duplicateCheckStatus: "PENDING" | "MATCH_FOUND" | "CLEARED";
  matchedClientMasterId: string | null;
  isActive: boolean;
  createdAt: string;
  cases: Array<{ id: string; title: string; lifecycle: string }>;
}

export default function CrmEnquiriesPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [prospects, setProspects] = useState<ProspectClient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [duplicateStatus, setDuplicateStatus] = useState<string>("ALL");
  const [operationType, setOperationType] = useState<string>("ALL");

  // New Client Form Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: "",
    contactPersonName: "",
    contactPersonEmail: "",
    contactPersonPhone: "",
    crNumber: "",
    address: "",
    operationType: "SECURITY_GUARDING"
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (duplicateStatus && duplicateStatus !== "ALL") params.set("duplicateStatus", duplicateStatus);
      if (operationType && operationType !== "ALL") params.set("operationType", operationType);

      const res = await fetch(`/api/v1/commercial/crm?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to fetch CRM prospects");
      }
      const data = await res.json();
      setProspects(data.prospects || []);
    } catch (err: any) {
      setError(err.message || "Error loading CRM prospective clients");
    } finally {
      setLoading(false);
    }
  }, [search, duplicateStatus, operationType]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    setAlertMessage(null);
    try {
      const res = await fetch("/api/v1/commercial/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create prospect client");

      setAlertMessage(data.duplicateCheckAlert || "Prospect client registered successfully.");
      setFormData({
        name: "",
        contactPersonName: "",
        contactPersonEmail: "",
        contactPersonPhone: "",
        crNumber: "",
        address: "",
        operationType: "SECURITY_GUARDING"
      });
      fetchProspects();
    } catch (err: any) {
      setAlertMessage(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const matchFoundCount = prospects.filter((p) => p.duplicateCheckStatus === "MATCH_FOUND").length;
  const clearedCount = prospects.filter((p) => p.duplicateCheckStatus === "CLEARED").length;

  const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
  const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

  const getDuplicateBadge = (status: "PENDING" | "MATCH_FOUND" | "CLEARED") => {
    switch (status) {
      case "MATCH_FOUND":
        return <Badge variant="warning" className="bg-status-warning/10 text-status-warning border-status-warning/30 font-bold">MATCH FOUND</Badge>;
      case "CLEARED":
        return <Badge variant="success" className="bg-status-success/10 text-status-success border-status-success/30">CLEARED</Badge>;
      default:
        return <Badge variant="neutral" className="bg-surface-container-high text-on-surface-variant">PENDING</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
            <Link href="/commercial/dashboard" className="hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">space_dashboard</span>
              Commercial Workspace
            </Link>
            <span>/</span>
            <span className="text-on-surface font-semibold">CRM & Enquiries</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">chat</span>
              CRM & Prospective Client Intake
            </h1>
            <Badge variant="secondary" className="bg-secondary/10 text-secondary border-secondary/30">
              Milestone CL-1
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            Register Prospect Client
          </Button>

          <Link href="/commercial/opportunities">
            <Button variant="ghost" size="sm" className="inline-flex items-center gap-1">
              <span>Opportunities</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-secondary bg-surface-container-low space-y-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Total Prospect Clients
          </span>
          <div className="text-2xl font-extrabold text-on-surface">{prospects.length}</div>
          <p className="text-[11px] text-on-surface-variant">Registered CRM prospects</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-status-warning bg-surface-container-low space-y-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Duplicate Match Alerts
          </span>
          <div className="text-2xl font-extrabold text-status-warning">{matchFoundCount}</div>
          <p className="text-[11px] text-on-surface-variant">Matching CR / Client records</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-status-success bg-surface-container-low space-y-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Cleared Clients
          </span>
          <div className="text-2xl font-extrabold text-status-success">{clearedCount}</div>
          <p className="text-[11px] text-on-surface-variant">No master duplicate conflicts</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-primary bg-surface-container-low space-y-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Active Deals Linked
          </span>
          <div className="text-2xl font-extrabold text-on-surface">
            {prospects.reduce((acc, p) => acc + (p.cases?.length || 0), 0)}
          </div>
          <p className="text-[11px] text-on-surface-variant">Commercial cases initiated</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="bg-surface-container-low p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Search Prospects</label>
            <Input
              type="text"
              placeholder="Search by name, contact, email, or CR Number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Duplicate Status</label>
            <select
              value={duplicateStatus}
              onChange={(e) => setDuplicateStatus(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="MATCH_FOUND">Match Found (Alert)</option>
              <option value="CLEARED">Cleared</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Operation Scope</label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none"
            >
              <option value="ALL">All Operations</option>
              {userAllowedSG && <option value="SECURITY_GUARDING">Security Guarding</option>}
              {userAllowedFM && <option value="FACILITY_MANAGEMENT">Facility Management</option>}
            </select>
          </div>
        </div>
      </Card>

      {/* Error / Alert notification */}
      {error && (
        <Card className="bg-status-error/10 border border-status-error/30 p-3 text-xs text-status-error">
          {error}
        </Card>
      )}

      {/* High-density Prospects Ledger */}
      <Card className="p-0 overflow-hidden bg-surface-container-low">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-high text-on-surface-variant border-b border-outline-variant font-bold">
                <th className="py-2.5 px-3">Prospect Company</th>
                <th className="py-2.5 px-3">CR Number</th>
                <th className="py-2.5 px-3">Contact Person</th>
                <th className="py-2.5 px-3">Scope</th>
                <th className="py-2.5 px-3">Duplicate Check</th>
                <th className="py-2.5 px-3">Linked Deals</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-on-surface-variant">Loading prospects...</td>
                </tr>
              ) : prospects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-on-surface-variant">No prospective clients registered matching criteria.</td>
                </tr>
              ) : (
                prospects.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-on-surface">
                      {p.name}
                      {p.address && <div className="text-[11px] text-on-surface-variant font-normal">{p.address}</div>}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs">{p.crNumber || "N/A"}</td>
                    <td className="py-2.5 px-3">
                      <div>{p.contactPersonName || "N/A"}</div>
                      <div className="text-[11px] text-on-surface-variant">{p.contactPersonEmail || p.contactPersonPhone || ""}</div>
                    </td>
                    <td className="py-2.5 px-3">{p.operationType || "SECURITY_GUARDING"}</td>
                    <td className="py-2.5 px-3">{getDuplicateBadge(p.duplicateCheckStatus)}</td>
                    <td className="py-2.5 px-3 font-bold">{p.cases?.length || 0} Cases</td>
                    <td className="py-2.5 px-3 text-right">
                      <Link href={`/commercial/opportunities`}>
                        <Button variant="ghost" size="sm" className="text-secondary hover:underline text-xs inline-flex items-center gap-1">
                          <span>View Deals</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CRM Prospect Activity Feed */}
      <CommercialActivityFeedPanel title="CRM Prospects Activity & Communication Feed" />

      {/* Register Prospect Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg bg-surface-container-lowest p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">person_add</span>
                Register Prospective Client
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {alertMessage && (
              <div className="p-3 text-xs rounded bg-secondary/10 border border-secondary/30 text-secondary font-medium">
                {alertMessage}
              </div>
            )}

            <form onSubmit={handleCreateClient} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Company Name *</label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Al Rayyan Towers Holding WLL"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-on-surface-variant mb-1">CR Number</label>
                  <Input
                    type="text"
                    placeholder="e.g. CR-981245"
                    value={formData.crNumber}
                    onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Operation Scope</label>
                  <select
                    value={formData.operationType}
                    onChange={(e) => setFormData({ ...formData, operationType: e.target.value })}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none"
                  >
                    <option value="SECURITY_GUARDING">Security Guarding</option>
                    <option value="FACILITY_MANAGEMENT">Facility Management</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Contact Person Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Mohammed Al-Kuwari"
                  value={formData.contactPersonName}
                  onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Contact Email</label>
                  <Input
                    type="email"
                    placeholder="e.g. m.kuwari@alrayyan.qa"
                    value={formData.contactPersonEmail}
                    onChange={(e) => setFormData({ ...formData, contactPersonEmail: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Contact Phone</label>
                  <Input
                    type="text"
                    placeholder="e.g. +974 4499 1234"
                    value={formData.contactPersonPhone}
                    onChange={(e) => setFormData({ ...formData, contactPersonPhone: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Address / Site Location</label>
                <Input
                  type="text"
                  placeholder="e.g. West Bay Tower 4, Doha"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={submitting}>
                  {submitting ? "Checking & Registering..." : "Submit & Check Duplicates"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
