"use client";

import React, { useState, useEffect } from "react";
import { SapConnection, SapSyncJob, SapSyncLog, SapFieldMapping, SapRetryQueue, SapExportQueue, SapReconciliationLog, SapPayrollStage, SapPayrollPeriodLock } from "@ahh-wfm/types";
import { Card, Badge, Button, Modal } from "@ahh-wfm/ui/src";

export default function SapIntegrationHub() {
  const [connections, setConnections] = useState<SapConnection[]>([]);
  const [jobs, setJobs] = useState<SapSyncJob[]>([]);
  const [logs, setLogs] = useState<SapSyncLog[]>([]);
  const [mappings, setMappings] = useState<SapFieldMapping[]>([]);
  const [retryQueue, setRetryQueue] = useState<SapRetryQueue[]>([]);
  const [exportQueue, setExportQueue] = useState<SapExportQueue[]>([]);
  const [reconciliationLogs, setReconciliationLogs] = useState<SapReconciliationLog[]>([]);
  const [payrollStages, setPayrollStages] = useState<SapPayrollStage[]>([]);
  const [periodLocks, setPeriodLocks] = useState<SapPayrollPeriodLock[]>([]);

  const [activeTab, setActiveTab] = useState<"dashboard" | "mappings" | "retry" | "export" | "reconciliation" | "payroll">("dashboard");
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [staging, setStaging] = useState(false);
  
  // Reconciliation settings
  const [reconPeriod, setReconPeriod] = useState("2026-06");
  const [reconModule, setReconModule] = useState("ATTENDANCE");
  const [payrollPeriod, setPayrollPeriod] = useState("2026-06");

  // Form states for Connection creation
  const [showConnModal, setShowConnModal] = useState(false);
  const [systemName, setSystemName] = useState("SAP SuccessFactors Sandbox");
  const [odataUrl, setOdataUrl] = useState("https://api.sandbox.successfactors.eu/odata/v2");
  const [clientId, setClientId] = useState("AHH_WFM_CLIENT_MOCK");
  const [companyId, setCompanyId] = useState("AlHattabWFM");
  const [userId, setUserId] = useState("sf_sync_user");
  const [privateKeyVaultId, setPrivateKeyVaultId] = useState("VAULT_SF_SANDBOX_KEY_REF");

  // Form states for Field Mapping creation
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mapModule, setMapModule] = useState("EMPLOYEE");
  const [mapSource, setMapSource] = useState("");
  const [mapTarget, setMapTarget] = useState("");
  const [mapTransform, setMapTransform] = useState("Direct");
  const [mapValidations, setMapValidations] = useState("REQUIRED");
  const [mapRequired, setMapRequired] = useState(true);

  // Sync Trigger settings
  const [selectedConn, setSelectedConn] = useState("");
  const [selectedModule, setSelectedModule] = useState("EMPLOYEE");
  const [selectedSyncType, setSelectedSyncType] = useState("INCREMENTAL");

  // Log Modal state
  const [selectedLog, setSelectedLog] = useState<SapSyncLog | null>(null);
  const [selectedJob, setSelectedJob] = useState<SapSyncJob | null>(null);

  const fetchData = async () => {
    try {
      const connRes = await fetch("/api/v1/sap/connections");
      if (connRes.ok) {
        const json = await connRes.json();
        setConnections(json);
        if (json.length > 0 && !selectedConn) {
          setSelectedConn(json[0].id);
        }
      }

      const jobsRes = await fetch("/api/v1/sap/jobs");
      if (jobsRes.ok) setJobs(await jobsRes.json());

      const logsRes = await fetch("/api/v1/sap/logs");
      if (logsRes.ok) setLogs(await logsRes.json());

      const mapsRes = await fetch("/api/v1/sap/mappings");
      if (mapsRes.ok) setMappings(await mapsRes.json());

      const retryRes = await fetch("/api/v1/sap/retry");
      if (retryRes.ok) setRetryQueue(await retryRes.json());

      const exportRes = await fetch("/api/v1/sap/export");
      if (exportRes.ok) setExportQueue(await exportRes.json());

      const reconRes = await fetch("/api/v1/sap/reconciliation");
      if (reconRes.ok) setReconciliationLogs(await reconRes.json());

      const payrollRes = await fetch("/api/v1/sap/payroll");
      if (payrollRes.ok) {
        const json = await payrollRes.json();
        setPayrollStages(json.stages);
        setPeriodLocks(json.locks);
      }
    } catch (e) {
      console.error("Failed to load SAP integration hub data", e);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "mappings" || tab === "retry" || tab === "export" || tab === "reconciliation" || tab === "payroll") {
        setActiveTab(tab as any);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [selectedConn]);

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/sap/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemName,
          odataUrl,
          clientId,
          companyId,
          userId,
          privateKeyVaultId,
          isActive: true
        })
      });
      if (res.ok) {
        setShowConnModal(false);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/sap/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: mapModule,
          sourceField: mapSource,
          targetField: mapTarget,
          transformRule: mapTransform,
          validationRules: mapValidations,
          isRequired: mapRequired,
          isActive: true
        })
      });
      if (res.ok) {
        setShowMappingModal(false);
        setMapSource("");
        setMapTarget("");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMapping = async (id: string, currentActive: boolean) => {
    try {
      await fetch("/api/v1/sap/mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          isActive: !currentActive
        })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerSync = async () => {
    if (!selectedConn) return;
    setSyncing(true);
    try {
      const endpoint = (selectedModule === "LEAVE" || selectedModule === "ATTENDANCE")
        ? "/api/v1/sap/export"
        : "/api/v1/sap/sync";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConn,
          module: selectedModule,
          syncType: selectedSyncType
        })
      });
      if (res.ok) {
        setTimeout(() => {
          setSyncing(false);
          fetchData();
        }, 1500);
      } else {
        setSyncing(false);
      }
    } catch (e) {
      setSyncing(false);
    }
  };

  const handleTriggerRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch("/api/v1/sap/retry", {
        method: "POST"
      });
      if (res.ok) {
        setTimeout(() => {
          setRetrying(false);
          fetchData();
        }, 1500);
      } else {
        setRetrying(false);
      }
    } catch (e) {
      setRetrying(false);
    }
  };

  const handleTriggerExportRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch("/api/v1/sap/export/retry", {
        method: "POST"
      });
      if (res.ok) {
        setTimeout(() => {
          setRetrying(false);
          fetchData();
        }, 1500);
      } else {
        setRetrying(false);
      }
    } catch (e) {
      setRetrying(false);
    }
  };

  const handleTriggerReconciliation = async () => {
    setReconciling(true);
    try {
      const res = await fetch("/api/v1/sap/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: reconPeriod,
          module: reconModule
        })
      });
      if (res.ok) {
        setTimeout(() => {
          setReconciling(false);
          fetchData();
        }, 1500);
      } else {
        setReconciling(false);
      }
    } catch (e) {
      setReconciling(false);
    }
  };

  const handleCalculatePayroll = async () => {
    setStaging(true);
    try {
      const res = await fetch("/api/v1/sap/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stage",
          period: payrollPeriod
        })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStaging(false);
    }
  };

  const handleToggleLockPayroll = async (period: string, currentLocked: boolean) => {
    try {
      const res = await fetch("/api/v1/sap/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lock",
          period,
          locked: !currentLocked
        })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprovePayrollStage = async (id: string, isApproved: boolean) => {
    try {
      const res = await fetch("/api/v1/sap/payroll", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          isApproved
        })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPayroll = async () => {
    if (!selectedConn) return;
    setStaging(true);
    try {
      const res = await fetch("/api/v1/sap/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "export",
          period: payrollPeriod,
          connectionId: selectedConn
        })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStaging(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Page Title & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">SAP SuccessFactors Integration Hub</h1>
          <p className="text-sm text-on-surface-variant">Manage inbound master data sync, schema field transformations, and logs</p>
        </div>
        <div className="flex bg-surface-container border border-outline-variant p-0.5 rounded-lg text-xs font-bold gap-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`py-1.5 px-3 rounded-md transition-colors ${
              activeTab === "dashboard" ? "bg-primary text-white" : "hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("payroll")}
            className={`py-1.5 px-3 rounded-md transition-colors ${
              activeTab === "payroll" ? "bg-primary text-white" : "hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            Payroll Staging
          </button>
          <button
            onClick={() => setActiveTab("export")}
            className={`py-1.5 px-3 rounded-md transition-colors ${
              activeTab === "export" ? "bg-primary text-white" : "hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            Export Queue ({exportQueue.filter(i => i.status === "PENDING" || i.status === "FAILED").length})
          </button>
          <button
            onClick={() => setActiveTab("reconciliation")}
            className={`py-1.5 px-3 rounded-md transition-colors ${
              activeTab === "reconciliation" ? "bg-primary text-white" : "hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            Reconciliation Board
          </button>
          <button
            onClick={() => setActiveTab("mappings")}
            className={`py-1.5 px-3 rounded-md transition-colors ${
              activeTab === "mappings" ? "bg-primary text-white" : "hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            Field Mappings
          </button>
          <button
            onClick={() => setActiveTab("retry")}
            className={`py-1.5 px-3 rounded-md transition-colors ${
              activeTab === "retry" ? "bg-primary text-white" : "hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            Inbound Retry ({retryQueue.filter(i => i.status === "PENDING").length})
          </button>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <>
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                  <span className="material-symbols-outlined">cloud_sync</span>
                </div>
                <Badge variant="success">SANDBOX MOCK</Badge>
              </div>
              <p className="text-outline-variant font-bold text-[10px] uppercase tracking-wider mb-0.5">Connection State</p>
              <h3 className="text-lg font-bold text-primary">Connected</h3>
              <p className="text-xs text-on-surface-variant mt-2">SF Endpoint is simulation-ready</p>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-50 rounded-lg text-secondary">
                  <span className="material-symbols-outlined">schedule_send</span>
                </div>
              </div>
              <p className="text-outline-variant font-bold text-[10px] uppercase tracking-wider mb-0.5">Sync Inbound Metrics</p>
              <h3 className="text-lg font-bold text-primary">
                {jobs.length > 0 ? jobs.reduce((acc, job) => acc + job.recordsSucceeded, 0) : 0} Success
              </h3>
              <p className="text-xs text-on-surface-variant mt-2">
                Failed: {jobs.length > 0 ? jobs.reduce((acc, job) => acc + job.recordsFailed, 0) : 0} items
              </p>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  <span className="material-symbols-outlined">rule</span>
                </div>
              </div>
              <p className="text-outline-variant font-bold text-[10px] uppercase tracking-wider mb-0.5">Outbound Export Queue</p>
              <h3 className="text-lg font-bold text-primary">{exportQueue.length} Total Items</h3>
              <p className="text-xs text-on-surface-variant mt-2">
                Pending: {exportQueue.filter(i => i.status === "PENDING" || i.status === "FAILED").length} items
              </p>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-red-50 rounded-lg text-status-error">
                  <span className="material-symbols-outlined">warning</span>
                </div>
              </div>
              <p className="text-outline-variant font-bold text-[10px] uppercase tracking-wider mb-0.5">Inbound Retry Queue</p>
              <h3 className="text-lg font-bold text-primary">{retryQueue.filter(i => i.status === "PENDING").length} Pending</h3>
              <p className="text-xs text-status-error mt-2 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">hourglass_empty</span> Queued for retry
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sync Controls Panel & Connections */}
            <div className="space-y-6">
              <Card>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">power</span> Connection Configurations
                  </h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-[10px] py-1 font-bold"
                    onClick={() => setShowConnModal(true)}
                  >
                    Add Connection
                  </Button>
                </div>
                {connections.length === 0 ? (
                  <p className="text-xs text-on-surface-variant p-4 text-center">No connection defined.</p>
                ) : (
                  <div className="space-y-3">
                    {connections.map((conn) => (
                      <div key={conn.id} className="p-3 border border-border-subtle rounded-lg text-xs space-y-1 bg-surface-container-low">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-primary">{conn.systemName}</span>
                          <Badge variant={conn.isActive ? "success" : "neutral"}>
                            {conn.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        <p className="text-on-surface-variant font-mono text-[10px] overflow-hidden truncate">{conn.odataUrl}</p>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-outline-variant mt-2 pt-2 border-t border-border-subtle/50">
                          <div>
                            <span className="font-semibold text-on-surface-variant">Client ID:</span> {conn.clientId}
                          </div>
                          <div>
                            <span className="font-semibold text-on-surface-variant">Company:</span> {conn.companyId}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-secondary">sync_alt</span> Trigger Integration Sync
                </h3>
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-on-surface-variant mb-1">Target Connection</label>
                    <select
                      value={selectedConn}
                      onChange={(e) => setSelectedConn(e.target.value)}
                      className="w-full p-2 border border-outline-variant rounded-md bg-white text-xs"
                    >
                      <option value="">Select connection...</option>
                      {connections.map(c => (
                        <option key={c.id} value={c.id}>{c.systemName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-on-surface-variant mb-1">Integration Module</label>
                    <select
                      value={selectedModule}
                      onChange={(e) => setSelectedModule(e.target.value)}
                      className="w-full p-2 border border-outline-variant rounded-md bg-white text-xs"
                    >
                      <option value="EMPLOYEE">Organization & Employee Sync (Inbound)</option>
                      <option value="LEAVE">Leave Outbound Sync (EmployeeTime)</option>
                      <option value="ATTENDANCE">Attendance Outbound Sync (TimeSheetEntry)</option>
                      <option value="OVERTIME">Overtime Outbound Sync (EmpCompensation)</option>
                      <option value="ROSTER">Shift Roster Outbound Sync (ShiftAssignment)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-on-surface-variant mb-1">Sync Type Mode</label>
                    <select
                      value={selectedSyncType}
                      onChange={(e) => setSelectedSyncType(e.target.value)}
                      className="w-full p-2 border border-outline-variant rounded-md bg-white text-xs"
                    >
                      <option value="INCREMENTAL">Incremental Ingestion / Export</option>
                      <option value="FULL">Full Synchronisation</option>
                      <option value="MANUAL">Manual Diagnostics Sync</option>
                    </select>
                  </div>
                  <Button
                    onClick={handleTriggerSync}
                    disabled={syncing || !selectedConn}
                    className="w-full text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <span className={`material-symbols-outlined text-sm ${syncing ? "animate-spin" : ""}`}>
                      sync
                    </span>
                    <span>
                      {syncing
                        ? "Processing Integration data..."
                        : (selectedModule === "LEAVE" || selectedModule === "ATTENDANCE" || selectedModule === "OVERTIME" || selectedModule === "ROSTER")
                          ? "Trigger Outbound Export"
                          : "Trigger Inbound Sync"
                      }
                    </span>
                  </Button>
                </div>
              </Card>
            </div>

            {/* Sync Job History Table */}
            <Card className="lg:col-span-2 flex flex-col p-0">
              <div className="p-4 border-b border-border-subtle bg-surface-container-low flex items-center gap-2 rounded-t-xl">
                <span className="material-symbols-outlined text-primary">history</span>
                <h3 className="text-xs font-bold uppercase text-primary">Sync Job Execution History</h3>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left">
                  <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                    <tr>
                      <th className="p-3">Job ID</th>
                      <th className="p-3">Module</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-center">Records (S/F/P)</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-xs">
                    {jobs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-on-surface-variant text-xs">
                          No sync jobs run yet. Click "Trigger Manual Sync" to run simulation.
                        </td>
                      </tr>
                    ) : (
                      jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="p-3 font-mono font-bold text-[10px] text-primary">{job.id}</td>
                          <td className="p-3 font-semibold text-primary">{job.module}</td>
                          <td className="p-3 text-on-surface-variant">{job.syncType}</td>
                          <td className="p-3">
                            <Badge
                              variant={
                                job.status === "COMPLETED"
                                  ? "success"
                                  : job.status === "FAILED"
                                  ? "error"
                                  : "warning"
                              }
                            >
                              {job.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-center text-[11px] font-mono">
                            <span className="text-green-600 font-bold">{job.recordsSucceeded}</span>/
                            <span className="text-red-500 font-bold">{job.recordsFailed}</span>/
                            <span className="text-outline-variant">{job.recordsProcessed}</span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setSelectedJob(job)}
                              className="text-secondary hover:underline font-bold text-[10px]"
                            >
                              Check Audit Logs
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      {activeTab === "mappings" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-container-low flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">schema</span>
              <h3 className="text-xs font-bold uppercase text-primary font-bold">Field Mapping & Schema Translations</h3>
            </div>
            <Button
              size="sm"
              className="text-[10px] py-1 font-bold flex items-center gap-1"
              onClick={() => setShowMappingModal(true)}
            >
              <span className="material-symbols-outlined text-sm">add</span> New Rule Mapping
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                <tr>
                  <th className="p-4">Integration Module</th>
                  <th className="p-4">SAP OData Property (Source)</th>
                  <th className="p-4">WFM Local Field (Target)</th>
                  <th className="p-4">Transform Formula</th>
                  <th className="p-4">Validations</th>
                  <th className="p-4 text-center">Required</th>
                  <th className="p-4 text-center">Active</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-on-surface-variant">
                      No field mapping rules registered.
                    </td>
                  </tr>
                ) : (
                  mappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-4 font-bold text-primary">{mapping.module}</td>
                      <td className="p-4 font-mono text-primary text-[11px] font-bold bg-surface-container-low/50">
                        {mapping.sourceField}
                      </td>
                      <td className="p-4 font-mono text-secondary text-[11px] font-bold">
                        {mapping.targetField}
                      </td>
                      <td className="p-4 font-semibold text-on-surface-variant">{mapping.transformRule}</td>
                      <td className="p-4 font-mono text-[10px] text-outline-variant">{mapping.validationRules || "-"}</td>
                      <td className="p-4 text-center">
                        <Badge variant={mapping.isRequired ? "error" : "neutral"}>
                          {mapping.isRequired ? "Yes" : "No"}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant={mapping.isActive ? "success" : "neutral"}>
                          {mapping.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-[10px] py-1 px-2.5 font-bold"
                          onClick={() => handleToggleMapping(mapping.id, mapping.isActive)}
                        >
                          {mapping.isActive ? "Disable" : "Enable"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === "retry" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-container-low flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">warning</span>
              <h3 className="text-xs font-bold uppercase text-primary font-bold">SAP Retry Queue & Dead-Letter Logs</h3>
            </div>
            <Button
              size="sm"
              disabled={retrying || retryQueue.filter(i => i.status === "PENDING").length === 0}
              className="text-[10px] py-1.5 font-bold flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleTriggerRetry}
            >
              <span className={`material-symbols-outlined text-sm ${retrying ? "animate-spin" : ""}`}>
                replay
              </span>
              <span>{retrying ? "Re-processing queue..." : "Run Queue Retry Now"}</span>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                <tr>
                  <th className="p-4">Queue Item ID</th>
                  <th className="p-4">Module</th>
                  <th className="p-4">Entity ID Reference</th>
                  <th className="p-4 text-center">Retry Count</th>
                  <th className="p-4">Next Attempt Scheduled</th>
                  <th className="p-4">Last Error Reason</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {retryQueue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-on-surface-variant">
                      Retry queue is empty. Trigger a sync job with missing fields to verify.
                    </td>
                  </tr>
                ) : (
                  retryQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-4 font-mono font-bold text-[10px] text-primary">{item.id}</td>
                      <td className="p-4 font-bold text-on-surface-variant">{item.module}</td>
                      <td className="p-4 font-mono text-[11px] font-semibold text-secondary">{item.entityId}</td>
                      <td className="p-4 text-center font-mono font-semibold">{item.retryCount}</td>
                      <td className="p-4 font-mono text-[10px] text-outline-variant">{item.nextAttemptAt}</td>
                      <td className="p-4 text-status-error font-medium truncate max-w-xs">{item.lastError || "None"}</td>
                      <td className="p-4">
                        <Badge
                          variant={
                            item.status === "RESOLVED"
                              ? "success"
                              : item.status === "FAILED_DLQ"
                              ? "error"
                              : "warning"
                          }
                        >
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === "payroll" && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-secondary">payments</span> Payroll Staging & Period Locks Console
            </h3>
            <div className="flex flex-wrap items-end gap-4 text-xs">
              <div className="w-48">
                <label className="block font-semibold text-on-surface-variant mb-1">Target Payroll Period</label>
                <select
                  value={payrollPeriod}
                  onChange={(e) => setPayrollPeriod(e.target.value)}
                  className="w-full p-2 border border-outline-variant rounded-md bg-white text-xs"
                >
                  <option value="2026-06">June 2026 (2026-06)</option>
                  <option value="2026-07">July 2026 (2026-07)</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleCalculatePayroll}
                  disabled={staging || periodLocks.some(l => l.period === payrollPeriod && l.locked)}
                  className="text-xs font-bold flex items-center gap-1.5"
                >
                  <span className={`material-symbols-outlined text-sm ${staging ? "animate-spin" : ""}`}>
                    calculate
                  </span>
                  <span>Stage Period Overtime</span>
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => handleToggleLockPayroll(payrollPeriod, periodLocks.some(l => l.period === payrollPeriod && l.locked))}
                  className={`text-xs font-bold flex items-center gap-1.5 ${
                    periodLocks.some(l => l.period === payrollPeriod && l.locked)
                      ? "text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                      : "text-green-600 border-green-200 bg-green-50 hover:bg-green-100"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {periodLocks.some(l => l.period === payrollPeriod && l.locked) ? "lock" : "lock_open"}
                  </span>
                  <span>
                    {periodLocks.some(l => l.period === payrollPeriod && l.locked) ? "Unlock Period" : "Lock & Freeze Period"}
                  </span>
                </Button>

                <Button
                  onClick={handleExportPayroll}
                  disabled={staging || !periodLocks.some(l => l.period === payrollPeriod && l.locked) || payrollStages.filter(s => s.payrollPeriod === payrollPeriod && s.isApproved && !s.isExported).length === 0}
                  className="text-xs font-bold flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white"
                >
                  <span className="material-symbols-outlined text-sm">
                    send
                  </span>
                  <span>Export Locked Package to SAP</span>
                </Button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] font-semibold text-outline-variant">Period Status:</span>
                {periodLocks.some(l => l.period === payrollPeriod && l.locked) ? (
                  <Badge variant="error">LOCKED & FROZEN</Badge>
                ) : (
                  <Badge variant="success">OPEN FOR EDITS</Badge>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-surface-container-low flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                <h3 className="text-xs font-bold uppercase text-primary">Staged Compensation Wage Component Line-Items</h3>
              </div>
              <div className="text-xs text-on-surface-variant font-mono">
                Total Staged Hours: <span className="font-bold text-primary">{payrollStages.filter(s => s.payrollPeriod === payrollPeriod).reduce((acc, s) => acc + s.calculatedHours, 0).toFixed(2)}h</span>
                {" | "}
                Estimated Pay: <span className="font-bold text-primary">{payrollStages.filter(s => s.payrollPeriod === payrollPeriod).reduce((acc, s) => acc + s.calculatedPay, 0).toLocaleString()} QAR</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                  <tr>
                    <th className="p-4">Staged ID</th>
                    <th className="p-4">Employee ID</th>
                    <th className="p-4">Wage Type Code</th>
                    <th className="p-4 text-center">Hours</th>
                    <th className="p-4 text-center">Estimated Pay</th>
                    <th className="p-4 text-center">Approved</th>
                    <th className="p-4 text-center">Sync Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-xs">
                  {payrollStages.filter(s => s.payrollPeriod === payrollPeriod).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-on-surface-variant">
                        No staged lines for this period. Click "Stage Period Overtime" to parse approved timesheets.
                      </td>
                    </tr>
                  ) : (
                    payrollStages.filter(s => s.payrollPeriod === payrollPeriod).map((stage) => (
                      <tr key={stage.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-4 font-mono font-bold text-[10px] text-primary">{stage.id}</td>
                        <td className="p-4 font-bold text-on-surface-variant">{stage.employeeId}</td>
                        <td className="p-4 font-mono text-[11px] font-bold text-secondary">{stage.wageType}</td>
                        <td className="p-4 text-center font-mono font-semibold">{stage.calculatedHours.toFixed(2)}h</td>
                        <td className="p-4 text-center font-mono font-semibold text-green-600">{stage.calculatedPay.toLocaleString()} QAR</td>
                        <td className="p-4 text-center">
                          <Badge variant={stage.isApproved ? "success" : "warning"}>
                            {stage.isApproved ? "Approved" : "Pending Approval"}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant={stage.isExported ? "success" : "neutral"}>
                            {stage.isExported ? "Exported" : "Staged"}
                          </Badge>
                        </td>
                        <td className="p-4 text-right space-x-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={periodLocks.some(l => l.period === payrollPeriod && l.locked) || stage.isExported}
                            className="text-[10px] py-1 px-2.5 font-bold"
                            onClick={() => handleApprovePayrollStage(stage.id, !stage.isApproved)}
                          >
                            {stage.isApproved ? "Reject" : "Approve"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "export" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-container-low flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">outbox</span>
              <h3 className="text-xs font-bold uppercase text-primary font-bold">SAP Outbound Export Queue & Idempotency Logs</h3>
            </div>
            <Button
              size="sm"
              disabled={retrying || exportQueue.filter(i => i.status === "FAILED" || i.status === "PENDING").length === 0}
              className="text-[10px] py-1.5 font-bold flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleTriggerExportRetry}
            >
              <span className={`material-symbols-outlined text-sm ${retrying ? "animate-spin" : ""}`}>
                replay
              </span>
              <span>{retrying ? "Re-processing exports..." : "Retry Failed/Pending Exports"}</span>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                <tr>
                  <th className="p-4">Idempotency Key</th>
                  <th className="p-4">Module</th>
                  <th className="p-4">Record ID</th>
                  <th className="p-4">SAP Ack ID</th>
                  <th className="p-4">Ack Status</th>
                  <th className="p-4">Ack Timestamp</th>
                  <th className="p-4 text-center">Retries</th>
                  <th className="p-4">Payload Preview</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {exportQueue.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-on-surface-variant">
                      No records exported yet. Trigger an outbound export from the dashboard.
                    </td>
                  </tr>
                ) : (
                  exportQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-4 font-mono font-bold text-[10px] text-primary">{item.idempotencyKey}</td>
                      <td className="p-4 font-bold text-on-surface-variant">{item.module}</td>
                      <td className="p-4 font-mono text-[11px] font-semibold text-secondary">{item.recordId}</td>
                      <td className="p-4 font-mono text-[10px] text-primary font-bold">{item.sapAckId || "-"}</td>
                      <td className="p-4">
                        {item.sapAckStatus ? (
                          <Badge variant="success">{item.sapAckStatus}</Badge>
                        ) : (
                          <span className="text-outline-variant font-medium">-</span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-[10px] text-outline-variant">{item.sapAckTimestamp || "-"}</td>
                      <td className="p-4 text-center font-mono font-semibold">{item.retryCount}</td>
                      <td className="p-4 max-w-xs">
                        <div className="font-mono text-[10px] bg-surface-container p-1 rounded overflow-x-auto truncate select-all">
                          {item.payload}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={
                            item.status === "SENT"
                              ? "success"
                              : item.status === "FAILED"
                              ? "error"
                              : "warning"
                          }
                        >
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === "reconciliation" && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-secondary">balance</span> Run Reconciliation Engine Audit
            </h3>
            <div className="flex flex-wrap items-end gap-4 text-xs">
              <div className="w-48">
                <label className="block font-semibold text-on-surface-variant mb-1">Payroll Period</label>
                <select
                  value={reconPeriod}
                  onChange={(e) => setReconPeriod(e.target.value)}
                  className="w-full p-2 border border-outline-variant rounded-md bg-white text-xs"
                >
                  <option value="2026-06">June 2026 (2026-06)</option>
                  <option value="2026-07">July 2026 (2026-07)</option>
                </select>
              </div>
              <div className="w-48">
                <label className="block font-semibold text-on-surface-variant mb-1">Module</label>
                <select
                  value={reconModule}
                  onChange={(e) => setReconModule(e.target.value)}
                  className="w-full p-2 border border-outline-variant rounded-md bg-white text-xs"
                >
                  <option value="ATTENDANCE">Attendance Hours (TimeSheetEntry)</option>
                  <option value="LEAVE">Leave Approvals (EmployeeTime)</option>
                </select>
              </div>
              <Button
                onClick={handleTriggerReconciliation}
                disabled={reconciling}
                className="text-xs font-bold flex items-center gap-1.5"
              >
                <span className={`material-symbols-outlined text-sm ${reconciling ? "animate-spin" : ""}`}>
                  assessment
                </span>
                <span>{reconciling ? "Generating Audits..." : "Compare WFM vs SAP"}</span>
              </Button>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-surface-container-low flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">difference</span>
              <h3 className="text-xs font-bold uppercase text-primary font-bold">WFM vs SAP Reconciliation Audit Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                  <tr>
                    <th className="p-4">Audit ID</th>
                    <th className="p-4">Employee ID</th>
                    <th className="p-4">Period</th>
                    <th className="p-4">Module</th>
                    <th className="p-4 text-center">WFM Hours</th>
                    <th className="p-4 text-center">SAP Hours</th>
                    <th className="p-4 text-center">Discrepancy</th>
                    <th className="p-4">Comments</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-xs">
                  {reconciliationLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-on-surface-variant">
                        No reconciliation audits generated. Select a period and run audit.
                      </td>
                    </tr>
                  ) : (
                    reconciliationLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-4 font-mono font-bold text-[10px] text-primary">{log.id}</td>
                        <td className="p-4 font-bold text-on-surface-variant">{log.employeeId}</td>
                        <td className="p-4 font-mono text-[10px] text-outline-variant">{log.period}</td>
                        <td className="p-4 font-semibold text-primary">{log.module}</td>
                        <td className="p-4 text-center font-mono font-semibold">{log.wfmHours}h</td>
                        <td className="p-4 text-center font-mono font-semibold">{log.sapHours}h</td>
                        <td className={`p-4 text-center font-mono font-bold ${log.discrepancy !== 0 ? "text-status-error" : "text-green-600"}`}>
                          {log.discrepancy > 0 ? `+${log.discrepancy}` : log.discrepancy}h
                        </td>
                        <td className="p-4 font-medium text-on-surface-variant max-w-xs truncate">{log.comments || "-"}</td>
                        <td className="p-4">
                          <Badge
                            variant={
                              log.status === "MATCHED"
                                ? "success"
                                : log.status === "RESOLVED"
                                ? "info"
                                : "error"
                            }
                          >
                            {log.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Add Connection Modal */}
      <Modal
        isOpen={showConnModal}
        onClose={() => setShowConnModal(false)}
        title="Add SAP SuccessFactors Connection"
      >
        <form onSubmit={handleCreateConnection} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-on-surface-variant mb-1">System Environment Name</label>
            <input
              type="text"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              className="w-full p-2 border border-outline-variant rounded-md text-xs"
              required
            />
          </div>
          <div>
            <label className="block font-semibold text-on-surface-variant mb-1">SAP OData API URL Endpoint</label>
            <input
              type="url"
              value={odataUrl}
              onChange={(e) => setOdataUrl(e.target.value)}
              className="w-full p-2 border border-outline-variant rounded-md text-xs"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-on-surface-variant mb-1">OAuth Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full p-2 border border-outline-variant rounded-md text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-on-surface-variant mb-1">Company ID</label>
              <input
                type="text"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full p-2 border border-outline-variant rounded-md text-xs"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-on-surface-variant mb-1">Sync Service User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full p-2 border border-outline-variant rounded-md text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-on-surface-variant mb-1">Private Key Vault reference ID</label>
              <input
                type="text"
                value={privateKeyVaultId}
                onChange={(e) => setPrivateKeyVaultId(e.target.value)}
                className="w-full p-2 border border-outline-variant rounded-md text-xs"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
            <Button variant="secondary" onClick={() => setShowConnModal(false)}>Cancel</Button>
            <Button type="submit">Register Endpoint Connection</Button>
          </div>
        </form>
      </Modal>

      {/* Add Field Mapping Modal */}
      <Modal
        isOpen={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        title="Add SAP Field Schema Mapping Rule"
      >
        <form onSubmit={handleCreateMapping} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-on-surface-variant mb-1">Integration Module</label>
            <select
              value={mapModule}
              onChange={(e) => setMapModule(e.target.value)}
              className="w-full p-2 border border-outline-variant rounded-md bg-white text-xs"
            >
              <option value="EMPLOYEE">ORGANIZATION & EMPLOYEE MASTER</option>
              <option value="LEAVE">LEAVE BALANCES & ACCRUALS</option>
              <option value="ATTENDANCE">ATTENDANCE TIMESHEETS</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-on-surface-variant mb-1">SAP OData Property (Source)</label>
              <input
                type="text"
                value={mapSource}
                onChange={(e) => setMapSource(e.target.value)}
                placeholder="e.g. personalInfo.firstName"
                className="w-full p-2 border border-outline-variant rounded-md text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-on-surface-variant mb-1">WFM Local Field (Target)</label>
              <input
                type="text"
                value={mapTarget}
                onChange={(e) => setMapTarget(e.target.value)}
                placeholder="e.g. name"
                className="w-full p-2 border border-outline-variant rounded-md text-xs"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-on-surface-variant mb-1">Transformation Formula</label>
              <select
                value={mapTransform}
                onChange={(e) => setMapTransform(e.target.value)}
                className="w-full p-2 border border-outline-variant rounded-md bg-white text-xs"
              >
                <option value="Direct">Direct string mapping</option>
                <option value="Lowercase">Cast to Lowercase</option>
                <option value="Uppercase">Cast to Uppercase</option>
                <option value="Lookup">Code Table Lookup</option>
                <option value="ValueMap">Custom Value Matrix</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-on-surface-variant mb-1">Schema Validation Rules</label>
              <input
                type="text"
                value={mapValidations}
                onChange={(e) => setMapValidations(e.target.value)}
                placeholder="e.g. EMAIL or REQUIRED"
                className="w-full p-2 border border-outline-variant rounded-md text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="mapRequired"
              checked={mapRequired}
              onChange={(e) => setMapRequired(e.target.checked)}
              className="w-4 h-4 rounded text-primary"
            />
            <label htmlFor="mapRequired" className="font-semibold text-on-surface-variant">Mandatory verification constraint</label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
            <Button variant="secondary" onClick={() => setShowMappingModal(false)}>Cancel</Button>
            <Button type="submit">Save Translation Rule</Button>
          </div>
        </form>
      </Modal>

      {/* Sync Job Audit Details Modal */}
      <Modal
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title={`Sync Job Details: ${selectedJob?.id}`}
      >
        {selectedJob && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-surface-container p-3 rounded-lg border border-border-subtle">
              <div>
                <span className="font-semibold text-outline-variant uppercase text-[10px]">Job Module / Type</span>
                <p className="font-bold text-primary">{selectedJob.module} / {selectedJob.syncType}</p>
              </div>
              <div>
                <span className="font-semibold text-outline-variant uppercase text-[10px]">Status</span>
                <p className="mt-0.5"><Badge variant="success">{selectedJob.status}</Badge></p>
              </div>
              <div>
                <span className="font-semibold text-outline-variant uppercase text-[10px]">Started At</span>
                <p className="font-mono text-primary font-semibold">{selectedJob.startedAt}</p>
              </div>
              <div>
                <span className="font-semibold text-outline-variant uppercase text-[10px]">Completed At</span>
                <p className="font-mono text-primary font-semibold">{selectedJob.completedAt || "-"}</p>
              </div>
            </div>

            <div className="border-t border-border-subtle pt-4">
              <h4 className="font-bold text-primary uppercase text-[10px] tracking-wider mb-2">Job Run Trace Logs</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {logs
                  .filter((log) => log.jobId === selectedJob.id || log.jobId === `RETRY-RQ-${selectedJob.id.split("-")[1]}`)
                  .map((log) => (
                    <div key={log.id} className="p-2.5 border border-border-subtle rounded bg-surface-container-low text-xs flex items-start gap-2">
                      <span className={`material-symbols-outlined text-sm mt-0.5 ${
                        log.severity === "ERROR" ? "text-status-error" : log.severity === "WARN" ? "text-amber-500" : "text-green-600"
                      }`}>
                        {log.severity === "ERROR" ? "error" : log.severity === "WARN" ? "warning" : "info"}
                      </span>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-outline-variant font-mono">
                          <span>{log.createdAt}</span>
                          <span>{log.severity}</span>
                        </div>
                        <p className="text-on-surface text-primary font-medium">{log.message}</p>
                      </div>
                    </div>
                  ))}
                {logs.filter((log) => log.jobId === selectedJob.id).length === 0 && (
                  <p className="text-center text-on-surface-variant p-4">No diagnostic logs found for this job run.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-border-subtle pt-4 mt-6">
              <Button variant="secondary" onClick={() => setSelectedJob(null)}>Close View</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
