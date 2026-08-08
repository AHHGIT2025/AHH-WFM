"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";

interface SummaryMetrics {
  totalOpen: number;
  criticalCount: number;
  highCount: number;
  overdueCount: number;
  unassignedCount: number;
  resolvedTodayCount: number;
}

interface EscalationItem {
  id: string;
  sourceType:
    | "UNCOVERED_ROSTER_SLOT"
    | "RELIEVER_DEFICIT"
    | "ROSTER_PLANNING_EXCEPTION"
    | "UNEXCUSED_RECONCILIATION"
    | "ATTENDANCE_CORRECTION_PENDING"
    | "CONTRACT_SLA_RISK";
  sourceId: string;
  title: string;
  description: string;
  operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT" | "GENERAL";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "ACKNOWLEDGED" | "ASSIGNED" | "RESOLVED" | "CANCELLED";
  createdAt: string;
  dueDate: string;
  isOverdue: boolean;
  assignedOwnerId: string | null;
  assignedOwnerName: string | null;
  companyId: string | null;
  companyName: string | null;
  siteId: string | null;
  siteName: string | null;
  contractId: string | null;
  contractTitle: string | null;
  drillDownUrl: string;
  authoritativeModule: string;
  requiresAuthoritativeModuleApproval: boolean;
}

interface SingleEscalationDetail {
  escalationId: string;
  sourceType: string;
  sourceId: string;
  sourceRecord: any;
  workflowInstance: any;
  auditHistory: Array<{
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    afterJson: string;
    createdAt: string;
  }>;
}

export default function OperationalEscalationsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  // Filter States
  const [businessDate, setBusinessDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [operationType, setOperationType] = useState<string>("ALL");
  const [companyId, setCompanyId] = useState<string>("");
  const [sourceType, setSourceType] = useState<string>("ALL");
  const [severity, setSeverity] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Data States
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics>({
    totalOpen: 0,
    criticalCount: 0,
    highCount: 0,
    overdueCount: 0,
    unassignedCount: 0,
    resolvedTodayCount: 0,
  });
  const [companies, setCompanies] = useState<{ id: string; companyName: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer / Workspace Drawer State
  const [selectedItem, setSelectedItem] = useState<EscalationItem | null>(null);
  const [itemDetail, setItemDetail] = useState<SingleEscalationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<
    "overview" | "metadata" | "drilldown" | "workflow" | "audit"
  >("overview");

  // Action Form State
  const [actionType, setActionType] = useState<
    "ACKNOWLEDGE" | "ASSIGN" | "COMMENT" | "RESOLVE" | "CANCEL" | "WORKFLOW_ACTION"
  >("ACKNOWLEDGE");
  const [newOwnerId, setNewOwnerId] = useState<string>("");
  const [actionRemarks, setActionRemarks] = useState<string>("");
  const [workflowActionType, setWorkflowActionType] = useState<string>("APPROVE");
  const [attemptedBypass, setAttemptedBypass] = useState<boolean>(false);
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Companies Master Data
  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch("/api/v1/companies");
        if (res.ok) {
          const compData = await res.json();
          setCompanies(Array.isArray(compData) ? compData : compData.companies || []);
        }
      } catch (err) {
        console.error("Failed to load companies master data", err);
      }
    }
    fetchCompanies();
  }, []);

  // Fetch Escalations List
  const fetchEscalations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (businessDate) params.append("businessDate", businessDate);
      if (operationType !== "ALL") params.append("operationType", operationType);
      if (companyId) params.append("companyId", companyId);
      if (sourceType !== "ALL") params.append("sourceType", sourceType);
      if (severity !== "ALL") params.append("severity", severity);
      if (status !== "ALL") params.append("status", status);
      if (overdueOnly) params.append("overdueOnly", "true");

      const res = await fetch(`/api/v1/commercial/command-center/escalations?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to fetch operational escalations.");
      }
      const resData = await res.json();
      setEscalations(resData.escalations || []);
      setSummaryMetrics(
        resData.summaryMetrics || {
          totalOpen: 0,
          criticalCount: 0,
          highCount: 0,
          overdueCount: 0,
          unassignedCount: 0,
          resolvedTodayCount: 0,
        }
      );
    } catch (err: any) {
      setError(err.message || "Failed to fetch operational escalations.");
    } finally {
      setLoading(false);
    }
  }, [businessDate, operationType, companyId, sourceType, severity, status, overdueOnly]);

  useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  // Fetch Item Detail when selected
  const openItemDetail = async (item: EscalationItem) => {
    setSelectedItem(item);
    setLoadingDetail(true);
    setItemDetail(null);
    setActionError(null);
    setActionSuccess(null);
    setAttemptedBypass(false);
    setActionRemarks("");
    try {
      const res = await fetch(`/api/v1/commercial/command-center/escalations/${item.id}`);
      if (res.ok) {
        const detailData = await res.json();
        setItemDetail(detailData);
      }
    } catch (err) {
      console.error("Failed to load item detail", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Action Submission Handler
  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setActionError(null);
    setActionSuccess(null);

    // Check Authoritative Source Protection Rule client-side warning
    if (
      actionType === "RESOLVE" &&
      selectedItem.sourceType === "ATTENDANCE_CORRECTION_PENDING" &&
      attemptedBypass
    ) {
      setActionError(
        "Authoritative Source Protection Violation: AttendanceCorrection approval belongs exclusively to the Attendance module. Use drill-down link /attendance/corrections to approve."
      );
      return;
    }

    setSubmittingAction(true);
    try {
      const payload: any = {
        action: actionType,
        remarks: actionRemarks,
      };

      if (actionType === "ASSIGN") {
        payload.ownerId = newOwnerId || user?.id;
      }
      if (actionType === "WORKFLOW_ACTION") {
        payload.workflowAction = workflowActionType;
      }
      if (actionType === "RESOLVE" && attemptedBypass) {
        payload.approveAttendanceCorrection = true;
      }

      const res = await fetch(
        `/api/v1/commercial/command-center/escalations/${selectedItem.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to execute action.");
      }

      setActionSuccess(`Action ${actionType} executed successfully.`);
      setActionRemarks("");

      // Refresh item detail and escalations list
      await openItemDetail(selectedItem);
      await fetchEscalations();
    } catch (err: any) {
      setActionError(err.message || "Failed to execute action.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Filtered escalations client-side search
  const filteredEscalations = escalations.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.sourceId.toLowerCase().includes(term) ||
      (item.siteName && item.siteName.toLowerCase().includes(term)) ||
      (item.contractTitle && item.contractTitle.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              Commercial Command Center — Operational Escalations
            </h1>
            <Badge variant="primary" style={{ backgroundColor: "#2563eb", color: "#ffffff" }}>
              CCC-3
            </Badge>
          </div>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "14px" }}>
            Centralized queue for operational exceptions, roster deficits, attendance reconciliations & SLA risk tracking
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Link href="/commercial/command-center">
            <Button variant="secondary" style={{ border: "1px solid #cbd5e1" }}>
              ← Command Center Dashboard
            </Button>
          </Link>
          <Link href="/commercial/command-center/roster-coverage">
            <Button variant="secondary" style={{ border: "1px solid #cbd5e1" }}>
              Roster Coverage Matrix
            </Button>
          </Link>
          <Link href="/commercial/command-center/commercial-health">
            <Button variant="secondary" style={{ border: "1px solid #4338ca", backgroundColor: "#4f46e5", color: "#ffffff" }}>
              Commercial &amp; SLA Health (CCC-4)
            </Button>
          </Link>
          <Button variant="primary" onClick={fetchEscalations} disabled={loading}>
            {loading ? "Refreshing..." : "↻ Refresh Queue"}
          </Button>
        </div>
      </div>

      {/* KPI Summary Scorecard */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <Card style={{ padding: "16px", borderLeft: "4px solid #3b82f6" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#64748b", fontWeight: "600" }}>
            Total Open
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#1e293b", marginTop: "4px" }}>
            {summaryMetrics.totalOpen}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Active Queue Items</div>
        </Card>

        <Card style={{ padding: "16px", borderLeft: "4px solid #ef4444" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#ef4444", fontWeight: "600" }}>
            Critical Severity
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#dc2626", marginTop: "4px" }}>
            {summaryMetrics.criticalCount}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Immediate Action Required</div>
        </Card>

        <Card style={{ padding: "16px", borderLeft: "4px solid #f97316" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#f97316", fontWeight: "600" }}>
            High Severity
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#ea580c", marginTop: "4px" }}>
            {summaryMetrics.highCount}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Elevated Operational Risk</div>
        </Card>

        <Card style={{ padding: "16px", borderLeft: "4px solid #b91c1c" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#b91c1c", fontWeight: "600" }}>
            SLA Overdue
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#991b1b", marginTop: "4px" }}>
            {summaryMetrics.overdueCount}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Breached Due Date</div>
        </Card>

        <Card style={{ padding: "16px", borderLeft: "4px solid #eab308" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#ca8a04", fontWeight: "600" }}>
            Unassigned
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#a16207", marginTop: "4px" }}>
            {summaryMetrics.unassignedCount}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Awaiting Owner</div>
        </Card>

        <Card style={{ padding: "16px", borderLeft: "4px solid #22c55e" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#16a34a", fontWeight: "600" }}>
            Resolved Today
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#15803d", marginTop: "4px" }}>
            {summaryMetrics.resolvedTodayCount}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Closed In Business Date</div>
        </Card>
      </div>

      {/* Filter Control Bar */}
      <Card style={{ padding: "16px", marginBottom: "24px", backgroundColor: "#f8fafc" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
              Business Date
            </label>
            <Input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
              Operation Scope
            </label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                backgroundColor: "#ffffff",
              }}
            >
              <option value="ALL">All Operations (SG & FM)</option>
              <option value="SECURITY_GUARDING">Security Guarding (SG)</option>
              <option value="FACILITY_MANAGEMENT">Facility Management (FM)</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
              Company Boundary
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                backgroundColor: "#ffffff",
              }}
            >
              <option value="">All Permitted Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
              Category / Source Type
            </label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                backgroundColor: "#ffffff",
              }}
            >
              <option value="ALL">All Escalation Types</option>
              <option value="UNCOVERED_ROSTER_SLOT">Uncovered Roster Slot</option>
              <option value="RELIEVER_DEFICIT">Reliever Deficit</option>
              <option value="ROSTER_PLANNING_EXCEPTION">Roster Planning Exception</option>
              <option value="UNEXCUSED_RECONCILIATION">Unexcused Attendance Reconciliation</option>
              <option value="ATTENDANCE_CORRECTION_PENDING">Pending Attendance Correction</option>
              <option value="CONTRACT_SLA_RISK">Contract SLA Risk</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
              Severity Level
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                backgroundColor: "#ffffff",
              }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
              Escalation Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                backgroundColor: "#ffffff",
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
              Search Title / Detail
            </label>
            <Input
              type="text"
              placeholder="Search title, site, contract..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                color: "#991b1b",
                marginBottom: "8px",
              }}
            >
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
                style={{ width: "16px", height: "16px" }}
              />
              Overdue SLA Only
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                setOperationType("ALL");
                setCompanyId("");
                setSourceType("ALL");
                setSeverity("ALL");
                setStatus("ALL");
                setOverdueOnly(false);
                setSearchTerm("");
              }}
              style={{ marginBottom: "4px", fontSize: "12px" }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            borderRadius: "6px",
            marginBottom: "20px",
            fontSize: "14px",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Register Register Table */}
      <Card style={{ padding: "0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
          <thead style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
            <tr>
              <th style={{ padding: "12px 16px", fontWeight: "600" }}>Escalation Key & Source</th>
              <th style={{ padding: "12px 16px", fontWeight: "600" }}>Title & Operational Detail</th>
              <th style={{ padding: "12px 16px", fontWeight: "600" }}>Scope & Location</th>
              <th style={{ padding: "12px 16px", fontWeight: "600" }}>Severity</th>
              <th style={{ padding: "12px 16px", fontWeight: "600" }}>Status</th>
              <th style={{ padding: "12px 16px", fontWeight: "600" }}>Due / SLA</th>
              <th style={{ padding: "12px 16px", fontWeight: "600" }}>Owner</th>
              <th style={{ padding: "12px 16px", fontWeight: "600", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                  Loading operational escalations queue...
                </td>
              </tr>
            ) : filteredEscalations.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                  No operational escalations found matching the selected filters.
                </td>
              </tr>
            ) : (
              filteredEscalations.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      backgroundColor: isSelected ? "#f0f9ff" : "transparent",
                      transition: "background-color 0.15s",
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: "600", fontSize: "13px", color: "#1e293b" }}>
                        {item.id}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {item.sourceType}
                      </div>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: "600", color: "#0f172a" }}>{item.title}</div>
                      <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                        {item.description}
                      </div>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <div>
                        <Badge
                          variant="secondary"
                          style={{
                            fontSize: "11px",
                            backgroundColor:
                              item.operationType === "SECURITY_GUARDING"
                                ? "#e0f2fe"
                                : item.operationType === "FACILITY_MANAGEMENT"
                                ? "#fef3c7"
                                : "#f1f5f9",
                            color:
                              item.operationType === "SECURITY_GUARDING"
                                ? "#0369a1"
                                : item.operationType === "FACILITY_MANAGEMENT"
                                ? "#b45309"
                                : "#475569",
                          }}
                        >
                          {item.operationType}
                        </Badge>
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                        {item.siteName || item.companyName || "Corporate / General"}
                      </div>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor:
                            item.severity === "CRITICAL"
                              ? "#fee2e2"
                              : item.severity === "HIGH"
                              ? "#ffedd5"
                              : item.severity === "MEDIUM"
                              ? "#fef9c3"
                              : "#e0e7ff",
                          color:
                            item.severity === "CRITICAL"
                              ? "#991b1b"
                              : item.severity === "HIGH"
                              ? "#c2410c"
                              : item.severity === "MEDIUM"
                              ? "#854d0e"
                              : "#3730a3",
                          fontWeight: "700",
                        }}
                      >
                        {item.severity}
                      </Badge>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor:
                            item.status === "OPEN"
                              ? "#ef4444"
                              : item.status === "ACKNOWLEDGED"
                              ? "#3b82f6"
                              : item.status === "ASSIGNED"
                              ? "#8b5cf6"
                              : item.status === "RESOLVED"
                              ? "#22c55e"
                              : "#94a3b8",
                          color: "#ffffff",
                          fontWeight: "600",
                        }}
                      >
                        {item.status}
                      </Badge>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: "12px", color: item.isOverdue ? "#dc2626" : "#475569", fontWeight: item.isOverdue ? "700" : "normal" }}>
                        {item.dueDate ? new Date(item.dueDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A"}
                      </div>
                      {item.isOverdue && (
                        <div style={{ fontSize: "10px", color: "#dc2626", fontWeight: "700" }}>OVERDUE</div>
                      )}
                    </td>

                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>
                      {item.assignedOwnerName || item.assignedOwnerId || <span style={{ color: "#94a3b8" }}>Unassigned</span>}
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <Button
                        variant="primary"
                        onClick={() => openItemDetail(item)}
                        style={{ fontSize: "12px", padding: "4px 10px" }}
                      >
                        Inspect & Manage
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Workspace Drawer / Detail Modal */}
      {selectedItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "650px",
            height: "100vh",
            backgroundColor: "#ffffff",
            boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Drawer Top Bar */}
          <div
            style={{
              padding: "16px 20px",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
                Escalation Detail Workspace
              </div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#ffffff", marginTop: "2px" }}>
                {selectedItem.id}
              </div>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                background: "none",
                border: "none",
                color: "#ffffff",
                fontSize: "20px",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>

          {/* 5-Tab Navigation Bar */}
          <div
            style={{
              display: "flex",
              backgroundColor: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            <button
              onClick={() => setDrawerTab("overview")}
              style={{
                flex: 1,
                padding: "12px 8px",
                border: "none",
                backgroundColor: drawerTab === "overview" ? "#ffffff" : "transparent",
                borderBottom: drawerTab === "overview" ? "2px solid #2563eb" : "none",
                color: drawerTab === "overview" ? "#2563eb" : "#64748b",
                cursor: "pointer",
              }}
            >
              1. Overview & Impact
            </button>

            <button
              onClick={() => setDrawerTab("metadata")}
              style={{
                flex: 1,
                padding: "12px 8px",
                border: "none",
                backgroundColor: drawerTab === "metadata" ? "#ffffff" : "transparent",
                borderBottom: drawerTab === "metadata" ? "2px solid #2563eb" : "none",
                color: drawerTab === "metadata" ? "#2563eb" : "#64748b",
                cursor: "pointer",
              }}
            >
              2. Source Metadata
            </button>

            <button
              onClick={() => setDrawerTab("drilldown")}
              style={{
                flex: 1,
                padding: "12px 8px",
                border: "none",
                backgroundColor: drawerTab === "drilldown" ? "#ffffff" : "transparent",
                borderBottom: drawerTab === "drilldown" ? "2px solid #2563eb" : "none",
                color: drawerTab === "drilldown" ? "#2563eb" : "#64748b",
                cursor: "pointer",
              }}
            >
              3. Module Link
            </button>

            <button
              onClick={() => setDrawerTab("workflow")}
              style={{
                flex: 1,
                padding: "12px 8px",
                border: "none",
                backgroundColor: drawerTab === "workflow" ? "#ffffff" : "transparent",
                borderBottom: drawerTab === "workflow" ? "2px solid #2563eb" : "none",
                color: drawerTab === "workflow" ? "#2563eb" : "#64748b",
                cursor: "pointer",
              }}
            >
              4. Workflow Action
            </button>

            <button
              onClick={() => setDrawerTab("audit")}
              style={{
                flex: 1,
                padding: "12px 8px",
                border: "none",
                backgroundColor: drawerTab === "audit" ? "#ffffff" : "transparent",
                borderBottom: drawerTab === "audit" ? "2px solid #2563eb" : "none",
                color: drawerTab === "audit" ? "#2563eb" : "#64748b",
                cursor: "pointer",
              }}
            >
              5. Audit History
            </button>
          </div>

          {/* Drawer Body Scrollable Content */}
          <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
            {loadingDetail ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                Loading full escalation details...
              </div>
            ) : (
              <>
                {/* TAB 1: OVERVIEW & HEALTH IMPACT */}
                {drawerTab === "overview" && (
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "12px" }}>
                      Operational Escalation Overview
                    </h3>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                      <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
                        <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Category</div>
                        <div style={{ fontWeight: "700", color: "#1e293b", marginTop: "2px" }}>{selectedItem.sourceType}</div>
                      </div>

                      <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
                        <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Severity</div>
                        <div style={{ fontWeight: "700", color: selectedItem.severity === "CRITICAL" ? "#dc2626" : "#2563eb", marginTop: "2px" }}>
                          {selectedItem.severity}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: "16px", backgroundColor: "#f1f5f9", borderRadius: "6px", marginBottom: "16px" }}>
                      <div style={{ fontWeight: "700", color: "#0f172a", marginBottom: "6px" }}>{selectedItem.title}</div>
                      <p style={{ color: "#334155", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>
                        {selectedItem.description}
                      </p>
                    </div>

                    <div style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "6px", marginBottom: "16px" }}>
                      <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#475569", margin: "0 0 8px 0" }}>
                        Command Center Health Impact
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#334155" }}>
                        <li>Operational Scope: <strong>{selectedItem.operationType}</strong></li>
                        <li>Authoritative Module: <strong>{selectedItem.authoritativeModule}</strong></li>
                        <li>Assigned Owner: <strong>{selectedItem.assignedOwnerName || "Unassigned"}</strong></li>
                        <li>Due SLA Target: <strong>{selectedItem.dueDate ? new Date(selectedItem.dueDate).toLocaleString() : "N/A"}</strong></li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* TAB 2: SOURCE METADATA */}
                {drawerTab === "metadata" && (
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "12px" }}>
                      Source Record Metadata
                    </h3>

                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Source ID:</label>
                      <code style={{ display: "block", padding: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", fontSize: "12px", marginTop: "4px" }}>
                        {selectedItem.sourceId}
                      </code>
                    </div>

                    {itemDetail?.sourceRecord ? (
                      <pre
                        style={{
                          backgroundColor: "#0f172a",
                          color: "#38bdf8",
                          padding: "16px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          overflowX: "auto",
                          maxHeight: "350px",
                        }}
                      >
                        {JSON.stringify(itemDetail.sourceRecord, null, 2)}
                      </pre>
                    ) : (
                      <div style={{ color: "#64748b", fontSize: "13px" }}>No raw source record returned.</div>
                    )}
                  </div>
                )}

                {/* TAB 3: AUTHORITATIVE MODULE LINK */}
                {drawerTab === "drilldown" && (
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "12px" }}>
                      Authoritative Operational Module Link
                    </h3>

                    <div
                      style={{
                        padding: "16px",
                        backgroundColor: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: "6px",
                        marginBottom: "16px",
                      }}
                    >
                      <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#1e40af", margin: "0 0 8px 0" }}>
                        Authoritative Source Protection Rule
                      </h4>
                      <p style={{ fontSize: "13px", color: "#1e3a8a", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                        Command Center (CCC-3) aggregates and monitors operational escalations across modules.
                        Specific domain operations (such as approving Attendance Corrections or altering Rosters) must be executed in their authoritative domain module.
                      </p>
                      <Link href={selectedItem.drillDownUrl} target="_blank">
                        <Button variant="primary" style={{ fontSize: "13px" }}>
                          Open Authoritative Module ({selectedItem.authoritativeModule}) ↗
                        </Button>
                      </Link>
                    </div>

                    {selectedItem.requiresAuthoritativeModuleApproval && (
                      <div
                        style={{
                          padding: "12px 16px",
                          backgroundColor: "#fffbebf",
                          border: "1px solid #fde68a",
                          color: "#92400e",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      >
                        <strong>Note:</strong> Approving this record in Command Center will return a 400 Bad Request. Use the drill-down link above to access the Attendance module.
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: WORKFLOW & OWNERSHIP ROUTING */}
                {drawerTab === "workflow" && (
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "12px" }}>
                      Workflow & Action Execution
                    </h3>

                    {/* Centralized Workflow Instance Info */}
                    {itemDetail?.workflowInstance && (
                      <div
                        style={{
                          padding: "12px 16px",
                          backgroundColor: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: "6px",
                          marginBottom: "16px",
                          fontSize: "13px",
                        }}
                      >
                        <div style={{ fontWeight: "700", color: "#166534" }}>
                          Central Workflow Active (Settings &gt; Workflow Setup)
                        </div>
                        <div style={{ color: "#15803d", marginTop: "4px" }}>
                          Current Level: Level {itemDetail.workflowInstance.currentLevelNumber} | Status: {itemDetail.workflowInstance.status}
                        </div>
                      </div>
                    )}

                    {/* Action Execution Form */}
                    <form onSubmit={handleExecuteAction}>
                      <div style={{ marginBottom: "12px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
                          Action Type
                        </label>
                        <select
                          value={actionType}
                          onChange={(e) => setActionType(e.target.value as any)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            fontSize: "14px",
                            backgroundColor: "#ffffff",
                          }}
                        >
                          <option value="ACKNOWLEDGE">ACKNOWLEDGE — Mark Received</option>
                          <option value="ASSIGN">ASSIGN — Reassign Owner</option>
                          <option value="COMMENT">COMMENT — Add Operational Remark</option>
                          <option value="RESOLVE">RESOLVE — Mark Escalation Resolved</option>
                          <option value="CANCEL">CANCEL — Dismiss Escalation</option>
                          {itemDetail?.workflowInstance && (
                            <option value="WORKFLOW_ACTION">WORKFLOW_ACTION — Step Approval</option>
                          )}
                        </select>
                      </div>

                      {actionType === "ASSIGN" && (
                        <div style={{ marginBottom: "12px" }}>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
                            Select Owner User ID
                          </label>
                          <Input
                            type="text"
                            placeholder="Enter owner user ID..."
                            value={newOwnerId}
                            onChange={(e) => setNewOwnerId(e.target.value)}
                            style={{ width: "100%" }}
                          />
                        </div>
                      )}

                      {actionType === "WORKFLOW_ACTION" && (
                        <div style={{ marginBottom: "12px" }}>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
                            Workflow Step Action
                          </label>
                          <select
                            value={workflowActionType}
                            onChange={(e) => setWorkflowActionType(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              fontSize: "14px",
                              backgroundColor: "#ffffff",
                            }}
                          >
                            <option value="APPROVE">APPROVE</option>
                            <option value="REJECT">REJECT</option>
                            <option value="RETURN">RETURN</option>
                          </select>
                        </div>
                      )}

                      {/* Authoritative Protection Test Checkbox */}
                      {actionType === "RESOLVE" && selectedItem.sourceType === "ATTENDANCE_CORRECTION_PENDING" && (
                        <div
                          style={{
                            padding: "12px",
                            backgroundColor: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: "6px",
                            marginBottom: "12px",
                          }}
                        >
                          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#991b1b", fontWeight: "600" }}>
                            <input
                              type="checkbox"
                              checked={attemptedBypass}
                              onChange={(e) => setAttemptedBypass(e.target.checked)}
                            />
                            Simulate direct AttendanceCorrection approval bypass (Testing Authoritative Protection)
                          </label>
                        </div>
                      )}

                      <div style={{ marginBottom: "16px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
                          Remarks / Operational Notes
                        </label>
                        <textarea
                          rows={3}
                          value={actionRemarks}
                          onChange={(e) => setActionRemarks(e.target.value)}
                          placeholder="Provide details regarding this action..."
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            fontSize: "13px",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>

                      {actionError && (
                        <div
                          style={{
                            padding: "10px 14px",
                            backgroundColor: "#fef2f2",
                            border: "1px solid #fecaca",
                            color: "#b91c1c",
                            borderRadius: "6px",
                            marginBottom: "12px",
                            fontSize: "12px",
                          }}
                        >
                          <strong>Protection Triggered:</strong> {actionError}
                        </div>
                      )}

                      {actionSuccess && (
                        <div
                          style={{
                            padding: "10px 14px",
                            backgroundColor: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            color: "#166534",
                            borderRadius: "6px",
                            marginBottom: "12px",
                            fontSize: "12px",
                          }}
                        >
                          {actionSuccess}
                        </div>
                      )}

                      <Button variant="primary" type="submit" disabled={submittingAction} style={{ width: "100%" }}>
                        {submittingAction ? "Submitting Action..." : `Execute ${actionType}`}
                      </Button>
                    </form>
                  </div>
                )}

                {/* TAB 5: IMMUTABLE AUDIT HISTORY */}
                {drawerTab === "audit" && (
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "12px" }}>
                      Immutable Action Audit Log
                    </h3>

                    {itemDetail?.auditHistory && itemDetail.auditHistory.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {itemDetail.auditHistory.map((log) => (
                          <div
                            key={log.id}
                            style={{
                              padding: "12px",
                              backgroundColor: "#f8fafc",
                              borderLeft: "3px solid #3b82f6",
                              borderRadius: "4px",
                              fontSize: "12px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                              <span style={{ fontWeight: "700", color: "#1e293b" }}>{log.action}</span>
                              <span>{new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                            <div style={{ color: "#475569", marginTop: "4px" }}>User: {log.userId}</div>
                            {log.afterJson && (
                              <pre
                                style={{
                                  backgroundColor: "#ffffff",
                                  padding: "8px",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "4px",
                                  marginTop: "6px",
                                  fontSize: "11px",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {log.afterJson}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "#64748b", fontSize: "13px" }}>
                        No audit history entries recorded for this escalation key yet.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
