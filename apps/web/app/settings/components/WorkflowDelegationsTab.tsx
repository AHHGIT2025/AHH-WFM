import React, { useState, useEffect } from "react";
import { Card, Button, Input, Modal, Badge } from "@ahh-wfm/ui/src";

interface WorkflowDelegationsTabProps {
  employees: any[];
  onShowMessage: (type: "success" | "error", text: string) => void;
}

export function WorkflowDelegationsTab({ employees, onShowMessage }: WorkflowDelegationsTabProps) {
  const [delegations, setDelegations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDelegation, setEditingDelegation] = useState<any | null>(null);

  // Form states
  const [originalApproverId, setOriginalApproverId] = useState("");
  const [delegatedApproverId, setDelegatedApproverId] = useState("");
  const [moduleType, setModuleType] = useState("GLOBAL");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [reason, setReason] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchDelegations();
  }, []);

  const fetchDelegations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/settings/workflow-delegations");
      if (res.ok) {
        setDelegations(await res.json());
      }
    } catch (e) {
      console.error(e);
      onShowMessage("error", "Failed to fetch delegations");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingDelegation(null);
    setOriginalApproverId("");
    setDelegatedApproverId("");
    setModuleType("GLOBAL");
    setEffectiveFrom("");
    setEffectiveTo("");
    setReason("");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (delegation: any) => {
    setEditingDelegation(delegation);
    setOriginalApproverId(delegation.originalApproverEmployeeId || "");
    setDelegatedApproverId(delegation.delegatedApproverEmployeeId || "");
    setModuleType(delegation.moduleType || "GLOBAL");
    setEffectiveFrom(delegation.effectiveFrom ? delegation.effectiveFrom.substring(0, 10) : "");
    setEffectiveTo(delegation.effectiveTo ? delegation.effectiveTo.substring(0, 10) : "");
    setReason(delegation.reason || "");
    setIsActive(!!delegation.isActive);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalApproverId || !delegatedApproverId || !effectiveFrom || !effectiveTo) {
      onShowMessage("error", "All fields are required");
      return;
    }

    if (originalApproverId === delegatedApproverId) {
      onShowMessage("error", "Original and delegated approver cannot be the same person");
      return;
    }

    const originalEmp = employees.find(e => e.id === originalApproverId);
    const delegatedEmp = employees.find(e => e.id === delegatedApproverId);

    const payload = {
      originalApproverEmployeeId: originalApproverId,
      originalApproverName: originalEmp ? (originalEmp.name || originalEmp.fullName || "") : "Original Approver",
      delegatedApproverEmployeeId: delegatedApproverId,
      delegatedApproverName: delegatedEmp ? (delegatedEmp.name || delegatedEmp.fullName || "") : "Delegated Approver",
      moduleType,
      operationType: moduleType === "SECURITY_GUARDING_CONTRACT" ? "SECURITY_GUARDING" : moduleType === "FACILITY_MANAGEMENT_CONTRACT" ? "FACILITY_MANAGEMENT" : "GLOBAL",
      effectiveFrom: new Date(effectiveFrom).toISOString(),
      effectiveTo: new Date(effectiveTo).toISOString(),
      reason,
      isActive
    };

    try {
      const url = editingDelegation ? `/api/v1/settings/workflow-delegations/${editingDelegation.id}` : "/api/v1/settings/workflow-delegations";
      const method = editingDelegation ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onShowMessage("success", `Delegation ${editingDelegation ? "updated" : "created"} successfully`);
        setIsModalOpen(false);
        fetchDelegations();
      } else {
        const err = await res.json();
        onShowMessage("error", err.error || "Failed to save delegation");
      }
    } catch (e) {
      console.error(e);
      onShowMessage("error", "Connection error saving delegation");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this approval delegation?")) return;
    try {
      const res = await fetch(`/api/v1/settings/workflow-delegations/${id}`, { method: "DELETE" });
      if (res.ok) {
        onShowMessage("success", "Delegation deleted successfully");
        fetchDelegations();
      } else {
        onShowMessage("error", "Failed to delete delegation");
      }
    } catch (e) {
      console.error(e);
      onShowMessage("error", "Connection error deleting delegation");
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const isDelegationLive = (dlg: any) => {
    if (!dlg.isActive) return false;
    const now = new Date();
    return new Date(dlg.effectiveFrom) <= now && now <= new Date(dlg.effectiveTo);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-black text-primary uppercase tracking-wider">Approval Delegations</h2>
          <p className="text-xs text-on-surface-variant">Temporarily delegate approval duties to another employee during leaves or absences.</p>
        </div>
        <Button onClick={handleOpenAdd} className="font-bold text-xs flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">person_add</span>
          Add Delegation
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : delegations.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">assignment_ind</span>
          <p className="text-sm font-bold text-primary">No Active Delegations</p>
          <p className="text-xs text-on-surface-variant max-w-sm mb-4">You can set up delegated approvers for when managers are away.</p>
          <Button onClick={handleOpenAdd} variant="secondary" className="text-xs font-bold">
            Create First Delegation
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {delegations.map((dlg) => {
            const isLive = isDelegationLive(dlg);
            return (
              <Card key={dlg.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-primary">{dlg.originalApproverName}</span>
                    <span className="material-symbols-outlined text-sm text-secondary">arrow_forward</span>
                    <span className="text-sm font-bold text-primary">{dlg.delegatedApproverName}</span>
                    
                    {isLive ? (
                      <Badge variant="success" className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 animate-pulse">Live Now</Badge>
                    ) : dlg.isActive ? (
                      <Badge variant="primary" className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5">Scheduled</Badge>
                    ) : (
                      <Badge variant="error" className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">settings_input_component</span>
                      Module: <span className="font-bold text-primary">{dlg.moduleType?.replace(/_/g, " ")}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">date_range</span>
                      {formatDate(dlg.effectiveFrom)} - {formatDate(dlg.effectiveTo)}
                    </span>
                  </div>
                  {dlg.reason && <p className="text-[11px] text-on-surface-variant italic">Reason: "{dlg.reason}"</p>}
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  <Button variant="secondary" onClick={() => handleOpenEdit(dlg)} className="text-xs font-bold">
                    Edit
                  </Button>
                  <Button variant="error" onClick={() => handleDelete(dlg.id)} className="text-xs font-bold">
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* DELEGATION MODAL */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingDelegation ? "Edit Approval Delegation" : "Create Approval Delegation"}
          size="xl"
        >
          <form onSubmit={handleSave} className="space-y-4 p-1 max-h-[75vh] overflow-y-auto pr-2 font-medium">
            <div>
              <label className="text-[10px] font-bold text-primary uppercase block mb-1">Original Approver</label>
              <select
                value={originalApproverId}
                onChange={(e) => setOriginalApproverId(e.target.value)}
                required
                className="w-full h-9 rounded-md border border-outline-variant px-3 py-1 bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="">-- Select Original Approver --</option>
                {employees
                  .filter(e => e.isActive !== false)
                  .map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name || e.fullName} ({e.employeeCode || e.code || "No Code"})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-primary uppercase block mb-1">Delegated Approver</label>
              <select
                value={delegatedApproverId}
                onChange={(e) => setDelegatedApproverId(e.target.value)}
                required
                className="w-full h-9 rounded-md border border-outline-variant px-3 py-1 bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="">-- Select Delegated Approver --</option>
                {employees
                  .filter(e => e.isActive !== false && e.id !== originalApproverId)
                  .map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name || e.fullName} ({e.employeeCode || e.code || "No Code"})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-primary uppercase block mb-1">Applies to Module</label>
              <select
                value={moduleType}
                onChange={(e) => setModuleType(e.target.value)}
                className="w-full h-9 rounded-md border border-outline-variant px-3 py-1 bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="GLOBAL">Global / All Modules</option>
                <option value="SECURITY_GUARDING_CONTRACT">Security Guarding Contracts</option>
                <option value="FACILITY_MANAGEMENT_CONTRACT">Facility Management Contracts</option>
                <option value="LEAVE_REQUEST">Leave Management Request</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-primary uppercase block mb-1">Effective From</label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-primary uppercase block mb-1">Effective To</label>
                <Input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-primary uppercase block mb-1">Reason / Remarks</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Annual Leave, Medical Absence"
                className="text-xs"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-primary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                />
                Active / Enabled
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="text-xs font-bold">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold">
                Save Delegation
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
