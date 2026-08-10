"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ContractConversionWizardPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<any>(null);

  // Form states
  const [contractNumber, setContractNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [billingBasis, setBillingBasis] = useState("MONTHLY");
  const [totalContractValue, setTotalContractValue] = useState<string>("");
  const [siteId, setSiteId] = useState("");
  const [projectId, setProjectId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successContract, setSuccessContract] = useState<any>(null);

  useEffect(() => {
    if (!proposalId) return;
    fetchReadiness();
  }, [proposalId]);

  const fetchReadiness = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/commercial/proposals/${proposalId}/conversion-readiness`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch conversion readiness.");
      }
      setReadiness(data);

      // Auto-suggest default contract number
      const randNum = Math.floor(1000 + Math.random() * 9000);
      setContractNumber(`CON-${new Date().getFullYear()}-${randNum}`);

      // Auto-fill dates default (today + 1 year)
      const today = new Date().toISOString().split("T")[0];
      const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
      setStartDate(today);
      setEndDate(nextYear);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractNumber || !startDate || !endDate) {
      alert("Please fill in contract number, start date, and end date.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        contractNumber,
        startDate,
        endDate,
        billingBasis,
        totalContractValue: totalContractValue ? parseFloat(totalContractValue) : null,
        siteId: siteId || null,
        projectId: projectId || null,
        clientId: readiness?.resolvedClientId
      };

      const res = await fetch(`/api/v1/commercial/proposals/${proposalId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Conversion failed.");
      }

      setSuccessContract(data.contract);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>Loading Contract Conversion Wizard...</h2>
      </div>
    );
  }

  if (successContract) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ padding: "1.5rem", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "8px" }}>
          <h2 style={{ color: "#065f46", marginTop: 0 }}>Contract Converted Successfully!</h2>
          <p><strong>Contract Number:</strong> {successContract.contractNumber}</p>
          <p><strong>Status:</strong> {successContract.status} (Approval Status: {successContract.approvalStatus})</p>
          <p><strong>Operation:</strong> {successContract.operationType}</p>
          <p><strong>Title:</strong> {successContract.title}</p>
          <div style={{ marginTop: "1.5rem" }}>
            <button
              onClick={() => {
                const targetRoute = successContract.operationType === "FACILITY_MANAGEMENT"
                  ? "/manpower/facility-management/contracts"
                  : "/manpower/security-guarding/contracts";
                router.push(targetRoute);
              }}
              style={{ padding: "0.75rem 1.5rem", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
            >
              Open Contracts Register
            </button>
            <button
              onClick={() => router.push("/commercial/quotations")}
              style={{ marginLeft: "1rem", padding: "0.75rem 1.5rem", background: "#6b7280", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              Back to Proposals Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  const version = readiness?.version;
  const clientResponse = readiness?.clientResponse;

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ color: "#1e293b" }}>CL-5 New Contract Conversion Wizard</h1>
      <p style={{ color: "#64748b" }}>Convert Accepted Commercial Proposal into DRAFT Manpower Contract</p>

      {error && (
        <div style={{ padding: "1rem", background: "#fef2f2", border: "1px solid #ef4444", borderRadius: "6px", color: "#991b1b", marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {readiness && !readiness.ready && (
        <div style={{ padding: "1rem", background: "#fffbebfb", border: "1px solid #f59e0b", borderRadius: "6px", color: "#92400e", marginBottom: "1.5rem" }}>
          <strong>Conversion Blockers Detected:</strong>
          <ul>
            {readiness.blockers.map((b: string, i: number) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Proposal Read-Only Summary */}
      <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0, color: "#334155" }}>Proposal Provenance & Response</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <p><strong>Title:</strong> {version?.title || "N/A"}</p>
            <p><strong>Version:</strong> v{version?.versionNumber}</p>
            <p><strong>Proposal Status:</strong> <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "4px", fontSize: "0.85rem" }}>{version?.status}</span></p>
            <p><strong>Selling Price Provenance:</strong> {version?.sellingPrice ? `${version.sellingPrice} ${version.currency}` : "N/A"}</p>
          </div>
          <div>
            <p><strong>Client Response:</strong> <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: "4px", fontSize: "0.85rem", fontWeight: "bold" }}>{clientResponse?.responseType || "N/A"}</span></p>
            <p><strong>Client Contact:</strong> {clientResponse?.clientContactName || "N/A"}</p>
            <p><strong>Reference:</strong> {clientResponse?.clientReference || "N/A"}</p>
            <p><strong>Snapshot Checksum:</strong> <code style={{ fontSize: "0.75rem" }}>{clientResponse?.snapshotChecksum?.substring(0, 16)}...</code></p>
          </div>
        </div>
      </div>

      {/* Contract Input Form */}
      <form onSubmit={handleExecuteConversion} style={{ background: "#ffffff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
        <h3 style={{ marginTop: 0, color: "#1e293b" }}>Contract Execution Parameters</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold", color: "#334155" }}>
              Contract Number *
            </label>
            <input
              type="text"
              required
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold", color: "#334155" }}>
              Billing Basis
            </label>
            <select
              value={billingBasis}
              onChange={(e) => setBillingBasis(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
            >
              <option value="MONTHLY">MONTHLY</option>
              <option value="HOURLY">HOURLY</option>
              <option value="DAILY">DAILY</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold", color: "#334155" }}>
              Start Date *
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold", color: "#334155" }}>
              End Date *
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold", color: "#334155" }}>
              Total Contract Value (Optional)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="Leave empty if unknown"
              value={totalContractValue}
              onChange={(e) => setTotalContractValue(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
            />
            <small style={{ color: "#64748b" }}>Separated from proposal selling price provenance</small>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold", color: "#334155" }}>
              Resolved Client Master
            </label>
            <input
              type="text"
              disabled
              value={readiness?.resolvedClientId || "NOT RESOLVED"}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #e2e8f0", background: "#f1f5f9" }}
            />
          </div>
        </div>

        {/* Manpower Staffing Requirements Preview */}
        <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
          <h4 style={{ color: "#334155", marginBottom: "0.5rem" }}>Inherited Staffing Requirements</h4>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                <th style={{ padding: "0.5rem", border: "1px solid #e2e8f0" }}>Position</th>
                <th style={{ padding: "0.5rem", border: "1px solid #e2e8f0" }}>Headcount</th>
                <th style={{ padding: "0.5rem", border: "1px solid #e2e8f0" }}>Deployment Type</th>
                <th style={{ padding: "0.5rem", border: "1px solid #e2e8f0" }}>Billing Eligible</th>
              </tr>
            </thead>
            <tbody>
              {(version?.costEstimateVersion?.items || []).map((item: any, idx: number) => (
                <tr key={idx}>
                  <td style={{ padding: "0.5rem", border: "1px solid #e2e8f0" }}>{item.positionTitle}</td>
                  <td style={{ padding: "0.5rem", border: "1px solid #e2e8f0" }}>{item.headcount}</td>
                  <td style={{ padding: "0.5rem", border: "1px solid #e2e8f0" }}>REGULAR</td>
                  <td style={{ padding: "0.5rem", border: "1px solid #e2e8f0" }}>Yes (Default)</td>
                </tr>
              ))}
              {(!version?.costEstimateVersion?.items || version.costEstimateVersion.items.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ padding: "0.5rem", textAlign: "center", color: "#64748b" }}>
                    No items in cost estimate snapshot. Standard defaults will apply.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
          <button
            type="submit"
            disabled={submitting || (readiness && !readiness.ready)}
            style={{
              padding: "0.75rem 1.75rem",
              background: submitting || (readiness && !readiness.ready) ? "#94a3b8" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: submitting || (readiness && !readiness.ready) ? "not-allowed" : "pointer"
            }}
          >
            {submitting ? "Converting..." : "Execute Contract Conversion"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/commercial/quotations")}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#f1f5f9",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
