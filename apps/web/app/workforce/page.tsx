"use client";

import React, { useState, useEffect } from "react";
import { Employee, Department } from "@ahh-wfm/types";
import { Card, Badge, Input, Button, Modal } from "@ahh-wfm/ui/src";
import Link from "next/link";

function formatCompanyLabel(company: any) {
  if (!company) return "Unnamed Company";
  const code = company.code || company.companyCode || "";
  const name = company.name || company.companyName || "";
  if (code && name) return `${code} — ${name}`;
  if (name) return name;
  if (code) return code;
  return "Unnamed Company";
}

function formatDepartmentLabel(department: any) {
  if (!department) return "Unnamed Department";
  const code = department.code || department.departmentCode || "";
  const name = department.name || department.departmentName || "";
  if (code && name) return `${code} — ${name}`;
  if (name) return name;
  if (code) return code;
  return "Unnamed Department";
}

function formatCostCenterLabel(costCenter: any) {
  if (!costCenter) return "Unnamed Cost Center";
  const code = costCenter.code || costCenter.costCenterCode || costCenter.costCode || "";
  const name = costCenter.name || costCenter.costCenterName || costCenter.label || "";
  if (code && name) return `${code} — ${name}`;
  if (name) return name;
  if (code) return code;
  return "Unnamed Cost Center";
}

function formatLocationLabel(location: any) {
  if (!location) return "Unnamed Location";
  const code = location.code || location.locationCode || "";
  const name = location.name || location.locationName || "";
  if (code && name) return `${code} — ${name}`;
  if (name) return name;
  if (code) return code;
  return "Unnamed Location";
}

function formatDesignationLabel(designation: any) {
  if (!designation) return "Unnamed Designation";
  const code = designation.code || designation.designationCode || "";
  const name = designation.name || designation.designationName || "";
  if (code && name) return `${code} — ${name}`;
  if (name) return name;
  if (code) return code;
  return "Unnamed Designation";
}

function formatProjectLabel(project: any) {
  if (!project) return "Unnamed Project";
  const code = project.code || project.projectCode || "";
  const name = project.name || project.projectName || "";
  if (code && name) return `${code} — ${name}`;
  if (name) return name;
  if (code) return code;
  return "Unnamed Project";
}

function formatProjectSiteLabel(site: any) {
  if (!site) return "Unnamed Site";
  const code = site.code || site.siteCode || "";
  const name = site.name || site.siteName || "";
  if (code && name) return `${code} — ${name}`;
  if (name) return name;
  if (code) return code;
  return "Unnamed Site";
}

export default function WorkforcePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState("all");
  const [dutyStatusFilter, setDutyStatusFilter] = useState("all");
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

  // Blue Collar & Project states
  const [empPositionCategoryId, setEmpPositionCategoryId] = useState("");
  const [empDefaultProjectId, setEmpDefaultProjectId] = useState("");
  const [empDefaultSiteId, setEmpDefaultSiteId] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [positionCategories, setPositionCategories] = useState<any[]>([]);
  const [allSites, setAllSites] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [empCompanyId, setEmpCompanyId] = useState("");
  const [empQidNumber, setEmpQidNumber] = useState("");
  const [empQidExpiryDate, setEmpQidExpiryDate] = useState("");
  const [empPassportNumber, setEmpPassportNumber] = useState("");
  const [empPassportExpiryDate, setEmpPassportExpiryDate] = useState("");
  const [empPassportIssueDate, setEmpPassportIssueDate] = useState("");
  const [empPassportIssuingCountry, setEmpPassportIssuingCountry] = useState("");
  const [empDateOfJoining, setEmpDateOfJoining] = useState("");
  const [empSponsor, setEmpSponsor] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [addTab, setAddTab] = useState("basic");
  const [prevCompanyId, setPrevCompanyId] = useState("");
  const [locations, setLocations] = useState<any[]>([]);
  const [allowedPunchLocations, setAllowedPunchLocations] = useState<any[]>([]);
  const [empDefaultPunchLocationId, setEmpDefaultPunchLocationId] = useState("");
  const [empAllowMultiplePunchLocations, setEmpAllowMultiplePunchLocations] = useState(false);
  const [empAllowOfficePunch, setEmpAllowOfficePunch] = useState(true);
  const [empAllowProjectSitePunch, setEmpAllowProjectSitePunch] = useState(true);
  const [empAllowOnCallPunch, setEmpAllowOnCallPunch] = useState(false);
  const [empAllowOutOfZonePunch, setEmpAllowOutOfZonePunch] = useState(false);
  const [empRequireOutOfZoneReview, setEmpRequireOutOfZoneReview] = useState(true);
  const [empGeofenceRadiusOverrideMeters, setEmpGeofenceRadiusOverrideMeters] = useState("");
  const [empAllowedPunchLocationAssignments, setEmpAllowedPunchLocationAssignments] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);

  const [empDesignationId, setEmpDesignationId] = useState("");
  const [empTradeClassificationId, setEmpTradeClassificationId] = useState("");
  const [empCostCenterId, setEmpCostCenterId] = useState("");
  const [empDefaultLocationId, setEmpDefaultLocationId] = useState("");
  const [empIsRelieverEligible, setEmpIsRelieverEligible] = useState(false);
  const [empIsStandbyEligible, setEmpIsStandbyEligible] = useState(false);
  const [empImmediateSupervisorId, setEmpImmediateSupervisorId] = useState("");
  const [empReportingManagerId, setEmpReportingManagerId] = useState("");
  const [empProjectSupervisorId, setEmpProjectSupervisorId] = useState("");
  const [empSiteSupervisorId, setEmpSiteSupervisorId] = useState("");
  const [empIsSupervisor, setEmpIsSupervisor] = useState(false);
  const [empSupervisorScopeType, setEmpSupervisorScopeType] = useState("DIRECT_REPORTS");

  // Account & Auth states
  const [empUsername, setEmpUsername] = useState("");
  const [empAuthMode, setEmpAuthMode] = useState("LOCAL");
  const [empIsLoginEnabled, setEmpIsLoginEnabled] = useState(true);
  const [empIsLocked, setEmpIsLocked] = useState(false);
  const [empMustChangePassword, setEmpMustChangePassword] = useState(false);
  const [empFailedLoginAttempts, setEmpFailedLoginAttempts] = useState(0);
  const [empLastLoginAt, setEmpLastLoginAt] = useState<string | null>(null);
  const [empPasswordUpdatedAt, setEmpPasswordUpdatedAt] = useState<string | null>(null);

  // Modal Tabs State
  const [editTab, setEditTab] = useState("basic");
  
  // Reset Password Modal State
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetTempPassword, setResetTempPassword] = useState("");
  const [resetForceChange, setResetForceChange] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [formSites, setFormSites] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);

  // Main dashboard filter states
  const [projectFilter, setProjectFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [positionCategoryFilter, setPositionCategoryFilter] = useState("all");
  const [filterSites, setFilterSites] = useState<any[]>([]);

  // Bulk Upload states
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkPreviewData, setBulkPreviewData] = useState<any>(null);
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Validation errors state
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleCompanyChange = (newCompanyId: string) => {
    setEmpCompanyId(newCompanyId);
    if (!newCompanyId) return;

    const clearedFields: string[] = [];

    // Check Department
    if (empDeptId) {
      const dept = departments.find(d => d.id === empDeptId);
      if (dept && dept.companyId && dept.companyId !== newCompanyId) {
        setEmpDeptId("");
        clearedFields.push("Department");
      }
    }

    // Check Cost Center
    if (empCostCenterId) {
      const cc = costCenters.find(c => c.id === empCostCenterId);
      if (cc && cc.companyId && cc.companyId !== newCompanyId) {
        setEmpCostCenterId("");
        clearedFields.push("Cost Center");
      }
    }

    // Check Default Location
    if (empDefaultLocationId) {
      const loc = locations.find(l => l.id === empDefaultLocationId);
      if (loc && loc.companyId && loc.companyId !== newCompanyId) {
        setEmpDefaultLocationId("");
        clearedFields.push("Location");
      }
    }

    // Check Default Project
    if (empDefaultProjectId) {
      const proj = projects.find(p => p.id === empDefaultProjectId);
      if (proj && proj.companyId && proj.companyId !== newCompanyId) {
        setEmpDefaultProjectId("");
        setEmpDefaultSiteId("");
        clearedFields.push("Project & Site");
      }
    } else if (empDefaultSiteId) {
      // Check Site
      const site = allSites.find(s => s.id === empDefaultSiteId);
      if (site && site.companyId && site.companyId !== newCompanyId) {
        setEmpDefaultSiteId("");
        clearedFields.push("Site");
      }
    }

    if (clearedFields.length > 0) {
      const msg = `Company changed. The following mismatched selections were cleared: ${clearedFields.join(", ")}.`;
      setValidationError(msg);
      setTimeout(() => {
        setValidationError(prev => prev === msg ? null : prev);
      }, 5000);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setDeptFilter("all");
    setEmploymentStatusFilter("all");
    setDutyStatusFilter("all");
    setCategoryFilter("all");
    setPositionCategoryFilter("all");
    setProjectFilter("all");
    setSiteFilter("all");
    setCompanyFilter("all");
    fetchDb();
  };

  const fetchDeployments = async () => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/v1/deployments?date=${todayStr}`);
      if (res.ok) {
        setDeployments(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/v1/employees/me').then(res => {
      if (res.ok) res.json().then(data => setIsAdmin(data.role === 'ADMIN'));
    });
  }, []);

  const fetchDb = async () => {
    try {
      const [empRes, deptRes, projRes, catRes, desRes, trdRes, locRes, ccRes, aplRes, compRes] = await Promise.all([
        fetch("/api/v1/employees"),
        fetch("/api/v1/departments"),
        fetch("/api/v1/projects"),
        fetch("/api/v1/blue-collar/position-categories"),
        fetch("/api/v1/masters/designations"),
        fetch("/api/v1/masters/trade-classifications"),
        fetch("/api/v1/masters/locations"),
        fetch("/api/v1/masters/cost-centers"),
        fetch("/api/v1/attendance/allowed-locations"),
        fetch("/api/v1/masters/companies")
      ]);
      if (empRes.ok && deptRes.ok) {
        setEmployees(await empRes.json());
        setDepartments(await deptRes.json());
      }
      if (projRes.ok) {
        setProjects(await projRes.json());
      }
      if (catRes.ok) {
        setPositionCategories(await catRes.json());
      }
      if (desRes && desRes.ok) setDesignations(await desRes.json());
      if (trdRes && trdRes.ok) setTrades(await trdRes.json());
      if (locRes && locRes.ok) setLocations(await locRes.json());
      if (ccRes && ccRes.ok) setCostCenters(await ccRes.json());
      if (aplRes && aplRes.ok) setAllowedPunchLocations(await aplRes.json());
      if (compRes && compRes.ok) setCompanies(await compRes.json());
      await fetchDeployments();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDb();
  }, []);

  useEffect(() => {
    if (empDefaultProjectId) {
      fetch(`/api/v1/projects/${empDefaultProjectId}/sites`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setFormSites(data))
        .catch(() => setFormSites([]));
    } else {
      setFormSites([]);
    }
  }, [empDefaultProjectId]);

  useEffect(() => {
    if (projectFilter !== "all") {
      fetch(`/api/v1/projects/${projectFilter}/sites`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setFilterSites(data))
        .catch(() => setFilterSites([]));
    } else {
      setFilterSites([]);
      setSiteFilter("all");
    }
  }, [projectFilter]);

  useEffect(() => {
    if (projects.length > 0) {
      Promise.all(
        projects.map(p =>
          fetch(`/api/v1/projects/${p.id}/sites`)
            .then(res => res.ok ? res.json() : [])
            .catch(() => [])
        )
      ).then(results => {
        const merged = results.flat();
        setAllSites(merged);
      });
    }
  }, [projects]);

  useEffect(() => {
    if (empCompanyId && prevCompanyId && empCompanyId !== prevCompanyId) {
      let clearedAny = false;
      let msgParts = [];
      if (empDeptId) {
        const dept = departments.find(d => d.id === empDeptId);
        if (dept && dept.companyId && dept.companyId !== empCompanyId) {
          setEmpDeptId("");
          clearedAny = true;
          msgParts.push("Department");
        }
      }
      if (empCostCenterId) {
        const cc = costCenters.find(c => c.id === empCostCenterId);
        if (cc && cc.companyId && cc.companyId !== empCompanyId) {
          setEmpCostCenterId("");
          clearedAny = true;
          msgParts.push("Cost Center");
        }
      }
      if (empDefaultLocationId) {
        const loc = locations.find(l => l.id === empDefaultLocationId);
        if (loc && loc.companyId && loc.companyId !== empCompanyId) {
          setEmpDefaultLocationId("");
          clearedAny = true;
          msgParts.push("Location");
        }
      }
      if (empDefaultProjectId) {
        const proj = projects.find(p => p.id === empDefaultProjectId);
        if (proj && proj.companyId && proj.companyId !== empCompanyId) {
          setEmpDefaultProjectId("");
          setEmpDefaultSiteId("");
          clearedAny = true;
          msgParts.push("Project & Site");
        }
      }
      if (clearedAny) {
        setValidationError(`Company changed. Cleared mismatched fields: ${msgParts.join(", ")}`);
        setTimeout(() => setValidationError(null), 5000);
      }
    }
    setPrevCompanyId(empCompanyId);
  }, [empCompanyId, departments, costCenters, locations, projects]);

  // Employee form validation helper
  const validateEmployeeForm = (email: string, name: string, role: string, id: string, isEdit = false): boolean => {
    if (!isEdit && (!id || id.trim() === "")) {
      setValidationError("Employee ID is required");
      return false;
    }
    if (!isEdit && empEmploymentStatus === "ACTIVE" && (!empCompanyId || empCompanyId.trim() === "")) {
      setValidationError("Company is required");
      return false;
    }
    if (empQidExpiryDate && empDateOfJoining) {
      if (new Date(empQidExpiryDate) < new Date(empDateOfJoining)) {
        setValidationError("Qatar ID expiry date cannot be before date of joining");
        return false;
      }
    }
    if (empPassportExpiryDate && empPassportIssueDate) {
      if (new Date(empPassportExpiryDate) < new Date(empPassportIssueDate)) {
        setValidationError("Passport expiry date cannot be before issue date");
        return false;
      }
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
    if (empWorkerCategory === "BLUE_COLLAR") {
      if (!empDesignationId) {
        setValidationError("Designation is required for Blue Collar employees");
        return false;
      }
      if (!empTradeClassificationId) {
        setValidationError("Trade Classification is required for Blue Collar employees");
        return false;
      }
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
          workerCategory: empWorkerCategory,
          positionCategoryId: empWorkerCategory === "BLUE_COLLAR" ? (empPositionCategoryId || undefined) : undefined,
          defaultProjectId: empWorkerCategory === "BLUE_COLLAR" ? (empDefaultProjectId || undefined) : undefined,
          defaultSiteId: empWorkerCategory === "BLUE_COLLAR" ? (empDefaultSiteId || undefined) : undefined,
          designationId: empDesignationId || undefined,
          tradeClassificationId: empTradeClassificationId || undefined,
          costCenterId: empCostCenterId || undefined,
          defaultLocationId: empDefaultLocationId || undefined,
          isRelieverEligible: empIsRelieverEligible,
          isStandbyEligible: empIsStandbyEligible,
          immediateSupervisorId: empImmediateSupervisorId || null,
          reportingManagerId: empReportingManagerId || null,
          projectSupervisorId: empProjectSupervisorId || null,
          siteSupervisorId: empSiteSupervisorId || null,
          isSupervisor: empIsSupervisor,
          supervisorScopeType: empSupervisorScopeType,
          companyId: empCompanyId || undefined,
          qidNumber: empQidNumber ? empQidNumber.trim() : undefined,
          qidExpiryDate: empQidExpiryDate || undefined,
          passportNumber: empPassportNumber ? empPassportNumber.trim().toUpperCase() : undefined,
          passportExpiryDate: empPassportExpiryDate || undefined,
          passportIssueDate: empPassportIssueDate || undefined,
          passportIssuingCountry: empPassportIssuingCountry ? empPassportIssuingCountry.trim() : undefined,
          dateOfJoining: empDateOfJoining || undefined,
          sponsor: empSponsor ? empSponsor.trim() : undefined,
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
        setEmpPositionCategoryId("");
        setEmpDefaultProjectId("");
        setEmpDefaultSiteId("");
        setEmpDesignationId("");
        setEmpTradeClassificationId("");
        setEmpCostCenterId("");
        setEmpDefaultLocationId("");
        setEmpIsRelieverEligible(false);
        setEmpImmediateSupervisorId("");
        setEmpReportingManagerId("");
        setEmpProjectSupervisorId("");
        setEmpSiteSupervisorId("");
        setEmpIsSupervisor(false);
        setEmpSupervisorScopeType("DIRECT_REPORTS");
        setEmpIsStandbyEligible(false);
        setEmpDefaultPunchLocationId("");
        setEmpAllowMultiplePunchLocations(false);
        setEmpAllowOfficePunch(true);
        setEmpAllowProjectSitePunch(true);
        setEmpAllowOnCallPunch(false);
        setEmpAllowOutOfZonePunch(false);
        setEmpRequireOutOfZoneReview(true);
        setEmpGeofenceRadiusOverrideMeters("");
        setEmpAllowedPunchLocationAssignments([]);
        setEmpCompanyId("");
        setEmpQidNumber("");
        setEmpQidExpiryDate("");
        setEmpPassportNumber("");
        setEmpPassportExpiryDate("");
        setEmpPassportIssueDate("");
        setEmpPassportIssuingCountry("");
        setEmpDateOfJoining("");
        setEmpSponsor("");
        setAddTab("basic");
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
          workerCategory: empWorkerCategory,
          positionCategoryId: empWorkerCategory === "BLUE_COLLAR" ? (empPositionCategoryId || null) : null,
          defaultProjectId: empWorkerCategory === "BLUE_COLLAR" ? (empDefaultProjectId || null) : null,
          defaultSiteId: empWorkerCategory === "BLUE_COLLAR" ? (empDefaultSiteId || null) : null,
          designationId: empDesignationId || null,
          tradeClassificationId: empTradeClassificationId || null,
          costCenterId: empCostCenterId || null,
          defaultLocationId: empDefaultLocationId || null,
          isRelieverEligible: empIsRelieverEligible,
          isStandbyEligible: empIsStandbyEligible,
          immediateSupervisorId: empImmediateSupervisorId || null,
          reportingManagerId: empReportingManagerId || null,
          projectSupervisorId: empProjectSupervisorId || null,
          siteSupervisorId: empSiteSupervisorId || null,
          isSupervisor: empIsSupervisor,
          supervisorScopeType: empSupervisorScopeType,
          username: empUsername || null,
          authMode: empAuthMode,
          isLoginEnabled: empIsLoginEnabled,
          companyId: empCompanyId || null,
          qidNumber: empQidNumber ? empQidNumber.trim() : null,
          qidExpiryDate: empQidExpiryDate || null,
          passportNumber: empPassportNumber ? empPassportNumber.trim().toUpperCase() : null,
          passportExpiryDate: empPassportExpiryDate || null,
          passportIssueDate: empPassportIssueDate || null,
          passportIssuingCountry: empPassportIssuingCountry ? empPassportIssuingCountry.trim() : null,
          dateOfJoining: empDateOfJoining || null,
          sponsor: empSponsor ? empSponsor.trim() : null
        })
      });

      // Patch the punch policy
      await fetch(`/api/v1/employees/${selectedEmp.id}/punch-policy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultPunchLocationId: empDefaultPunchLocationId || null,
          allowMultiplePunchLocations: empAllowMultiplePunchLocations,
          allowOfficePunch: empAllowOfficePunch,
          allowProjectSitePunch: empAllowProjectSitePunch,
          allowOnCallPunch: empAllowOnCallPunch,
          allowOutOfZonePunch: empAllowOutOfZonePunch,
          requireOutOfZoneReview: empRequireOutOfZoneReview,
          geofenceRadiusOverrideMeters: empGeofenceRadiusOverrideMeters || null
        })
      });

      if (res.ok) {
        setIsEditEmpOpen(false);
        setSelectedEmp(null);
        setEmpPositionCategoryId("");
        setEmpDefaultProjectId("");
        setEmpDefaultSiteId("");
        setEmpDesignationId("");
        setEmpTradeClassificationId("");
        setEmpCostCenterId("");
        setEmpDefaultLocationId("");
        setEmpIsRelieverEligible(false);
        setEmpIsStandbyEligible(false);
        fetchDb();
      } else {
        const err = await res.json();
        setValidationError(err.error || "Failed to update employee");
      }
    } catch (e) {
      setValidationError("Network or server connection failed");
    }
  };

  
  const handleLockAccount = async (id: string, lock: boolean) => {
    try {
      const res = await fetch(`/api/v1/admin/user-accounts/${id}/${lock ? 'lock' : 'unlock'}`, { method: "POST" });
      if (res.ok) {
        setEmpIsLocked(lock);
        const updated = await res.json();
        if(updated.employee && updated.employee.failedLoginAttempts !== undefined) {
           setEmpFailedLoginAttempts(updated.employee.failedLoginAttempts);
        }
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update account lock status");
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    try {
      const res = await fetch(`/api/v1/admin/user-accounts/${selectedEmp.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPassword: resetTempPassword || undefined, forceChange: resetForceChange })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedPassword(data.tempPassword);
        setEmpMustChangePassword(true);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to reset password");
      }
    } catch (e) {
      alert("Network error");
    }
  };
  
  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 12; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    setResetTempPassword(pass);
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

  const openEditModal = async (emp: Employee) => {
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
    setEmpPositionCategoryId((emp as any).positionCategoryId || "");
    setEmpDefaultProjectId((emp as any).defaultProjectId || "");
    setEmpDefaultSiteId((emp as any).defaultSiteId || "");
    setEmpDesignationId((emp as any).designationId || "");
    setEmpTradeClassificationId((emp as any).tradeClassificationId || "");
    setEmpCostCenterId((emp as any).costCenterId || "");
    setEmpDefaultLocationId((emp as any).defaultLocationId || "");
    setEmpIsRelieverEligible(!!(emp as any).isRelieverEligible);
    setEmpImmediateSupervisorId((emp as any).immediateSupervisorId || "");
    setEmpReportingManagerId((emp as any).reportingManagerId || "");
    setEmpProjectSupervisorId((emp as any).projectSupervisorId || "");
    setEmpSiteSupervisorId((emp as any).siteSupervisorId || "");
    setEmpIsSupervisor(!!(emp as any).isSupervisor);
    setEmpSupervisorScopeType((emp as any).supervisorScopeType || "DIRECT_REPORTS");
    setEmpCompanyId(emp.companyId || "");
    setEmpQidNumber(emp.qidNumber || "");
    setEmpQidExpiryDate(emp.qidExpiryDate ? new Date(emp.qidExpiryDate).toISOString().split("T")[0] : "");
    setEmpPassportNumber(emp.passportNumber || "");
    setEmpPassportExpiryDate(emp.passportExpiryDate ? new Date(emp.passportExpiryDate).toISOString().split("T")[0] : "");
    setEmpPassportIssueDate(emp.passportIssueDate ? new Date(emp.passportIssueDate).toISOString().split("T")[0] : "");
    setEmpPassportIssuingCountry(emp.passportIssuingCountry || "");
    setEmpDateOfJoining(emp.dateOfJoining ? new Date(emp.dateOfJoining).toISOString().split("T")[0] : "");
    setEmpSponsor(emp.sponsor || "");
    setEmpIsStandbyEligible(!!(emp as any).isStandbyEligible);
    setEmpDefaultPunchLocationId((emp as any).defaultPunchLocationId || "");
    setEmpAllowMultiplePunchLocations(!!(emp as any).allowMultiplePunchLocations);
    setEmpAllowOfficePunch((emp as any).allowOfficePunch !== false);
    setEmpAllowProjectSitePunch((emp as any).allowProjectSitePunch !== false);
    setEmpAllowOnCallPunch(!!(emp as any).allowOnCallPunch);
    setEmpAllowOutOfZonePunch(!!(emp as any).allowOutOfZonePunch);
    setEmpRequireOutOfZoneReview((emp as any).requireOutOfZoneReview !== false);
    setEmpGeofenceRadiusOverrideMeters((emp as any).geofenceRadiusOverrideMeters?.toString() || "");

    setEmpUsername((emp as any).username || "");
    setEmpAuthMode((emp as any).authMode || "LOCAL");
    setEmpIsLoginEnabled((emp as any).isLoginEnabled !== false);
    setEmpIsLocked(!!(emp as any).isLocked);
    setEmpMustChangePassword(!!(emp as any).mustChangePassword);
    setEmpFailedLoginAttempts((emp as any).failedLoginAttempts || 0);
    setEmpLastLoginAt((emp as any).lastLoginAt ? new Date((emp as any).lastLoginAt).toLocaleString() : null);
    setEmpPasswordUpdatedAt((emp as any).passwordUpdatedAt ? new Date((emp as any).passwordUpdatedAt).toLocaleString() : null);

    setEditTab("basic");
    try {
      const aplRes = await fetch(`/api/v1/employees/${emp.id}/allowed-locations`);
      if (aplRes.ok) {
        setEmpAllowedPunchLocationAssignments(await aplRes.json());
      } else {
        setEmpAllowedPunchLocationAssignments([]);
      }
    } catch (e) {
      setEmpAllowedPunchLocationAssignments([]);
    }
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
    const matchesCompany = companyFilter === "all" || emp.companyId === companyFilter;

    // Filter by Worker Category
    const matchesCategory = categoryFilter === "all" || emp.workerCategory === categoryFilter;

    // Filter by Trade Position Category
    const matchesPositionCategory = positionCategoryFilter === "all" || (emp as any).positionCategoryId === positionCategoryFilter;

    // Filter by Project
    const empDeployments = deployments.filter(d => d.employeeId === emp.id);
    const matchesProject = projectFilter === "all" ||
      (emp as any).defaultProjectId === projectFilter ||
      empDeployments.some(d => d.projectId === projectFilter);

    // Filter by Site
    const matchesSite = siteFilter === "all" ||
      (emp as any).defaultSiteId === siteFilter ||
      empDeployments.some(d => d.siteId === siteFilter);

    const matchesEmploymentStatus = employmentStatusFilter === "all" || emp.employmentStatus === employmentStatusFilter;
    const matchesDutyStatus = dutyStatusFilter === "all" || emp.dutyStatus === dutyStatusFilter;

    return matchesSearch && matchesDept && matchesCategory && matchesPositionCategory && matchesProject && matchesSite && matchesEmploymentStatus && matchesDutyStatus && matchesCompany;
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
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="all">All Companies</option>
            {companies.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {formatCompanyLabel(comp)}
              </option>
            ))}
          </select>
          <select
            className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departments.filter(d => companyFilter === "all" || d.companyId === companyFilter).map((dept) => (
              <option key={dept.id} value={dept.id}>
                {formatDepartmentLabel(dept)}
              </option>
            ))}
          </select>
          <select
            className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
            value={employmentStatusFilter}
            onChange={(e) => setEmploymentStatusFilter(e.target.value)}
          >
            <option value="all">All Employment Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Deactivated</option>
          </select>
          <select
            className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
            value={dutyStatusFilter}
            onChange={(e) => setDutyStatusFilter(e.target.value)}
          >
            <option value="all">All Duty Statuses</option>
            <option value="OFF_DUTY">Offline</option>
            <option value="ON_DUTY">On Duty</option>
            <option value="ON_BREAK">On Break</option>
            <option value="ON_LEAVE">On Leave</option>
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
          {categoryFilter === "BLUE_COLLAR" && (
            <>
              <select
                className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
                value={positionCategoryFilter}
                onChange={(e) => setPositionCategoryFilter(e.target.value)}
              >
                <option value="all">All Trades</option>
                {positionCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="all">All Projects</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>{formatProjectLabel(proj)}</option>
                ))}
              </select>
              <select
                className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                disabled={projectFilter === "all"}
              >
                <option value="all">All Sites</option>
                {filterSites.map((site) => (
                  <option key={site.id} value={site.id}>{formatProjectSiteLabel(site)}</option>
                ))}
              </select>
            </>
          )}
          <Button 
            variant="secondary" 
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 text-xs bg-surface border border-outline-variant"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">filter_alt_off</span>
            Reset Filters
          </Button>
        </div>
      </Card>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((emp) => {
          const isEmpActive = emp.employmentStatus ? (emp.employmentStatus === "ACTIVE") : (emp.isActive !== false);
          const empDept = departments.find(d => d.id === emp.departmentId)?.name || emp.department || "N/A";
          const defaultProject = projects.find(p => p.id === (emp as any).defaultProjectId);
          const defaultSite = allSites.find(s => s.id === (emp as any).defaultSiteId);
          const tradeCategory = positionCategories.find(c => c.id === (emp as any).positionCategoryId);
          const empDeployments = deployments.filter(d => d.employeeId === emp.id);

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
                  <p className="opacity-60 font-semibold uppercase">Company</p>
                  {(() => {
                    const comp = companies.find(c => c.id === emp.companyId);
                    return comp ? (
                      <p className="font-bold text-primary mt-0.5">{comp.companyCode} — {comp.companyName}</p>
                    ) : (
                      <p className="font-bold text-status-error bg-status-error/10 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 mt-0.5">
                        ⚠️ Company missing
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <p className="opacity-60 font-semibold uppercase">Department</p>
                  <p className="font-bold text-primary mt-0.5">{empDept}</p>
                </div>
                {emp.workerCategory === "BLUE_COLLAR" && (
                  <>
                    <div>
                      <p className="opacity-60 font-semibold uppercase">Trade/Position</p>
                      <p className="font-bold text-primary mt-0.5">{tradeCategory?.name || "N/A"}</p>
                    </div>
                    <div>
                      <p className="opacity-60 font-semibold uppercase">Default Site</p>
                      <p className="font-bold text-primary mt-0.5 text-ellipsis overflow-hidden whitespace-nowrap" title={defaultSite ? `${defaultProject?.projectName || ""} - ${defaultSite?.siteName || ""}` : ""}>
                        {defaultSite ? `${defaultProject?.projectCode || ""}: ${defaultSite.siteName}` : "N/A"}
                      </p>
                    </div>
                    {empDeployments.length > 0 && (
                      <div className="col-span-2 bg-secondary/5 border border-secondary/15 rounded-lg p-2.5 mt-1">
                        <p className="text-[9px] opacity-70 font-bold uppercase tracking-wider text-secondary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">assignment_ind</span>
                          <span>Today's Deployments</span>
                        </p>
                        {empDeployments.map((d, idx) => {
                          const proj = projects.find(p => p.id === d.projectId);
                          const site = allSites.find(s => s.id === d.siteId);
                          return (
                            <p key={idx} className="font-bold text-primary text-[10px] mt-1">
                              • {proj?.projectName || "Proj"}: {site?.siteName || "Site"} ({d.startTime} - {d.endTime})
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
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
                  onClick={() => { openEditModal(emp); }}
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

          <div className="flex border-b border-outline-variant/30 mb-4 overflow-x-auto no-scrollbar">
            <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${addTab === 'basic' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setAddTab('basic')}>Basic Info</button>
            <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${addTab === 'assignment' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setAddTab('assignment')}>Work Assignment</button>
            <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${addTab === 'identity' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setAddTab('identity')}>Identity Documents</button>
            <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${addTab === 'punch' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setAddTab('punch')}>Punch Settings</button>
            <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${addTab === 'supervisor' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setAddTab('supervisor')}>Supervisor & Reporting</button>
            <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${addTab === 'account' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setAddTab('account')}>Account Access</button>
          </div>

          {/* BASIC INFO TAB */}
          {addTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Employee ID *"
                  placeholder="e.g. AA-1002"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  required
                />
                <Input
                  label="Full Name *"
                  placeholder="e.g. Ahmed Al-Mansoori"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Email Address *"
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
            </div>
          )}

          {/* WORK ASSIGNMENT TAB */}
          {addTab === 'assignment' && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-container border border-outline-variant/30 rounded-xl space-y-3">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Company & Department</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Company *</label>
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={empCompanyId}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                      required={empEmploymentStatus === 'ACTIVE'}
                    >
                      <option value="">Select Company</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{formatCompanyLabel(c)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Department</label>
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={empDeptId}
                      onChange={(e) => setEmpDeptId(e.target.value)}
                    >
                      <option value="">Select Department (Optional)</option>
                      {departments.filter(d => !empCompanyId || d.companyId === empCompanyId).map((d) => (
                        <option key={d.id} value={d.id}>{formatDepartmentLabel(d)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Designation</label>
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={empDesignationId}
                      onChange={(e) => setEmpDesignationId(e.target.value)}
                    >
                      <option value="">Select Designation</option>
                      {designations.map((d) => (
                        <option key={d.id} value={d.id}>{formatDesignationLabel(d)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {empWorkerCategory === "BLUE_COLLAR" && (
                <div className="p-4 bg-secondary/5 border border-secondary/10 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">Blue Collar Core Settings</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Trade / Position Category *</label>
                      <select
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={empPositionCategoryId}
                        onChange={(e) => setEmpPositionCategoryId(e.target.value)}
                        required
                      >
                        <option value="">Select Trade/Position Category</option>
                        {positionCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Trade Classification *</label>
                      <select
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={empTradeClassificationId}
                        onChange={(e) => setEmpTradeClassificationId(e.target.value)}
                        required
                      >
                        <option value="">Select Trade Classification</option>
                        {trades.map((t) => (
                          <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Default Project</label>
                      <select
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={empDefaultProjectId}
                        onChange={(e) => setEmpDefaultProjectId(e.target.value)}
                      >
                        <option value="">Select Project</option>
                        {projects.filter(p => !empCompanyId || p.companyId === empCompanyId).map((p) => (
                          <option key={p.id} value={p.id}>{formatProjectLabel(p)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Default Site</label>
                      <select
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={empDefaultSiteId}
                        onChange={(e) => setEmpDefaultSiteId(e.target.value)}
                        disabled={!empDefaultProjectId}
                      >
                        <option value="">Select Site</option>
                        {formSites.map((s) => (
                          <option key={s.id} value={s.id}>{formatProjectSiteLabel(s)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-3">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Location & Allocation Settings</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Default Location</label>
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={empDefaultLocationId}
                      onChange={(e) => setEmpDefaultLocationId(e.target.value)}
                    >
                      <option value="">Select Location</option>
                      {locations.filter(l => !empCompanyId || l.companyId === empCompanyId).map((l) => (
                        <option key={l.id} value={l.id}>{formatLocationLabel(l)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cost Center</label>
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={empCostCenterId}
                      onChange={(e) => setEmpCostCenterId(e.target.value)}
                    >
                      <option value="">Select Cost Center</option>
                      {costCenters.filter(cc => !empCompanyId || cc.companyId === empCompanyId).map((cc) => (
                        <option key={cc.id} value={cc.id}>{formatCostCenterLabel(cc)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-6 pt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={empIsRelieverEligible}
                      onChange={(e) => setEmpIsRelieverEligible(e.target.checked)}
                      className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0"
                    />
                    Eligible as Reliever / Cover
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={empIsStandbyEligible}
                      onChange={(e) => setEmpIsStandbyEligible(e.target.checked)}
                      className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0"
                    />
                    Standby Pool Operative
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* IDENTITY DOCUMENTS TAB */}
          {addTab === 'identity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Qatar ID Number"
                  value={empQidNumber}
                  onChange={(e) => setEmpQidNumber(e.target.value)}
                  placeholder="e.g. 28232400123"
                />
                <Input
                  label="Qatar ID Expiry Date"
                  type="date"
                  value={empQidExpiryDate}
                  onChange={(e) => setEmpQidExpiryDate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Passport Number"
                  value={empPassportNumber}
                  onChange={(e) => setEmpPassportNumber(e.target.value)}
                  placeholder="e.g. EP123456"
                />
                <Input
                  label="Passport Issue Country"
                  value={empPassportIssuingCountry}
                  onChange={(e) => setEmpPassportIssuingCountry(e.target.value)}
                  placeholder="e.g. India"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Passport Issue Date"
                  type="date"
                  value={empPassportIssueDate}
                  onChange={(e) => setEmpPassportIssueDate(e.target.value)}
                />
                <Input
                  label="Passport Expiry Date"
                  type="date"
                  value={empPassportExpiryDate}
                  onChange={(e) => setEmpPassportExpiryDate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Sponsor"
                  value={empSponsor}
                  onChange={(e) => setEmpSponsor(e.target.value)}
                  placeholder="e.g. Al Hattab Holding"
                />
                <Input
                  label="Date of Joining"
                  type="date"
                  value={empDateOfJoining}
                  onChange={(e) => setEmpDateOfJoining(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* PUNCH SETTINGS TAB */}
          {addTab === 'punch' && (
            <div className="space-y-4">
              <div className="p-4 bg-tertiary/5 border border-tertiary/10 rounded-xl space-y-4">
                <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider">Mobile Punch-in Settings</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Default Mobile Punch Location</label>
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={empDefaultPunchLocationId}
                      onChange={(e) => setEmpDefaultPunchLocationId(e.target.value)}
                    >
                      <option value="">-- Let System Decide Automatically --</option>
                      {allowedPunchLocations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name} ({l.locationType})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Geofence Radius Override (m)</label>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={empGeofenceRadiusOverrideMeters}
                      onChange={(e) => setEmpGeofenceRadiusOverrideMeters(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-subtle">
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empAllowMultiplePunchLocations} onChange={(e) => setEmpAllowMultiplePunchLocations(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" /> Allow Multiple Locations</label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empAllowOfficePunch} onChange={(e) => setEmpAllowOfficePunch(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" /> Allow Office Punch</label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empAllowProjectSitePunch} onChange={(e) => setEmpAllowProjectSitePunch(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" /> Allow Project Site Punch</label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empAllowOnCallPunch} onChange={(e) => setEmpAllowOnCallPunch(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" /> Allow On-Call Location Punch</label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empAllowOutOfZonePunch} onChange={(e) => setEmpAllowOutOfZonePunch(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" /> Allow Out of Zone Punch</label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empRequireOutOfZoneReview} onChange={(e) => setEmpRequireOutOfZoneReview(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" disabled={!empAllowOutOfZonePunch}/> Flag Out of Zone for Review</label>
                </div>
              </div>
            </div>
          )}

          {/* SUPERVISOR & REPORTING TAB */}
          {addTab === 'supervisor' && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-4">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Hierarchy Assignment</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Immediate Supervisor</label>
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={empImmediateSupervisorId}
                      onChange={(e) => setEmpImmediateSupervisorId(e.target.value)}
                    >
                      <option value="">Select Supervisor</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.id} - {e.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Reporting Manager</label>
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={empReportingManagerId}
                      onChange={(e) => setEmpReportingManagerId(e.target.value)}
                    >
                      <option value="">Select Manager</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.id} - {e.name}</option>)}
                    </select>
                  </div>
                </div>
                {empWorkerCategory === 'BLUE_COLLAR' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project Supervisor</label>
                      <select
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={empProjectSupervisorId}
                        onChange={(e) => setEmpProjectSupervisorId(e.target.value)}
                      >
                        <option value="">Select Project Supervisor</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.id} - {e.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Site Supervisor</label>
                      <select
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={empSiteSupervisorId}
                        onChange={(e) => setEmpSiteSupervisorId(e.target.value)}
                      >
                        <option value="">Select Site Supervisor</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.id} - {e.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-tertiary/5 border border-tertiary/10 rounded-xl space-y-4">
                <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider">Supervisor Scope</p>
                <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empIsSupervisor}
                    onChange={(e) => setEmpIsSupervisor(e.target.checked)}
                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0"
                  />
                  Employee is a Supervisor
                </label>
                {empIsSupervisor && (
                  <div className="space-y-1 pt-2">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Supervisor Scope Type</label>
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={empSupervisorScopeType}
                      onChange={(e) => setEmpSupervisorScopeType(e.target.value)}
                    >
                      <option value="DIRECT_REPORTS">Direct Reports Only</option>
                      <option value="DEPARTMENT">Department-Wide</option>
                      <option value="PROJECT">Project-Wide</option>
                      <option value="SITE">Site-Wide</option>
                      <option value="COMPANY">Company-Wide</option>
                      <option value="CUSTOM">Custom Scope</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ACCOUNT ACCESS TAB */}
          {addTab === 'account' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Default Password"
                  type="password"
                  placeholder="Optional (Default: Password123!)"
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                />
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Username</label>
                  <Input
                    value={empUsername}
                    onChange={(e) => setEmpUsername(e.target.value)}
                    placeholder="e.g. ahmed.mansoori"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Auth Mode</label>
                  <select
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={empAuthMode}
                    onChange={(e) => setEmpAuthMode(e.target.value)}
                  >
                    <option value="LOCAL">Local Only</option>
                    <option value="SSO">SSO Only</option>
                    <option value="LOCAL_AND_SSO">Local & SSO</option>
                  </select>
                </div>
                <div className="flex items-center gap-6 pt-6">
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={empIsLoginEnabled}
                      onChange={(e) => setEmpIsLoginEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0"
                    />
                    Login Enabled
                  </label>
                </div>
              </div>
            </div>
          )}

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
            
            <div className="flex border-b border-outline-variant/30 mb-4 overflow-x-auto no-scrollbar">
              <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${editTab === 'basic' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setEditTab('basic')}>Basic Info</button>
              <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${editTab === 'assignment' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setEditTab('assignment')}>Work Assignment</button>
              <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${editTab === 'identity' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setEditTab('identity')}>Identity Documents</button>
              <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${editTab === 'punch' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setEditTab('punch')}>Punch Settings</button>
              <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${editTab === 'supervisor' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setEditTab('supervisor')}>Supervisor & Reporting</button>
              {isAdmin && (
                <button type="button" className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${editTab === 'account' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`} onClick={() => setEditTab('account')}>Login & Account Access</button>
              )}
            </div>

            {/* BASIC INFO TAB */}
            {editTab === 'basic' && (
              <div className="space-y-4">
                <Input label="Employee ID (Read-only)" value={selectedEmp.id} disabled />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Full Name" value={empName} onChange={(e) => setEmpName(e.target.value)} required />
                  <Input label="Email Address" type="email" value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Phone Number" value={empPhone} onChange={(e) => setEmpPhone(e.target.value)} />
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Duty Status</label>
                    <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empDutyStatus} onChange={(e) => setEmpDutyStatus(e.target.value)}>
                      <option value="OFF_DUTY">Offline</option>
                      <option value="ON_DUTY">On Duty</option>
                      <option value="ON_BREAK">On Break</option>
                      <option value="ON_LEAVE">On Leave</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Worker Category</label>
                    <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empWorkerCategory} onChange={(e) => setEmpWorkerCategory(e.target.value)}>
                      <option value="WHITE_COLLAR">White Collar (Staff)</option>
                      <option value="BLUE_COLLAR">Blue Collar (Laborer)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Employment Status</label>
                    <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empEmploymentStatus} onChange={(e) => setEmpEmploymentStatus(e.target.value)}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">DEACTIVATED</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* WORK ASSIGNMENT TAB */}
            {editTab === 'assignment' && (
              <div className="space-y-4">
                <div className="p-4 bg-surface-container border border-outline-variant/30 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Company & Department</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Company *</label>
                      <select
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={empCompanyId}
                        onChange={(e) => handleCompanyChange(e.target.value)}
                        required={empEmploymentStatus === 'ACTIVE'}
                      >
                        <option value="">Select Company</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>{formatCompanyLabel(c)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Department</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empDeptId} onChange={(e) => setEmpDeptId(e.target.value)}>
                        <option value="">Select Department (Optional)</option>
                        {departments.filter(d => !empCompanyId || d.companyId === empCompanyId).map((d) => <option key={d.id} value={d.id}>{formatDepartmentLabel(d)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Role</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empRole} onChange={(e) => setEmpRole(e.target.value)}>
                        <option value="EMPLOYEE">EMPLOYEE</option>
                        <option value="SUPERVISOR">SUPERVISOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Default Shift</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empShiftId} onChange={(e) => setEmpShiftId(e.target.value)}>
                        <option value="GEN-001">General Shift (9 AM - 6 PM)</option>
                        <option value="MOR-102">Morning Shift (6 AM - 2 PM)</option>
                        <option value="AFT-103">Afternoon Shift (2 PM - 10 PM)</option>
                        <option value="NGT-201">Night Shift (10 PM - 6 AM)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-surface-container border border-outline-variant/30 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">General Designation</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Designation</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empDesignationId} onChange={(e) => setEmpDesignationId(e.target.value)}>
                        <option value="">Select Designation</option>
                        {designations.map((d) => <option key={d.id} value={d.id}>{formatDesignationLabel(d)}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
  
                {empWorkerCategory === "BLUE_COLLAR" && (
                  <div className="p-4 bg-secondary/5 border border-secondary/10 rounded-xl space-y-3">
                    <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">Blue Collar Core Settings</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Trade / Position Category *</label>
                        <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empPositionCategoryId} onChange={(e) => setEmpPositionCategoryId(e.target.value)} required>
                          <option value="">Select Trade/Position Category</option>
                          {positionCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Trade Classification *</label>
                        <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empTradeClassificationId} onChange={(e) => setEmpTradeClassificationId(e.target.value)} required>
                          <option value="">Select Trade Classification</option>
                          {trades.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Default Project</label>
                        <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empDefaultProjectId} onChange={(e) => setEmpDefaultProjectId(e.target.value)}>
                          <option value="">Select Project</option>
                          {projects.filter(p => !empCompanyId || p.companyId === empCompanyId).map((p) => <option key={p.id} value={p.id}>{formatProjectLabel(p)}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Default Site</label>
                        <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empDefaultSiteId} onChange={(e) => setEmpDefaultSiteId(e.target.value)} disabled={!empDefaultProjectId}>
                          <option value="">Select Site</option>
                          {formSites.map((s) => <option key={s.id} value={s.id}>{formatProjectSiteLabel(s)}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Location & Allocation Settings</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Default Location</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empDefaultLocationId} onChange={(e) => setEmpDefaultLocationId(e.target.value)}>
                        <option value="">Select Location</option>
                        {locations.filter(l => !empCompanyId || l.companyId === empCompanyId).map((l) => <option key={l.id} value={l.id}>{formatLocationLabel(l)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cost Center</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empCostCenterId} onChange={(e) => setEmpCostCenterId(e.target.value)}>
                        <option value="">Select Cost Center</option>
                        {costCenters.filter(cc => !empCompanyId || cc.companyId === empCompanyId).map((cc) => <option key={cc.id} value={cc.id}>{formatCostCenterLabel(cc)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-6 pt-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer">
                      <input type="checkbox" checked={empIsRelieverEligible} onChange={(e) => setEmpIsRelieverEligible(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0" />
                      Eligible as Reliever / Cover
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer">
                      <input type="checkbox" checked={empIsStandbyEligible} onChange={(e) => setEmpIsStandbyEligible(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0" />
                      Standby Pool Operative
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* IDENTITY DOCUMENTS TAB */}
            {editTab === 'identity' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Qatar ID Number" value={empQidNumber} onChange={(e) => setEmpQidNumber(e.target.value)} placeholder="e.g. 28232400123" />
                  <Input label="Qatar ID Expiry Date" type="date" value={empQidExpiryDate} onChange={(e) => setEmpQidExpiryDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Passport Number" value={empPassportNumber} onChange={(e) => setEmpPassportNumber(e.target.value)} placeholder="e.g. EP123456" />
                  <Input label="Passport Issue Country" value={empPassportIssuingCountry} onChange={(e) => setEmpPassportIssuingCountry(e.target.value)} placeholder="e.g. India" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Passport Issue Date" type="date" value={empPassportIssueDate} onChange={(e) => setEmpPassportIssueDate(e.target.value)} />
                  <Input label="Passport Expiry Date" type="date" value={empPassportExpiryDate} onChange={(e) => setEmpPassportExpiryDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Sponsor" value={empSponsor} onChange={(e) => setEmpSponsor(e.target.value)} placeholder="e.g. Al Hattab Holding" />
                  <Input label="Date of Joining" type="date" value={empDateOfJoining} onChange={(e) => setEmpDateOfJoining(e.target.value)} />
                </div>
              </div>
            )}

            {/* PUNCH SETTINGS TAB */}
            {editTab === 'punch' && (
              <div className="space-y-4">
                <div className="p-4 bg-tertiary/5 border border-tertiary/10 rounded-xl space-y-4">
                  <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider">Mobile Punch-in Settings</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Default Mobile Punch Location</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empDefaultPunchLocationId} onChange={(e) => setEmpDefaultPunchLocationId(e.target.value)}>
                        <option value="">-- Let System Decide Automatically --</option>
                        {allowedPunchLocations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.locationType})</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Geofence Radius Override (m)</label>
                      <input type="number" placeholder="e.g. 500" className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empGeofenceRadiusOverrideMeters} onChange={(e) => setEmpGeofenceRadiusOverrideMeters(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-subtle">
                    <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empAllowMultiplePunchLocations} onChange={(e) => setEmpAllowMultiplePunchLocations(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" /> Allow Multiple Locations</label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empAllowOfficePunch} onChange={(e) => setEmpAllowOfficePunch(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" /> Allow Office Punch</label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empAllowProjectSitePunch} onChange={(e) => setEmpAllowProjectSitePunch(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" /> Allow Project Site Punch</label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empAllowOnCallPunch} onChange={(e) => setEmpAllowOnCallPunch(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" /> Allow On-Call Location Punch</label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empAllowOutOfZonePunch} onChange={(e) => setEmpAllowOutOfZonePunch(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" /> Allow Out of Zone Punch</label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer"><input type="checkbox" checked={empRequireOutOfZoneReview} onChange={(e) => setEmpRequireOutOfZoneReview(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" disabled={!empAllowOutOfZonePunch}/> Flag Out of Zone for Review</label>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-3 mt-4">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider font-mono">Additional Punch Locations Management</p>
                  {empAllowMultiplePunchLocations && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Additional Allowed Locations</label>
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {empAllowedPunchLocationAssignments.map((a: any) => (
                          <div key={a.id} className="flex items-center gap-2 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                            <span>{a.allowedPunchLocation?.name}</span>
                            <button 
                              type="button" 
                              onClick={async () => {
                                const res = await fetch(`/api/v1/employees/${selectedEmp?.id}/allowed-locations?assignmentId=${a.id}`, { method: "DELETE" });
                                if (res.ok) {
                                  setEmpAllowedPunchLocationAssignments(prev => prev.filter(x => x.id !== a.id));
                                }
                              }}
                              className="text-primary hover:text-red-500 font-bold"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex gap-2">
                         <select
                          className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          id="newAllowedLocationSelect"
                        >
                          <option value="">Add Allowed Location...</option>
                          {allowedPunchLocations.filter(l => !empAllowedPunchLocationAssignments.some((a: any) => a.allowedPunchLocationId === l.id) && l.id !== empDefaultPunchLocationId).map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            const sel = document.getElementById("newAllowedLocationSelect") as HTMLSelectElement;
                            if (!sel || !sel.value) return;
                            const res = await fetch(`/api/v1/employees/${selectedEmp?.id}/allowed-locations`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ allowedPunchLocationId: sel.value })
                            });
                            if (res.ok) {
                              const assignment = await res.json();
                              setEmpAllowedPunchLocationAssignments(prev => [...prev, assignment]);
                              sel.value = "";
                            }
                          }}
                          className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUPERVISOR & REPORTING TAB */}
            {editTab === 'supervisor' && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-4">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Hierarchy Assignment</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Immediate Supervisor</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empImmediateSupervisorId} onChange={(e) => setEmpImmediateSupervisorId(e.target.value)}>
                        <option value="">Clear Supervisor</option>
                        {employees.filter(e => e.isActive !== false && e.id !== selectedEmp.id).map(e => <option key={e.id} value={e.id}>{e.id} - {e.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Reporting Manager</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empReportingManagerId} onChange={(e) => setEmpReportingManagerId(e.target.value)}>
                        <option value="">Clear Manager</option>
                        {employees.filter(e => e.isActive !== false && e.id !== selectedEmp.id).map(e => <option key={e.id} value={e.id}>{e.id} - {e.name}</option>)}
                      </select>
                    </div>
                  </div>
                  {empWorkerCategory === 'BLUE_COLLAR' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project Supervisor</label>
                        <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empProjectSupervisorId} onChange={(e) => setEmpProjectSupervisorId(e.target.value)}>
                          <option value="">Clear Project Supervisor</option>
                          {employees.filter(e => e.isActive !== false && e.id !== selectedEmp.id).map(e => <option key={e.id} value={e.id}>{e.id} - {e.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Site Supervisor</label>
                        <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empSiteSupervisorId} onChange={(e) => setEmpSiteSupervisorId(e.target.value)}>
                          <option value="">Clear Site Supervisor</option>
                          {employees.filter(e => e.isActive !== false && e.id !== selectedEmp.id).map(e => <option key={e.id} value={e.id}>{e.id} - {e.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-tertiary/5 border border-tertiary/10 rounded-xl space-y-4">
                  <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider">Supervisor Scope</p>
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
                    <input type="checkbox" checked={empIsSupervisor} onChange={(e) => setEmpIsSupervisor(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0" />
                    Employee is a Supervisor
                  </label>
                  {empIsSupervisor && (
                    <div className="space-y-1 pt-2">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Supervisor Scope Type</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empSupervisorScopeType} onChange={(e) => setEmpSupervisorScopeType(e.target.value)}>
                        <option value="DIRECT_REPORTS">Direct Reports Only</option>
                        <option value="DEPARTMENT">Department-Wide</option>
                        <option value="PROJECT">Project-Wide</option>
                        <option value="SITE">Site-Wide</option>
                        <option value="COMPANY">Company-Wide</option>
                        <option value="CUSTOM">Custom Scope</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LOGIN & ACCOUNT ACCESS TAB */}
            {editTab === 'account' && isAdmin && (
              <div className="space-y-4">
                <div className="p-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl space-y-4">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Account Settings</p>
                    {empIsLocked && <Badge variant="error">ACCOUNT LOCKED</Badge>}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Username</label>
                      <Input value={empUsername} onChange={(e) => setEmpUsername(e.target.value)} placeholder="e.g. john.doe" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Auth Mode</label>
                      <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" value={empAuthMode} onChange={(e) => setEmpAuthMode(e.target.value)}>
                        <option value="LOCAL">Local Only</option>
                        <option value="SSO">SSO Only</option>
                        <option value="LOCAL_AND_SSO">Local & SSO</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex gap-6 pt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
                      <input type="checkbox" checked={empIsLoginEnabled} onChange={(e) => setEmpIsLoginEnabled(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0" />
                      Login Enabled
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
                      <input type="checkbox" checked={empMustChangePassword} onChange={(e) => setEmpMustChangePassword(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0" />
                      Must Change Password
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-surface-container-low rounded-lg border border-border-subtle">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Failed Logins</p>
                    <p className="text-lg font-black text-on-surface mt-1">{empFailedLoginAttempts}</p>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg border border-border-subtle">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Last Login</p>
                    <p className="text-sm font-semibold text-on-surface mt-1">{empLastLoginAt || 'Never'}</p>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg border border-border-subtle">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Password Updated</p>
                    <p className="text-sm font-semibold text-on-surface mt-1">{empPasswordUpdatedAt || 'Never'}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-border-subtle">
                  <Button variant="secondary" type="button" onClick={() => setIsResetPasswordOpen(true)}>Reset Password</Button>
                  {empIsLocked ? (
                    <Button variant="success" type="button" onClick={() => handleLockAccount(selectedEmp.id, false)}>Unlock Account</Button>
                  ) : (
                    <Button variant="error" type="button" onClick={() => handleLockAccount(selectedEmp.id, true)}>Lock Account</Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center border-t border-border-subtle pt-4 mt-6">
              {selectedEmp.isActive !== false ? (
                <Button variant="error" type="button" onClick={() => handleDeactivate(selectedEmp.id)}>Deactivate</Button>
              ) : (
                <Button variant="success" type="button" onClick={() => handleActivate(selectedEmp.id)}>Activate</Button>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" type="button" onClick={() => setIsEditEmpOpen(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={isResetPasswordOpen} onClose={() => { setIsResetPasswordOpen(false); setGeneratedPassword(null); setResetTempPassword(""); }} title="Reset Account Password">
        <div className="space-y-4">
          <p className="text-xs text-on-surface-variant">
            Resetting password for <span className="font-bold text-on-surface">{selectedEmp?.name}</span> ({selectedEmp?.id}).
          </p>
          
          {generatedPassword ? (
            <div className="p-4 bg-status-success/10 border border-status-success/20 rounded-xl space-y-3">
              <p className="text-xs font-bold text-status-success">Password reset successfully!</p>
              <div className="flex items-center gap-2">
                <input type="text" readOnly value={generatedPassword} className="flex-1 bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm font-mono" />
                <Button variant="secondary" onClick={() => navigator.clipboard.writeText(generatedPassword)}>Copy</Button>
              </div>
              <p className="text-[10px] text-on-surface-variant">This password will only be shown once. Please provide it to the employee securely.</p>
            </div>
          ) : (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Temporary Password</label>
                <div className="flex gap-2">
                  <Input value={resetTempPassword} onChange={(e) => setResetTempPassword(e.target.value)} placeholder="Type password or generate" className="flex-1 font-mono" />
                  <Button variant="secondary" type="button" onClick={generateRandomPassword}>Generate</Button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer mt-2">
                <input type="checkbox" checked={resetForceChange} onChange={(e) => setResetForceChange(e.target.checked)} className="w-4 h-4 rounded border-outline-variant text-primary" />
                Force password change on next login
              </label>
              <div className="flex justify-end gap-2 pt-4 border-t border-border-subtle">
                <Button variant="secondary" type="button" onClick={() => setIsResetPasswordOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Confirm Reset</Button>
              </div>
            </form>
          )}
        </div>
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
