"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button, Card, Badge, Modal, Input } from "@ahh-wfm/ui";
import { useSession } from "next-auth/react";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import Link from "next/link";

const TABS = [
  { key: "rate-cards", label: "Rate Cards" },
  { key: "categories", label: "Categories" },
  { key: "elements", label: "Elements" },
  { key: "drivers", label: "Drivers" },
  { key: "formulas", label: "Formula Definitions" },
  { key: "packages", label: "Packages" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface RateCardVersion {
  id: string;
  masterId: string;
  versionNumber: number;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  ratesJson: Record<string, number>;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
}

interface RateCardMaster {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  currency: string;
  companyId?: string | null;
  createdBy: string;
  versions?: RateCardVersion[];
}

function statusBadgeVariant(status: string): "success" | "neutral" | "warning" | "error" {
  if (status === "ACTIVE") return "success";
  if (status === "APPROVED" || status === "UNDER_REVIEW") return "warning";
  if (status === "REJECTED" || status === "RETIRED") return "error";
  return "neutral";
}

export default function CostConfigurationPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;
  const hasAccess = session && (isAdminUser(user) || hasPermission(user, "precontract.costConfig.view"));
  const canManage = session && (isAdminUser(user) || hasPermission(user, "precontract.costConfig.manage"));

  const [activeTab, setActiveTab] = useState<TabKey>("rate-cards");
  const [rateCards, setRateCards] = useState<RateCardMaster[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<RateCardMaster | null>(null);
  const [versions, setVersions] = useState<RateCardVersion[]>([]);
  const [entityRecords, setEntityRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create Rate Card Master modal
  const [showCreateMaster, setShowCreateMaster] = useState(false);
  const [masterCode, setMasterCode] = useState("");
  const [masterName, setMasterName] = useState("");
  const [masterCurrency, setMasterCurrency] = useState("QAR");
  const [masterDesc, setMasterDesc] = useState("");

  // Create / Edit Draft Version modal
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const [basicPayRate, setBasicPayRate] = useState("");
  const [allowancesRate, setAllowancesRate] = useState("");
  const [relieverRate, setRelieverRate] = useState("");

  const loadRateCards = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/v1/settings/commercial-contract/cost-configurations/rate-cards?limit=50");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load PC-2A rate cards.");
      }
      const list: RateCardMaster[] = data.data || [];
      setRateCards(list);
      setSelectedMaster((prev) => {
        if (prev) {
          const match = list.find((m) => m.id === prev.id);
          if (match) return match;
        }
        return list[0] || null;
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Error loading PC-2A rate cards.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadVersions = useCallback(async (masterId: string) => {
    try {
      const res = await fetch(`/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${masterId}/versions`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load rate card versions.");
      }
      setVersions(data.data || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Error loading versions.");
    }
  }, []);

  const loadEntityTab = useCallback(async (entityKey: TabKey) => {
    if (entityKey === "rate-cards" || entityKey === "formulas") return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/v1/settings/commercial-contract/cost-configurations/${entityKey}?limit=50`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to load ${entityKey}.`);
      }
      setEntityRecords(data.data || []);
    } catch (err: any) {
      setErrorMsg(err.message || `Error loading ${entityKey}.`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    if (activeTab === "rate-cards") {
      loadRateCards();
    } else if (activeTab !== "formulas") {
      loadEntityTab(activeTab);
    }
  }, [hasAccess, activeTab, loadRateCards, loadEntityTab]);

  useEffect(() => {
    if (selectedMaster?.id && activeTab === "rate-cards") {
      loadVersions(selectedMaster.id);
    } else if (!selectedMaster) {
      setVersions([]);
    }
  }, [selectedMaster?.id, activeTab, loadVersions]);

  const handleCreateMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/v1/settings/commercial-contract/cost-configurations/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: masterCode.trim(),
          name: masterName.trim(),
          currency: masterCurrency.trim().toUpperCase(),
          ...(masterDesc.trim() ? { description: masterDesc.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create rate card master.");
      }
      setShowCreateMaster(false);
      setMasterCode("");
      setMasterName("");
      setMasterDesc("");
      setSuccessMsg(`Rate card "${data.data.code}" created. Add a Draft version with approved rates.`);
      await loadRateCards();
      setSelectedMaster(data.data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openNewVersionModal = () => {
    setEditingVersionId(null);
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setEffectiveTo("");
    setBasicPayRate("");
    setAllowancesRate("");
    setRelieverRate("");
    setShowVersionModal(true);
  };

  const openEditVersionModal = (ver: RateCardVersion) => {
    setEditingVersionId(ver.id);
    setEffectiveFrom(ver.effectiveFrom ? ver.effectiveFrom.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEffectiveTo(ver.effectiveTo ? ver.effectiveTo.slice(0, 10) : "");
    setBasicPayRate(ver.ratesJson?.BASIC_PAY !== undefined ? String(ver.ratesJson.BASIC_PAY) : "");
    setAllowancesRate(ver.ratesJson?.ALLOWANCES !== undefined ? String(ver.ratesJson.ALLOWANCES) : "");
    setRelieverRate(ver.ratesJson?.RELIEVER_COST !== undefined ? String(ver.ratesJson.RELIEVER_COST) : "");
    setShowVersionModal(true);
  };

  const handleSaveVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !selectedMaster) return;

    const parsedRates: Record<string, number> = {};
    if (basicPayRate.trim() !== "") parsedRates.BASIC_PAY = Number(basicPayRate);
    if (allowancesRate.trim() !== "") parsedRates.ALLOWANCES = Number(allowancesRate);
    if (relieverRate.trim() !== "") parsedRates.RELIEVER_COST = Number(relieverRate);

    if (
      parsedRates.BASIC_PAY === undefined ||
      !Number.isFinite(parsedRates.BASIC_PAY) ||
      parsedRates.BASIC_PAY <= 0 ||
      parsedRates.ALLOWANCES === undefined ||
      !Number.isFinite(parsedRates.ALLOWANCES) ||
      parsedRates.ALLOWANCES < 0
    ) {
      setErrorMsg("Enter valid numeric rates for BASIC_PAY (> 0) and ALLOWANCES (>= 0).");
      return;
    }
    if (parsedRates.RELIEVER_COST !== undefined && (!Number.isFinite(parsedRates.RELIEVER_COST) || parsedRates.RELIEVER_COST < 0)) {
      setErrorMsg("RELIEVER_COST must be a valid non-negative number.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const url = editingVersionId
        ? `/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${selectedMaster.id}/versions/${editingVersionId}`
        : `/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${selectedMaster.id}/versions`;
      const method = editingVersionId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveFrom,
          effectiveTo: effectiveTo.trim() ? effectiveTo : null,
          ratesJson: parsedRates,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save rate card version.");
      }
      setShowVersionModal(false);
      setSuccessMsg(editingVersionId ? "Draft version updated." : `Draft v${data.data.versionNumber} created.`);
      await loadVersions(selectedMaster.id);
      await loadRateCards();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLifecycleAction = async (versionId: string, action: string) => {
    if (!canManage || !selectedMaster) return;
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(
        `/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${selectedMaster.id}/versions/${versionId}/lifecycle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to execute ${action}.`);
      }
      setSuccessMsg(`Rate card version action ${action} completed.`);
      await loadVersions(selectedMaster.id);
      await loadRateCards();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-5xl text-primary">sync</span>
          <p className="mt-2 text-xs font-bold text-on-surface-variant">Loading cost configuration console...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center max-w-md p-6 bg-status-error/10 border border-status-error/20 rounded-2xl">
          <span className="material-symbols-outlined text-status-error text-5xl">gpp_bad</span>
          <h2 className="text-lg font-bold text-primary mt-2">Access Denied</h2>
          <p className="text-xs text-on-surface-variant mt-1">
            You do not possess the required permissions to view the Commercial Cost Configuration console.
          </p>
          <div className="mt-4">
            <Link href="/" className="bg-primary text-white font-bold text-xs px-4 py-2 rounded-lg inline-block">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const latestVersion = versions[0] || selectedMaster?.versions?.[0] || null;
  const activeVersion = versions.find((v) => v.status === "ACTIVE") || null;

  return (
    <div className="flex flex-col h-full gap-4 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-primary">PC-2A Commercial Cost Configuration</h1>
          <div className="flex items-center gap-2 mt-1">
            {activeVersion ? (
              <Badge variant="success">ACTIVE v{activeVersion.versionNumber}</Badge>
            ) : latestVersion ? (
              <Badge variant={statusBadgeVariant(latestVersion.status)}>
                {latestVersion.status} v{latestVersion.versionNumber}
              </Badge>
            ) : (
              <Badge variant="neutral">NO ACTIVE RATE CARD</Badge>
            )}
            <span className="text-xs text-on-surface-variant font-medium">
              {selectedMaster ? `${selectedMaster.code} — ${selectedMaster.name} (${selectedMaster.currency})` : "Select or create a PC-2A Rate Card"}
            </span>
          </div>
        </div>
        {canManage && activeTab === "rate-cards" && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => setShowCreateMaster(true)} disabled={isLoading}>
              New Rate Card
            </Button>
            {selectedMaster && (
              <Button size="sm" variant="secondary" onClick={openNewVersionModal} disabled={isLoading}>
                New Draft Version
              </Button>
            )}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-status-error/10 text-status-error p-3 rounded-lg text-sm font-medium border border-status-error/20">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-status-success/10 text-status-success p-3 rounded-lg text-sm font-medium border border-status-success/20">
          {successMsg}
        </div>
      )}

      <Card className="flex-1 flex flex-col p-0 overflow-hidden" padded={false}>
        <div className="flex border-b border-outline-variant overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6 overflow-y-auto flex-1">
          {activeTab === "rate-cards" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">Rate Card Masters</h2>
                {rateCards.length === 0 ? (
                  <div className="p-4 border border-dashed border-outline-variant rounded-xl text-xs text-on-surface-variant">
                    No PC-2A rate cards configured yet. Authorized Finance/Commercial users can create one to configure BASIC_PAY and ALLOWANCES.
                  </div>
                ) : (
                  rateCards.map((mc) => {
                    const latest = mc.versions?.[0];
                    const isSelected = selectedMaster?.id === mc.id;
                    return (
                      <button
                        key={mc.id}
                        type="button"
                        onClick={() => setSelectedMaster(mc)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-on-surface">{mc.code}</span>
                          {latest ? (
                            <Badge variant={statusBadgeVariant(latest.status)}>{latest.status} v{latest.versionNumber}</Badge>
                          ) : (
                            <Badge variant="neutral">NO VERSIONS</Badge>
                          )}
                        </div>
                        <div className="text-xs text-on-surface-variant mt-1">{mc.name} ({mc.currency})</div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">
                    Versions &amp; Maker/Checker Lifecycle
                  </h2>
                </div>
                {!selectedMaster ? (
                  <div className="p-6 border border-dashed border-outline-variant rounded-xl text-xs text-on-surface-variant">
                    Select a rate card master to view or manage its versions.
                  </div>
                ) : versions.length === 0 ? (
                  <div className="p-6 border border-dashed border-outline-variant rounded-xl text-xs text-on-surface-variant">
                    No versions yet for {selectedMaster.code}. Click &ldquo;New Draft Version&rdquo; to enter Finance-approved rates.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {versions.map((ver) => {
                      const isMaker = user?.id === ver.createdBy;
                      return (
                        <div key={ver.id} className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-on-surface">Version v{ver.versionNumber}</span>
                              <Badge variant={statusBadgeVariant(ver.status)}>{ver.status}</Badge>
                            </div>
                            <span className="text-xs text-on-surface-variant">
                              Effective: {ver.effectiveFrom?.slice(0, 10)} {ver.effectiveTo ? `→ ${ver.effectiveTo.slice(0, 10)}` : "(Open-ended)"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-surface-container-low p-3 rounded-lg">
                            {Object.entries(ver.ratesJson || {}).map(([code, val]) => (
                              <div key={code}>
                                <span className="text-on-surface-variant font-medium">{code}:</span>{" "}
                                <span className="font-bold text-on-surface">{selectedMaster.currency} {Number(val).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant">
                            <div>
                              Maker: <span className="font-semibold text-on-surface">{ver.createdBy}</span>
                              {ver.approvedBy && (
                                <> · Checker: <span className="font-semibold text-on-surface">{ver.approvedBy}</span></>
                              )}
                            </div>

                            {canManage && (
                              <div className="flex flex-wrap gap-2">
                                {ver.status === "DRAFT" && (
                                  <>
                                    <Button size="sm" variant="secondary" onClick={() => openEditVersionModal(ver)} disabled={isLoading}>
                                      Edit Draft
                                    </Button>
                                    <Button size="sm" variant="primary" onClick={() => handleLifecycleAction(ver.id, "SUBMIT")} disabled={isLoading}>
                                      Submit for Review
                                    </Button>
                                  </>
                                )}
                                {ver.status === "UNDER_REVIEW" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="success"
                                      onClick={() => handleLifecycleAction(ver.id, "APPROVE")}
                                      disabled={isLoading || isMaker}
                                      title={isMaker ? "Maker and Checker must be different users" : "Approve rate card version"}
                                    >
                                      {isMaker ? "Approve (Checker Only)" : "Approve"}
                                    </Button>
                                    <Button size="sm" variant="error" onClick={() => handleLifecycleAction(ver.id, "REJECT")} disabled={isLoading}>
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {ver.status === "APPROVED" && (
                                  <>
                                    <Button size="sm" variant="primary" onClick={() => handleLifecycleAction(ver.id, "ACTIVATE")} disabled={isLoading}>
                                      Activate
                                    </Button>
                                    <Button size="sm" variant="error" onClick={() => handleLifecycleAction(ver.id, "RETIRE")} disabled={isLoading}>
                                      Retire
                                    </Button>
                                  </>
                                )}
                                {ver.status === "ACTIVE" && (
                                  <Button size="sm" variant="error" onClick={() => handleLifecycleAction(ver.id, "RETIRE")} disabled={isLoading}>
                                    Retire
                                  </Button>
                                )}
                                {ver.status === "REJECTED" && (
                                  <Button size="sm" variant="secondary" onClick={() => handleLifecycleAction(ver.id, "RESUBMIT")} disabled={isLoading}>
                                    Clone to Draft
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "formulas" && <FormulaDefinitionsTab />}

          {activeTab !== "rate-cards" && activeTab !== "formulas" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">
                  {TABS.find((t) => t.key === activeTab)?.label}
                </h2>
                <span className="text-xs text-on-surface-variant">{entityRecords.length} record(s)</span>
              </div>
              {entityRecords.length === 0 ? (
                <div className="p-4 border border-dashed border-outline-variant rounded-xl text-xs text-on-surface-variant">
                  No records found for this PC-2A configuration entity.
                </div>
              ) : (
                <div className="overflow-x-auto border border-outline-variant rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-container-low text-on-surface-variant uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Latest Version</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {entityRecords.map((rec: any) => {
                        const latest = rec.versions?.[0];
                        return (
                          <tr key={rec.id}>
                            <td className="py-2.5 px-3 font-semibold text-on-surface">{rec.code}</td>
                            <td className="py-2.5 px-3 text-on-surface">{rec.name}</td>
                            <td className="py-2.5 px-3 text-on-surface-variant">
                              {latest ? `v${latest.versionNumber}` : "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              {latest ? (
                                <Badge variant={statusBadgeVariant(latest.status)}>{latest.status}</Badge>
                              ) : (
                                <Badge variant="neutral">NO VERSION</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Modal isOpen={showCreateMaster} onClose={() => setShowCreateMaster(false)} title="Create PC-2A Rate Card Master">
        <form onSubmit={handleCreateMaster} className="space-y-4">
          <Input label="Rate Card Code" value={masterCode} onChange={(e) => setMasterCode(e.target.value)} placeholder="e.g. SG-QAR-2026" required />
          <Input label="Rate Card Name" value={masterName} onChange={(e) => setMasterName(e.target.value)} placeholder="e.g. Security Guarding Standard Rate Card" required />
          <Input label="Currency (3-letter ISO)" value={masterCurrency} onChange={(e) => setMasterCurrency(e.target.value)} maxLength={3} required />
          <Input label="Description (Optional)" value={masterDesc} onChange={(e) => setMasterDesc(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreateMaster(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={isLoading}>Create Rate Card</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showVersionModal} onClose={() => setShowVersionModal(false)} title={editingVersionId ? "Edit Draft Rate Card Version" : "Create Draft Rate Card Version"}>
        <form onSubmit={handleSaveVersion} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Effective From" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
            <Input label="Effective To (Optional)" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
          </div>
          <Input label="BASIC_PAY (Monthly Rate)" type="number" step="0.01" min="0.01" value={basicPayRate} onChange={(e) => setBasicPayRate(e.target.value)} placeholder="Enter Finance-approved amount" required />
          <Input label="ALLOWANCES (Monthly Rate)" type="number" step="0.01" min="0" value={allowancesRate} onChange={(e) => setAllowancesRate(e.target.value)} placeholder="Enter Finance-approved amount" required />
          <Input label="RELIEVER_COST (Optional)" type="number" step="0.01" min="0" value={relieverRate} onChange={(e) => setRelieverRate(e.target.value)} placeholder="Optional" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowVersionModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={isLoading}>Save Draft</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function FormulaDefinitionsTab() {
  const [formula, setFormula] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestFormula = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/v1/settings/commercial-contract/cost-configurations/formula-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formula }),
      });
      if (res.status === 409) {
        setTestResult({ error: "Conflict: Formula has ambiguous variables or circular dependencies." });
      } else if (!res.ok) {
        setTestResult({ error: "Syntax error or invalid formula." });
      } else {
        const data = await res.json();
        setTestResult({ success: true, result: data.result || "Formula evaluated successfully." });
      }
    } catch (e: any) {
      setTestResult({ error: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-on-surface mb-2">Formula Definitions</h2>
        <p className="text-sm text-on-surface-variant">Define and test custom mathematical formulas for cost calculation.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
            Formula Expression
          </label>
          <textarea
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-sm font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            rows={4}
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="e.g. (BASE_SALARY * 0.1) + OVERTIME_RATE"
          />
        </div>
        <Button onClick={handleTestFormula} disabled={isTesting || !formula.trim()}>
          {isTesting ? "Testing..." : "Run Synthetic Test"}
        </Button>
        {testResult && (
          <Card className="bg-surface-container-low border-dashed border-outline-variant mt-4">
            <h3 className="text-sm font-bold mb-2">Test Result:</h3>
            {testResult.error ? (
              <div className="text-status-error text-sm font-medium">{testResult.error}</div>
            ) : (
              <div className="text-status-success text-sm font-medium">{testResult.result}</div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
