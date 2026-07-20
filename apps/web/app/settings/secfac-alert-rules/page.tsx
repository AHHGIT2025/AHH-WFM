"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { OperationType, SecFacAlertRule } from "@ahh-wfm/types";

export default function SecFacAlertRulesSettingsPage() {
  const [operationType, setOperationType] = useState<"SECURITY_GUARDING" | "FACILITY_MANAGEMENT">("SECURITY_GUARDING");
  const [rules, setRules] = useState<SecFacAlertRule[]>([]);
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Edit / Create Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SecFacAlertRule | null>(null);
  const [formData, setFormData] = useState({
    code: "GUARD_NO_SHOW",
    name: "",
    description: "",
    sourceType: "ATTENDANCE_SCHEDULING",
    severity: "HIGH",
    isActive: false,
    triggerAfterMinutes: "15",
    reminderIntervalMinutes: "30",
    maximumReminders: "3",
    targetRole: "SECURITY_SUPERVISOR",
    fallbackRole: "SECURITY_OPERATIONS_MANAGER",
    projectId: "",
    siteId: ""
  });
  const [saving, setSaving] = useState(false);

  const fetchRulesAndReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ operationType });
      if (search) q.append("search", search);

      const [resRules, resReadiness] = await Promise.all([
        fetch(`/api/v1/secfac/alert-rules?${q.toString()}`),
        fetch(`/api/v1/secfac/alert-rules/readiness?operationType=${operationType}`)
      ]);

      if (!resRules.ok) {
        const errData = await resRules.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load alert rules");
      }
      const dataRules = await resRules.json();
      setRules(dataRules.rules || []);

      if (resReadiness.ok) {
        const dataReadiness = await resReadiness.json();
        setReadiness(dataReadiness);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load alert rules");
    } finally {
      setLoading(false);
    }
  }, [operationType, search]);

  useEffect(() => {
    fetchRulesAndReadiness();
  }, [fetchRulesAndReadiness]);

  const handleSeedTemplates = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/v1/secfac/alert-rules/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationType })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Seeding failed");
      }
      const data = await res.json();
      alert(data.message);
      fetchRulesAndReadiness();
    } catch (e: any) {
      alert(`Seeding failed: ${e?.message || e}`);
    } finally {
      setSeeding(false);
    }
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setFormData({
      code: operationType === "SECURITY_GUARDING" ? "GUARD_NO_SHOW" : "EMPLOYEE_NO_SHOW",
      name: "",
      description: "",
      sourceType: "ATTENDANCE_SCHEDULING",
      severity: "HIGH",
      isActive: false, // Default inactive per business rules
      triggerAfterMinutes: "15",
      reminderIntervalMinutes: "30",
      maximumReminders: "3",
      targetRole: operationType === "SECURITY_GUARDING" ? "SECURITY_SUPERVISOR" : "FM_SUPERVISOR",
      fallbackRole: operationType === "SECURITY_GUARDING" ? "SECURITY_OPERATIONS_MANAGER" : "FM_OPERATIONS_MANAGER",
      projectId: "",
      siteId: ""
    });
    setModalOpen(true);
  };

  const openEditModal = (rule: SecFacAlertRule) => {
    setEditingRule(rule);
    setFormData({
      code: rule.code,
      name: rule.name,
      description: rule.description || "",
      sourceType: rule.sourceType,
      severity: rule.severity,
      isActive: rule.isActive,
      triggerAfterMinutes: rule.triggerAfterMinutes ? String(rule.triggerAfterMinutes) : "",
      reminderIntervalMinutes: rule.reminderIntervalMinutes ? String(rule.reminderIntervalMinutes) : "",
      maximumReminders: String(rule.maximumReminders || 0),
      targetRole: rule.targetRole || "",
      fallbackRole: rule.fallbackRole || "",
      projectId: rule.projectId || "",
      siteId: rule.siteId || ""
    });
    setModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        operationType,
        code: formData.code,
        name: formData.name,
        description: formData.description,
        sourceType: formData.sourceType,
        severity: formData.severity,
        isActive: formData.isActive,
        triggerAfterMinutes: formData.triggerAfterMinutes ? parseInt(formData.triggerAfterMinutes, 10) : null,
        reminderIntervalMinutes: formData.reminderIntervalMinutes ? parseInt(formData.reminderIntervalMinutes, 10) : null,
        maximumReminders: parseInt(formData.maximumReminders || "0", 10),
        targetRole: formData.targetRole || null,
        fallbackRole: formData.fallbackRole || null,
        projectId: formData.projectId || null,
        siteId: formData.siteId || null
      };

      const url = editingRule ? `/api/v1/secfac/alert-rules/${editingRule.id}` : `/api/v1/secfac/alert-rules`;
      const method = editingRule ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Save failed");
      }

      setModalOpen(false);
      fetchRulesAndReadiness();
    } catch (e: any) {
      alert(`Save failed: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const securityCodes = [
    "GUARD_NO_SHOW",
    "LATE_ARRIVAL",
    "WRONG_SITE_CLOCK_IN",
    "PATROL_MISSED",
    "PATROL_CHECKPOINT_OVERDUE",
    "INCIDENT_UNRESOLVED",
    "REPLACEMENT_NOT_ASSIGNED",
    "MINIMUM_MANPOWER_BREACH",
    "SUPERVISOR_REPORT_OVERDUE"
  ];

  const fmCodes = [
    "EMPLOYEE_NO_SHOW",
    "LATE_ARRIVAL",
    "EARLY_DEPARTURE",
    "WRONG_SITE_CLOCK_IN",
    "OFF_SITE_CLOCK_IN",
    "TASK_OVERDUE",
    "CHECKLIST_OVERDUE",
    "CHECKLIST_FAILED_ACTION_REQUIRED",
    "INCIDENT_UNRESOLVED",
    "REPLACEMENT_NOT_ASSIGNED",
    "SUPERVISOR_REPORT_OVERDUE"
  ];

  const currentCodes = operationType === "SECURITY_GUARDING" ? securityCodes : fmCodes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">tune</span>
            SECFAC Alert Rule Settings
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Configure central operational alert rules, SLA targets, trigger delays, and pilot rollout safeguards
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={operationType === "SECURITY_GUARDING" ? "/manpower/security-guarding/alerts" : "/manpower/facility-management/alerts"}
            className="px-3 py-2 text-xs font-bold border border-outline-variant hover:bg-surface-container-low rounded-lg transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Console
          </Link>

          <button
            disabled={seeding}
            onClick={handleSeedTemplates}
            className="px-3 py-2 text-xs font-bold border border-primary text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">model_training</span>
            {seeding ? "Seeding..." : "Seed Pilot Rule Templates"}
          </button>

          <button
            onClick={openCreateModal}
            className="px-3 py-2 text-xs font-bold bg-primary text-white hover:opacity-90 rounded-lg shadow-sm transition-opacity flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Custom Rule
          </button>
        </div>
      </div>

      {/* Scope Selector Tabs */}
      <div className="flex border-b border-outline-variant gap-6 text-sm font-bold">
        <button
          onClick={() => { setOperationType("SECURITY_GUARDING"); }}
          className={`pb-3 transition-colors flex items-center gap-2 border-b-2 ${
            operationType === "SECURITY_GUARDING"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">security</span>
          Security Guarding Rules
        </button>
        <button
          onClick={() => { setOperationType("FACILITY_MANAGEMENT"); }}
          className={`pb-3 transition-colors flex items-center gap-2 border-b-2 ${
            operationType === "FACILITY_MANAGEMENT"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">business</span>
          Facility Management Rules
        </button>
      </div>

      {/* Pilot Readiness Panel */}
      {readiness && (
        <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex justify-between items-center border-b border-outline-variant pb-3">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">checklist</span>
              Pilot Readiness Checklist
            </h2>
            <div className="flex items-center gap-2">
              {readiness.overallStatus === "READY" && (
                <span className="px-3 py-1 text-xs font-extrabold rounded-full bg-green-100 text-green-800 border border-green-300">
                  READY FOR PILOT
                </span>
              )}
              {readiness.overallStatus === "READY_WITH_WARNINGS" && (
                <span className="px-3 py-1 text-xs font-extrabold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  READY WITH WARNINGS
                </span>
              )}
              {readiness.overallStatus === "NOT_READY" && (
                <span className="px-3 py-1 text-xs font-extrabold rounded-full bg-red-100 text-red-800 border border-red-300">
                  NOT READY FOR PILOT
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {readiness.checks?.map((c: any) => (
              <div key={c.id} className="flex items-start gap-2 bg-surface-container-low p-2.5 rounded-lg">
                <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                  c.passed ? "text-green-600" : c.severity === "CRITICAL" ? "text-red-600" : "text-amber-600"
                }`}>
                  {c.passed ? "check_circle" : c.severity === "CRITICAL" ? "cancel" : "warning"}
                </span>
                <div>
                  <p className="font-bold text-on-surface">{c.name}</p>
                  <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5">{c.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Filter */}
      <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
        <input
          type="text"
          placeholder="Filter rules by code, name, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 text-xs border border-outline-variant rounded-lg bg-surface-container-lowest focus:outline-none focus:border-primary"
        />
      </div>

      {/* Rules Table */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-xs">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 text-xs font-medium border-b border-red-200">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Code / Name</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Timing & Reminders</th>
                <th className="py-3 px-4">Target Role</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant font-medium">
                    <span className="material-symbols-outlined animate-spin text-2xl text-primary mb-1">sync</span>
                    <p>Loading rules...</p>
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant font-medium">
                    No alert rules found. Click &quot;Seed Pilot Rule Templates&quot; to load default recommended rules.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.isActive ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-green-100 text-green-800 border border-green-300">ACTIVE</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-600 border border-gray-300">INACTIVE</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-primary">{r.name}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">{r.code}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-on-surface">
                      {r.severity}
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant text-[11px]">
                      <div>Delay: {r.triggerAfterMinutes ? `${r.triggerAfterMinutes} mins` : "Immediate"}</div>
                      <div>Reminder: {r.reminderIntervalMinutes ? `every ${r.reminderIntervalMinutes} mins (max ${r.maximumReminders})` : "Disabled"}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium">
                      {r.targetRole || "Default Coordinator"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-on-surface-variant text-[11px]">
                      {r.siteId ? `Site Override` : r.projectId ? `Project Override` : `Global Rule`}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => openEditModal(r)}
                        className="px-2.5 py-1 text-[11px] font-bold border border-outline-variant hover:bg-surface-container-low rounded transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Rule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSaveRule} className="bg-surface border border-outline-variant rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-primary">
              {editingRule ? "Edit Alert Rule" : "Create New Alert Rule"} ({operationType})
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-on-surface-variant">Alert Code</label>
                <select
                  disabled={!!editingRule}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value, name: formData.name || e.target.value.replace(/_/g, " ") })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
                >
                  {currentCodes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-on-surface-variant">Severity</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label className="font-bold text-on-surface-variant">Rule Name</label>
              <input
                type="text"
                required
                placeholder="Rule title..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
              />
            </div>

            <div className="text-xs">
              <label className="font-bold text-on-surface-variant">Description</label>
              <textarea
                rows={2}
                placeholder="Description of trigger condition..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-on-surface-variant">Delay (Mins)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.triggerAfterMinutes}
                  onChange={(e) => setFormData({ ...formData, triggerAfterMinutes: e.target.value })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
                />
              </div>
              <div>
                <label className="font-bold text-on-surface-variant">Reminder Interval</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reminderIntervalMinutes}
                  onChange={(e) => setFormData({ ...formData, reminderIntervalMinutes: e.target.value })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
                />
              </div>
              <div>
                <label className="font-bold text-on-surface-variant">Max Reminders</label>
                <input
                  type="number"
                  min="0"
                  value={formData.maximumReminders}
                  onChange={(e) => setFormData({ ...formData, maximumReminders: e.target.value })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-on-surface-variant">Initial Target Role</label>
                <input
                  type="text"
                  placeholder="e.g. SECURITY_SUPERVISOR"
                  value={formData.targetRole}
                  onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
                />
              </div>
              <div>
                <label className="font-bold text-on-surface-variant">Fallback Role</label>
                <input
                  type="text"
                  placeholder="e.g. SECURITY_OPERATIONS_MANAGER"
                  value={formData.fallbackRole}
                  onChange={(e) => setFormData({ ...formData, fallbackRole: e.target.value })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded text-primary"
              />
              Rule Active (Requires Pilot Readiness Checks)
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-bold border border-outline-variant rounded-lg hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Rule"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
