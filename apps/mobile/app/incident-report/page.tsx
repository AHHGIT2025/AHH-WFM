"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { enqueueOfflineItem, generateUuid } from "@/lib/secfac-secure-offline-storage";


export default function IncidentReportPage() {
  const { data: session } = useSession();
  const [siteId, setSiteId] = useState("SITE01");
  const [type, setType] = useState<"OCCURRENCE" | "INCIDENT">("INCIDENT");
  const [severity, setSeverity] = useState<"MINOR" | "MODERATE" | "MAJOR" | "CRITICAL">("MINOR");
  const [category, setCategory] = useState("SAFETY_HAZARD");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !description || !siteId) {
      setStatusMessage({ text: "Please fill in all required fields.", isError: true });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    const idempotencyKey = `MOB-INC-${generateUuid()}`;

    const payload = {
      siteId,
      type,
      severity,
      category,
      title,
      description,
      immediateAction,
      source: "MOBILE_APP",
      idempotencyKey
    };

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // Enqueue to encrypted offline storage if offline
        enqueueOfflineItem("INCIDENT_REPORT", payload);
        setStatusMessage({ text: "Offline mode: Incident report queued for sync when online." });
        setTitle("");
        setDescription("");
        setImmediateAction("");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/v1/secfac/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        setStatusMessage({ text: `Report submitted successfully! Ref: ${json.data.incidentNumber}` });
        setTitle("");
        setDescription("");
        setImmediateAction("");
      } else {
        // Fallback to offline queue on server error
        enqueueOfflineItem("INCIDENT_REPORT", payload);
        setStatusMessage({ text: "Network error. Report saved to offline queue." });
      }
    } catch {
      enqueueOfflineItem("INCIDENT_REPORT", payload);
      setStatusMessage({ text: "Saved to offline queue due to network connection issues." });
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
          <h2 className="text-lg font-bold text-on-surface">Report Incident / Occurrence</h2>
          <p className="text-[10px] text-on-surface-variant font-mono uppercase">
            SECFAC Phase 6B Security Guarding
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
          <span className="material-symbols-outlined text-sm">report_problem</span>
          Field Incident Form
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Record Type</label>
            <select
              value={type}
              onChange={(e: any) => setType(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs font-bold"
            >
              <option value="INCIDENT">INCIDENT</option>
              <option value="OCCURRENCE">OCCURRENCE</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e: any) => setSeverity(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs font-bold"
            >
              <option value="MINOR">MINOR</option>
              <option value="MODERATE">MODERATE</option>
              <option value="MAJOR">MAJOR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs font-bold"
          >
            <option value="SAFETY_HAZARD">Safety Hazard</option>
            <option value="THEFT">Theft / Unlawful Entry</option>
            <option value="UNAUTHORIZED_ACCESS">Unauthorized Access</option>
            <option value="PROPERTY_DAMAGE">Property Damage</option>
            <option value="DISCIPLINE">Disciplinary Issue</option>
            <option value="EQUIPMENT_FAILURE">Equipment Failure</option>
            <option value="OTHER">Other / General Observation</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Title / Summary *</label>
          <input
            type="text"
            required
            placeholder="E.g. Damaged perimeter fence near Gate 3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Detailed Description *</label>
          <textarea
            required
            placeholder="Log detailed observation..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs h-24 resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Immediate Action Taken</label>
          <textarea
            placeholder="E.g. Cordoned off area, notified supervisor..."
            value={immediateAction}
            onChange={(e) => setImmediateAction(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs h-16 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow"
        >
          <span className="material-symbols-outlined text-sm">send</span>
          {submitting ? "SUBMITTING..." : "SUBMIT REPORT"}
        </button>
      </form>
    </div>
  );
}
