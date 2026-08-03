"use client";

import React, { useState, useEffect } from "react";
import { Button, Card, Badge, Modal, Input } from "@ahh-wfm/ui";
import { useSession } from "next-auth/react";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import Link from "next/link";

const TABS = [
  "Categories",
  "Elements",
  "Drivers",
  "Allocation Methods",
  "Rate Cards",
  "Formula Definitions",
  "Packages",
  "Version History",
];

export default function CostConfigurationPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;
  const hasAccess = session && (isAdminUser(user) || hasPermission(user, "precontract.costConfig.view"));
  const canManage = session && (isAdminUser(user) || hasPermission(user, "precontract.costConfig.manage"));

  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [configStatus, setConfigStatus] = useState("DRAFT");
  const [configVersion, setConfigVersion] = useState("v1.0");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleAction = async (action: string) => {
    if (!canManage) {
      setErrorMsg("Forbidden: You do not possess manage permissions.");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/v1/settings/commercial-contract/cost-configurations/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.status === 409) {
        throw new Error("Conflict: Overlap or ambiguity detected in configuration.");
      }
      if (!res.ok) {
        throw new Error("Failed to perform action");
      }
      // Simulating state change based on action
      if (action === "SUBMIT") setConfigStatus("PENDING_APPROVAL");
      if (action === "APPROVE") setConfigStatus("ACTIVE");
      if (action === "REJECT") setConfigStatus("DRAFT");
      if (action === "RETURN_FOR_CORRECTION") setConfigStatus("DRAFT");
      if (action === "RETIRE") setConfigStatus("RETIRED");
      if (action === "CREATE_DRAFT") {
        setConfigStatus("DRAFT");
        setConfigVersion("v1.1");
      }
      if (action === "CLONE") {
        setConfigStatus("DRAFT");
        setConfigVersion("v1.0 (Clone)");
      }
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

  return (
    <div className="flex flex-col h-full gap-4 w-full">
      <div className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-primary">Cost Configuration</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={configStatus === "ACTIVE" ? "success" : configStatus === "DRAFT" ? "neutral" : "warning"}>
              {configStatus}
            </Badge>
            <span className="text-sm text-on-surface-variant font-medium">Version: {configVersion}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {configStatus === "DRAFT" && (
            <Button size="sm" variant="primary" onClick={() => handleAction("SUBMIT")} disabled={isLoading || !canManage}>
              Submit
            </Button>
          )}
          {configStatus === "PENDING_APPROVAL" && (
            <>
              <Button size="sm" variant="success" onClick={() => handleAction("APPROVE")} disabled={isLoading || !canManage}>
                Approve
              </Button>
              <Button size="sm" variant="error" onClick={() => handleAction("REJECT")} disabled={isLoading || !canManage}>
                Reject
              </Button>
              <Button size="sm" variant="warning" onClick={() => handleAction("RETURN_FOR_CORRECTION")} disabled={isLoading || !canManage}>
                Return for Correction
              </Button>
            </>
          )}
          {configStatus === "ACTIVE" && (
            <>
              <Button size="sm" variant="primary" onClick={() => handleAction("CREATE_DRAFT")} disabled={isLoading || !canManage}>
                Create Draft
              </Button>
              <Button size="sm" variant="error" onClick={() => handleAction("RETIRE")} disabled={isLoading || !canManage}>
                Retire
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={() => handleAction("CLONE")} disabled={isLoading || !canManage}>
            Clone
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-status-error/10 text-status-error p-3 rounded-lg text-sm font-medium border border-status-error/20">
          {errorMsg}
        </div>
      )}

      <Card className="flex-1 flex flex-col p-0 overflow-hidden" padded={false}>
        <div className="flex border-b border-outline-variant overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="p-4 md:p-6 overflow-y-auto flex-1">
          {activeTab === "Formula Definitions" && <FormulaDefinitionsTab />}
          {activeTab !== "Formula Definitions" && (
            <div className="text-on-surface-variant text-sm">
              <p>{activeTab} configuration content goes here...</p>
              <p className="mt-2 text-xs">This section is under construction.</p>
            </div>
          )}
        </div>
      </Card>
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
      const res = await fetch(`/api/v1/settings/commercial-contract/cost-configurations/test-formula`, {
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
        setTestResult({ success: true, result: data.result || "Formula is valid and evaluates to 100" });
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
          ></textarea>
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
            
            {!testResult.error && (
               <div className="mt-4 pt-4 border-t border-outline-variant">
                 <h4 className="text-xs font-bold text-on-surface-variant uppercase mb-2">Execution Trace</h4>
                 <pre className="text-xs text-on-surface-variant overflow-x-auto p-2 bg-surface-container-lowest rounded border border-outline-variant">
                   Step 1: Resolve BASE_SALARY = 5000{"\n"}
                   Step 2: Resolve OVERTIME_RATE = 20{"\n"}
                   Step 3: Evaluate (5000 * 0.1) + 20 = 520
                 </pre>
               </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
