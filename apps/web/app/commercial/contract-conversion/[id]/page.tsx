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
  const [noticePeriodDays, setNoticePeriodDays] = useState<string>("");
  const [billingBasis, setBillingBasis] = useState("MONTHLY");
  const [totalContractValue, setTotalContractValue] = useState<string>("");
  const [siteId, setSiteId] = useState("");
  const [projectId, setProjectId] = useState("");

  // Client Master Resolution states (DEF-049)
  const [selectedLinkClientId, setSelectedLinkClientId] = useState("");
  const [linkingClient, setLinkingClient] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  // Manpower Staffing states (DEF-047)
  const [manpowerItems, setManpowerItems] = useState<Array<{
    position: string;
    quantity: string;
    deploymentType: string;
    costingBasis?: string | null;
  }>>([]);

  const [submitting, setSubmitting] = useState(false);
  const [successContract, setSuccessContract] = useState<any>(null);

  useEffect(() => {
    if (!proposalId) return;
    fetchReadiness();
  }, [proposalId]);

  const syncReadinessState = (data: any) => {
    setReadiness(data);
    setSelectedLinkClientId(data.resolvedClientId || "");

    const derived = Array.isArray(data.manpowerItems)
      ? data.manpowerItems.map((m: any) => ({
          position: m.position || "",
          quantity: m.quantity && Number(m.quantity) > 0 ? String(m.quantity) : "",
          deploymentType: m.deploymentType || "REGULAR",
          costingBasis: m.costingBasis || null
        }))
      : [];
    setManpowerItems(derived);
  };

  const fetchReadiness = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/commercial/proposals/${proposalId}/conversion-readiness`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch conversion readiness.");
      }
      syncReadinessState(data);

      // Auto-suggest production format number only if user has not entered one
      const randNum = Math.floor(1000 + Math.random() * 9000);
      setContractNumber((prev) => prev || `CON-${new Date().getFullYear()}-${randNum}`);

      // Auto-fill dates default (today + 1 year) if unset
      const today = new Date().toISOString().split("T")[0];
      const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
      setStartDate((prev) => prev || today);
      setEndDate((prev) => prev || nextYear);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkClientMaster = async () => {
    if (!selectedLinkClientId) {
      setError("Please select an active Client Master record before linking.");
      return;
    }
    setLinkingClient(true);
    setError(null);
    setLinkMessage(null);
    try {
      const res = await fetch(`/api/v1/commercial/proposals/${proposalId}/conversion-readiness`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedLinkClientId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to link Client Master.");
      }
      syncReadinessState(data);
      const linkedLabel = data.resolvedClient
        ? `${data.resolvedClient.code} - ${data.resolvedClient.name}`
        : data.resolvedClientId;
      setLinkMessage(`Client Master linked cleanly: ${linkedLabel}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLinkingClient(false);
    }
  };

  const handleDeploymentTypeChange = (idx: number, deploymentType: string) => {
    setManpowerItems((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, deploymentType } : row))
    );
  };

  const handleExecuteConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContractNumber = contractNumber.trim();
    if (!trimmedContractNumber || !startDate || !endDate) {
      setError("Please fill in Contract Number, Start Date, and End Date.");
      return;
    }

    if (!readiness?.resolvedClientId) {
      setError("Client master must be resolved before conversion.");
      return;
    }

    let parsedNoticePeriod: number | null = null;
    if (noticePeriodDays.trim() !== "") {
      const n = Number(noticePeriodDays.trim());
      if (!Number.isInteger(n) || n < 0) {
        setError("Notice Period (Days) must be a non-negative whole number.");
        return;
      }
      parsedNoticePeriod = n;
    }

    if (manpowerItems.length === 0) {
      setError("At least one manpower staffing row with a valid Position and Headcount (> 0) is required.");
      return;
    }

    const normalizedManpowerItems: Array<{ position: string; quantity: number; deploymentType: string }> = [];
    for (let i = 0; i < manpowerItems.length; i++) {
      const row = manpowerItems[i];
      const pos = row.position.trim();
      const qty = Number(row.quantity);
      const depType = row.deploymentType.trim();
      if (!pos) {
        setError(`Staffing row #${i + 1}: Position title is required.`);
        return;
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        setError(`Staffing row #${i + 1} (${pos}): Headcount must be a positive whole number.`);
        return;
      }
      if (!depType) {
        setError(`Staffing row #${i + 1} (${pos}): Deployment Type is required.`);
        return;
      }
      normalizedManpowerItems.push({ position: pos, quantity: qty, deploymentType: depType });
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        contractNumber: trimmedContractNumber,
        startDate,
        endDate,
        noticePeriodDays: parsedNoticePeriod,
        billingBasis,
        totalContractValue: totalContractValue ? parseFloat(totalContractValue) : null,
        siteId: siteId || null,
        projectId: projectId || null,
        clientId: readiness?.resolvedClientId,
        manpowerItems: normalizedManpowerItems
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
          <p><strong>Notice Period:</strong> {successContract.noticePeriodDays !== null && successContract.noticePeriodDays !== undefined ? `${successContract.noticePeriodDays} days` : "Not set"}</p>
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

      {linkMessage && (
        <div style={{ padding: "1rem", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "6px", color: "#065f46", marginBottom: "1.5rem" }}>
          {linkMessage}
        </div>
      )}

      {readiness?.existingContract && (
        <div style={{ padding: "1rem", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "6px", color: "#065f46", marginBottom: "1.5rem" }}>
          <strong>Contract Already Converted:</strong> {readiness.existingContract.contractNumber} ({readiness.existingContract.status})
        </div>
      )}

      {readiness && !readiness.ready && (
        <div style={{ padding: "1rem", background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: "6px", color: "#92400e", marginBottom: "1.5rem" }}>
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
            <p>
              <strong>Proposal Issuance Status:</strong>{" "}
              <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "4px", fontSize: "0.85rem" }}>{version?.status}</span>
            </p>
            <p style={{ fontSize: "0.8rem", color: "#475569", marginTop: "-0.25rem" }}>
              Proposal status remains ISSUED_TO_CLIENT after client issuance; acceptance and conversion are tracked separately.
            </p>
            <p><strong>Selling Price Provenance:</strong> {version?.sellingPrice ? `${version.sellingPrice} ${version.currency}` : "N/A"}</p>
          </div>
          <div>
            <p>
              <strong>Client Acceptance:</strong>{" "}
              <span style={{ background: clientResponse?.responseType === "ACCEPTED" ? "#d1fae5" : "#fee2e2", color: clientResponse?.responseType === "ACCEPTED" ? "#065f46" : "#991b1b", padding: "2px 8px", borderRadius: "4px", fontSize: "0.85rem", fontWeight: "bold" }}>
                {clientResponse?.responseType || "PENDING"}
              </span>
            </p>
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
              placeholder="e.g., CON-2026-0042"
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
            />
            <small style={{ color: "#64748b" }}>Auto-suggested standard format (editable for approved client/UAT contract reference).</small>
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
              Notice Period (Days)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="e.g., 60 or 90"
              value={noticePeriodDays}
              onChange={(e) => setNoticePeriodDays(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
            />
            <small style={{ color: "#64748b" }}>Optional contract notice period used for renewal/termination tracking.</small>
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

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold", color: "#334155" }}>
              Resolved Client Master
            </label>
            <input
              type="text"
              disabled
              value={
                readiness?.resolvedClient
                  ? `${readiness.resolvedClient.code} - ${readiness.resolvedClient.name} (${readiness.resolvedClient.id})`
                  : "NOT RESOLVED"
              }
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "4px",
                border: readiness?.resolvedClient ? "1px solid #10b981" : "1px solid #f59e0b",
                background: "#f1f5f9",
                color: readiness?.resolvedClient ? "#0f172a" : "#991b1b",
                fontWeight: 600
              }}
            />

            {!readiness?.existingContract && readiness?.canLinkClient && (
              <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
                <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.85rem", fontWeight: "bold", color: "#334155" }}>
                  Link Existing Client Master ({version?.proposal?.operationType || version?.proposal?.case?.operationType || "Scoped"})
                </label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <select
                    value={selectedLinkClientId}
                    onChange={(e) => setSelectedLinkClientId(e.target.value)}
                    style={{ flex: 1, padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a" }}
                  >
                    <option value="">-- Select Authorized Client Master --</option>
                    {(readiness?.eligibleClients || []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name} ({c.id})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={linkingClient || !selectedLinkClientId}
                    onClick={handleLinkClientMaster}
                    style={{
                      padding: "0.5rem 1rem",
                      background: linkingClient || !selectedLinkClientId ? "#e2e8f0" : "#0f766e",
                      color: linkingClient || !selectedLinkClientId ? "#475569" : "#ffffff",
                      border: "none",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      cursor: linkingClient || !selectedLinkClientId ? "not-allowed" : "pointer"
                    }}
                  >
                    {linkingClient ? "Linking..." : "Link Client Master"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manpower Staffing Requirements Preview & Validation */}
        <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem", padding: "1rem", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
          <div style={{ marginBottom: "0.75rem" }}>
            <h4 style={{ color: "#334155", margin: 0 }}>Inherited Staffing Requirements (Locked to Approved Costing Baseline)</h4>
            <small style={{ color: "#64748b" }}>
              Position and Headcount are inherited strictly from the approved costing/proposal snapshot and cannot be silently altered here. Specify operational Deployment Type for each approved row.
            </small>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "#e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "0.5rem", border: "1px solid #cbd5e1" }}>Position (Approved)</th>
                <th style={{ padding: "0.5rem", border: "1px solid #cbd5e1", width: "130px" }}>Headcount (Approved)</th>
                <th style={{ padding: "0.5rem", border: "1px solid #cbd5e1", width: "190px" }}>Deployment Type *</th>
                <th style={{ padding: "0.5rem", border: "1px solid #cbd5e1", width: "150px" }}>Costing Basis</th>
              </tr>
            </thead>
            <tbody>
              {manpowerItems.map((item, idx) => {
                const posInvalid = !item.position.trim();
                const qtyNum = Number(item.quantity);
                const qtyInvalid = !Number.isInteger(qtyNum) || qtyNum <= 0;
                return (
                  <tr key={idx}>
                    <td style={{ padding: "0.5rem", border: "1px solid #e2e8f0", background: "#f1f5f9", color: posInvalid ? "#991b1b" : "#0f172a", fontWeight: 600 }}>
                      {posInvalid ? "MISSING POSITION IN COSTING" : item.position}
                    </td>
                    <td style={{ padding: "0.5rem", border: "1px solid #e2e8f0", background: "#f1f5f9", color: qtyInvalid ? "#991b1b" : "#0f172a", fontWeight: 600 }}>
                      {qtyInvalid ? "INVALID (<= 0)" : item.quantity}
                    </td>
                    <td style={{ padding: "0.5rem", border: "1px solid #e2e8f0" }}>
                      <select
                        value={item.deploymentType}
                        onChange={(e) => handleDeploymentTypeChange(idx, e.target.value)}
                        style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff" }}
                      >
                        <option value="REGULAR">REGULAR</option>
                        <option value="RELIEVER">RELIEVER</option>
                        <option value="SUPERVISOR">SUPERVISOR</option>
                        <option value="TEMPORARY">TEMPORARY</option>
                      </select>
                    </td>
                    <td style={{ padding: "0.5rem", border: "1px solid #e2e8f0", color: "#475569", fontSize: "0.8rem" }}>
                      {item.costingBasis || "COSTING"}
                    </td>
                  </tr>
                );
              })}
              {manpowerItems.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "0.75rem", textAlign: "center", color: "#991b1b", fontWeight: 500 }}>
                    No direct manpower staffing lines found in the approved costing baseline. Revise costing/proposal before conversion.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
          <button
            type="submit"
            disabled={submitting || (readiness && !readiness.ready) || manpowerItems.length === 0}
            style={{
              padding: "0.75rem 1.75rem",
              background: submitting || (readiness && !readiness.ready) || manpowerItems.length === 0 ? "#e2e8f0" : "#2563eb",
              color: submitting || (readiness && !readiness.ready) || manpowerItems.length === 0 ? "#475569" : "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: submitting || (readiness && !readiness.ready) || manpowerItems.length === 0 ? "not-allowed" : "pointer"
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
