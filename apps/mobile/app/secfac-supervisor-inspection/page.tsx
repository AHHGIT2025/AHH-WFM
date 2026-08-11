"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { enqueueOfflineItem, generateUuid } from "@/lib/secfac-secure-offline-storage";


export default function MobileSupervisorInspectionPage() {
  const { data: session } = useSession();
  const [siteId, setSiteId] = useState("SITE01");
  const [inspectedEmployeeId, setInspectedEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState("TMPL-GUARD-TURNOUT-01");
  const [overallResult, setOverallResult] = useState<"COMPLIANT" | "NON_COMPLIANT" | "REQUIRES_ACTION">("COMPLIANT");
  const [notes, setNotes] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inspectedEmployeeId || !siteId) {
      setStatusMessage({ text: "Please enter Inspected Guard ID and Site ID.", isError: true });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    const idempotencyKey = `MOB-INSP-${generateUuid()}`;

    const payload = {
      siteId,
      inspectedEmployeeId,
      templateId,
      overallResult,
      notes,
      correctiveAction,
      responses: [
        { itemTemplateId: "ITEM-UNIFORM-01", responseValue: "PASS", isCompliant: overallResult === "COMPLIANT" },
        { itemTemplateId: "ITEM-EQUIPMENT-01", responseValue: "PASS", isCompliant: true }
      ],
      idempotencyKey
    };

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueOfflineItem("SUPERVISOR_INSPECTION", payload);
        setStatusMessage({ text: "Offline mode: Inspection queued for sync when online." });
        setInspectedEmployeeId("");
        setNotes("");
        setCorrectiveAction("");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/v1/secfac/supervisor-inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        setStatusMessage({ text: "Supervisor inspection submitted successfully!" });
        setInspectedEmployeeId("");
        setNotes("");
        setCorrectiveAction("");
      } else {
        enqueueOfflineItem("SUPERVISOR_INSPECTION", payload);
        setStatusMessage({ text: "Saved inspection to offline queue." });
      }
    } catch {
      enqueueOfflineItem("SUPERVISOR_INSPECTION", payload);
      setStatusMessage({ text: "Saved inspection to offline queue." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
        <Link href="/" className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h2 className="text-lg font-bold text-on-surface">Supervisor Field Inspection</h2>
          <p className="text-[10px] text-on-surface-variant font-mono uppercase">
            Guard Turnout & Equipment Audit
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${statusMessage.isError ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container"}`}>
          <span className="material-symbols-outlined text-sm">{statusMessage.isError ? "error" : "check_circle"}</span>
          {statusMessage.text}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-surface border border-[#C4C6D2] rounded-2xl p-5 shadow-sm space-y-4 text-xs">
        <h3 className="text-xs font-bold text-on-surface uppercase font-mono tracking-wide text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">fact_check</span>
          Inspection Form
        </h3>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site ID *</label>
          <input
            type="text"
            required
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs font-bold"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Inspected Guard Employee ID *</label>
          <input
            type="text"
            required
            placeholder="E.g. EMP002"
            value={inspectedEmployeeId}
            onChange={(e) => setInspectedEmployeeId(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs font-bold"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Overall Inspection Result</label>
          <select
            value={overallResult}
            onChange={(e: any) => setOverallResult(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs font-bold"
          >
            <option value="COMPLIANT">COMPLIANT (100%)</option>
            <option value="REQUIRES_ACTION">REQUIRES ACTION (75%)</option>
            <option value="NON_COMPLIANT">NON-COMPLIANT (50%)</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Supervisor Notes / Observations</label>
          <textarea
            placeholder="Field observation details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs h-20 resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Corrective Action Required</label>
          <textarea
            placeholder="Action required from guard or project manager..."
            value={correctiveAction}
            onChange={(e) => setCorrectiveAction(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs h-16 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow"
        >
          <span className="material-symbols-outlined text-sm">fact_check</span>
          {submitting ? "SUBMITTING..." : "SUBMIT INSPECTION AUDIT"}
        </button>
      </form>
    </div>
  );
}
