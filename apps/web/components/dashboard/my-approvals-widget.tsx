"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

export const MyApprovalsWidget: React.FC = () => {
  const [counts, setCounts] = useState<{ pendingCount: number; actionedCount: number }>({ pendingCount: 0, actionedCount: 0 });
  const [recentPending, setRecentPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [cntRes, listRes] = await Promise.all([
          fetch("/api/v1/approvals/counts"),
          fetch("/api/v1/approvals?tab=inbox&pageSize=4")
        ]);

        if (cntRes.ok) {
          const cntJson = await cntRes.json();
          if (cntJson.success && cntJson.data) {
            setCounts(cntJson.data);
          }
        }
        if (listRes.ok) {
          const listJson = await listRes.json();
          if (listJson.success && listJson.data) {
            setRecentPending(listJson.data);
          }
        }
      } catch (e) {
        console.error("Failed to load approval dashboard data:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <Card className="p-5 border border-border-subtle bg-surface-container-lowest space-y-4">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">task_alt</span>
          <div>
            <h2 className="text-sm font-bold text-primary tracking-tight">My Approvals Portal</h2>
            <p className="text-[11px] text-on-surface-variant">Centralized review and tracking across all operational workflows</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/approvals?tab=inbox">
            <Button size="sm" variant="secondary" className="text-xs font-semibold py-1 px-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">inbox</span>
              <span>View Inbox ({counts.pendingCount})</span>
            </Button>
          </Link>
          <Link href="/approvals?tab=outbox">
            <Button size="sm" variant="secondary" className="text-xs font-semibold py-1 px-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">outbox</span>
              <span>View Outbox</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-surface-container-low rounded-lg border border-border-subtle flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Pending Action</p>
            <p className="text-xl font-extrabold text-status-warning mt-0.5">{counts.pendingCount}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">Tasks awaiting your sign-off</p>
          </div>
          <span className="material-symbols-outlined text-status-warning text-3xl opacity-80">pending_actions</span>
        </div>

        <div className="p-3 bg-surface-container-low rounded-lg border border-border-subtle flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Recently Actioned</p>
            <p className="text-xl font-extrabold text-primary mt-0.5">{counts.actionedCount}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">Workflows tracked in Outbox</p>
          </div>
          <span className="material-symbols-outlined text-primary text-3xl opacity-80">history</span>
        </div>
      </div>

      {/* Recent Pending Table */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Recent Items Awaiting Approval</h3>
        {loading ? (
          <div className="py-6 text-center text-xs text-on-surface-variant">Loading approval queue...</div>
        ) : recentPending.length === 0 ? (
          <div className="py-6 text-center bg-surface-container-low rounded-lg border border-dashed border-border-subtle">
            <span className="material-symbols-outlined text-status-success text-2xl">check_circle</span>
            <p className="text-xs font-bold text-on-surface mt-1">You're all caught up!</p>
            <p className="text-[11px] text-on-surface-variant">No pending approval requests require your review right now.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-bold text-on-surface-variant uppercase">
                  <th className="py-2 px-2">Reference</th>
                  <th className="py-2 px-2">Module</th>
                  <th className="py-2 px-2">Subject</th>
                  <th className="py-2 px-2">Current Level</th>
                  <th className="py-2 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {recentPending.map((item) => (
                  <tr key={item.approvalKey} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-2 px-2 font-mono font-bold text-primary">{item.reference}</td>
                    <td className="py-2 px-2">
                      <Badge variant="neutral" className="text-[10px] py-0 px-1.5">{item.sourceModule}</Badge>
                    </td>
                    <td className="py-2 px-2 text-on-surface font-medium max-w-[200px] truncate">{item.subject}</td>
                    <td className="py-2 px-2 text-on-surface-variant text-[11px]">{item.currentLevelName || `Level ${item.currentLevelNumber}`}</td>
                    <td className="py-2 px-2 text-right">
                      <Link href={`/approvals/${item.id}`}>
                        <Button size="sm" variant="primary" className="text-[11px] py-0.5 px-2.5 font-bold">Review</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
};
