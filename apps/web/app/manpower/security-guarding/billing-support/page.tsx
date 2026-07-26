"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasPermission } from "../../../../lib/permissions";

interface BillingLine {
  id: string;
  date: string;
  clientName: string;
  contractCode: string;
  projectName: string;
  siteName: string;
  position: string;
  plannedManpower: number;
  actualManpower: number;
  actualHours: number;
  relieversUsed: number;
  billableAdvisoryQty: number;
  comments: string;
}

export default function BillingSupportPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState("all");
  const [billingLines, setBillingLines] = useState<BillingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadClients = async () => {
    try {
      const res = await fetch("/api/v1/security/scheduling/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (e) {
      console.error("Failed to load clients list", e);
    }
  };

  const loadBillingSupportData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/security/scheduling/billing-support?period=${period}&clientId=${selectedClient}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBillingLines(data.billingLines);
        } else {
          setError(data.error || "Failed to load billing support data");
        }
      } else {
        if (res.status === 403) {
          setError("Access Forbidden: You do not have permission to view Security Guarding data.");
        } else {
          setError("Failed to fetch billing support data from server");
        }
      }
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    loadBillingSupportData();
  }, [period, selectedClient]);

  const handleExport = () => {
    const headers = ["Date", "Client Name", "Contract Code", "Project", "Site", "Post / Position", "Planned Manpower", "Actual Deployed", "Actual Hours", "Relievers Used", "Billable Qty Advisory", "Comments"];
    const rows = billingLines.map(b => [
      b.date,
      b.clientName,
      b.contractCode,
      b.projectName,
      b.siteName,
      b.position,
      b.plannedManpower,
      b.actualManpower,
      b.actualHours,
      b.relieversUsed,
      b.billableAdvisoryQty,
      b.comments
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `security_billing_support_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 bg-surface-container-lowest p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <Link href="/manpower/security-guarding/dashboard" className="text-xs text-primary hover:underline flex items-center gap-1 mb-1">
            <span className="material-symbols-outlined text-[12px]">arrow_back</span> Back to Command Center
          </Link>
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">analytics</span>
            Billing-Support Reports
          </h1>
          <p className="text-[11px] text-on-surface-variant">Review client contract service delivery records, planned vs actual hours, and delivery anomalies</p>
          <div className="mt-2 bg-blue-50 border border-blue-200 text-blue-800 text-[11px] px-3 py-1 rounded inline-flex items-center gap-1.5 font-semibold">
            <span className="material-symbols-outlined text-[14px]">info</span>
            Operational Commercial Billing Support Only — No Invoices Generated
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-on-surface">Client:</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="bg-surface border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface focus:outline-primary"
            >
              <option value="all">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.clientName}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-on-surface">Month:</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-surface border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-semibold border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-xs leading-relaxed space-y-1">
        <h3 className="font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">info</span>
          BILLING-SUPPORT ADVISORY DATA
        </h3>
        <p>This sheet details client contract performance metrics to validate shift delivery. It does not generate invoices, post commercial ledger entries, or interface with finance billing engines.</p>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-on-surface-variant">
              Delivery Sheets for {period}: <span className="text-primary">{billingLines.length} entries</span>
            </span>
            <button
              onClick={handleExport}
              disabled={billingLines.length === 0}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">download</span> Export Service Delivery Sheet
            </button>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-surface-container-low text-on-surface font-bold border-b border-outline-variant/60">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Contract Code</th>
                  <th className="p-3">Project / Site</th>
                  <th className="p-3">Post / Position</th>
                  <th className="p-3 text-center">Planned vs Deployed</th>
                  <th className="p-3 text-center">Hours Worked</th>
                  <th className="p-3 text-center">Relievers Used</th>
                  <th className="p-3 text-center">Billable Advisory Qty</th>
                  <th className="p-3">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {billingLines.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-on-surface-variant font-medium">
                      No service delivery entries found for this query.
                    </td>
                  </tr>
                ) : (
                  billingLines.map((line) => (
                    <tr key={line.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="p-3 font-semibold text-on-surface">{line.date}</td>
                      <td className="p-3 font-bold text-on-surface">{line.clientName}</td>
                      <td className="p-3 text-primary font-semibold">{line.contractCode}</td>
                      <td className="p-3">
                        <div className="font-bold text-on-surface">{line.projectName}</div>
                        <div className="text-[10px] text-on-surface-variant font-semibold">{line.siteName}</div>
                      </td>
                      <td className="p-3 font-semibold text-on-surface">{line.position}</td>
                      <td className="p-3 text-center">
                        <span className="font-semibold text-on-surface">{line.plannedManpower}</span> planned /{" "}
                        <span className={`font-bold ${line.actualManpower < line.plannedManpower ? "text-rose-600" : "text-emerald-600"}`}>
                          {line.actualManpower}
                        </span> deployed
                      </td>
                      <td className="p-3 text-center font-bold text-on-surface">{line.actualHours} hrs</td>
                      <td className="p-3 text-center font-semibold text-on-surface">{line.relieversUsed}</td>
                      <td className="p-3 text-center">
                        <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded text-[11px]">
                          {line.billableAdvisoryQty} post(s)
                        </span>
                      </td>
                      <td className="p-3 text-on-surface-variant italic font-semibold">{line.comments}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
