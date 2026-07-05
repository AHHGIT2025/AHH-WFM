import React, { useState, useEffect } from "react";
import { Card, Button, Input, Modal, Badge } from "@ahh-wfm/ui/src";

interface WorkflowManagementTabProps {
  employees: any[];
  onShowMessage: (type: "success" | "error", text: string) => void;
}

export function WorkflowManagementTab({ employees, onShowMessage }: WorkflowManagementTabProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  // Form states
  const [workflowName, setWorkflowName] = useState("");
  const [moduleType, setModuleType] = useState("SECURITY_GUARDING_CONTRACT");
  const [operationType, setOperationType] = useState("SECURITY_GUARDING");
  const [appliesTo, setAppliesTo] = useState("ACTIVATION");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [remarks, setRemarks] = useState("");
  const [levels, setLevels] = useState<any[]>([]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/settings/workflows");
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch (e) {
      console.error(e);
      onShowMessage("error", "Failed to fetch workflow templates");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingTemplate(null);
    setWorkflowName("");
    setModuleType("SECURITY_GUARDING_CONTRACT");
    setOperationType("SECURITY_GUARDING");
    setAppliesTo("ACTIVATION");
    setIsDefault(false);
    setIsActive(true);
    setRemarks("");
    setLevels([
      {
        levelNumber: 1,
        levelName: "Level 1 Approval",
        approvalRule: "ANY_ONE",
        isMandatory: true,
        remarks: "",
        approvers: []
      }
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (template: any) => {
    setEditingTemplate(template);
    setWorkflowName(template.workflowName || "");
    setModuleType(template.moduleType || "SECURITY_GUARDING_CONTRACT");
    setOperationType(template.operationType || "SECURITY_GUARDING");
    setAppliesTo(template.appliesTo || "ACTIVATION");
    setIsDefault(!!template.isDefault);
    setIsActive(!!template.isActive);
    setRemarks(template.remarks || "");
    setLevels(
      (template.levels || []).map((lvl: any) => ({
        ...lvl,
        approvers: (lvl.approvers || []).map((ap: any) => ({
          ...ap
        }))
      }))
    );
    setIsModalOpen(true);
  };

  const handleAddLevel = () => {
    const nextNumber = levels.length > 0 ? Math.max(...levels.map(l => l.levelNumber)) + 1 : 1;
    setLevels([
      ...levels,
      {
        levelNumber: nextNumber,
        levelName: `Level ${nextNumber} Approval`,
        approvalRule: "ANY_ONE",
        isMandatory: true,
        remarks: "",
        approvers: []
      }
    ]);
  };

  const handleRemoveLevel = (index: number) => {
    setLevels(levels.filter((_, i) => i !== index).map((lvl, idx) => ({
      ...lvl,
      levelNumber: idx + 1
    })));
  };

  const handleLevelChange = (index: number, key: string, value: any) => {
    const copy = [...levels];
    copy[index] = { ...copy[index], [key]: value };
    setLevels(copy);
  };

  const handleAddApprover = (levelIndex: number) => {
    const copy = [...levels];
    copy[levelIndex].approvers = [
      ...copy[levelIndex].approvers,
      {
        approverType: "SPECIFIC_EMPLOYEE",
        employeeId: "",
        employeeName: "",
        employeeCode: "",
        email: "",
        roleName: ""
      }
    ];
    setLevels(copy);
  };

  const handleRemoveApprover = (levelIndex: number, approverIndex: number) => {
    const copy = [...levels];
    copy[levelIndex].approvers = copy[levelIndex].approvers.filter((_: any, i: number) => i !== approverIndex);
    setLevels(copy);
  };

  const handleApproverChange = (levelIndex: number, approverIndex: number, key: string, value: any) => {
    const copy = [...levels];
    const ap = { ...copy[levelIndex].approvers[approverIndex] };
    
    if (key === "employeeId") {
      const emp = employees.find(e => e.id === value);
      if (emp) {
        ap.employeeId = emp.id;
        ap.employeeName = emp.name || emp.fullName || "";
        ap.employeeCode = emp.employeeCode || emp.code || "";
        ap.email = emp.email || "";
      } else {
        ap.employeeId = "";
        ap.employeeName = "";
        ap.employeeCode = "";
        ap.email = "";
      }
    } else {
      ap[key] = value;
    }
    
    copy[levelIndex].approvers[approverIndex] = ap;
    setLevels(copy);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflowName) {
      onShowMessage("error", "Workflow name is required");
      return;
    }

    // Basic level checks
    if (levels.length === 0) {
      onShowMessage("error", "At least one workflow level is required");
      return;
    }

    for (let i = 0; i < levels.length; i++) {
      const lvl = levels[i];
      if (!lvl.levelName) {
        onShowMessage("error", `Level ${lvl.levelNumber} must have a name`);
        return;
      }
      if (lvl.approvers.length === 0) {
        onShowMessage("error", `Level "${lvl.levelName}" must have at least one approver configured`);
        return;
      }
      for (let j = 0; j < lvl.approvers.length; j++) {
        const ap = lvl.approvers[j];
        if (ap.approverType === "SPECIFIC_EMPLOYEE" && !ap.employeeId) {
          onShowMessage("error", `Please select an employee for approver ${j + 1} at Level "${lvl.levelName}"`);
          return;
        }
      }
    }

    const payload = {
      workflowName,
      moduleType,
      operationType,
      appliesTo,
      isDefault,
      isActive,
      remarks,
      levels
    };

    try {
      const url = editingTemplate ? `/api/v1/settings/workflows/${editingTemplate.id}` : "/api/v1/settings/workflows";
      const method = editingTemplate ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onShowMessage("success", `Workflow template ${editingTemplate ? "updated" : "created"} successfully`);
        setIsModalOpen(false);
        fetchTemplates();
      } else {
        const err = await res.json();
        onShowMessage("error", err.error || "Failed to save workflow template");
      }
    } catch (e) {
      console.error(e);
      onShowMessage("error", "Connection error saving workflow template");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this approval workflow template?")) return;
    try {
      const res = await fetch(`/api/v1/settings/workflows/${id}`, { method: "DELETE" });
      if (res.ok) {
        onShowMessage("success", "Workflow template deleted successfully");
        fetchTemplates();
      } else {
        onShowMessage("error", "Failed to delete workflow template");
      }
    } catch (e) {
      console.error(e);
      onShowMessage("error", "Connection error deleting workflow template");
    }
  };

  // Sync business module and operation type selection
  const handleModuleTypeChange = (val: string) => {
    setModuleType(val);
    if (val === "SECURITY_GUARDING_CONTRACT") {
      setOperationType("SECURITY_GUARDING");
    } else if (val === "FACILITY_MANAGEMENT_CONTRACT") {
      setOperationType("FACILITY_MANAGEMENT");
    } else {
      setOperationType("GLOBAL");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-black text-primary uppercase tracking-wider">Centralized Approval Workflows</h2>
          <p className="text-xs text-on-surface-variant">Configure reusable approval workflows for contracts, termination, and requests.</p>
        </div>
        <Button onClick={handleOpenAdd} className="font-bold text-xs flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">add</span>
          Create Template
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : templates.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">schema</span>
          <p className="text-sm font-bold text-primary">No Approval Workflows Configured</p>
          <p className="text-xs text-on-surface-variant max-w-sm mb-4">Centralized approval workflows are required to route contracts for approval.</p>
          <Button onClick={handleOpenAdd} variant="secondary" className="text-xs font-bold">
            Create First Template
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-primary">{tpl.workflowName}</h3>
                  {tpl.isDefault && <Badge variant="primary" className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5">Default</Badge>}
                  {tpl.isActive ? (
                    <Badge variant="success" className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5">Active</Badge>
                  ) : (
                    <Badge variant="error" className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5">Inactive</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">settings_input_component</span>
                    {tpl.moduleType?.replace(/_/g, " ")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">target</span>
                    Applies to: <span className="font-bold text-primary">{tpl.appliesTo}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">stairs</span>
                    Levels: <span className="font-bold text-primary">{(tpl.levels || []).length}</span>
                  </span>
                </div>
                {tpl.remarks && <p className="text-[11px] text-on-surface-variant italic">"{tpl.remarks}"</p>}
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <Button variant="secondary" onClick={() => handleOpenEdit(tpl)} className="text-xs font-bold">
                  Edit
                </Button>
                <Button variant="error" onClick={() => handleDelete(tpl.id)} className="text-xs font-bold">
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* WORKFLOW TEMPLATE MODAL */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingTemplate ? `Edit Workflow Template — ${workflowName}` : "Create Approval Workflow Template"}
          size="6xl"
        >
          <form onSubmit={handleSave} className="space-y-6 p-1 max-h-[75vh] overflow-y-auto pr-2 font-medium">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-primary uppercase block mb-1">Workflow Name</label>
                <Input
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="e.g. Security Guarding Contract Approval"
                  required
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-primary uppercase block mb-1">Module / Request Type</label>
                <select
                  value={moduleType}
                  onChange={(e) => handleModuleTypeChange(e.target.value)}
                  className="w-full h-9 rounded-md border border-outline-variant px-3 py-1 bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="SECURITY_GUARDING_CONTRACT">Security Guarding Contract</option>
                  <option value="FACILITY_MANAGEMENT_CONTRACT">Facility Management Contract</option>
                  <option value="LEAVE_REQUEST">Leave Management Request</option>
                  <option value="FUTURE_MODULE">Future Module</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-primary uppercase block mb-1">Applies To Action</label>
                <select
                  value={appliesTo}
                  onChange={(e) => setAppliesTo(e.target.value)}
                  className="w-full h-9 rounded-md border border-outline-variant px-3 py-1 bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="ACTIVATION">Contract Activation / Submit</option>
                  <option value="TERMINATION">Contract Termination</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-primary uppercase block mb-1">Description / Remarks</label>
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional remarks"
                  className="text-xs"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-primary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                  />
                  Set as Default for this Module
                </label>

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
            </div>

            <hr className="border-outline-variant" />

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-secondary uppercase tracking-wider">Workflow Levels</h4>
                <Button type="button" onClick={handleAddLevel} variant="secondary" className="text-[11px] font-bold py-1">
                  Add Level
                </Button>
              </div>

              {levels.map((lvl, lIndex) => (
                <div key={lIndex} className="p-4 bg-surface-container-low border border-outline-variant rounded-lg space-y-4 relative">
                  <button
                    type="button"
                    onClick={() => handleRemoveLevel(lIndex)}
                    className="absolute top-2 right-2 text-on-surface-variant hover:text-error transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pr-6">
                    <div>
                      <label className="text-[9px] font-bold text-primary uppercase block mb-1">Level Name</label>
                      <Input
                        value={lvl.levelName}
                        onChange={(e) => handleLevelChange(lIndex, "levelName", e.target.value)}
                        placeholder={`Level ${lvl.levelNumber} Name`}
                        required
                        className="text-xs h-8"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-primary uppercase block mb-1">Level Number</label>
                      <Input
                        type="number"
                        value={lvl.levelNumber}
                        onChange={(e) => handleLevelChange(lIndex, "levelNumber", parseInt(e.target.value, 10))}
                        required
                        className="text-xs h-8"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-primary uppercase block mb-1">Approval Rule</label>
                      <select
                        value={lvl.approvalRule}
                        onChange={(e) => handleLevelChange(lIndex, "approvalRule", e.target.value)}
                        className="w-full h-8 rounded-md border border-outline-variant px-3 py-1 bg-surface text-xs focus:outline-none"
                      >
                        <option value="ANY_ONE">Any One Approver (ANY_ONE)</option>
                        <option value="ALL_REQUIRED">All Approvers Required (ALL_REQUIRED)</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-primary cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!lvl.isMandatory}
                          onChange={(e) => handleLevelChange(lIndex, "isMandatory", e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                        />
                        Mandatory Level
                      </label>
                    </div>
                  </div>

                  {/* Approvers Section inside Level */}
                  <div className="pl-4 border-l-2 border-primary space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Approvers</span>
                      <Button type="button" onClick={() => handleAddApprover(lIndex)} variant="secondary" className="text-[9px] py-0.5 px-2">
                        Add Approver
                      </Button>
                    </div>

                    {lvl.approvers.length === 0 ? (
                      <p className="text-[10px] text-on-surface-variant italic">No approvers configured. Add at least one.</p>
                    ) : (
                      <div className="space-y-2">
                        {lvl.approvers.map((ap: any, aIndex: number) => (
                          <div key={aIndex} className="flex items-center gap-3 bg-surface p-2 rounded border border-outline-variant">
                            <select
                              value={ap.approverType}
                              onChange={(e) => handleApproverChange(lIndex, aIndex, "approverType", e.target.value)}
                              className="h-8 rounded border border-outline-variant px-2 bg-surface text-xs focus:outline-none"
                            >
                              <option value="SPECIFIC_EMPLOYEE">Specific Employee</option>
                              <option value="ROLE_BASED">Role Based</option>
                              <option value="DEPT_HEAD">Department Head</option>
                              <option value="REPORTING_MANAGER">Reporting Manager</option>
                              <option value="CONTRACT_ADMIN">Contract Admin</option>
                            </select>

                            {ap.approverType === "SPECIFIC_EMPLOYEE" ? (
                              <select
                                value={ap.employeeId || ""}
                                onChange={(e) => handleApproverChange(lIndex, aIndex, "employeeId", e.target.value)}
                                className="h-8 flex-1 rounded border border-outline-variant px-2 bg-surface text-xs focus:outline-none"
                              >
                                <option value="">-- Select Employee --</option>
                                {employees
                                  .filter(e => e.isActive !== false)
                                  .map(e => (
                                    <option key={e.id} value={e.id}>
                                      {e.name || e.fullName} ({e.employeeCode || e.code || "No Code"})
                                    </option>
                                  ))}
                              </select>
                            ) : ap.approverType === "ROLE_BASED" ? (
                              <Input
                                value={ap.roleName || ""}
                                onChange={(e) => handleApproverChange(lIndex, aIndex, "roleName", e.target.value)}
                                placeholder="Enter role name"
                                className="text-xs h-8 flex-1"
                              />
                            ) : (
                              <span className="text-xs text-on-surface-variant italic flex-1">Auto-assigned dynamically at runtime.</span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveApprover(lIndex, aIndex)}
                              className="text-on-surface-variant hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="text-xs font-bold">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold">
                Save Template
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
