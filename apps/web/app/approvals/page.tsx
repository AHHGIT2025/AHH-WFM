"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

const MODULE_OPTIONS = [
  { value: "ALL", label: "All Modules" },
  { value: "COSTING", label: "Commercial Costing" },
  { value: "PROPOSAL", label: "Commercial Proposals" },
  { value: "CONTRACT", label: "Commercial Contracts" },
  { value: "ADDENDUM", label: "Contract Addendums" },
  { value: "CLEARANCE", label: "Employee Clearance" },
  { value: "LEAVE", label: "Leave Requests" },
  { value: "CALENDAR", label: "Manpower Calendars" }
];

export default function ApprovalCenterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "outbox" ? "outbox" : "inbox";

  const [tab, setTab] = useState<"inbox" | "outbox">(initialTab);
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<{ pendingCount: number; actionedCount: number }>({ pendingCount: 0, actionedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Sync tab with URL
  const switchTab = (newTab: "inbox" | "outbox") => {
    setTab(newTab);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.replace(`/approvals?${params.toString()}`);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch counts
      const countRes = await fetch("/api/v1/approvals/counts");
      if (countRes.ok) {
        const cntJson = await countRes.json();
        if (cntJson.success && cntJson.data) setCounts(cntJson.data);
      }

      // 2. Fetch list
      const queryParams = new URLSearchParams({
        tab,
        page: page.toString(),
        pageSize: "12",
        ...(search ? { search } : {}),
        ...(moduleFilter !== "ALL" ? { module: moduleFilter } : {}),
        ...(tab === "outbox" && statusFilter !== "ALL" ? { status: statusFilter } : {})
      });

      const listRes = await fetch(`/api/v1/approvals?${queryParams.toString()}`);
      if (listRes.ok) {
        const listJson = await listRes.json();
        if (listJson.success && listJson.data) {
          setItems(listJson.data);
          setTotalPages(listJson.pagination?.totalPages || 1);
          setTotalCount(listJson.pagination?.total || 0);
        }
      }
    } catch (e) {
      console.error("Failed to load approval center items:", e);
    } finally {
      setLoading(false);
    }
  }, [tab, page, search, moduleFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getBadgeVariant = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "APPROVED" || s === "COMPLETED") return "success";
    if (s === "REJECTED") return "error";
    if (s === "RETURNED" || s === "RETURNED_FOR_CORRECTION" || s === "IN_PROGRESS" || s === "PENDING") return "warning";
    return "neutral";
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">task_alt</span>
            <h1 className="text-xl font-black text-primary tracking-tight">Universal Approval Center</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Centralized review, tracking, and audit governance across all operational workflows
          </p>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg border border-border-subtle">
          <span className="text-xs font-semibold text-on-surface-variant">Pending Tasks:</span>
          <Badge variant={counts.pendingCount > 0 ? "warning" : "success"} className="font-mono text-xs font-bold">
            {counts.pendingCount}
          </Badge>
          <span className="text-border-subtle mx-1">|</span>
          <span className="text-xs font-semibold text-on-surface-variant">My Outbox:</span>
          <Badge variant="neutral" className="font-mono text-xs font-bold">
            {counts.actionedCount}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle gap-4">
        <button
          onClick={() => switchTab("inbox")}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            tab === "inbox"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-base">inbox</span>
          <span>Pending Review (Inbox)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tab === "inbox" ? "bg-primary text-white" : "bg-surface-container-high text-on-surface"}`}>
            {counts.pendingCount}
          </span>
        </button>

        <button
          onClick={() => switchTab("outbox")}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            tab === "outbox"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-base">outbox</span>
          <span>My Actions (Outbox)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tab === "outbox" ? "bg-primary text-white" : "bg-surface-container-high text-on-surface"}`}>
            {counts.actionedCount}
          </span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-surface-container-lowest p-3 rounded-lg border border-border-subtle">
        <div className="flex flex-1 w-full md:w-auto items-center gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">search</span>
            <input
              type="text"
              placeholder="Search reference, subject, or requester..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-container-low border border-border-subtle rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="text-xs bg-surface-container-low border border-border-subtle rounded-md py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-primary font-medium text-on-surface"
          >
            {MODULE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {tab === "outbox" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-surface-container-low border border-border-subtle rounded-md py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-primary font-medium text-on-surface"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RETURNED">Returned</option>
              <option value="REJECTED">Rejected</option>
            </select>
          )}
        </div>

        <div className="text-xs text-on-surface-variant font-medium self-end md:self-center">
          Showing {items.length} of {totalCount} records
        </div>
      </div>

      {/* Main Table / Empty State */}
      {loading ? (
        <Card className="p-12 text-center text-xs text-on-surface-variant border border-border-subtle">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full mb-3" />
          <p>Loading approval records...</p>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-border-subtle bg-surface-container-lowest space-y-3">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-60">
            {tab === "inbox" ? "task_alt" : "outbox"}
          </span>
          <h3 className="text-sm font-bold text-on-surface">
            {tab === "inbox" ? "No Pending Approvals" : "No Outbox Records Found"}
          </h3>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            {tab === "inbox"
              ? "You do not have any operational approval requests waiting for your action. Great job!"
              : "You have not taken any approval or review actions matching the selected filters."}
          </p>
        </Card>
      ) : tab === "inbox" ? (
        /* INBOX TABLE */
        <Card className="overflow-hidden border border-border-subtle bg-surface-container-lowest">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-border-subtle text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Requester</th>
                  <th className="py-3 px-4">Current Level</th>
                  <th className="py-3 px-4">Pending Approvers</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {items.map((item) => (
                  <tr key={item.approvalKey} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                      {item.reference}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant="neutral" className="text-[10px] uppercase font-bold py-0.5 px-2">
                        {item.sourceModule}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-semibold text-on-surface max-w-xs truncate">
                      {item.subject}
                      {item.subtitle && <p className="text-[10px] text-on-surface-variant font-normal">{item.subtitle}</p>}
                    </td>
                    <td className="py-3 px-4 text-on-surface font-medium whitespace-nowrap">
                      {item.requesterName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant="warning" className="text-[10px] font-bold">
                        {item.currentLevelName || `Level ${item.currentLevelNumber}`}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-on-surface-variant max-w-[180px] truncate">
                      {item.currentPendingApprover}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-on-surface-variant whitespace-nowrap">
                      {new Date(item.pendingSince || item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link href={`/approvals/${item.id}`}>
                        <Button size="sm" variant="primary" className="text-xs font-bold py-1 px-3">
                          Review & Act
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* OUTBOX TABLE */
        <Card className="overflow-hidden border border-border-subtle bg-surface-container-lowest">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-border-subtle text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Requester</th>
                  <th className="py-3 px-4">My Action</th>
                  <th className="py-3 px-4">Action Date</th>
                  <th className="py-3 px-4">Current State</th>
                  <th className="py-3 px-4">Final Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {items.map((item) => (
                  <tr key={item.approvalKey} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                      {item.reference}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant="neutral" className="text-[10px] uppercase font-bold py-0.5 px-2">
                        {item.sourceModule}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-semibold text-on-surface max-w-xs truncate">
                      {item.subject}
                    </td>
                    <td className="py-3 px-4 text-on-surface font-medium whitespace-nowrap">
                      {item.requesterName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant={getBadgeVariant(item.myAction)} className="text-[10px] font-bold">
                        {item.myAction}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-on-surface-variant whitespace-nowrap">
                      {new Date(item.myActionAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-on-surface-variant max-w-[160px] truncate">
                      {item.currentPendingApprover}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant={getBadgeVariant(item.currentWorkflowStatus)} className="text-[10px] font-bold">
                        {item.finalStatus}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link href={`/approvals/${item.id}`}>
                        <Button size="sm" variant="secondary" className="text-xs font-bold py-1 px-3">
                          View Lifecycle
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-on-surface-variant font-medium">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
