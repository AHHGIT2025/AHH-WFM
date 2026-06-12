"use client";

import React, { useState, useEffect } from "react";
import { LeaveRequest } from "@ahh-wfm/types";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

export default function LeavePage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "Pending Approval" | "Approved" | "Rejected">("all");

  const fetchLeaves = async () => {
    try {
      const res = await fetch("/api/v1/leaves");
      if (res.ok) {
        const json = await res.json();
        setLeaves(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLeaves();
    const interval = setInterval(fetchLeaves, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id: string, status: "Approved" | "Rejected") => {
    try {
      const res = await fetch(`/api/v1/leaves/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchLeaves();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = leaves.filter((l) => {
    return activeTab === "all" || l.status === activeTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">Leave &amp; Approvals</h1>
          <p className="text-sm text-on-surface-variant">Review, approve, or reject employee leave and time off requests</p>
        </div>
      </div>

      {/* Tab controls */}
      <div className="flex border border-outline-variant rounded-lg overflow-hidden bg-white max-w-md text-xs font-bold">
        {(["all", "Pending Approval", "Approved", "Rejected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 border-r border-outline-variant last:border-none transition-colors ${
              activeTab === tab ? "bg-secondary text-white" : "hover:bg-surface-container text-on-surface-variant"
            }`}
          >
            {tab === "all" ? "All Requests" : tab}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Leave Type</th>
                <th className="p-4">Date Range</th>
                <th className="p-4">Reason / Notes</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-on-surface-variant">
                    No leave requests found in this category.
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-bold text-primary">{req.employeeName}</p>
                        <p className="text-[10px] font-mono text-on-surface-variant">{req.employeeId}</p>
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-primary">{req.type}</td>
                    <td className="p-4 font-mono font-medium text-primary">{req.dateRange}</td>
                    <td className="p-4 text-on-surface-variant max-w-xs truncate">"{req.reason}"</td>
                    <td className="p-4">
                      <Badge
                        variant={
                          req.status === "Approved"
                            ? "success"
                            : req.status === "Rejected"
                            ? "error"
                            : "warning"
                        }
                      >
                        {req.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      {req.status === "Pending Approval" ? (
                        <div className="flex gap-1.5 justify-end">
                          <Button
                            variant="success"
                            size="sm"
                            className="font-bold text-[10px] py-1 px-3"
                            onClick={() => handleAction(req.id, "Approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="error"
                            size="sm"
                            className="font-bold text-[10px] py-1 px-3"
                            onClick={() => handleAction(req.id, "Rejected")}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant italic font-medium">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
