"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MobileApprovalCenterPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"inbox" | "outbox">("inbox");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [stats, setStats] = useState({ inboxCount: 0, outboxCount: 0 });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tab,
        search,
        module: moduleFilter
      });
      const res = await fetch(`/api/v1/approvals?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        if (data.stats) {
          setStats({
            inboxCount: data.stats.pendingCount || 0,
            outboxCount: data.stats.totalOutboxCount || 0
          });
        }
      }
    } catch (e) {
      console.error("Failed to load mobile approvals:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [tab, search, moduleFilter]);

  const getStatusBadgeClass = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "APPROVED" || s === "COMPLETED") return "bg-status-success/10 text-status-success border-status-success/20";
    if (s === "REJECTED") return "bg-status-error/10 text-status-error border-status-error/20";
    if (s === "RETURNED") return "bg-status-warning/10 text-status-warning border-status-warning/20";
    return "bg-primary/10 text-primary border-primary/20";
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-base font-bold text-on-surface">Universal Approval Center</h1>
            <p className="text-[10px] text-on-surface-variant">Review & action requests across all modules</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-surface-container-low p-1 border border-outline-variant/30">
        <button
          onClick={() => setTab("inbox")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
            tab === "inbox"
              ? "bg-surface text-primary shadow-sm border border-outline-variant/20"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">inbox</span>
          <span>Pending Inbox</span>
          {stats.inboxCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-primary text-white">
              {stats.inboxCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab("outbox")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
            tab === "outbox"
              ? "bg-surface text-primary shadow-sm border border-outline-variant/20"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">outbox</span>
          <span>Actioned Outbox</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search reference, subject, requester..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-surface border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { label: "All Modules", value: "" },
            { label: "Commercial", value: "COMMERCIAL" },
            { label: "Clearance", value: "CLEARANCE" },
            { label: "Leave", value: "LEAVE" },
            { label: "Manpower", value: "MANPOWER" },
            { label: "SECFAC", value: "SECFAC" }
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setModuleFilter(m.value)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border transition-colors ${
                moduleFilter === m.value
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-on-surface-variant border-outline-variant/30 hover:border-primary/50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Item List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-outline-variant/30 rounded-2xl p-8 text-center space-y-2 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-surface-container-high mx-auto flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[24px]">
              {tab === "inbox" ? "done_all" : "history"}
            </span>
          </div>
          <h3 className="text-xs font-bold text-on-surface">
            {tab === "inbox" ? "Inbox Zero" : "No Action History"}
          </h3>
          <p className="text-[11px] text-on-surface-variant">
            {tab === "inbox"
              ? "You have no pending approval requests requiring action."
              : "Items you have acted on will appear here with live tracking."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <Link
              key={item.approvalKey || item.id}
              href={`/approvals/${encodeURIComponent(item.id)}`}
              className="block bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm hover:border-primary/50 active:scale-[0.99] transition-all space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container-high text-primary border border-outline-variant/20">
                      {item.reference || item.sourceId || "REF"}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary-container/40 text-secondary">
                      {item.sourceModule || "WORKFLOW"}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-on-surface line-clamp-1 mt-1">
                    {item.subject || item.reference}
                  </h4>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadgeClass(item.currentWorkflowStatus || item.finalStatus)}`}>
                  {item.currentWorkflowStatus || item.finalStatus || "Pending"}
                </span>
              </div>

              <div className="text-[10px] text-on-surface-variant space-y-1 pt-1 border-t border-outline-variant/20">
                <div className="flex justify-between items-center">
                  <span>Requester: <strong className="text-on-surface font-semibold">{item.requesterName || "Requester"}</strong></span>
                  <span>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ""}</span>
                </div>
                {item.companyName && (
                  <p className="truncate text-on-surface-variant/80">{item.companyName}</p>
                )}
                {tab === "outbox" && item.myAction && (
                  <div className="flex items-center gap-1 text-primary font-semibold pt-0.5">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>My Action: {item.myAction} ({item.myActionAt ? new Date(item.myActionAt).toLocaleDateString() : ""})</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
