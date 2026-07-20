"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

export default function SecFacMonitoringPage() {
  const [operationType, setOperationType] = useState<"SECURITY_GUARDING" | "FACILITY_MANAGEMENT">("SECURITY_GUARDING");
  const [activeTab, setActiveTab] = useState<"overview" | "workers" | "queue" | "history" | "dailySummary">("overview");

  const [summaryData, setSummaryData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchMonitoringData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = `operationType=${operationType}`;
      const [resSummary, resHistory, resDaily] = await Promise.all([
        fetch(`/api/v1/secfac/monitoring/summary?${q}`),
        fetch(`/api/v1/secfac/monitoring/history?${q}&pageSize=10`),
        fetch(`/api/v1/secfac/monitoring/daily-summary?${q}`)
      ]);

      if (resSummary.ok) {
        setSummaryData(await resSummary.json());
      }
      if (resHistory.ok) {
        const hist = await resHistory.json();
        setHistoryData(hist.snapshots || []);
      }
      if (resDaily.ok) {
        setDailySummary(await resDaily.json());
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load monitoring data.");
    } finally {
      setLoading(false);
    }
  }, [operationType]);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/v1/secfac/monitoring/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationType })
      });
      if (res.ok) {
        setSuccessMsg("Monitoring cycle executed successfully.");
        await fetchMonitoringData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to execute monitoring cycle.");
      }
    } catch (e: any) {
      setError(e?.message || "Error during manual refresh.");
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "HEALTHY":
      case "SENT":
      case "VALID":
      case "CONTINUE":
        return <span style={{ padding: "4px 10px", borderRadius: "12px", background: "#d1fae5", color: "#065f46", fontWeight: "bold", fontSize: "12px" }}>HEALTHY</span>;
      case "DEGRADED":
      case "CONTINUE_WITH_MONITORING":
      case "WARNING":
        return <span style={{ padding: "4px 10px", borderRadius: "12px", background: "#fef3c7", color: "#92400e", fontWeight: "bold", fontSize: "12px" }}>DEGRADED</span>;
      case "UNHEALTHY":
      case "PAUSE_AND_REVIEW":
      case "STOP_WORKERS":
      case "CRITICAL":
        return <span style={{ padding: "4px 10px", borderRadius: "12px", background: "#fee2e2", color: "#991b1b", fontWeight: "bold", fontSize: "12px" }}>UNHEALTHY</span>;
      case "DISABLED":
        return <span style={{ padding: "4px 10px", borderRadius: "12px", background: "#f3f4f6", color: "#4b5563", fontWeight: "bold", fontSize: "12px" }}>DISABLED</span>;
      default:
        return <span style={{ padding: "4px 10px", borderRadius: "12px", background: "#e5e7eb", color: "#374151", fontWeight: "bold", fontSize: "12px" }}>{status}</span>;
    }
  };

  const evalWorker = summaryData?.evalWorker;
  const notifWorker = summaryData?.notifWorker;
  const monitoringWorker = summaryData?.monitoringWorker;
  const queue = summaryData?.queue;

  return (
    <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#111827", margin: 0 }}>
            SECFAC Phase 5D — Operational Monitoring & Stabilization
          </h1>
          <p style={{ color: "#6b7280", margin: "4px 0 0 0", fontSize: "14px" }}>
            Real-time worker health, queue depth metrics, and pilot stability governance
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: "600",
              cursor: refreshing ? "not-allowed" : "pointer"
            }}
          >
            {refreshing ? "Refreshing..." : "Manual Refresh"}
          </button>
          <Link
            href="/settings/secfac-notifications"
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#374151",
              textDecoration: "none",
              fontWeight: "600"
            }}
          >
            Notification Settings
          </Link>
        </div>
      </div>

      {/* Scope Selector */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => setOperationType("SECURITY_GUARDING")}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: operationType === "SECURITY_GUARDING" ? "2px solid #2563eb" : "1px solid #d1d5db",
            background: operationType === "SECURITY_GUARDING" ? "#eff6ff" : "#fff",
            color: operationType === "SECURITY_GUARDING" ? "#1d4ed8" : "#374151",
            fontWeight: "bold"
          }}
        >
          Security Guarding (Active Pilot)
        </button>
        <button
          onClick={() => setOperationType("FACILITY_MANAGEMENT")}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: operationType === "FACILITY_MANAGEMENT" ? "2px solid #2563eb" : "1px solid #d1d5db",
            background: operationType === "FACILITY_MANAGEMENT" ? "#eff6ff" : "#fff",
            color: operationType === "FACILITY_MANAGEMENT" ? "#1d4ed8" : "#374151",
            fontWeight: "bold"
          }}
        >
          Facility Management (Disabled)
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "6px", background: "#fde8e8", color: "#9b1c1c", marginBottom: "16px" }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: "12px 16px", borderRadius: "6px", background: "#def7ec", color: "#03543f", marginBottom: "16px" }}>
          {successMsg}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ borderBottom: "1px solid #e5e7eb", marginBottom: "24px", display: "flex", gap: "24px" }}>
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "12px 0",
            border: "none",
            background: "none",
            borderBottom: activeTab === "overview" ? "2px solid #2563eb" : "none",
            color: activeTab === "overview" ? "#2563eb" : "#6b7280",
            fontWeight: activeTab === "overview" ? "bold" : "normal",
            cursor: "pointer"
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("workers")}
          style={{
            padding: "12px 0",
            border: "none",
            background: "none",
            borderBottom: activeTab === "workers" ? "2px solid #2563eb" : "none",
            color: activeTab === "workers" ? "#2563eb" : "#6b7280",
            fontWeight: activeTab === "workers" ? "bold" : "normal",
            cursor: "pointer"
          }}
        >
          Worker Health
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          style={{
            padding: "12px 0",
            border: "none",
            background: "none",
            borderBottom: activeTab === "queue" ? "2px solid #2563eb" : "none",
            color: activeTab === "queue" ? "#2563eb" : "#6b7280",
            fontWeight: activeTab === "queue" ? "bold" : "normal",
            cursor: "pointer"
          }}
        >
          Queue Metrics
        </button>
        <button
          onClick={() => setActiveTab("history")}
          style={{
            padding: "12px 0",
            border: "none",
            background: "none",
            borderBottom: activeTab === "history" ? "2px solid #2563eb" : "none",
            color: activeTab === "history" ? "#2563eb" : "#6b7280",
            fontWeight: activeTab === "history" ? "bold" : "normal",
            cursor: "pointer"
          }}
        >
          Snapshots
        </button>
        <button
          onClick={() => setActiveTab("dailySummary")}
          style={{
            padding: "12px 0",
            border: "none",
            background: "none",
            borderBottom: activeTab === "dailySummary" ? "2px solid #2563eb" : "none",
            color: activeTab === "dailySummary" ? "#2563eb" : "#6b7280",
            fontWeight: activeTab === "dailySummary" ? "bold" : "normal",
            cursor: "pointer"
          }}
        >
          Daily Summary
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading monitoring metrics...</div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div>
              {/* Stat Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                <div style={{ padding: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}>SYSTEM STATUS</div>
                  <div style={{ marginTop: "8px" }}>{getStatusBadge(summaryData?.systemStatus || "HEALTHY")}</div>
                </div>

                <div style={{ padding: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}>EVALUATION WORKER</div>
                  <div style={{ marginTop: "8px" }}>{getStatusBadge(evalWorker?.healthStatus || "DISABLED")}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                    Age: {evalWorker?.heartbeatAgeSeconds || 0}s
                  </div>
                </div>

                <div style={{ padding: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}>NOTIFICATION WORKER</div>
                  <div style={{ marginTop: "8px" }}>{getStatusBadge(notifWorker?.healthStatus || "DISABLED")}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                    Age: {notifWorker?.heartbeatAgeSeconds || 0}s
                  </div>
                </div>

                <div style={{ padding: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}>MONITORING WORKER</div>
                  <div style={{ marginTop: "8px" }}>{getStatusBadge(monitoringWorker?.healthStatus || "HEALTHY")}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                    Interval: 5m
                  </div>
                </div>

                <div style={{ padding: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}>PENDING QUEUE</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#111827", marginTop: "4px" }}>
                    {queue?.pendingCount || 0}
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                    Oldest: {queue?.oldestPendingAgeMinutes || 0}m
                  </div>
                </div>

                <div style={{ padding: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}>DEAD LETTER COUNT</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: queue?.deadLetterCount > 0 ? "#dc2626" : "#111827", marginTop: "4px" }}>
                    {queue?.deadLetterCount || 0}
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                    Max Threshold: 5
                  </div>
                </div>

                <div style={{ padding: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}>EXTERNAL DELIVERIES</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#059669", marginTop: "4px" }}>
                    0
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                    Email/Push/SMS Disabled
                  </div>
                </div>

                <div style={{ padding: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}>SCOPE ISOLATION</div>
                  <div style={{ marginTop: "8px" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", background: "#d1fae5", color: "#065f46", fontWeight: "bold", fontSize: "12px" }}>ENFORCED</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                    Facility Management Isolated
                  </div>
                </div>
              </div>

              {/* Active Warnings Panel */}
              {queue?.warnings && queue.warnings.length > 0 && (
                <div style={{ padding: "16px", background: "#fffbebf7", border: "1px solid #fef3c7", borderRadius: "8px", marginBottom: "24px" }}>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#92400e" }}>Active Operational Warnings</h3>
                  <ul style={{ margin: 0, paddingLeft: "20px", color: "#b45309", fontSize: "14px" }}>
                    {queue.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* WORKERS TAB */}
          {activeTab === "workers" && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "12px 16px" }}>Worker Name</th>
                    <th style={{ padding: "12px 16px" }}>Scope</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Heartbeat Age</th>
                    <th style={{ padding: "12px 16px" }}>Lock Key</th>
                    <th style={{ padding: "12px 16px" }}>Lock Status</th>
                    <th style={{ padding: "12px 16px" }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {[evalWorker, notifWorker, monitoringWorker].map((w, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 16px", fontWeight: "bold" }}>{w?.workerName}</td>
                      <td style={{ padding: "12px 16px" }}>{w?.operationType}</td>
                      <td style={{ padding: "12px 16px" }}>{getStatusBadge(w?.healthStatus || "DISABLED")}</td>
                      <td style={{ padding: "12px 16px" }}>{w?.heartbeatAgeSeconds || 0}s</td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", fontFamily: "monospace" }}>secfac:worker:{w?.workerName?.split("-")[3]}:{w?.operationType?.toLowerCase()}</td>
                      <td style={{ padding: "12px 16px" }}>{w?.lockHeld ? "HELD" : w?.staleLock ? "STALE" : "FREE"}</td>
                      <td style={{ padding: "12px 16px", color: "#6b7280" }}>{w?.healthReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* QUEUE TAB */}
          {activeTab === "queue" && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "12px 16px" }}>Notification Status</th>
                    <th style={{ padding: "12px 16px" }}>Record Count</th>
                    <th style={{ padding: "12px 16px" }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px", fontWeight: "bold" }}>PENDING</td>
                    <td style={{ padding: "12px 16px" }}>{queue?.pendingCount || 0}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>Awaiting worker claiming (Oldest: {queue?.oldestPendingAgeMinutes || 0}m)</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px", fontWeight: "bold" }}>CLAIMED / PROCESSING</td>
                    <td style={{ padding: "12px 16px" }}>{(queue?.claimedCount || 0) + (queue?.processingCount || 0)}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>Currently being processed by notification worker</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px", fontWeight: "bold" }}>RETRY_SCHEDULED</td>
                    <td style={{ padding: "12px 16px" }}>{queue?.retryScheduledCount || 0}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>Awaiting exponential retry backoff</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px", fontWeight: "bold" }}>SENT (IN_APP)</td>
                    <td style={{ padding: "12px 16px", color: "#059669", fontWeight: "bold" }}>{queue?.sentCount || 0}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>Successfully delivered to user alert feed</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px", fontWeight: "bold" }}>DEAD_LETTER</td>
                    <td style={{ padding: "12px 16px", color: queue?.deadLetterCount > 0 ? "#dc2626" : "inherit", fontWeight: "bold" }}>{queue?.deadLetterCount || 0}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>Exceeded maximum attempts (5) without success</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* HISTORY SNAPSHOTS TAB */}
          {activeTab === "history" && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "12px 16px" }}>Captured At</th>
                    <th style={{ padding: "12px 16px" }}>Type</th>
                    <th style={{ padding: "12px 16px" }}>Worker</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Severity</th>
                    <th style={{ padding: "12px 16px" }}>Pending Depth</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 16px" }}>{new Date(s.capturedAt).toLocaleString()}</td>
                      <td style={{ padding: "12px 16px", fontWeight: "bold" }}>{s.snapshotType}</td>
                      <td style={{ padding: "12px 16px" }}>{s.workerName}</td>
                      <td style={{ padding: "12px 16px" }}>{getStatusBadge(s.healthStatus)}</td>
                      <td style={{ padding: "12px 16px" }}>{s.severity}</td>
                      <td style={{ padding: "12px 16px" }}>{s.queueDepth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* DAILY SUMMARY TAB */}
          {activeTab === "dailySummary" && dailySummary && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Daily Summary for {dailySummary.businessDate}</h2>
                <div>Recommendation: {getStatusBadge(dailySummary.recommendation)}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <div><strong>Evaluation Cycles:</strong> {dailySummary.evaluationCycles}</div>
                <div><strong>Notification Cycles:</strong> {dailySummary.notificationCycles}</div>
                <div><strong>Alerts Created:</strong> {dailySummary.alertsCreated}</div>
                <div><strong>IN_APP Delivered:</strong> {dailySummary.inAppDelivered}</div>
                <div><strong>Dead Lettered:</strong> {dailySummary.notificationsDeadLettered}</div>
                <div><strong>Accuracy Rate:</strong> {dailySummary.accuracyMetrics?.accuracyRate}%</div>
                <div><strong>False Positive Rate:</strong> {dailySummary.accuracyMetrics?.falsePositiveRate}%</div>
                <div><strong>External Deliveries:</strong> {dailySummary.externalDeliveries}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
