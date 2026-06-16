"use client";

import React, { useState, useEffect } from "react";
import { Card, Button, Input } from "@ahh-wfm/ui/src";
import { useRouter } from "next/navigation";

export default function NewClearanceRequest() {
  const router = useRouter();
  
  // Master data state
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  
  // Filter state
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected employee data
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  
  // Form input state
  const [formData, setFormData] = useState({
    employeeId: "",
    clearanceType: "LEAVE_VACATION",
    separationType: "",
    departureDate: "",
    returningDate: "",
    lastWorkingDate: "",
    typeOfProcess: "",
    templateId: ""
  });
  
  // Dynamic step overrides state
  const [stepOverrides, setStepOverrides] = useState<any[]>([]);
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  
  // Loading & error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load companies, departments, employees, templates
  useEffect(() => {
    setLoading(true);
    
    // Fetch companies
    fetch("/api/v1/masters/companies")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCompanies(data);
      })
      .catch(err => console.error("Error fetching companies:", err));
      
    // Fetch departments
    fetch("/api/v1/masters/departments")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDepartments(data);
      })
      .catch(err => console.error("Error fetching departments:", err));

    // Fetch employees
    fetch("/api/v1/employees")
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.data || [];
        setEmployees(list);
      })
      .catch(err => console.error("Error fetching employees:", err));

    // Fetch templates
    fetch("/api/v1/clearance/templates")
      .then(res => res.json())
      .then(resData => {
        if (resData.success && Array.isArray(resData.data)) {
          setTemplates(resData.data);
        }
      })
      .catch(err => console.error("Error fetching templates:", err));
      
    setLoading(false);
  }, []);

  // Update template selection automatically when clearanceType changes
  useEffect(() => {
    const matchingTemplate = templates.find(t => t.clearanceType === formData.clearanceType && t.isActive);
    if (matchingTemplate) {
      handleTemplateChange(matchingTemplate.id);
    } else {
      setFormData(prev => ({ ...prev, templateId: "" }));
      setStepOverrides([]);
    }
  }, [formData.clearanceType, templates]);

  // IT Applicability dynamic checker
  const checkItApplicability = (emp: any) => {
    if (!emp) return false;
    const hasLogin = emp.isLoginEnabled === true;
    const hasUsername = !!emp.username;
    const hasAuth = ["LOCAL", "SSO", "LOCAL_AND_SSO"].includes(emp.authMode) && emp.isLoginEnabled !== false;
    const hasEmail = emp.email && (emp.email.endsWith(".qa") || emp.email.endsWith("@alhattab.qa") || emp.email.includes("admin") || emp.email.includes("alhattab"));
    const isWhiteCollar = emp.employeeCategory === "WHITE_COLLAR" || emp.role === "ADMIN" || emp.role === "SUPERVISOR";
    const hasItAssets = emp.hasItAssets === true;
    
    return hasItAssets || hasLogin || hasUsername || hasAuth || hasEmail || isWhiteCollar;
  };

  // Generate steps review when employee or template changes
  const generateStepOverrides = (emp: any, template: any) => {
    if (!emp || !template) return;
    
    const overrides = template.sections.map((sec: any) => {
      let isApplicable = sec.isRequiredByDefault;
      let notApplicableReason = "";
      
      // Camps & Facilities override rule
      if (sec.sectionName === "Camps & Facilities") {
        const isAccommodated = emp.hasAccommodation === true;
        isApplicable = isAccommodated;
        if (!isAccommodated) notApplicableReason = "No company accommodation assigned";
      }
      
      // IT Department override rule
      if (sec.sectionName === "IT Department") {
        const isItApplicable = checkItApplicability(emp);
        isApplicable = isItApplicable;
        if (!isItApplicable) notApplicableReason = "No IT assets or system access assigned";
      }
      
      // Default approver selection
      let assignedApproverId = sec.defaultApproverId || "";
      
      // Direct Supervisor dynamic resolution
      if (sec.sectionName === "Direct Supervisor") {
        assignedApproverId = emp.immediateSupervisorId || emp.reportingManagerId || emp.projectSupervisorId || emp.siteSupervisorId || "";
      }
      
      return {
        sectionName: sec.sectionName,
        stepOrder: sec.stepOrder,
        isApplicable,
        notApplicableReason,
        assignedApproverId,
        notes: "",
        isRequiredByDefault: sec.isRequiredByDefault
      };
    });
    
    setStepOverrides(overrides);
  };

  const handleEmployeeChange = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    setSelectedEmployee(emp || null);
    setFormData(prev => ({ ...prev, employeeId }));
    
    if (emp) {
      setSignatureName(emp.name);
      const template = templates.find(t => t.id === formData.templateId);
      if (template) {
        generateStepOverrides(emp, template);
      }
    } else {
      setSignatureName("");
      setStepOverrides([]);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setFormData(prev => ({ ...prev, templateId }));
    const template = templates.find(t => t.id === templateId);
    if (selectedEmployee && template) {
      generateStepOverrides(selectedEmployee, template);
    }
  };

  const handleOverrideToggle = (index: number) => {
    const updated = [...stepOverrides];
    const item = updated[index];
    item.isApplicable = !item.isApplicable;
    if (!item.isApplicable) {
      if (item.sectionName === "IT Department") {
        item.notApplicableReason = "No IT assets or system access assigned";
      } else if (item.sectionName === "Camps & Facilities") {
        item.notApplicableReason = "No company accommodation assigned";
      } else {
        item.notApplicableReason = "Not applicable for this request";
      }
    } else {
      item.notApplicableReason = "";
    }
    setStepOverrides(updated);
  };

  const handleOverrideFieldChange = (index: number, field: string, value: any) => {
    const updated = [...stepOverrides];
    updated[index][field] = value;
    setStepOverrides(updated);
  };

  const handleResetFilters = () => {
    setSelectedCompanyId("");
    setSelectedDepartmentId("");
    setSearchQuery("");
    handleEmployeeChange("");
  };

  // Cascading filters filtering employees
  const filteredEmployees = employees.filter(emp => {
    const companyMatch = !selectedCompanyId || emp.companyId === selectedCompanyId;
    const departmentMatch = !selectedDepartmentId || emp.departmentId === selectedDepartmentId;
    
    const term = searchQuery.toLowerCase().trim();
    const label = `${emp.id} ${emp.name} ${emp.designation?.name || ""}`.toLowerCase();
    const searchMatch = !term || label.includes(term);
    
    return companyMatch && departmentMatch && searchMatch;
  });

  // Departments filtered by selected company
  const filteredDepartments = departments.filter(d => !selectedCompanyId || d.companyId === selectedCompanyId);

  // Helper to resolve Working For string
  const getWorkingForString = (emp: any) => {
    if (!emp) return "-";
    if (emp.defaultProject?.projectName) {
      let val = emp.defaultProject.projectName;
      if (emp.defaultSite?.siteName) val += ` — ${emp.defaultSite.siteName}`;
      return val;
    }
    if (emp.company?.companyName && emp.departmentRef?.name) {
      return `${emp.company.companyName} — ${emp.departmentRef.name}`;
    }
    if (emp.company?.companyName) return emp.company.companyName;
    return "Not set";
  };

  // Validations
  const validateForm = (isSubmitFlow: boolean) => {
    if (!formData.employeeId) return "Employee is required.";
    if (!formData.clearanceType) return "Clearance Type is required.";
    if (!formData.templateId) return "Clearance template selection is required.";
    
    if (formData.clearanceType === "LEAVE_VACATION") {
      if (!formData.departureDate) return "Departure Date is required for leave.";
      if (!formData.returningDate) return "Returning Date is required for leave.";
    } else {
      if (!formData.separationType) return "Separation Type is required.";
      if (!formData.lastWorkingDate) return "Last Working Date is required.";
    }
    
    if (isSubmitFlow) {
      if (!declarationChecked) return "You must accept the employee declaration to submit.";
      if (!signatureName.trim()) return "Signature Name is required for submission.";
    }

    // Step validations
    for (const step of stepOverrides) {
      if (step.isApplicable) {
        if (!step.assignedApproverId && !step.fallbackRole) {
          return `Step "${step.sectionName}" requires an approver or a fallback queue.`;
        }
      } else {
        if (!step.notApplicableReason || !step.notApplicableReason.trim()) {
          return `Step "${step.sectionName}" is marked as Not Applicable and requires a reason.`;
        }
      }
    }

    return "";
  };

  const handleSave = async (status: "DRAFT" | "PENDING_EMPLOYEE_SIGNATURE") => {
    const validationError = validateForm(status === "PENDING_EMPLOYEE_SIGNATURE");
    if (validationError) {
      setError(validationError);
      window.scrollTo(0, 0);
      return;
    }

    setError("");
    setLoading(true);
    
    try {
      const payload = {
        ...formData,
        status,
        overrides: stepOverrides,
        actorId: selectedEmployee?.id || "system"
      };

      const res = await fetch("/api/v1/clearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (resData.success) {
        // If submitted directly, we sign the declaration if checked
        if (status === "PENDING_EMPLOYEE_SIGNATURE" && declarationChecked) {
          await fetch(`/api/v1/clearance/${resData.data.id}/sign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              signatureName,
              signatureData: "Digitally signed on request creation"
            })
          });
        }
        
        router.push(`/clearance/${resData.data.id}`);
      } else {
        setError(resData.error || "Failed to create clearance request.");
      }
    } catch (err: any) {
      console.error(err);
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#FAF8F5] min-h-screen text-gray-800">
      
      {/* Page Header */}
      <div className="flex justify-between items-center border-b pb-4 border-gray-200">
        <div>
          <h1 className="text-3xl font-extrabold text-[#800000] tracking-tight">New Clearance Request</h1>
          <p className="text-gray-500 mt-1">Initiate a leave or separation clearance request from Stitch references</p>
        </div>
        <Button variant="ghost" className="hover:bg-gray-100" onClick={() => router.push("/clearance")}>Cancel</Button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-800 text-sm shadow-sm font-medium">
          ⚠️ Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns (Form Sections) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Search & Cascading Filters */}
          <Card className="p-6 shadow-sm border border-gray-200/50 bg-white">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-lg font-bold text-[#800000] flex items-center gap-2">
                <span className="bg-[#800000]/10 text-[#800000] w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-semibold">1</span>
                Search & Filters
              </h2>
              <button onClick={handleResetFilters} className="text-xs text-[#800000] hover:underline font-semibold">
                Reset Filters
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Company</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setSelectedDepartmentId("");
                    handleEmployeeChange("");
                  }}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#800000] focus:ring focus:ring-[#800000]/20 text-sm py-2 px-3 bg-white border"
                >
                  <option value="">All Companies</option>
                  {companies.map(c => {
                    const code = c.code || c.companyCode || "";
                    const name = c.name || c.companyName || "";
                    const label = code && name ? `${code} — ${name}` : (name || code || c.id);
                    return (
                      <option key={c.id} value={c.id}>{label}</option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Department</label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => {
                    setSelectedDepartmentId(e.target.value);
                    handleEmployeeChange("");
                  }}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#800000] focus:ring focus:ring-[#800000]/20 text-sm py-2 px-3 bg-white border"
                >
                  <option value="">All Departments</option>
                  {filteredDepartments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Search Employee</label>
                <Input
                  type="text"
                  placeholder="Type code or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-sm border border-gray-300 py-1"
                />
              </div>
            </div>
          </Card>

          {/* Section 2: Employee Selection */}
          <Card className="p-6 shadow-sm border border-gray-200/50 bg-white">
            <h2 className="text-lg font-bold text-[#800000] mb-4 border-b pb-2 flex items-center gap-2">
              <span className="bg-[#800000]/10 text-[#800000] w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-semibold">2</span>
              Employee Selection
            </h2>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Select Employee</label>
              <select
                required
                value={formData.employeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 shadow-sm focus:border-[#800000] focus:ring focus:ring-[#800000]/20 text-sm py-2 px-3 bg-white"
              >
                <option value="">-- Select Employee --</option>
                {filteredEmployees.map(emp => {
                  const empId = emp.id || "N/A";
                  const empName = emp.name || "Unknown Name";
                  const designationName = emp.designation?.name || emp.designation || "N/A";
                  const label = `${empId} — ${empName} — ${designationName}`;
                  return (
                    <option key={emp.id} value={emp.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-400 mt-1">Showing {filteredEmployees.length} matching employees based on filters</p>
            </div>
          </Card>

          {/* Section 4: Process Details */}
          <Card className="p-6 shadow-sm border border-gray-200/50 bg-white">
            <h2 className="text-lg font-bold text-[#800000] mb-4 border-b pb-2 flex items-center gap-2">
              <span className="bg-[#800000]/10 text-[#800000] w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-semibold">4</span>
              Process Details
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Clearance Type</label>
                <select
                  value={formData.clearanceType}
                  onChange={(e) => setFormData(prev => ({ ...prev, clearanceType: e.target.value, separationType: "" }))}
                  className="w-full rounded-md border border-gray-300 text-sm py-2 px-3 bg-white"
                >
                  <option value="LEAVE_VACATION">Leave / Vacation Clearance</option>
                  <option value="SEPARATION">Separation Clearance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Type of Process</label>
                <Input
                  type="text"
                  placeholder="e.g., Annual Vacation, Final Exit Visa..."
                  value={formData.typeOfProcess}
                  onChange={(e) => setFormData(prev => ({ ...prev, typeOfProcess: e.target.value }))}
                  className="w-full text-sm border border-gray-300 py-1"
                />
              </div>

              {formData.clearanceType === "LEAVE_VACATION" ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Departure Date</label>
                    <Input
                      type="date"
                      value={formData.departureDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, departureDate: e.target.value }))}
                      className="w-full text-sm border border-gray-300 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Returning Date</label>
                    <Input
                      type="date"
                      value={formData.returningDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, returningDate: e.target.value }))}
                      className="w-full text-sm border border-gray-300 py-1"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Separation Type</label>
                    <select
                      value={formData.separationType}
                      onChange={(e) => setFormData(prev => ({ ...prev, separationType: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 text-sm py-2 px-3 bg-white"
                    >
                      <option value="">-- Select Separation Type --</option>
                      <option value="RESIGNATION">Resignation</option>
                      <option value="TERMINATION">Termination</option>
                      <option value="END_OF_CONTRACT">End of Contract</option>
                      <option value="FINAL_EXIT">Final Exit</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Last Working Date</label>
                    <Input
                      type="date"
                      value={formData.lastWorkingDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastWorkingDate: e.target.value }))}
                      className="w-full text-sm border border-gray-300 py-1"
                    />
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Section 6: Step Applicability Review & Overrides */}
          <Card className="p-6 shadow-sm border border-gray-200/50 bg-white">
            <h2 className="text-lg font-bold text-[#800000] mb-4 border-b pb-2 flex items-center gap-2">
              <span className="bg-[#800000]/10 text-[#800000] w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-semibold">6</span>
              Applicability Review & Overrides
            </h2>
            
            {stepOverrides.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">
                Select an employee and template to review workflow steps.
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 mb-2">Configure step applicability and override approver users. IT and Accommodation steps are pre-calculated.</p>
                {stepOverrides.map((step, idx) => (
                  <div key={idx} className={`p-4 border rounded-md transition-all duration-200 bg-white ${step.isApplicable ? "border-[#800000]/20" : "border-gray-200 bg-gray-50/50"}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">{step.stepOrder}. {step.sectionName}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${step.isApplicable ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-800"}`}>
                            {step.isApplicable ? "Applicable" : "Not Applicable"}
                          </span>
                        </div>
                        
                        {!step.isApplicable && (
                          <div className="mt-2">
                            <label className="block text-[10px] font-semibold text-red-700">Skip Reason (Required)</label>
                            <Input
                              type="text"
                              value={step.notApplicableReason || ""}
                              onChange={(e) => handleOverrideFieldChange(idx, "notApplicableReason", e.target.value)}
                              placeholder="Describe why this step is not applicable..."
                              className="w-full text-xs mt-1 border border-red-300 py-0.5 px-2 bg-white"
                            />
                          </div>
                        )}
                        
                        {step.isApplicable && (
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500">Override Approver</label>
                              <select
                                value={step.assignedApproverId || ""}
                                onChange={(e) => handleOverrideFieldChange(idx, "assignedApproverId", e.target.value)}
                                className="w-full rounded border border-gray-300 text-xs py-1 px-2 mt-1 bg-white"
                              >
                                <option value="">-- Use Default Approver --</option>
                                {employees.map(e => (
                                  <option key={e.id} value={e.id}>{e.id} — {e.name} ({e.designation?.name || "Employee"})</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500">HR Notes / Checklist Items</label>
                              <Input
                                type="text"
                                value={step.notes || ""}
                                onChange={(e) => handleOverrideFieldChange(idx, "notes", e.target.value)}
                                placeholder="Special instructions for this department..."
                                className="w-full text-xs mt-1 border border-gray-300 py-0.5 px-2 bg-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-center border-t md:border-t-0 pt-2 md:pt-0">
                        <label className="text-xs text-gray-600 font-medium">Active:</label>
                        <button
                          type="button"
                          onClick={() => handleOverrideToggle(idx)}
                          className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer ${step.isApplicable ? "bg-[#800000]" : "bg-gray-300"}`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${step.isApplicable ? "translate-x-5" : ""}`} />
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Section 7: Declaration & Submit */}
          <Card className="p-6 shadow-sm border border-gray-200/50 bg-white">
            <h2 className="text-lg font-bold text-[#800000] mb-4 border-b pb-2 flex items-center gap-2">
              <span className="bg-[#800000]/10 text-[#800000] w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-semibold">7</span>
              Declaration & Submit
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-[#800000]/5 rounded-md border border-[#800000]/10">
                <input
                  id="declaration"
                  type="checkbox"
                  checked={declarationChecked}
                  onChange={(e) => setDeclarationChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 text-[#800000] border-gray-300 rounded focus:ring-[#800000]"
                />
                <label htmlFor="declaration" className="text-xs text-gray-700 leading-relaxed font-medium select-none cursor-pointer">
                  I hereby declare that all company assets, keys, mobile devices, ID cards, and files in my possession will be handed over to the respective departments as per the checklist below, and that all system accounts and accesses can be deactivated upon my departure.
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Signature Name (Representative / Employee)</label>
                  <Input
                    type="text"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Enter name to sign electronically..."
                    className="w-full text-sm border border-gray-300 py-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-150">
                <Button
                  onClick={() => handleSave("DRAFT")}
                  disabled={loading}
                  className="bg-white border text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-medium"
                >
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleSave("PENDING_EMPLOYEE_SIGNATURE")}
                  disabled={loading}
                  className="bg-[#800000] text-white hover:bg-[#600000] px-5 py-2 text-sm font-bold shadow-sm"
                >
                  {loading ? "Processing..." : "Submit Clearance"}
                </Button>
              </div>
            </div>
          </Card>

        </div>

        {/* Right Column (Sidebar Snapshot & Workflow Preview) */}
        <div className="space-y-6">
          
          {/* Section 3: Employee Details Snapshot */}
          <Card className="p-6 shadow-sm border border-gray-200/50 bg-white">
            <h2 className="text-lg font-bold text-[#800000] mb-4 border-b pb-2 flex items-center gap-2">
              <span className="bg-[#800000]/10 text-[#800000] w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-semibold">3</span>
              Employee Snapshot
            </h2>
            
            {selectedEmployee ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded border">
                  <div className="w-10 h-10 rounded-full bg-[#800000] text-white flex items-center justify-center font-bold text-sm">
                    {selectedEmployee.name ? selectedEmployee.name.substring(0,2).toUpperCase() : "EMP"}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">{selectedEmployee.name || "Unknown Employee"}</h3>
                    <p className="text-xs text-gray-500 font-mono">{selectedEmployee.id}</p>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Designation:</span>
                    <span className="font-bold text-gray-900 text-right">{selectedEmployee.designation?.name || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Department:</span>
                    <span className="font-bold text-gray-900 text-right">{selectedEmployee.departmentRef?.name || selectedEmployee.department || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Working For:</span>
                    <span className="font-bold text-gray-900 text-right">{getWorkingForString(selectedEmployee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Company:</span>
                    <span className="font-bold text-gray-900 text-right">
                      {selectedEmployee.company ? `${selectedEmployee.company.companyCode} — ${selectedEmployee.company.companyName}` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Sponsor:</span>
                    <span className="font-bold text-gray-900 text-right">{selectedEmployee.sponsor || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Date of Joining:</span>
                    <span className="font-bold text-gray-900 text-right">
                      {selectedEmployee.dateOfJoining ? new Date(selectedEmployee.dateOfJoining).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">QID Number:</span>
                    <span className="font-bold text-gray-900 text-right">{selectedEmployee.qidNumber || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">QID Expiry Date:</span>
                    <span className="font-bold text-gray-900 text-right">
                      {selectedEmployee.qidExpiryDate ? new Date(selectedEmployee.qidExpiryDate).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Passport Number:</span>
                    <span className="font-bold text-gray-900 text-right">{selectedEmployee.passportNumber || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Passport Expiry Date:</span>
                    <span className="font-bold text-gray-900 text-right">
                      {selectedEmployee.passportExpiryDate ? new Date(selectedEmployee.passportExpiryDate).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">System Access:</span>
                    <span className={`font-bold text-right ${selectedEmployee.isLoginEnabled ? "text-green-600" : "text-gray-500"}`}>
                      {selectedEmployee.isLoginEnabled ? "Active Account" : "No Login Access"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Supervisor:</span>
                    <span className="font-bold text-gray-900 text-right">{selectedEmployee.immediateSupervisor?.name || "N/A"}</span>
                  </div>
                </div>

                <div className="border-t pt-3 flex flex-wrap gap-1.5">
                  {selectedEmployee.hasAccommodation && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">Resides in Camp</span>
                  )}
                  {selectedEmployee.hasItAssets && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">Has IT Assets</span>
                  )}
                  {selectedEmployee.employeeCategory === "BLUE_COLLAR" ? (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-bold rounded">Blue Collar</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-[#800000]/10 text-[#800000] text-[10px] font-bold rounded">White Collar</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8 text-sm">
                No employee selected
              </div>
            )}
          </Card>

          {/* Section 5: Workflow Template Selection Preview */}
          <Card className="p-6 shadow-sm border border-gray-200/50 bg-white">
            <h2 className="text-lg font-bold text-[#800000] mb-4 border-b pb-2 flex items-center gap-2">
              <span className="bg-[#800000]/10 text-[#800000] w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-semibold">5</span>
              Workflow Preview
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Select Workflow Template</label>
                <select
                  value={formData.templateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full rounded-md border border-gray-300 text-sm py-2 px-3 bg-white"
                >
                  <option value="">-- Select Template --</option>
                  {templates.filter(t => t.isActive).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {stepOverrides.length > 0 && (
                <div className="border-t pt-3 space-y-3">
                  <h4 className="text-xs font-bold text-gray-700">Approval Steps Preview ({stepOverrides.length})</h4>
                  <div className="relative border-l border-[#800000]/30 ml-2 pl-4 space-y-4 max-h-[300px] overflow-y-auto">
                    {stepOverrides.map((step, idx) => {
                      const approverName = step.assignedApproverId 
                        ? employees.find(e => e.id === step.assignedApproverId)?.name || "Explicit User"
                        : step.fallbackRole || "Default Team Queue";
                        
                      return (
                        <div key={idx} className="relative text-xs">
                          {/* Dot indicator */}
                          <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border border-white shadow-sm ${step.isApplicable ? "bg-[#800000]" : "bg-gray-300"}`} />
                          
                          <div className="font-bold text-gray-800">{step.sectionName}</div>
                          <div className="text-gray-500 flex justify-between mt-0.5 pr-2">
                            <span>Approver: {approverName}</span>
                            <span className={step.isApplicable ? "text-green-600 font-semibold" : "text-gray-400 italic"}>
                              {step.isApplicable ? "Active" : "Skipped"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>

        </div>

      </div>

    </div>
  );
}