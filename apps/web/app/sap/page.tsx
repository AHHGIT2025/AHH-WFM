"use client";

import React, { useState, useEffect } from "react";
import { SyncLog } from "@ahh-wfm/types";
import { Card, Badge, Button, Modal } from "@ahh-wfm/ui/src";

export default function SapPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "Failed" | "Success">("all");
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/v1/sap/logs");
      if (res.ok) {
        const json = await res.json();
        setLogs(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleGlobalSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/v1/sap/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "Data Pull",
          subject: "Global_SF_Schema",
          status: "Success",
          details: "Pulled and synchronized schema properties for 48 fields successfully."
        })
      });
      setTimeout(() => {
        setSyncing(false);
        fetchLogs();
      }, 1500);
    } catch (e) {
      setSyncing(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (activeTab === "all") return true;
    return log.status === activeTab;
  });

  return (
    <div className="space-y-6">
      {/* Title & Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">SAP SuccessFactors Hub</h1>
          <p className="text-sm text-on-surface-variant">Real-time sync controls and data-feed health diagnostics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="font-bold flex items-center gap-1.5 text-xs">
            <span className="material-symbols-outlined text-sm">download</span> Export Report
          </Button>
          <Button
            onClick={handleGlobalSync}
            disabled={syncing}
            className="font-bold flex items-center gap-1.5 text-xs"
          >
            <span className={`material-symbols-outlined text-sm ${syncing ? "animate-spin" : ""}`}>
              sync
            </span>
            <span>{syncing ? "Syncing Schema..." : "Sync Global Schema"}</span>
          </Button>
        </div>
      </div>

      {/* Grid of status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <span className="material-symbols-outlined">cloud_done</span>
            </div>
            <Badge variant="success">ACTIVE</Badge>
          </div>
          <p className="text-outline-variant font-bold text-[10px] uppercase tracking-wider mb-0.5">API Health</p>
          <h3 className="text-lg font-bold text-primary">SuccessFactors Live</h3>
          <p className="text-xs text-on-surface-variant mt-2">Latency: 142ms</p>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
          </div>
          <p className="text-outline-variant font-bold text-[10px] uppercase tracking-wider mb-0.5">In Queue</p>
          <h3 className="text-lg font-bold text-primary">0 Records</h3>
          <p className="text-xs text-on-surface-variant mt-2">All batches ingested</p>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 rounded-lg text-secondary">
              <span className="material-symbols-outlined">analytics</span>
            </div>
          </div>
          <p className="text-outline-variant font-bold text-[10px] uppercase tracking-wider mb-0.5">Sync Success Rate</p>
          <h3 className="text-lg font-bold text-primary">99.8%</h3>
          <div className="w-full bg-surface-container rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="bg-secondary h-full" style={{ width: "99.8%" }}></div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-red-50 rounded-lg text-status-error">
              <span className="material-symbols-outlined">warning</span>
            </div>
          </div>
          <p className="text-outline-variant font-bold text-[10px] uppercase tracking-wider mb-0.5">Issues Flagged</p>
          <h3 className="text-lg font-bold text-primary">1 Mapping Conflict</h3>
          <p className="text-xs text-status-error mt-2 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">error</span> Resolve immediately
          </p>
        </Card>
      </div>

      {/* Main visual section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sync Log Feed */}
        <Card className="lg:col-span-2 flex flex-col p-0">
          <div className="p-4 border-b border-border-subtle bg-surface-container-low flex justify-between items-center rounded-t-xl">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">list_alt</span>
              <h3 className="text-xs font-bold uppercase text-primary">Sync Log Audits</h3>
            </div>
            <div className="flex border border-outline-variant rounded-lg overflow-hidden text-[10px] font-bold bg-white">
              {(["all", "Success", "Failed"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-1.5 px-3 border-r border-outline-variant last:border-none ${
                    activeTab === tab ? "bg-secondary text-white" : "hover:bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {tab === "all" ? "All Logs" : tab}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Operation</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-on-surface-variant">
                      No logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-3 font-mono text-[10px] text-on-surface-variant whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="p-3 font-semibold text-primary">{log.operation}</td>
                      <td className="p-3 font-mono text-[11px]">{log.subject}</td>
                      <td className="p-3">
                        <Badge variant={log.status === "Success" ? "success" : log.status === "Failed" ? "error" : "warning"}>
                          {log.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-secondary hover:underline font-bold text-[10px]"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Node latency viz */}
        <Card className="bg-primary text-white flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold mb-0.5">Regional Nodes Health</h3>
            <p className="text-[10px] text-outline-variant opacity-75">SAP API Cluster Sync</p>

            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-green-400">dns</span>
                  <div>
                    <p className="text-xs font-bold">Doha Node (AP-South-Q)</p>
                    <p className="text-[9px] text-outline-variant opacity-75">Primary Site Hub</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-green-400">99.9%</p>
                  <p className="text-[9px] text-green-400">Optimal</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-green-400">dns</span>
                  <div>
                    <p className="text-xs font-bold">Frankfurt Node (EU-Central)</p>
                    <p className="text-[9px] text-outline-variant opacity-75">Active Mirror Site</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-green-400">99.7%</p>
                  <p className="text-[9px] text-green-400">Synced</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-400">dns</span>
                  <div>
                    <p className="text-xs font-bold">Singapore Node (AP-East)</p>
                    <p className="text-[9px] text-outline-variant opacity-75">Fallback Standby</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-amber-400">95.4%</p>
                  <p className="text-[9px] text-amber-400">Delayed</p>
                </div>
              </div>
            </div>
          </div>
          <Button variant="secondary" className="w-full text-xs font-bold bg-white/10 border-white/20 text-white hover:bg-white/20 mt-8">
            Re-optimize Nodes
          </Button>
        </Card>
      </div>

      {/* Log Details Diagnostic Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Diagnostic Log: ${selectedLog?.id}`}
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">Timestamp</p>
                <p className="font-mono mt-0.5 text-primary font-semibold">{selectedLog.timestamp}</p>
              </div>
              <div>
                <p className="font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">Operation</p>
                <p className="font-bold text-primary mt-0.5">{selectedLog.operation}</p>
              </div>
              <div>
                <p className="font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">Subject</p>
                <p className="font-mono mt-0.5 text-primary font-semibold">{selectedLog.subject}</p>
              </div>
              <div>
                <p className="font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">Status</p>
                <div className="mt-1">
                  <Badge variant={selectedLog.status === "Success" ? "success" : selectedLog.status === "Failed" ? "error" : "warning"}>
                    {selectedLog.status}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-4">
              <p className="font-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-1">Response details</p>
              <pre className="bg-surface p-3 rounded-lg text-xs font-mono overflow-x-auto text-primary border border-border-subtle max-h-40 whitespace-pre-wrap">
                {selectedLog.details}
              </pre>
            </div>
            <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>Close</Button>
              <Button onClick={() => alert("Diagnosing WFM-SAP Bridge connectivity... Healthy.")}>Re-test API Bridge</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
