"use client";

import React, { useState, useEffect } from "react";
import { Employee, Department } from "@ahh-wfm/types";
import { Card, Badge, Input, Button, Modal } from "@ahh-wfm/ui/src";

export default function WorkforcePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [isAddEmpOpen, setIsAddEmpOpen] = useState(false);
  const [isEditEmpOpen, setIsEditEmpOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);

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
  const [empStatus, setEmpStatus] = useState("Offline");

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
          password: empPassword || undefined
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
          status: empStatus
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
    if (!confirm("Are you sure you want to deactivate this employee? They will no longer be able to log in.")) return;

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
        body: JSON.stringify({ isActive: true })
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
    setEmpStatus(emp.status);
    setValidationError(null);
    setIsEditEmpOpen(true);
  };

  // Filter logic
  const filtered = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.id.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase());

    const matchesDept = deptFilter === "all" || emp.departmentId === deptFilter;

    let matchesStatus = true;
    if (statusFilter === "active") {
      matchesStatus = emp.isActive !== false;
    } else if (statusFilter === "inactive") {
      matchesStatus = emp.isActive === false;
    } else if (statusFilter !== "all") {
      matchesStatus = emp.isActive !== false && emp.status === statusFilter;
    }

    return matchesSearch && matchesDept && matchesStatus;
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
        </div>
      </Card>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((emp) => (
          <Card key={emp.id} className={`flex flex-col justify-between ${emp.isActive === false ? "opacity-60 bg-surface-container-low" : ""}`}>
            <div className="flex justify-between items-start gap-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary-container/10 flex items-center justify-center font-bold text-primary border border-secondary-container/20 shrink-0">
                  {emp.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <h3 className="font-bold text-primary text-sm">{emp.name}</h3>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{emp.role}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {emp.isActive === false ? (
                  <Badge variant="neutral">Deactivated</Badge>
                ) : (
                  <Badge
                    variant={
                      emp.status === "On Duty"
                        ? "success"
                        : emp.status === "On Break"
                        ? "warning"
                        : emp.status === "On Leave"
                        ? "pending"
                        : "neutral"
                    }
                  >
                    {emp.status}
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
              {emp.isActive === false ? (
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
        ))}
      </div>

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
            <Input
              label="Default Password"
              type="password"
              placeholder="Optional (Default: Password123!)"
              value={empPassword}
              onChange={(e) => setEmpPassword(e.target.value)}
            />
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
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={empStatus}
                  onChange={(e) => setEmpStatus(e.target.value)}
                >
                  <option value="Offline">Offline</option>
                  <option value="On Duty">On Duty</option>
                  <option value="On Break">On Break</option>
                  <option value="On Leave">On Leave</option>
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
