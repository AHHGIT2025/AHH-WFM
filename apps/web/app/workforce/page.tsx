"use client";

import React, { useState, useEffect } from "react";
import { Employee, Department } from "@ahh-wfm/types";
import { Card, Badge, Input, Button, Modal } from "@ahh-wfm/ui/src";
import Link from "next/link";

export default function WorkforcePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modals state
  const [isAddEmpOpen, setIsAddEmpOpen] = useState(false);
  const [isEditEmpOpen, setIsEditEmpOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  // Forms state
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [newDeptName, setNewDeptName] = useState("");
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState("");

  // Employee Form fields
  const [empId, setEmpId] = useState("");
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPhone, setEmpPhone] = useState("");
  const [empRole, setEmpRole] = useState("EMPLOYEE");
  const [empDeptId, setEmpDeptId] = useState("");
  const [empShiftId, setEmpShiftId] = useState("GEN-001");
  const [empPassword, setEmpPassword] = useState("");
  const [empEmploymentStatus, setEmpEmploymentStatus] = useState("ACTIVE");
  const [empDutyStatus, setEmpDutyStatus] = useState("OFF_DUTY");
  const [empWorkerCategory, setEmpWorkerCategory] = useState("WHITE_COLLAR");

  // Bulk Upload states
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkPreviewData, setBulkPreviewData] = useState<any>(null);
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Validation errors state
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchDb = async () => {
    try {
      const [empRes, deptRes] = await Promise.all([
        fetch("/api/v1/employees"),
        fetch("/api/v1/departments")
      ]);
      if (empRes.ok && deptRes.ok) {
        setEmployees(await empRes.json());
        setDepartments(await deptRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDb();
  }, []);

  // Employee form validation helper
  const validateEmployeeForm = (email: string, name: string, role: string, id: string, isEdit = false): boolean => {
    if (!isEdit && (!id || id.trim() === "")) {
      setValidationError("Employee ID is required");
      return false;
    }
    if (!name || name.trim() === "") {
      setValidationError("Employee name is required");
      return false;
    }
    if (!email || email.trim() === "") {
      setValidationError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setValidationError("Invalid email format (e.g. name@domain.com)");
      return false;
    }
    if (!role || role.trim() === "") {
      setValidationError("Role is required");
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmployeeForm(empEmail, empName, empRole, empId)) return;

    try {
      const res = await fetch("/api/v1/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: empId,
          name: empName,
          email: empEmail,
          phone: empPhone || undefined,
          role: empRole,
          departmentId: empDeptId || undefined,
          shiftId: empShiftId || undefined,
          password: empPassword || undefined,
          employmentStatus: empEmploymentStatus,
          dutyStatus: empDutyStatus,
          workerCategory: empWorkerCategory
        })
      });

      if (res.ok) {
        setIsAddEmpOpen(false);
        // Reset fields
        setEmpId("");
        setEmpName("");
        setEmpEmail("");
        setEmpPhone("");
        setEmpRole("EMPLOYEE");
        setEmpDeptId("");
        setEmpShiftId("GEN-001");
        setEmpPassword("");
        setEmpEmploymentStatus("ACTIVE");
        setEmpDutyStatus("OFF_DUTY");
        setEmpWorkerCategory("WHITE_COLLAR");
        fetchDb();
      } else {
        const err = await res.json();
        setValidationError(err.error || "Failed to create employee");
      }
    } catch (e) {
      setValidationError("Network or server connection failed");
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    if (!validateEmployeeForm(empEmail, empName, empRole, selectedEmp.id, true)) return;

    try {
      const res = await fetch(`/api/v1/employees/${selectedEmp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: empName,
          email: empEmail,
          phone: empPhone || null,
          role: empRole,
          departmentId: empDeptId || null,
          shiftId: empShiftId || null,
          employmentStatus: empEmploymentStatus,
          dutyStatus: empDutyStatus,
          workerCategory: empWorkerCategory
        })
      });

      if (res.ok) {
        setIsEditEmpOpen(false);
        setSelectedEmp(null);
        fetchDb();
      } else {
        const err = await res.json();
        setValidationError(err.error || "Failed to update employee");
      }
    } catch (e) {
      setValidationError("Network or server connection failed");
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this employee? This will restrict scheduling, integrations exports, and clock-ins.")) return;

    try {
      const res = await fetch(`/api/v1/employees/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setIsEditEmpOpen(false);
        setSelectedEmp(null);
        fetchDb();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to deactivate employee");
      }
    } catch (e) {
      alert("Failed to deactivate employee due to network connection issues");
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employmentStatus: "ACTIVE" })
      });
      if (res.ok) {
        setIsEditEmpOpen(false);
        setSelectedEmp(null);
        fetchDb();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to activate employee");
      }
    } catch (e) {
      alert("Failed to activate employee");
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName || newDeptName.trim() === "") return;

    try {
      const res = await fetch("/api/v1/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeptName })
      });

      if (res.ok) {
        setNewDeptName("");
        fetchDb();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create department");
      }
    } catch (e) {
      alert("Connection failed");
    }
  };

  const handleRenameDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeptId || !editingDeptName || editingDeptName.trim() === "") return;

    try {
      const res = await fetch(`/api/v1/departments/${editingDeptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingDeptName })
      });

      if (res.ok) {
        setEditingDeptId(null);
        setEditingDeptName("");
        fetchDb();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to rename department");
      }
    } catch (e) {
      alert("Connection failed");
    }
  };

  const openEditModal = (emp: Employee) => {
    setSelectedEmp(emp);
    setEmpName(emp.name);
    setEmpEmail(emp.email);
    setEmpPhone(emp.phone || "");
    setEmpRole(emp.role);
    setEmpDeptId(emp.departmentId || "");
    setEmpShiftId(emp.shiftId || "GEN-001");
    setEmpEmploymentStatus(emp.employmentStatus || (emp.isActive !== false ? "ACTIVE" : "INACTIVE"));
    setEmpDutyStatus(emp.dutyStatus || "OFF_DUTY");
    setEmpWorkerCategory(emp.workerCategory || "WHITE_COLLAR");
    setValidationError(null);
    setIsEditEmpOpen(true);
  };

  // CSV parsing & upload preview
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    setBulkUploadError("");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      try {
        const res = await fetch("/api/v1/employees/bulk-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csvText: text,
            fileName: file.name,
            updateExisting
          })
        });
        if (res.ok) {
          setBulkPreviewData(await res.json());
        } else {
          const err = await res.json();
          setBulkUploadError(err.error || "Failed to generate CSV upload preview.");
        }
      } catch (err) {
        setBulkUploadError("Connection failed generating CSV preview.");
      }
    };
    reader.readAsText(file);
  };

  const handleImportBulk = async () => {
    if (!bulkPreviewData || !bulkPreviewData.previewRows) return;
    setImporting(true);
    setBulkUploadError("");

    const validRows = bulkPreviewData.previewRows.filter((r: any) => r.isValid).map((r: any) => r.data);

    if (validRows.length === 0) {
      setBulkUploadError("No valid rows found to import.");
      setImporting(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/employees/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows,
          fileName: bulkPreviewData.fileName,
          updateExisting
        })
      });

      if (res.ok) {
        setIsBulkUploadOpen(false);
        setBulkPreviewData(null);
        setBulkFile(null);
        fetchDb();
      } else {
        const err = await res.json();
        setBulkUploadError(err.error || "Failed to import rows.");
      }
    } catch (e) {
      setBulkUploadError("Network connection error during import.");
    } finally {
      setImporting(false);
    }
  };

  // Filter logic
  const filtered = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.id.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase());

    const matchesDept = deptFilter === "all" || emp.departmentId === deptFilter;

    // Filter by Worker Category
    const matchesCategory = categoryFilter === "all" || emp.workerCategory === categoryFilter;

    let matchesStatus = true;
    const isEmpActive = emp.employmentStatus ? (emp.employmentStatus === "ACTIVE") : (emp.isActive !== false);

    if (statusFilter === "active") {
      matchesStatus = isEmpActive;
    } else if (statusFilter === "inactive") {
      matchesStatus = !isEmpActive;
    } else if (statusFilter !== "all") {
      matchesStatus = isEmpActive && (emp.status === statusFilter || emp.dutyStatus === statusFilter);
    }

    return matchesSearch && matchesDept && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Workforce Directory</h1>
          <p className="text-sm text-on-surface-variant">List of all registered field engineers, inspectors, and logistics staff</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            onClick={() => {
              setIsBulkUploadOpen(true);
              setBulkFile(null);
              setBulkPreviewData(null);
              setBulkUploadError("");
            }}
            className="font-bold flex items-center gap-1.5 text-xs bg-surface border border-outline-variant"
          >
            <span className="material-symbols-outlined text-[18px] w-4 h-4 text-primary">upload_file</span>
            <span>Bulk Upload</span>
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setNewDeptName("");
              setEditingDeptId(null);
              setIsDeptModalOpen(true);
            }}
            className="font-bold flex items-center gap-1.5 text-xs"
          >
            <span className="material-symbols-outlined text-[18px] w-4 h-4 text-white">domain</span>
            <span>Departments</span>
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setValidationError(null);
              setEmpId("");
              setEmpName("");
              setEmpEmail("");
              setEmpPhone("");
              setEmpRole("EMPLOYEE");
              setEmpDeptId("");
              setEmpShiftId("GEN-001");
              setEmpPassword("");
              setEmpEmploymentStatus("ACTIVE");
              setEmpDutyStatus("OFF_DUTY");
              setEmpWorkerCategory("WHITE_COLLAR");
              setIsAddEmpOpen(true);
            }}
            className="font-bold flex items-center gap-1.5 text-xs"
          >
            <span className="material-symbols-outlined text-[18px] w-4 h-4 text-white">person_add</span>
            <span>Add Employee</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
          <input
            className="pl-10 pr-4 py-2 border border-outline-variant rounded-lg bg-surface text-sm w-full focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder="Search by name, ID or email..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <select
            className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <select
            className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="On Duty">On Duty</option>
            <option value="On Break">On Break</option>
            <option value="Offline">Offline</option>
            <option value="On Leave">On Leave</option>
          </select>
          <select
            className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="WHITE_COLLAR">White Collar</option>
            <option value="BLUE_COLLAR">Blue Collar</option>
          </select>
        </div>
      </Card>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((emp) => {
          const isEmpActive = emp.employmentStatus ? (emp.employmentStatus === "ACTIVE") : (emp.isActive !== false);
          return (
            <Card key={emp.id} className={`flex flex-col justify-between ${!isEmpActive ? "opacity-60 bg-surface-container-low" : ""}`}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary-container/10 flex items-center justify-center font-bold text-primary border border-secondary-container/20 shrink-0">
                    {emp.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <h3 className="font-bold text-primary text-sm">{emp.name}</h3>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{emp.role}</p>
                    <div className="mt-1">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-secondary/10 text-secondary uppercase">
                        {emp.workerCategory === "BLUE_COLLAR" ? "Blue Collar" : "White Collar"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge variant={isEmpActive ? "success" : "neutral"}>
                    {isEmpActive ? "Active" : "Deactivated"}
                  </Badge>
                  {isEmpActive && (
                    <Badge
                      variant={
                        emp.status === "On Duty" || emp.dutyStatus === "ON_DUTY"
                          ? "success"
                          : emp.status === "On Break"
                          ? "warning"
                          : emp.status === "On Leave"
                          ? "pending"
                          : "neutral"
                      }
                    >
                      {emp.status || "Offline"}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border-subtle grid grid-cols-2 gap-y-2 gap-x-4 text-[11px] text-on-surface-variant">
                <div>
                  <p className="opacity-60 font-semibold uppercase">ID</p>
                  <p className="font-mono text-xs mt-0.5 text-primary font-bold">{emp.id}</p>
                </div>
                <div>
                  <p className="opacity-60 font-semibold uppercase">Department</p>
                  <p className="font-bold text-primary mt-0.5">{emp.department}</p>
                </div>
                <div className="col-span-2">
                  <p className="opacity-60 font-semibold uppercase">Email</p>
                  <p className="font-medium text-primary mt-0.5 break-all">{emp.email}</p>
                </div>
                {emp.phone && (
                  <div className="col-span-2">
                    <p className="opacity-60 font-semibold uppercase">Phone</p>
                    <p className="font-medium text-primary mt-0.5">{emp.phone}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1 font-bold text-xs py-1.5"
                  onClick={() => openEditModal(emp)}
                >
                  Edit Profile
                </Button>
                {!isEmpActive ? (
                  <Button
                    variant="success"
                    className="font-bold text-xs py-1.5 px-3"
                    onClick={() => handleActivate(emp.id)}
                  >
                    Activate
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-status-error hover:bg-red-50 font-bold text-xs py-1.5 px-3 border border-outline-variant"
                    onClick={() => handleDeactivate(emp.id)}
                  >
                    Deactivate
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Bulk Upload Modal */}
      <Modal isOpen={isBulkUploadOpen} onClose={() => setIsBulkUploadOpen(false)} title="Bulk Upload Employees Gateway">
        <div className="space-y-4 text-xs font-medium">
          <div className="p-4 bg-surface-container-low border border-border-subtle rounded-xl flex justify-between items-center">
            <div>
              <p className="font-bold text-primary">Download Template</p>
              <p className="text-[10px] text-outline-variant">Standard schema fields layout rules template file.</p>
            </div>
            <Link
              href="/api/v1/employees/bulk-template"
              className="bg-primary text-white hover:bg-primary/95 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">download</span> Download CSV
            </Link>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-outline-variant">Upload CSV Data File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full bg-surface-container-low border border-border-subtle rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="updateExisting"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-0"
            />
            <label htmlFor="updateExisting" className="text-xs text-primary font-bold cursor-pointer select-none">
              Update existing employee records if IDs match
            </label>
          </div>

          {bulkUploadError && (
            <div className="p-3 bg-status-error/15 text-status-error font-bold rounded-lg border border-status-error/35">
              {bulkUploadError}
            </div>
          )}

          {bulkPreviewData && (
            <div className="space-y-3">
              <div className="flex gap-4 border-y border-border-subtle py-2 text-[10px] font-bold text-outline-variant justify-around text-center">
                <div>
                  <p>Total Rows</p>
                  <p className="text-lg font-black text-primary">{bulkPreviewData.totalRows}</p>
                </div>
                <div>
                  <p className="text-status-success">Valid rows</p>
                  <p className="text-lg font-black text-status-success">{bulkPreviewData.validRows}</p>
                </div>
                <div>
                  <p className="text-status-error">Invalid rows</p>
                  <p className="text-lg font-black text-status-error">{bulkPreviewData.invalidRows}</p>
                </div>
              </div>

              {bulkPreviewData.previewRows && (
                <div className="max-h-[30vh] overflow-y-auto space-y-2 pr-1 border border-border-subtle/50 rounded-xl p-3 bg-surface-container-lowest">
                  <p className="text-[10px] font-bold text-outline-variant uppercase">Row Preview Statuses:</p>
                  {bulkPreviewData.previewRows.map((row: any) => (
                    <div key={row.rowNum} className={`p-2.5 rounded-lg border text-[11px] ${row.isValid ? 'bg-status-success/5 border-status-success/15' : 'bg-status-error/5 border-status-error/15'}`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-primary">Row {row.rowNum}: {row.data.fullName || "N/A"} ({row.data.employeeId || "NO ID"})</span>
                        <Badge variant={row.isValid ? "success" : "error"}>{row.isValid ? "Valid" : "Invalid"}</Badge>
                      </div>
                      {row.errors.length > 0 && (
                        <div className="mt-1 text-[10px] text-status-error font-bold list-disc list-inside">
                          {row.errors.map((err: string, i: number) => (
                            <p key={i}>• {err}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
                <Button variant="secondary" onClick={() => setBulkPreviewData(null)}>Clear</Button>
                <Button onClick={handleImportBulk} disabled={importing || bulkPreviewData.validRows === 0}>
                  {importing ? "Importing..." : `Import ${bulkPreviewData.validRows} Valid Rows`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Add Employee Modal */}
      <Modal isOpen={isAddEmpOpen} onClose={() => setIsAddEmpOpen(false)} title="Register New Employee">
        <form onSubmit={handleAddEmployee} className="space-y-4">
          {validationError && (
            <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error text-xs font-semibold rounded-lg">
              {validationError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Employee ID"
              placeholder="e.g. AA-1002"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              required
            />
            <Input
              label="Full Name"
              placeholder="e.g. Ahmed Al-Mansoori"
              value={empName}
              onChange={(e) => setEmpName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. ahmed@alhattab.qa"
              value={empEmail}
              onChange={(e) => setEmpEmail(e.target.value)}
              required
            />
            <Input
              label="Phone Number"
              placeholder="e.g. +974 5555 4433"
              value={empPhone}
              onChange={(e) => setEmpPhone(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Department</label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={empDeptId}
                onChange={(e) => setEmpDeptId(e.target.value)}
              >
                <option value="">Select Department (Optional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Role</label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={empRole}
                onChange={(e) => setEmpRole(e.target.value)}
              >
                <option value="EMPLOYEE">EMPLOYEE (Mobile App)</option>
                <option value="SUPERVISOR">SUPERVISOR (Web Admin)</option>
                <option value="ADMIN">ADMIN (Full Control)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Worker Category</label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={empWorkerCategory}
                onChange={(e) => setEmpWorkerCategory(e.target.value)}
              >
                <option value="WHITE_COLLAR">White Collar (Staff)</option>
                <option value="BLUE_COLLAR">Blue Collar (Laborer)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Default Shift</label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={empShiftId}
                onChange={(e) => setEmpShiftId(e.target.value)}
              >
                <option value="GEN-001">General Shift (9 AM - 6 PM)</option>
                <option value="MOR-102">Morning Shift (6 AM - 2 PM)</option>
                <option value="AFT-103">Afternoon Shift (2 PM - 10 PM)</option>
                <option value="NGT-201">Night Shift (10 PM - 6 AM)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Default Password"
              type="password"
              placeholder="Optional (Default: Password123!)"
              value={empPassword}
              onChange={(e) => setEmpPassword(e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Employment Status</label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={empEmploymentStatus}
                onChange={(e) => setEmpEmploymentStatus(e.target.value)}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">DEACTIVATED</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
            <Button variant="secondary" type="button" onClick={() => setIsAddEmpOpen(false)}>Cancel</Button>
            <Button type="submit">Register Employee</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal isOpen={isEditEmpOpen} onClose={() => setIsEditEmpOpen(false)} title="Edit Employee Profile">
        {selectedEmp && (
          <form onSubmit={handleEditEmployee} className="space-y-4">
            {validationError && (
              <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error text-xs font-semibold rounded-lg">
                {validationError}
              </div>
            )}
            <Input
              label="Employee ID (Read-only)"
              value={selectedEmp.id}
              disabled
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={empEmail}
                onChange={(e) => setEmpEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                value={empPhone}
                onChange={(e) => setEmpPhone(e.target.value)}
              />
              <div className="space-y-1">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Duty Status</label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={empDutyStatus}
                  onChange={(e) => setEmpDutyStatus(e.target.value)}
                >
                  <option value="OFF_DUTY">Offline</option>
                  <option value="ON_DUTY">On Duty</option>
                  <option value="ON_BREAK">On Break</option>
                  <option value="ON_LEAVE">On Leave</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Department</label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={empDeptId}
                  onChange={(e) => setEmpDeptId(e.target.value)}
                >
                  <option value="">Select Department (Optional)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Role</label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value)}
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Worker Category</label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={empWorkerCategory}
                  onChange={(e) => setEmpWorkerCategory(e.target.value)}
                >
                  <option value="WHITE_COLLAR">White Collar (Staff)</option>
                  <option value="BLUE_COLLAR">Blue Collar (Laborer)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Employment Status</label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={empEmploymentStatus}
                  onChange={(e) => setEmpEmploymentStatus(e.target.value)}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">DEACTIVATED</option>
                </select>
              </div>
            </div>
            <div className="flex justify-between items-center border-t border-border-subtle pt-4 mt-6">
              {selectedEmp.isActive !== false ? (
                <Button
                  variant="error"
                  type="button"
                  onClick={() => handleDeactivate(selectedEmp.id)}
                >
                  Deactivate Employee
                </Button>
              ) : (
                <Button
                  variant="success"
                  type="button"
                  onClick={() => handleActivate(selectedEmp.id)}
                >
                  Activate Employee
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" type="button" onClick={() => setIsEditEmpOpen(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Department Management Modal */}
      <Modal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} title="Manage Departments">
        <div className="space-y-6">
          {/* Create Form */}
          <form onSubmit={handleCreateDept} className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="New Department Name"
                placeholder="e.g. Logistics"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="shrink-0 h-[38px] font-bold text-xs py-1 px-4">
              Add
            </Button>
          </form>

          {/* Department List */}
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b pb-1.5">Registered Departments</h4>
            {departments.map((dept) => (
              <div key={dept.id} className="flex items-center justify-between p-2.5 bg-surface-container-low border border-outline-variant/30 rounded-lg text-xs font-semibold">
                {editingDeptId === dept.id ? (
                  <form onSubmit={handleRenameDept} className="flex gap-2 items-center flex-1">
                    <input
                      className="flex-1 bg-surface border border-outline-variant rounded px-2 py-1 outline-none text-xs"
                      value={editingDeptName}
                      onChange={(e) => setEditingDeptName(e.target.value)}
                      required
                    />
                    <Button type="submit" size="sm" className="font-bold text-[10px] py-1 px-2.5">
                      Save
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="font-bold text-[10px] py-1 px-2.5"
                      onClick={() => setEditingDeptId(null)}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="text-primary font-bold">{dept.name}</span>
                    <button
                      className="text-secondary hover:underline font-bold text-[11px]"
                      onClick={() => {
                        setEditingDeptId(dept.id);
                        setEditingDeptName(dept.name);
                      }}
                    >
                      Rename
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-border-subtle pt-4">
            <Button variant="secondary" onClick={() => setIsDeptModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
