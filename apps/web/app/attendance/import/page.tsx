"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, Badge, Button, Input, Modal } from "@ahh-wfm/ui/src";

import { useSession } from "next-auth/react";

interface BatchItem {
  id: string;
  batchNumber: string;
  companyId: string | null;
  company?: { id: string; companyCode: string; companyName: string } | null;
  operationType: string | null;
  attendancePeriodFrom: string | null;
  attendancePeriodTo: string | null;
  sourceType: string;
  originalFileName: string;
  recordCount: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  duplicateCount: number;
  unmatchedCount: number;
  status: string;
  uploadedByName: string | null;
  uploadedAt: string;
}

export default function AttendanceImportPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const operationAccess = user?.operationAccess || {};
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.permissions?.includes("manpower.admin.full_access");
  const hasSecurity = operationAccess?.allowedSecurityGuarding || isAdmin || user?.permissions?.includes("manpower.security.view");
  const hasFm = operationAccess?.allowedFacilityManagement || isAdmin || user?.permissions?.includes("manpower.fm.view");

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState(hasFm && !hasSecurity ? "FACILITY_MANAGEMENT" : hasSecurity && !hasFm ? "SECURITY_GUARDING" : "ALL");
  const [search, setSearch] = useState("");

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [importProfile, setImportProfile] = useState<"NORMALIZED_ROW_UPLOAD" | "MONTHLY_MUSTER_MATRIX">("NORMALIZED_ROW_UPLOAD");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedScope, setSelectedScope] = useState<"SECURITY_GUARDING" | "FACILITY_MANAGEMENT">(
    hasFm && !hasSecurity ? "FACILITY_MANAGEMENT" : "SECURITY_GUARDING"
  );
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [matrixMonth, setMatrixMonth] = useState("8");
  const [matrixYear, setMatrixYear] = useState("2026");
  const [autoValidate, setAutoValidate] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [companies, setCompanies] = useState<{ id: string; companyCode: string; companyName: string }[]>([]);

  // Initialize from URL search params if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const op = urlParams.get("operationType");
      if (op === "SECURITY_GUARDING" || op === "FACILITY_MANAGEMENT") {
        setSelectedScope(op);
        setScopeFilter(op);
      }
    }
  }, []);

  // Update scope defaults when user access is loaded
  useEffect(() => {
    if (hasFm && !hasSecurity) {
      setSelectedScope("FACILITY_MANAGEMENT");
      setScopeFilter("FACILITY_MANAGEMENT");
    } else if (hasSecurity && !hasFm) {
      setSelectedScope("SECURITY_GUARDING");
      setScopeFilter("SECURITY_GUARDING");
    }
  }, [hasSecurity, hasFm]);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (scopeFilter !== "ALL") params.append("operationType", scopeFilter);

      const res = await fetch(`/api/v1/attendance-import/batches?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch (e) {
      console.error("Failed to fetch batches:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, scopeFilter]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/v1/admin/masters/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || data || []);
      }
    } catch (e) {
      console.error("Failed to fetch companies:", e);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchCompanies();
  }, [fetchBatches]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select an attendance file (CSV or XLSX) to upload.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("importProfile", importProfile);
      if (selectedCompanyId) formData.append("companyId", selectedCompanyId);
      formData.append("operationType", selectedScope);
      if (importProfile === "MONTHLY_MUSTER_MATRIX") {
        formData.append("month", matrixMonth);
        formData.append("year", matrixYear);
      } else {
        if (periodFrom) formData.append("attendancePeriodFrom", periodFrom);
        if (periodTo) formData.append("attendancePeriodTo", periodTo);
      }
      formData.append("autoValidate", String(autoValidate));

      const res = await fetch("/api/v1/attendance-import/batches", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Failed to upload attendance file.");
      } else {
        setIsUploadOpen(false);
        setUploadFile(null);
        fetchBatches();
      }
    } catch (err: any) {
      setUploadError(err.message || "Network error during upload.");
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VALIDATED":
        return <Badge variant="success">Validated</Badge>;
      case "UNDER_REVIEW":
        return <Badge variant="warning">Under Review</Badge>;
      case "VALIDATING":
        return <Badge variant="pending">Validating...</Badge>;
      case "UPLOADED":
        return <Badge variant="info">Uploaded</Badge>;
      case "REJECTED":
        return <Badge variant="error">Rejected</Badge>;
      case "CANCELLED":
        return <Badge variant="neutral">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const filteredBatches = batches.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.batchNumber.toLowerCase().includes(q) ||
      b.originalFileName.toLowerCase().includes(q) ||
      (b.company?.companyName || "").toLowerCase().includes(q) ||
      (b.uploadedByName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
              Phase AT-1 / AT-1A Intake & Output
            </span>
            <span className="text-xs text-on-surface-variant">Non-Authoritative Staging</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface mt-1">Attendance Intake & Staging Console</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Stage, parse monthly muster matrices, resolve reference entities, and generate DRAFT detailed timesheets and client mobilization sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <a href="/api/v1/attendance-import/template" download title="Download standard CSV row-by-row template">
              <Button variant="secondary" size="sm" type="button">
                <span className="material-symbols-outlined text-sm mr-1.5">description</span>
                CSV Template
              </Button>
            </a>
            <a href="/api/v1/attendance-import/template?profile=MONTHLY_MUSTER_MATRIX" download title="Download approved Monthly Muster Matrix XLSX template">
              <Button variant="secondary" size="sm" type="button">
                <span className="material-symbols-outlined text-sm mr-1.5">table_view</span>
                Matrix Template (XLSX)
              </Button>
            </a>
          </div>
          <Button variant="primary" size="sm" onClick={() => setIsUploadOpen(true)}>
            <span className="material-symbols-outlined text-sm mr-1.5">upload_file</span>
            Upload Attendance File
          </Button>
        </div>
      </div>

      {/* Info Alert Banner */}
      <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-blue-700 text-xl mt-0.5">verified_user</span>
        <div className="text-xs text-blue-900 leading-relaxed">
          <span className="font-bold">Zero Authoritative Mutation Guarantee:</span> Imported records remain safely inside the staging environment and are correlated against existing Workforce Directory, Sites, Contracts, Rosters, and Mobile punches. No authoritative attendance, scheduling, payroll, or billing records are mutated in Phase AT-1.
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card padded className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="UPLOADED">Uploaded</option>
                <option value="VALIDATING">Validating</option>
                <option value="VALIDATED">Validated</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Operational Scope</label>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {hasSecurity && hasFm && <option value="ALL">All Scopes (Security & FM)</option>}
                {hasSecurity && <option value="SECURITY_GUARDING">Security Guarding</option>}
                {hasFm && <option value="FACILITY_MANAGEMENT">Facility Management</option>}
              </select>
            </div>
          </div>

          <div className="w-full md:w-72">
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Search Batches</label>
            <input
              type="text"
              placeholder="Search batch #, file name, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </Card>

      {/* Batches Table */}
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Company & Scope</th>
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4 text-center">Total</th>
                <th className="py-3 px-4 text-center">Valid</th>
                <th className="py-3 px-4 text-center">Warnings</th>
                <th className="py-3 px-4 text-center">Errors</th>
                <th className="py-3 px-4 text-center">Duplicates</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Uploaded By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-on-surface-variant">
                    Loading attendance intake batches...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-on-surface-variant">
                    No intake batches found matching the selected criteria. Click "Upload Attendance File" to begin.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      <Link href={`/attendance/import/${batch.id}`} className="hover:underline">
                        {batch.batchNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-on-surface">{batch.company?.companyName || "Holding Level"}</div>
                      <div className="text-[10px] text-on-surface-variant">{batch.operationType || "All Operations"}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-on-surface" title={batch.originalFileName}>
                      {batch.originalFileName}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold">{batch.recordCount}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-700 font-bold">{batch.validCount}</td>
                    <td className="py-3.5 px-4 text-center text-amber-700 font-bold">{batch.warningCount}</td>
                    <td className="py-3.5 px-4 text-center text-rose-700 font-bold">{batch.errorCount}</td>
                    <td className="py-3.5 px-4 text-center text-purple-700 font-bold">{batch.duplicateCount}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(batch.status)}</td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      <div>{batch.uploadedByName || "System"}</div>
                      <div className="text-[10px]">{new Date(batch.uploadedAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/attendance/import/${batch.id}`}>
                        <Button variant="secondary" size="xs">
                          Inspect
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

      {/* Upload Modal */}
      <Modal isOpen={isUploadOpen} onClose={() => !uploading && setIsUploadOpen(false)} title="Upload Attendance Operational File">
        <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
          {uploadError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs">
              {uploadError}
            </div>
          )}

          {/* Import Profile Selection */}
          <div>
            <label className="block font-bold text-on-surface-variant uppercase mb-1">Import Profile / Layout</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setImportProfile("NORMALIZED_ROW_UPLOAD")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  importProfile === "NORMALIZED_ROW_UPLOAD"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                    : "border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="material-symbols-outlined text-sm">view_list</span>
                  <span>Row-by-Row Upload</span>
                </div>
                <div className="text-[10px] text-on-surface-variant font-normal">
                  Standard tabular CSV (1 row = 1 employee duty)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setImportProfile("MONTHLY_MUSTER_MATRIX")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  importProfile === "MONTHLY_MUSTER_MATRIX"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                    : "border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="material-symbols-outlined text-sm">grid_view</span>
                  <span>Monthly Muster Matrix</span>
                </div>
                <div className="text-[10px] text-on-surface-variant font-normal">
                  Employee × Days 1..31 horizontal matrix (XLSX)
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-on-surface-variant uppercase mb-1">Target Company</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select Company (Optional / Auto-detect)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.companyCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-on-surface-variant uppercase mb-1">Operational Scope</label>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT")}
              disabled={!isAdmin && ((hasSecurity && !hasFm) || (hasFm && !hasSecurity))}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-2 focus:ring-primary/20 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {hasSecurity && <option value="SECURITY_GUARDING">Security Guarding</option>}
              {hasFm && <option value="FACILITY_MANAGEMENT">Facility Management</option>}
            </select>
            {!isAdmin && ((hasSecurity && !hasFm) || (hasFm && !hasSecurity)) && (
              <p className="text-[10px] text-on-surface-variant mt-1">Scope locked to your assigned operational domain.</p>
            )}
          </div>

          {importProfile === "MONTHLY_MUSTER_MATRIX" ? (
            <div className="grid grid-cols-2 gap-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Matrix Month</label>
                <select
                  value={matrixMonth}
                  onChange={(e) => setMatrixMonth(e.target.value)}
                  className="w-full bg-white border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2026, m - 1, 1).toLocaleString("en-US", { month: "long" })} (Month {m})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Matrix Year</label>
                <input
                  type="number"
                  min="2024"
                  max="2030"
                  value={matrixYear}
                  onChange={(e) => setMatrixYear(e.target.value)}
                  className="w-full bg-white border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Period From</label>
                <input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface"
                />
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Period To</label>
                <input
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold text-on-surface-variant uppercase mb-1">
              {importProfile === "MONTHLY_MUSTER_MATRIX" ? "Matrix Spreadsheet (.xlsx, .xls, .csv, max 10MB)" : "Attendance File (.csv, max 10MB)"}
            </label>
            <div className="border-2 border-dashed border-outline-variant rounded-xl p-4 text-center hover:border-primary transition-colors cursor-pointer bg-surface-container-lowest">
              <input
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadFile(e.target.files[0]);
                  }
                }}
                className="w-full text-xs text-on-surface"
              />
              {uploadFile && (
                <div className="mt-2 font-bold text-primary text-xs">
                  Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoValidate"
              checked={autoValidate}
              onChange={(e) => setAutoValidate(e.target.checked)}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="autoValidate" className="text-xs text-on-surface font-medium cursor-pointer">
              Automatically execute validation engine upon staging
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setIsUploadOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={uploading || !uploadFile}>
              {uploading ? "Parsing & Staging..." : "Upload & Stage"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
