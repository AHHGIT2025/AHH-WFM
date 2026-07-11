"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasPermission, isAdminUser } from "../../../../lib/permissions";
import { getEffectiveContractManpower } from "../../../../lib/contract-helpers";

interface ChecklistItem {
  itemCode: string;
  itemLabel: string;
  requiresGuardViolationDetails: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface ChecklistSection {
  sectionName: string;
  items: ChecklistItem[];
}

const DEFAULT_CHECKLIST_CONFIG: ChecklistSection[] = [
  {
    sectionName: "Site Access / Security Control",
    items: [
      { itemCode: "SEC_GATE_CHECKED", itemLabel: "Main gate / entry-exit point checked", requiresGuardViolationDetails: false, isActive: true, sortOrder: 1 },
      { itemCode: "SEC_VISITOR_CONTROL", itemLabel: "Visitor / vehicle movement controlled", requiresGuardViolationDetails: false, isActive: true, sortOrder: 2 },
      { itemCode: "SEC_POST_ORDERS", itemLabel: "Post orders followed", requiresGuardViolationDetails: false, isActive: true, sortOrder: 3 }
    ]
  },
  {
    sectionName: "Guard Behavior",
    items: [
      { itemCode: "BEH_ALERT_ACTIVE", itemLabel: "Guard alert and active", requiresGuardViolationDetails: true, isActive: true, sortOrder: 4 },
      { itemCode: "BEH_NOT_SLEEPING", itemLabel: "Guard not sleeping", requiresGuardViolationDetails: true, isActive: true, sortOrder: 5 },
      { itemCode: "BEH_PHONE_USE", itemLabel: "Guard not using mobile unnecessarily", requiresGuardViolationDetails: true, isActive: true, sortOrder: 6 },
      { itemCode: "BEH_AWAY_POST", itemLabel: "Guard not away from post without approval", requiresGuardViolationDetails: true, isActive: true, sortOrder: 7 },
      { itemCode: "BEH_CLIENT_INSTRUCT", itemLabel: "Guard following client instructions", requiresGuardViolationDetails: true, isActive: true, sortOrder: 8 }
    ]
  },
  {
    sectionName: "Documents & Equipment",
    items: [
      { itemCode: "DOC_CONTRACT_EQUIP", itemLabel: "Required equipment available as per contract", requiresGuardViolationDetails: false, isActive: true, sortOrder: 9 },
      { itemCode: "DOC_LOGBOOK_AVAIL", itemLabel: "Site logbook available", requiresGuardViolationDetails: false, isActive: true, sortOrder: 10 },
      { itemCode: "DOC_VISITOR_REG", itemLabel: "Visitor register available", requiresGuardViolationDetails: false, isActive: true, sortOrder: 11 }
    ]
  }
];

export default function ManpowerMasterPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const business = params?.business as string; // "security-guarding" | "facility-management"
  const master = params?.master as string; // "clients" | "contracts" | "projects" | "sites" | "zones" | "areas" | "manpower" | "settings"

  const isSecurity = business === "security-guarding";
  const businessLabel = isSecurity ? "Security Guarding" : "Facility Management";
  const masterLabel = master ? master.charAt(0).toUpperCase() + master.slice(1) : "";

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Sub-data for relations
  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [shiftsList, setShiftsList] = useState<any[]>([]);
  const [locationUnits, setLocationUnits] = useState<any[]>([]);
  const [workforceEmployees, setWorkforceEmployees] = useState<any[]>([]);
  const [delegations, setDelegations] = useState<any[]>([]);
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [workflowLevels, setWorkflowLevels] = useState<any[]>([]);

  // Security Guarding compliance states
  const [activeSubTab, setActiveSubTab] = useState("directory");
  const [licensesList, setLicensesList] = useState<any[]>([]);
  const [gatePassesList, setGatePassesList] = useState<any[]>([]);
  const [relieverPoolsList, setRelieverPoolsList] = useState<any[]>([]);
  const [relieverAssignmentsList, setRelieverAssignmentsList] = useState<any[]>([]);
  const [deploymentsList, setDeploymentsList] = useState<any[]>([]);
  const [showAddLicenseModal, setShowAddLicenseModal] = useState(false);
  const [showAddGatePassModal, setShowAddGatePassModal] = useState(false);

  // Security Projects states
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectSummary, setProjectSummary] = useState<any | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [siteSummary, setSiteSummary] = useState<any | null>(null);
  const [projectAllocatedMaterials, setProjectAllocatedMaterials] = useState<any[]>([]);
  const [projectShiftRequirements, setProjectShiftRequirements] = useState<any[]>([]);
  const [projectDeployments, setProjectDeployments] = useState<any[]>([]);

  // Patrol Operations Board states
  const [coordinatorSubTab, setCoordinatorSubTab] = useState<"board" | "assignments">("board");
  const [siteActiveTab, setSiteActiveTab] = useState("overview");
  const [siteToDisable, setSiteToDisable] = useState<any | null>(null);
  const [deleteSiteReport, setDeleteSiteReport] = useState<any | null>(null);
  const [patrolVisitsList, setPatrolVisitsList] = useState<any[]>([]);
  const [dailyReportsList, setDailyReportsList] = useState<any[]>([]);
  const [selectedPatrolSite, setSelectedPatrolSite] = useState<any | null>(null);
  const [showPatrolDrawer, setShowPatrolDrawer] = useState(false);
  const [patrolActiveTab, setPatrolActiveTab] = useState("verification");

  // Site Creation/Edit additional states
  const [formSiteShifts, setFormSiteShifts] = useState<any[]>([]);
  const [formSiteAllowance, setFormSiteAllowance] = useState<any>({ siteAllowanceEnabled: false });
  const [siteAllowanceApplicable, setSiteAllowanceApplicable] = useState(false);

  // Form states inside Patrol Drawer
  const [verificationRecords, setVerificationRecords] = useState<Record<string, any>>({});
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, { status: "OK" | "NOT_OK" | "NA"; remarks: string }>>({});
  const [guardViolations, setGuardViolations] = useState<Record<string, Array<{
    id: string;
    employeeCode: string;
    employeeName: string;
    postName: string;
    remarks: string;
    actionTaken: string;
    errorMsg?: string;
  }>>>({});
  const [incidentForm, setIncidentForm] = useState<any>({
    severity: "Medium",
    type: "Security breach",
    status: "Open",
    escalatedTo: "Operations Coordinator",
    followUpRequired: "No",
    peopleInvolved: "",
    description: "",
    immediateAction: ""
  });
  const [replacementForm, setReplacementForm] = useState<any>({
    reason: "Absent",
    criticalPost: "No",
    status: "Requested",
    notifiedOperations: "Yes",
    replacementRequiredFrom: new Date().toISOString().substring(11, 16),
    remarks: ""
  });
  const [clientNoteForm, setClientNoteForm] = useState<any>({
    feedback: "Neutral",
    escalationRequired: "No",
    clientRep: "",
    complaint: "",
    specialInstruction: "",
    additionalManpower: "No",
    requestedQty: 0,
    remarks: ""
  });

  async function loadPatrolData() {
    if (!isSecurity || master !== "coordinators") return;
    try {
      const [patrolRes, reportsRes] = await Promise.all([
        fetch(`/api/v1/security/patrols?operationType=SECURITY_GUARDING`),
        fetch(`/api/v1/security/patrols/daily-reports?operationType=SECURITY_GUARDING`)
      ]);
      if (patrolRes.ok) setPatrolVisitsList(await patrolRes.json());
      if (reportsRes.ok) setDailyReportsList(await reportsRes.json());
    } catch (e) {
      console.error("Failed to load patrol data", e);
    }
  }

  async function loadSecurityComplianceData() {
    try {
      const [licRes, gpRes, poolsRes, poolAsgRes, depRes] = await Promise.all([
        fetch("/api/v1/security/licenses"),
        fetch("/api/v1/security/gate-passes"),
        fetch("/api/v1/security/reliever-pools"),
        fetch("/api/v1/security/reliever-pools/assignments"),
        fetch(`/api/v1/manpower/security-guarding/deployments?date=${new Date().toISOString().split("T")[0]}`)
      ]);
      if (licRes.ok) setLicensesList(await licRes.json());
      if (gpRes.ok) setGatePassesList(await gpRes.json());
      if (poolsRes.ok) setRelieverPoolsList(await poolsRes.json());
      if (poolAsgRes.ok) setRelieverAssignmentsList(await poolAsgRes.json());
      if (depRes.ok) setDeploymentsList(await depRes.json());
      loadPatrolData();
    } catch (e) {
      console.error("Failed to load security compliance data", e);
    }
  }

  // Form states
  const [formData, setFormData] = useState<any>({});
  const [formError, setFormError] = useState("");
  const [editItem, setEditItem] = useState<any | null>(null);
  const [filterCustomerType, setFilterCustomerType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selectedClientDetail, setSelectedClientDetail] = useState<any | null>(null);
  const [selectedContractDetail, setSelectedContractDetail] = useState<any | null>(null);
  const [addendumContract, setAddendumContract] = useState<any | null>(null);
  const [addendumActiveTab, setAddendumActiveTab] = useState<string>("summary");
  const [addFormLineItems, setAddFormLineItems] = useState<any[]>([]);
  const [addendumForm, setAddendumForm] = useState<any>({
    title: "",
    addendumType: "Manpower Increase",
    addendumDate: new Date().toISOString().substring(0, 10),
    effectiveFrom: new Date().toISOString().substring(0, 10),
    description: "",
    commercialImpact: "",
    status: "DRAFT",
    lineItems: []
  });

  const [projectAllocations, setProjectAllocations] = useState<any[]>([]);
  const [projectRelieverAllocations, setProjectRelieverAllocations] = useState<any[]>([]);
  const [siteAllocations, setSiteAllocations] = useState<any[]>([]);
  const [siteRelieverAllocations, setSiteRelieverAllocations] = useState<any[]>([]);

  const fetchProjectAllocationSummary = async (projId: string, contractId: string) => {
    try {
      const res = await fetch(`/api/v1/security/projects/${projId}/allocation-summary?contractId=${contractId}`);
      if (res.ok) {
        const json = await res.json();
        setProjectAllocations(json.manpowerSummary || []);
        setProjectRelieverAllocations(json.relieverSummary || []);
      }
    } catch (e) {
      console.error("Failed to load project allocation summary", e);
    }
  };

  const fetchSiteAllocationSummary = async (siteId: string, projId: string) => {
    try {
      const res = await fetch(`/api/v1/security/sites/${siteId}/allocation-summary?projectId=${projId}`);
      if (res.ok) {
        const json = await res.json();
        setSiteAllocations(json.manpowerSummary || []);
        setSiteRelieverAllocations(json.relieverSummary || []);
      }
    } catch (e) {
      console.error("Failed to load site allocation summary", e);
    }
  };

  const handleProjectChange = async (projId: string, siteId: string) => {
    if (projId) {
      fetchSiteAllocationSummary(siteId, projId);
      if (isSecurity) {
        const project = projects.find(p => p.id === projId);
        if (project && project.contractId) {
          try {
            const cRes = await fetch(`/api/v1/manpower/${business}/contracts/${project.contractId}`);
            if (cRes.ok) {
              const contract = await cRes.json();
              const inherited = (contract.shiftRequirements || []).map((sr: any) => ({
                id: `inherited-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                shiftCode: sr.shiftName || sr.shiftCode,
                shiftStartTime: sr.startTime || sr.shiftStartTime,
                shiftEndTime: sr.endTime || sr.shiftEndTime,
                requiredCount: sr.postsCovered || sr.requiredCount || 0,
                requiredRelieverCount: sr.requiredRelieverCount || 0,
                categoryId: sr.categoryId || (categories[0]?.id || ""),
                isInherited: true,
                isOverride: false
              }));
              setFormSiteShifts(inherited);
            }
          } catch (err) {
            console.error("Failed to load contract shifts:", err);
          }
        }
      }
    } else {
      setSiteAllocations([]);
      setSiteRelieverAllocations([]);
      setFormSiteShifts([]);
    }
  };

  const startEdit = (item: any) => {
    setEditItem(item);
    setFormData({ ...item });
    setFormError("");
    if (master === "contracts") {
      setWorkflowLevels(item.workflowLevels || []);
    } else if (master === "projects") {
      fetchProjectAllocationSummary(item.id, item.contractId);
    } else if (master === "sites") {
      fetchSiteAllocationSummary(item.id, item.projectId);
      if (isSecurity) {
        fetch(`/api/v1/security/scheduling/site-allowance?siteId=${item.id}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.siteAllowanceEnabled) {
              setFormSiteAllowance(data);
              setSiteAllowanceApplicable(true);
            } else {
              setFormSiteAllowance({ siteAllowanceEnabled: false });
              setSiteAllowanceApplicable(false);
            }
          })
          .catch(() => {
            setFormSiteAllowance({ siteAllowanceEnabled: false });
            setSiteAllowanceApplicable(false);
          });
        fetch(`/api/v1/security/scheduling/site-shifts?siteId=${item.id}`)
          .then(res => res.ok ? res.json() : [])
          .then(data => {
            if (Array.isArray(data)) {
              setFormSiteShifts(data.map((s: any) => ({
                id: s.id,
                shiftCode: s.shiftCode,
                shiftStartTime: s.shiftStartTime,
                shiftEndTime: s.shiftEndTime,
                requiredCount: s.requiredCount,
                requiredRelieverCount: s.requiredRelieverCount,
                categoryId: s.categoryId,
                isOverride: true
              })));
            } else {
              setFormSiteShifts([]);
            }
          })
          .catch(() => {
            setFormSiteShifts([]);
          });
      }
    }
  };

  const viewClientDetails = async (clientId: string) => {
    try {
      const res = await fetch(`/api/v1/manpower/${business}/clients/${clientId}`);
      if (res.ok) {
        setSelectedClientDetail(await res.json());
      } else {
        alert("Failed to load customer details");
      }
    } catch (e) {
      alert("Failed to connect to server");
    }
  };

  const handleWorkflowAction = async (action: "submit" | "approve" | "reject" | "activate", payload: any = {}) => {
    try {
      const url = `/api/v1/manpower/${business}/contracts/${selectedContractDetail.id}/workflow/${action}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updatedContract = await res.json();
        setSelectedContractDetail(updatedContract);
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || `Failed to perform workflow action: ${action}`);
      }
    } catch (e) {
      alert("Server connection failed");
    }
  };

  const viewContractDetails = async (contractId: string) => {
    try {
      const res = await fetch(`/api/v1/manpower/${business}/contracts/${contractId}`);
      if (res.ok) {
        setSelectedContractDetail(await res.json());
      } else {
        alert("Failed to load contract details");
      }
    } catch (e) {
      alert("Failed to connect to server");
    }
  };

  // Permission Checks
  const canView = isAdminUser(session?.user as any) ||
                  hasPermission(session?.user as any, "manpower.admin.full_access") ||
                  hasPermission(session?.user as any, isSecurity ? "manpower.security.view" : "manpower.fm.view");
  const canManage = isAdminUser(session?.user as any) ||
                    hasPermission(session?.user as any, "manpower.admin.full_access") ||
                    hasPermission(session?.user as any, isSecurity ? "manpower.security.manage" : "manpower.fm.manage");

  const apiBase = master === "coordinators"
    ? `/api/v1/security/coordinators?operationType=${isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT"}`
    : `/api/v1/manpower/${business}/${master === "areas" ? "areas" : master === "zones" ? "zones" : master}`;

  const [includeInactive, setIncludeInactive] = useState(false);

  async function loadData() {
    if (!canView) return;
    setLoading(true);
    try {
      const url = new URL(apiBase, window.location.origin);
      if (master === "manpower" && includeInactive) {
        url.searchParams.set("includeInactive", "true");
      }
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        setData(json);
        console.log(`[Debug Master Page] Fetched manpower count: ${json.length}`);
      }
    } catch (e) {
      console.error("Failed to load master data", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadRelations() {
    try {
      if (master === "contracts" || master === "projects" || master === "sites" || master === "zones" || master === "areas") {
        const [clientsRes, categoriesRes, materialsRes] = await Promise.all([
          fetch(`/api/v1/manpower/${business}/clients`),
          fetch(`/api/v1/manpower/${business}/categories`),
          fetch(`/api/v1/manpower/${business}/materials`)
        ]);
        if (clientsRes.ok) setClients(await clientsRes.json());
        if (categoriesRes.ok) setCategories(await categoriesRes.json());
        if (materialsRes.ok) setMaterialsList(await materialsRes.json());
      }
      if (master === "projects" || master === "sites" || master === "zones" || master === "areas") {
        const res = await fetch(`/api/v1/manpower/${business}/contracts`);
        if (res.ok) setContracts(await res.json());
      }
      if (master === "sites" || master === "zones" || master === "areas") {
        const res = await fetch(`/api/v1/manpower/${business}/projects`);
        if (res.ok) setProjects(await res.json());
      }
      if (master === "zones" || master === "areas") {
        const res = await fetch(`/api/v1/manpower/${business}/sites`);
        if (res.ok) setSites(await res.json());
      }
      if (master === "manpower" || master === "contracts") {
        const [catRes, empRes, delRes] = await Promise.all([
          fetch(`/api/v1/manpower/${business}/categories`),
          fetch(`/api/v1/employees`),
          fetch(`/api/v1/settings/workflow-delegations`).catch(() => null)
        ]);
        if (catRes.ok) setCategories(await catRes.json());
        if (empRes.ok) setWorkforceEmployees(await empRes.json());
        if (delRes && delRes.ok) setDelegations(await delRes.json());
      }
      if (master === "coordinators") {
        const [projRes, empRes, sitesRes, unitsRes] = await Promise.all([
          fetch(`/api/v1/manpower/${business}/projects`),
          fetch(`/api/v1/manpower/${business}/manpower`),
          fetch(`/api/v1/manpower/${business}/sites`),
          fetch(`/api/v1/manpower/${business}/${isSecurity ? "zones" : "areas"}`)
        ]);
        if (projRes.ok) setProjects(await projRes.json());
        if (empRes.ok) setWorkforceEmployees(await empRes.json());
        if (sitesRes.ok) setSites(await sitesRes.json());
        if (unitsRes.ok) setLocationUnits(await unitsRes.json());
      }
      if (isSecurity && (master === "manpower" || master === "projects" || master === "coordinators")) {
        loadSecurityComplianceData();
      }
      if (master === "shifts") {
        const [sitesRes, catsRes, shiftsRes, unitsRes] = await Promise.all([
          fetch(`/api/v1/manpower/${business}/sites`),
          fetch(`/api/v1/manpower/${business}/categories`),
          fetch(`/api/v1/shifts`),
          fetch(`/api/v1/manpower/${business}/${isSecurity ? "zones" : "areas"}`)
        ]);
        if (sitesRes.ok) setSites(await sitesRes.json());
        if (catsRes.ok) setCategories(await catsRes.json());
        if (shiftsRes.ok) setShiftsList(await shiftsRes.json());
        if (unitsRes.ok) setLocationUnits(await unitsRes.json());
      }
    } catch (e) {
      console.error("Failed to load relations", e);
    }
  }

  const handleDeleteRequirement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift requirement?")) return;
    try {
      const res = await fetch(`${apiBase}?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        alert("Failed to delete shift requirement");
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (business && master) {
      loadData();
      loadRelations();
    }
  }, [business, master, session, includeInactive]);

  // Support redirecting reliever-pools to manpower directory tab
  useEffect(() => {
    if (master === "reliever-pools") {
      router.replace(`/manpower/${business}/manpower?tab=relieverPools`);
    }
  }, [master, business, router]);

  // Support active sub-tab switching via query param
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get("tab");
      if (tab) {
        setActiveSubTab(tab);
      }
    }
  }, [master]);

  // Support automatic modal triggers from dashboard quick actions (e.g. ?add=true)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("add") === "true") {
        if (isSecurity && master === "manpower") {
          if (activeSubTab === "licenses") {
            setShowAddLicenseModal(true);
          } else if (activeSubTab === "gatePasses") {
            setShowAddGatePassModal(true);
          } else if (activeSubTab === "directory") {
            setShowAddModal(true);
          }
        } else {
          setShowAddModal(true);
        }
      }
    }
  }, [master, isSecurity, activeSubTab]);

  if (!canView) {
    return (
      <div className="p-8 text-center text-status-error font-bold">
        Access Denied: You do not have permission to view {businessLabel} operations.
      </div>
    );
  }

  const handleSyncOperationType = async (employee: any) => {
    const targetCategory = employee.manpowerCategoryId || (isSecurity ? "PM-CAT-SEC-02" : "PM-CAT-FM-01");
    if (!confirm(`Are you sure you want to sync operation type for ${employee.name} (${employee.id})?`)) return;
    try {
      const res = await fetch(`/api/v1/manpower/${business}/manpower`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: employee.id,
          manpowerCategoryId: targetCategory
        })
      });
      if (res.ok) {
        alert("Operation type synchronized successfully!");
        loadData();
        loadRelations();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to sync operation type");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred during synchronization");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    try {
      if (master === "sites" && isSecurity) {
        for (const shift of formSiteShifts) {
          if (!shift.categoryId) {
            setFormError("All shift requirements must have a position selected.");
            return;
          }
          if (!shift.shiftCode) {
            setFormError("All shift requirements must have a shift name.");
            return;
          }
          if (!shift.shiftStartTime || !shift.shiftEndTime) {
            setFormError(`Start time and End time are required for shift ${shift.shiftCode}.`);
            return;
          }
          if (Number(shift.requiredCount) <= 0) {
            setFormError(`Required headcount for shift ${shift.shiftCode} must be greater than 0.`);
            return;
          }
          if (Number(shift.requiredRelieverCount || 0) < 0) {
            setFormError(`Required relievers count for shift ${shift.shiftCode} cannot be negative.`);
            return;
          }
        }

        const permAllocByPos: Record<string, number> = {};
        const relAllocByPos: Record<string, number> = {};

        siteAllocations.forEach(a => {
          permAllocByPos[a.position] = (permAllocByPos[a.position] || 0) + (a.allocatedToThis || 0);
        });
        siteRelieverAllocations.forEach(a => {
          relAllocByPos[a.position] = (relAllocByPos[a.position] || 0) + (a.allocatedToThis || 0);
        });

        const permShiftByPos: Record<string, number> = {};
        const relShiftByPos: Record<string, number> = {};

        formSiteShifts.forEach(s => {
          const categoryName = categories.find(c => c.id === s.categoryId)?.name || "";
          if (categoryName) {
            const isRel = siteRelieverAllocations.some(a => a.position === categoryName);
            if (isRel) {
              relShiftByPos[categoryName] = (relShiftByPos[categoryName] || 0) + (Number(s.requiredCount) || 0);
            } else {
              permShiftByPos[categoryName] = (permShiftByPos[categoryName] || 0) + (Number(s.requiredCount) || 0);
            }
          }
        });

        let hasExceeded = false;
        let exceededMessage = "";

        for (const pos in permShiftByPos) {
          const allocQty = permAllocByPos[pos] || 0;
          const shiftQty = permShiftByPos[pos];
          if (shiftQty > allocQty) {
            hasExceeded = true;
            exceededMessage += `\n- Position "${pos}" (Permanent): shift requirement is ${shiftQty} but allocated manpower is only ${allocQty}.`;
          }
        }

        for (const pos in relShiftByPos) {
          const allocQty = relAllocByPos[pos] || 0;
          const shiftQty = relShiftByPos[pos];
          if (shiftQty > allocQty) {
            hasExceeded = true;
            exceededMessage += `\n- Position "${pos}" (Reliever): shift requirement is ${shiftQty} but allocated manpower is only ${allocQty}.`;
          }
        }

        if (hasExceeded) {
          if (!confirm(`Warning: The total shift requirements exceed the allocated manpower for the following positions:${exceededMessage}\n\nDo you want to proceed anyway?`)) {
            return;
          }
        }
      }

      let submitBody = { ...formData };
      if (master === "projects") {
        submitBody.allocations = projectAllocations.map(a => ({
          requirementId: a.requirementId,
          position: a.position,
          allocatedQty: a.allocatedToThis
        }));
        submitBody.relieverAllocations = projectRelieverAllocations.map(a => ({
          requirementId: a.requirementId,
          position: a.position,
          allocatedQty: a.allocatedToThis
        }));
      } else if (master === "sites") {
        submitBody.allocations = [
          ...siteAllocations.map(a => ({
            position: a.position,
            allocatedQty: a.allocatedToThis,
            deploymentType: "PERMANENT",
            relieverPoolType: "DEDICATED"
          })),
          ...siteRelieverAllocations.map(a => ({
            position: a.position,
            allocatedQty: a.allocatedToThis,
            deploymentType: "RELIEVER",
            relieverPoolType: a.relieverPoolType || "DEDICATED"
          }))
        ];
        if (isSecurity) {
          submitBody.siteAllowanceApplicable = siteAllowanceApplicable;
          submitBody.siteAllowance = formSiteAllowance;
          submitBody.siteShiftRequirements = formSiteShifts;
        }
      }

      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitBody)
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({});
        setProjectAllocations([]);
        setProjectRelieverAllocations([]);
        setSiteAllocations([]);
        setSiteRelieverAllocations([]);
        loadData();
      } else {
        const errJson = await res.json();
        setFormError(errJson.error || "Failed to create item");
      }
    } catch (e) {
      setFormError("Server connection failed");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    try {
      if (master === "sites" && isSecurity) {
        for (const shift of formSiteShifts) {
          if (!shift.categoryId) {
            setFormError("All shift requirements must have a position selected.");
            return;
          }
          if (!shift.shiftCode) {
            setFormError("All shift requirements must have a shift name.");
            return;
          }
          if (!shift.shiftStartTime || !shift.shiftEndTime) {
            setFormError(`Start time and End time are required for shift ${shift.shiftCode}.`);
            return;
          }
          if (Number(shift.requiredCount) <= 0) {
            setFormError(`Required headcount for shift ${shift.shiftCode} must be greater than 0.`);
            return;
          }
          if (Number(shift.requiredRelieverCount || 0) < 0) {
            setFormError(`Required relievers count for shift ${shift.shiftCode} cannot be negative.`);
            return;
          }
        }

        const permAllocByPos: Record<string, number> = {};
        const relAllocByPos: Record<string, number> = {};

        siteAllocations.forEach(a => {
          permAllocByPos[a.position] = (permAllocByPos[a.position] || 0) + (a.allocatedToThis || 0);
        });
        siteRelieverAllocations.forEach(a => {
          relAllocByPos[a.position] = (relAllocByPos[a.position] || 0) + (a.allocatedToThis || 0);
        });

        const permShiftByPos: Record<string, number> = {};
        const relShiftByPos: Record<string, number> = {};

        formSiteShifts.forEach(s => {
          const categoryName = categories.find(c => c.id === s.categoryId)?.name || "";
          if (categoryName) {
            const isRel = siteRelieverAllocations.some(a => a.position === categoryName);
            if (isRel) {
              relShiftByPos[categoryName] = (relShiftByPos[categoryName] || 0) + (Number(s.requiredCount) || 0);
            } else {
              permShiftByPos[categoryName] = (permShiftByPos[categoryName] || 0) + (Number(s.requiredCount) || 0);
            }
          }
        });

        let hasExceeded = false;
        let exceededMessage = "";

        for (const pos in permShiftByPos) {
          const allocQty = permAllocByPos[pos] || 0;
          const shiftQty = permShiftByPos[pos];
          if (shiftQty > allocQty) {
            hasExceeded = true;
            exceededMessage += `\n- Position "${pos}" (Permanent): shift requirement is ${shiftQty} but allocated manpower is only ${allocQty}.`;
          }
        }

        for (const pos in relShiftByPos) {
          const allocQty = relAllocByPos[pos] || 0;
          const shiftQty = relShiftByPos[pos];
          if (shiftQty > allocQty) {
            hasExceeded = true;
            exceededMessage += `\n- Position "${pos}" (Reliever): shift requirement is ${shiftQty} but allocated manpower is only ${allocQty}.`;
          }
        }

        if (hasExceeded) {
          if (!confirm(`Warning: The total shift requirements exceed the allocated manpower for the following positions:${exceededMessage}\n\nDo you want to proceed anyway?`)) {
            return;
          }
        }
      }

      let submitBody = { id: editItem.id, ...formData };
      if (master === "projects") {
        submitBody.allocations = projectAllocations.map(a => ({
          requirementId: a.requirementId,
          position: a.position,
          allocatedQty: a.allocatedToThis
        }));
        submitBody.relieverAllocations = projectRelieverAllocations.map(a => ({
          requirementId: a.requirementId,
          position: a.position,
          allocatedQty: a.allocatedToThis
        }));
      } else if (master === "sites") {
        submitBody.allocations = [
          ...siteAllocations.map(a => ({
            position: a.position,
            allocatedQty: a.allocatedToThis,
            deploymentType: "PERMANENT",
            relieverPoolType: "DEDICATED"
          })),
          ...siteRelieverAllocations.map(a => ({
            position: a.position,
            allocatedQty: a.allocatedToThis,
            deploymentType: "RELIEVER",
            relieverPoolType: a.relieverPoolType || "DEDICATED"
          }))
        ];
        if (isSecurity) {
          submitBody.siteAllowanceApplicable = siteAllowanceApplicable;
          submitBody.siteAllowance = formSiteAllowance;
          submitBody.siteShiftRequirements = formSiteShifts;
        }
      }

      const url = (master === "materials" || master === "projects") ? `${apiBase}/${editItem.id}` : apiBase;
      const method = master === "materials" ? "PUT" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitBody)
      });
      if (res.ok) {
        setEditItem(null);
        setFormData({});
        setProjectAllocations([]);
        setProjectRelieverAllocations([]);
        setSiteAllocations([]);
        setSiteRelieverAllocations([]);
        loadData();
      } else {
        const errJson = await res.json();
        setFormError(errJson.error || "Failed to update item");
      }
    } catch (e) {
      setFormError("Server connection failed");
    }
  };

  const filteredData = data.filter((item: any) => {
    const term = searchTerm.toLowerCase();
    if (master === "clients") {
      const searchMatch = (
        item.name?.toLowerCase().includes(term) ||
        item.code?.toLowerCase().includes(term) ||
        item.crNumber?.toLowerCase().includes(term) ||
        item.qidNumber?.toLowerCase().includes(term) ||
        item.mainPhone?.toLowerCase().includes(term) ||
        item.mainEmail?.toLowerCase().includes(term) ||
        item.operationContactName?.toLowerCase().includes(term) ||
        item.financeContactName?.toLowerCase().includes(term)
      );
      const typeMatch = filterCustomerType === "ALL" || item.customerType === filterCustomerType;
      const statusMatch = filterStatus === "ALL" || (filterStatus === "ACTIVE" ? item.isActive : !item.isActive);
      return searchMatch && typeMatch && statusMatch;
    }
    if (master === "categories") {
      return item.name?.toLowerCase().includes(term) || item.code?.toLowerCase().includes(term);
    }
    if (master === "contracts") {
      return item.title?.toLowerCase().includes(term) || item.contractNumber?.toLowerCase().includes(term);
    }
    if (master === "projects") {
      return item.name?.toLowerCase().includes(term) || item.code?.toLowerCase().includes(term);
    }
    if (master === "sites" || master === "zones" || master === "areas") {
      return item.name?.toLowerCase().includes(term);
    }
    if (master === "manpower") {
      return item.name?.toLowerCase().includes(term) || item.id?.toLowerCase().includes(term) || item.email?.toLowerCase().includes(term);
    }
    if (master === "coordinators") {
      return item.code?.toLowerCase().includes(term) ||
             item.project?.name?.toLowerCase().includes(term) ||
             item.coordinatorEmployee?.name?.toLowerCase().includes(term);
    }
    return true;
  });

  async function loadProjectDetails(projectId: string) {
    setSelectedProjectId(projectId);
    try {
      const summaryRes = await fetch(`/api/v1/security/projects/${projectId}/deployment-summary`);
      let summaryData: any = null;
      if (summaryRes.ok) {
        summaryData = await summaryRes.json();
      }
      
      const allocRes = await fetch(`/api/v1/security/projects/${projectId}/allocation-summary`);
      if (allocRes.ok && summaryData) {
        const allocData = await allocRes.json();
        summaryData.manpowerSummary = allocData.manpowerSummary;
        summaryData.relieverSummary = allocData.relieverSummary;
      }

      if (summaryData) {
        setProjectSummary(summaryData);
      }

      const matRes = await fetch(`/api/v1/manpower/material-allocations?projectId=${projectId}`);
      if (matRes.ok) setProjectAllocatedMaterials(await matRes.json());

      const sitesRes = await fetch(`/api/v1/manpower/${business}/sites`);
      if (sitesRes.ok) {
        const allSites = await sitesRes.json();
        const projectSites = allSites.filter((s: any) => s.projectId === projectId);
        const projectSiteIds = projectSites.map((s: any) => s.id);
        
        const shiftsRes = await fetch(`/api/v1/shifts`);
        if (shiftsRes.ok) {
          const allShifts = await shiftsRes.json();
          const filteredShifts = allShifts.filter((s: any) => projectSiteIds.includes(s.siteId));
          setProjectShiftRequirements(filteredShifts);
        }

        const todayStr = new Date().toISOString().split("T")[0];
        const depRes = await fetch(`/api/v1/manpower/${business}/deployments?date=${todayStr}`);
        if (depRes.ok) {
          const allDeps = await depRes.json();
          const filteredDeps = allDeps.filter((d: any) => projectSiteIds.includes(d.shiftRequirement?.siteId));
          setProjectDeployments(filteredDeps);
        }
      }
    } catch (e) {
      console.error("Failed to load project details", e);
    }
  }

  async function loadSiteDetails(siteId: string) {
    setSelectedSiteId(siteId);
    try {
      const res = await fetch(`/api/v1/security/sites/${siteId}/deployment-summary`);
      if (res.ok) {
        setSiteSummary(await res.json());
      }
    } catch (e) {
      console.error("Failed to load site details", e);
    }
  }

  const handleAddLicenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const form = e.target as HTMLFormElement;
    const formDataObj = new FormData(form);
    const payload = {
      employeeId: formDataObj.get("employeeId") as string,
      licenseNumber: formDataObj.get("licenseNumber") as string,
      issueDate: formDataObj.get("issueDate") as string,
      expiryDate: formDataObj.get("expiryDate") as string,
      status: "VALID"
    };

    try {
      const res = await fetch("/api/v1/security/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowAddLicenseModal(false);
        loadSecurityComplianceData();
      } else {
        const err = await res.json();
        setFormError(err.error || "Failed to add license record");
      }
    } catch (err) {
      setFormError("Server connection failed");
    }
  };

  const handleAddGatePassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const form = e.target as HTMLFormElement;
    const formDataObj = new FormData(form);
    const payload = {
      employeeId: formDataObj.get("employeeId") as string,
      siteId: formDataObj.get("siteId") as string,
      passNumber: formDataObj.get("passNumber") as string,
      issueDate: formDataObj.get("issueDate") as string,
      expiryDate: formDataObj.get("expiryDate") as string,
      status: "ACTIVE"
    };

    try {
      const res = await fetch("/api/v1/security/gate-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowAddGatePassModal(false);
        loadSecurityComplianceData();
      } else {
        const err = await res.json();
        setFormError(err.error || "Failed to add gate pass record");
      }
    } catch (err) {
      setFormError("Server connection failed");
    }
  };

  function renderProjectDetailsPanel() {
    const project = data.find(p => p.id === selectedProjectId);
    if (!project) return null;

    if (!projectSummary) {
      return (
        <div className="w-1/2 bg-surface border border-outline-variant rounded-xl shadow-sm p-6 flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
          <p className="text-xs text-on-surface-variant">Loading project contract summary...</p>
        </div>
      );
    }

    const { contract, manpowerRequirements, relieverRequirements, shiftRequirements, sites: projectSites, distribution } = projectSummary;

    return (
      <div className="w-1/2 bg-surface border border-outline-variant rounded-xl shadow-sm p-6 overflow-y-auto flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-outline-variant/60 pb-3">
          <div>
            <h3 className="text-sm font-black text-primary">{project.name}</h3>
            <p className="text-[10px] text-on-surface-variant">Project Code: {project.code}</p>
          </div>
          <button
            onClick={() => {
              setSelectedProjectId(null);
              setProjectSummary(null);
            }}
            className="w-6 h-6 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Contract Summary */}
        {contract && (
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-primary flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">description</span>
              Linked Contract Summary
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[10px] text-on-surface-variant font-medium">Contract Number</p>
                <p className="font-semibold text-on-surface">{contract.contractNumber}</p>
              </div>
              <div>
                <p className="text-[10px] text-on-surface-variant font-medium">Client</p>
                <p className="font-semibold text-on-surface">{contract.clientName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] text-on-surface-variant font-medium">Contract Title</p>
                <p className="font-semibold text-on-surface">{contract.title}</p>
              </div>
              <div>
                <p className="text-[10px] text-on-surface-variant font-medium">Period</p>
                <p className="font-semibold text-on-surface">
                  {contract.startDate?.split("T")[0]} to {contract.endDate?.split("T")[0]}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-on-surface-variant font-medium">Status</p>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${contract.status === "ACTIVE" ? "bg-status-success/15 text-status-success" : "bg-status-warning/15 text-status-warning"}`}>
                  {contract.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Manpower Distribution Metrics */}
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2">
          <p className="text-[9px] uppercase font-bold text-on-surface-variant">Manpower Allocation Progress</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs border border-outline-variant/60 rounded-lg p-2 bg-surface">
            <div>
              <p className="text-[10px] text-on-surface-variant font-medium">Contract Req.</p>
              <p className="text-sm font-black text-on-surface">{distribution?.totalContractRequired || 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant font-medium">Distributed</p>
              <p className="text-sm font-black text-primary">{distribution?.totalSiteDistributed || 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant font-medium">Remaining</p>
              <p className={`text-sm font-black ${distribution?.remainingUndistributed > 0 ? "text-status-error" : "text-status-success"}`}>
                {distribution?.remainingUndistributed || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Manpower Requirements Table */}
        <div className="space-y-2 animate-fade-in">
          <h4 className="text-xs font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">groups</span>
            Manpower Requirements & Project Allocation Balances
          </h4>
          <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                  <th className="px-3 py-2">Position</th>
                  <th className="px-3 py-2 text-center">Contract Req</th>
                  <th className="px-3 py-2 text-center">Project Qty</th>
                  <th className="px-3 py-2 text-center">Site Alloc</th>
                  <th className="px-3 py-2 text-center">Avail Bal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {!projectSummary.manpowerSummary || projectSummary.manpowerSummary.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-on-surface-variant italic">No manpower requirements specified.</td>
                  </tr>
                ) : (
                  projectSummary.manpowerSummary.map((alloc: any, idx: number) => (
                    <tr key={idx} className="hover:bg-surface-container-lowest">
                      <td className="px-3 py-2 font-semibold text-on-surface">{alloc.position}</td>
                      <td className="px-3 py-2 text-center font-semibold text-on-surface-variant">{alloc.contractQty}</td>
                      <td className="px-3 py-2 text-center font-bold text-primary">{alloc.allocatedToThis}</td>
                      <td className="px-3 py-2 text-center font-semibold text-secondary">{alloc.allocatedToSites}</td>
                      <td className={`px-3 py-2 text-center font-bold ${alloc.remainingForSites > 0 ? "text-status-success" : "text-on-surface-variant"}`}>
                        {alloc.remainingForSites}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reliever Requirements Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">shuffle</span>
            Reliever Requirements & Project Allocation Balances
          </h4>
          <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                  <th className="px-3 py-2">Position</th>
                  <th className="px-3 py-2 text-center">Contract Req</th>
                  <th className="px-3 py-2 text-center">Project Qty</th>
                  <th className="px-3 py-2 text-center">Site Alloc</th>
                  <th className="px-3 py-2 text-center">Avail Bal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {!projectSummary.relieverSummary || projectSummary.relieverSummary.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-on-surface-variant italic">No reliever requirements specified.</td>
                  </tr>
                ) : (
                  projectSummary.relieverSummary.map((alloc: any, idx: number) => (
                    <tr key={idx} className="hover:bg-surface-container-lowest">
                      <td className="px-3 py-2 font-semibold text-on-surface">{alloc.position}</td>
                      <td className="px-3 py-2 text-center font-semibold text-on-surface-variant">{alloc.contractQty}</td>
                      <td className="px-3 py-2 text-center font-bold text-primary">{alloc.allocatedToThis}</td>
                      <td className="px-3 py-2 text-center font-semibold text-secondary">{alloc.allocatedToSites}</td>
                      <td className={`px-3 py-2 text-center font-bold ${alloc.remainingForSites > 0 ? "text-status-success" : "text-on-surface-variant"}`}>
                        {alloc.remainingForSites}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shift Requirements Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            Inherited Shift Templates
          </h4>
          <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                  <th className="px-3 py-2">Shift Name</th>
                  <th className="px-3 py-2">Timing</th>
                  <th className="px-3 py-2 text-center">Posts</th>
                  <th className="px-3 py-2">Pattern</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {shiftRequirements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-on-surface-variant italic">No shift templates specified in contract.</td>
                  </tr>
                ) : (
                  shiftRequirements.map((sr: any) => (
                    <tr key={sr.id} className="hover:bg-surface-container-lowest">
                      <td className="px-3 py-2 font-semibold text-on-surface">{sr.shiftName}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{sr.startTime} - {sr.endTime}</td>
                      <td className="px-3 py-2 text-center font-bold">{sr.postsCovered}</td>
                      <td className="px-3 py-2 text-[10px] text-on-surface-variant font-medium">{sr.daysPattern}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Connected Sites List Summary */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">location_on</span>
            Connected Sites & Roster Setup
          </h4>
          <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                  <th className="px-3 py-2">Site Name</th>
                  <th className="px-3 py-2 text-center">Shifts</th>
                  <th className="px-3 py-2 text-center">Req Guards</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {projectSites.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-on-surface-variant italic">No sites linked to this project.</td>
                  </tr>
                ) : (
                  projectSites.map((s: any) => (
                    <tr key={s.id} className="hover:bg-surface-container-lowest">
                      <td className="px-3 py-2 font-semibold text-on-surface">
                        <div>{s.name}</div>
                        <div className="text-[10px] text-on-surface-variant font-mono">{s.code}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-bold">{s.activeShiftsCount}</td>
                      <td className="px-3 py-2 text-center font-bold">{s.requiredGuards}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${s.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                          {s.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderSiteDetailsPanel() {
    const site = data.find(s => s.id === selectedSiteId);
    if (!site) return null;

    if (!siteSummary) {
      return (
        <div className="w-[85%] bg-surface border border-outline-variant rounded-xl shadow-2xl p-6 flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
          <p className="text-xs text-on-surface-variant">Loading site deployment summary...</p>
        </div>
      );
    }

    const { project, contract, client, siteShifts, siteAllowance, projectInstructions } = siteSummary;

    // Allow adding site shift config based on inherited contract shifts
    const handleAddSiteShift = async (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formDataObj = new FormData(form);

      const contractShiftId = formDataObj.get("contractShiftId") as string;
      const designation = formDataObj.get("designation") as string;
      const requiredCount = parseInt(formDataObj.get("requiredCount") as string, 10);
      const postName = formDataObj.get("postName") as string;

      if (!contractShiftId || !designation || isNaN(requiredCount)) {
        alert("Please fill all required fields");
        return;
      }

      // Find the inherited contract shift details
      const inheritedShift = (projectSummary?.shiftRequirements || []).find((s: any) => s.id === contractShiftId);
      const shiftName = inheritedShift ? inheritedShift.shiftName : "Site Shift";
      const startTime = inheritedShift ? inheritedShift.startTime : "07:00";
      const endTime = inheritedShift ? inheritedShift.endTime : "19:00";

      const payload = {
        siteId: selectedSiteId,
        categoryId: designation,
        shiftCode: shiftName.toUpperCase(),
        startTime,
        endTime,
        requiredCount,
        allowanceCode: siteAllowance?.siteAllowanceEnabled ? "SITE_ALLOW" : null,
        operationType: "SECURITY_GUARDING",
        isActive: true,
        postName
      };

      try {
        const res = await fetch("/api/v1/security/scheduling/site-shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          form.reset();
          loadSiteDetails(selectedSiteId!);
          loadData();
        } else {
          const err = await res.json();
          alert(err.error || "Failed to save site shift requirement");
        }
      } catch (err) {
        alert("Server connection failed");
      }
    };

    // Delete Worksite
    const handleDeleteSite = async () => {
      const user = session?.user as any;
      const isSuperOrAdmin = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
      const hasPerm = hasPermission(user, "manpower.admin.full_access") || hasPermission(user, "manpower.security.manage");

      if (!isSuperOrAdmin && !hasPerm) {
        alert("You do not have permission to delete sites.");
        return;
      }

      try {
        const res = await fetch(`/api/v1/security/sites/${selectedSiteId}/dependencies`);
        if (res.ok) {
          const report = await res.json();
          setDeleteSiteReport(report);
        } else {
          alert("Failed to load site dependency report.");
        }
      } catch (err) {
        alert("Server connection failed checking dependencies");
      }
    };

    const executeActualDelete = async () => {
      try {
        const res = await fetch(`/api/v1/security/sites/${selectedSiteId}`, {
          method: "DELETE"
        });
        const result = await res.json();
        setDeleteSiteReport(null);
        if (res.ok) {
          if (result.deactivated) {
            alert(result.message || "This site is already used in deployment records. It has been deactivated instead of permanently deleted.");
          } else {
            alert("Site deleted successfully.");
          }
          setSelectedSiteId(null);
          setSiteSummary(null);
          loadData();
        } else {
          alert(result.error || "Failed to delete site");
        }
      } catch (err) {
        alert("Server connection failed executing delete");
      }
    };

    const executeDeactivateOnly = async () => {
      try {
        const res = await fetch(`/api/v1/security/sites/${selectedSiteId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false })
        });
        setDeleteSiteReport(null);
        if (res.ok) {
          alert("Site deactivated successfully.");
          loadSiteDetails(selectedSiteId!);
          loadData();
        } else {
          const err = await res.json();
          alert(err.error || "Failed to deactivate site");
        }
      } catch (err) {
        alert("Server connection failed executing deactivation");
      }
    };

    // Toggle Site Active Status
    const handleToggleStatus = async () => {
      const user = session?.user as any;
      const isSuperOrAdmin = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
      const hasPerm = hasPermission(user, "manpower.admin.full_access") || hasPermission(user, "manpower.security.manage");

      if (!isSuperOrAdmin && !hasPerm) {
        alert("You do not have permission to enable/disable sites.");
        return;
      }

      if (siteSummary.site.isActive) {
        setSiteToDisable(siteSummary.site);
      } else {
        await executeStatusUpdate(true);
      }
    };

    const executeStatusUpdate = async (newStatus: boolean) => {
      try {
        const res = await fetch(`/api/v1/security/sites/${selectedSiteId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: newStatus })
        });
        if (res.ok) {
          setSiteToDisable(null);
          loadSiteDetails(selectedSiteId!);
          loadData();
        } else {
          const err = await res.json();
          alert(err.error || "Failed to update site status");
        }
      } catch (err) {
        alert("Server connection failed");
      }
    };

    // Save site allowance
    const handleSaveAllowance = async (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formDataObj = new FormData(form);

      const enabled = formDataObj.get("siteAllowanceEnabled") === "true";
      const amount = parseFloat(formDataObj.get("siteAllowanceAmount") as string);
      const frequency = formDataObj.get("siteAllowanceFrequency") as string;
      const description = formDataObj.get("allowanceDescription") as string;

      const payload = {
        siteId: selectedSiteId,
        siteAllowanceEnabled: enabled,
        siteAllowanceAmount: enabled ? amount : 0,
        siteAllowanceFrequency: enabled ? frequency : "MONTHLY",
        allowanceDescription: description,
        isActive: true
      };

      try {
        const res = await fetch("/api/v1/security/scheduling/site-allowance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert("Allowance policy saved successfully.");
          loadSiteDetails(selectedSiteId!);
        } else {
          const err = await res.json();
          alert(err.error || "Failed to save allowance configuration");
        }
      } catch (err) {
        alert("Server connection failed");
      }
    };

    return (
      <div className="w-[85%] bg-surface border border-outline-variant rounded-xl shadow-2xl p-6 overflow-y-auto flex flex-col gap-6">
        {/* Site Header Summary */}
        <div className="flex justify-between items-start border-b border-outline-variant pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-primary">{siteSummary.site.name}</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${siteSummary.site.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                {siteSummary.site.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-xs font-mono uppercase text-on-surface-variant mt-1">Site Code: {siteSummary.site.code}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => startEdit(siteSummary.site)}
              className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 rounded-lg text-xs font-bold transition-all"
            >
              Edit Site
            </button>
            <button
              onClick={handleToggleStatus}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                siteSummary.site.isActive
                  ? "bg-status-error/10 text-status-error border-status-error/20 hover:bg-status-error/15"
                  : "bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/15"
              }`}
            >
              {siteSummary.site.isActive ? "Disable Site" : "Activate Site"}
            </button>
            <button
              onClick={handleDeleteSite}
              className="px-3 py-1.5 bg-status-error/10 text-status-error border border-status-error/20 hover:bg-status-error/15 rounded-lg text-xs font-bold transition-all"
            >
              Delete Site
            </button>
            <button
              onClick={() => {
                setSelectedSiteId(null);
                setSiteSummary(null);
              }}
              className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Hierarchy Context Breadcrumbs */}
        <div className="grid grid-cols-3 gap-3 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/60 text-xs">
          <div>
            <span className="text-[10px] text-on-surface-variant font-medium">Client</span>
            <p className="font-semibold text-on-surface">{client?.name || "Unknown Client"}</p>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant font-medium">Contract</span>
            <p className="font-semibold text-on-surface">{contract?.contractNumber || "—"}</p>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant font-medium">Project</span>
            <p className="font-semibold text-on-surface">{project?.name || "—"}</p>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-outline-variant gap-2 p-1 bg-surface-container-low rounded-xl">
          {[
            { id: "overview", label: "Overview", icon: "dashboard" },
            { id: "contract_requirements", label: "Contract Roster Reqs", icon: "description" },
            { id: "site_shifts", label: "Configure Site Shifts", icon: "schedule" },
            { id: "site_allowance", label: "Site Allowance Setup", icon: "payments" },
            { id: "project_instructions", label: "Project Instructions", icon: "assignment" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSiteActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all rounded-lg ${
                siteActiveTab === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Panels */}
        {siteActiveTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface border border-outline-variant p-4 rounded-xl text-center space-y-1">
                <p className="text-[10px] text-on-surface-variant font-bold uppercase">Required Manpower</p>
                <p className="text-2xl font-black text-primary">{siteSummary.site.requiredManpower || 0}</p>
              </div>
              <div className="bg-surface border border-outline-variant p-4 rounded-xl text-center space-y-1">
                <p className="text-[10px] text-on-surface-variant font-bold uppercase">Deployed Guards</p>
                <p className="text-2xl font-black text-status-success">{siteSummary.site.assignedManpower || 0}</p>
              </div>
              <div className="bg-surface border border-outline-variant p-4 rounded-xl text-center space-y-1">
                <p className="text-[10px] text-on-surface-variant font-bold uppercase">Vacant Slots</p>
                <p className={`text-2xl font-black ${siteSummary.site.remainingVacant > 0 ? "text-status-error" : "text-status-success"}`}>
                  {siteSummary.site.remainingVacant || 0}
                </p>
              </div>
            </div>

            {/* Allowance Summary Card */}
            <div className="bg-surface border border-outline-variant p-4 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">payments</span>
                Active Site Allowance
              </h4>
              {siteAllowance?.siteAllowanceEnabled ? (
                <div className="text-xs space-y-1 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/60">
                  <p className="font-bold text-on-surface">Allowance Status: <span className="text-status-success">ENABLED</span></p>
                  <p className="font-semibold text-on-surface">Amount: QAR {siteAllowance.siteAllowanceAmount} ({siteAllowance.siteAllowanceFrequency})</p>
                  {siteAllowance.allowanceDescription && (
                    <p className="text-on-surface-variant italic mt-1">Description: {siteAllowance.allowanceDescription}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant italic">No site allowance configured. Guards deployed to this site will receive default standard grade parameters.</p>
              )}
            </div>
          </div>
        )}

        {siteActiveTab === "contract_requirements" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-primary">Manpower Requirements</h4>
              <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                      <th className="px-3 py-2">Position</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2">Deployment Type</th>
                      <th className="px-3 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {(projectSummary?.manpowerRequirements || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-on-surface-variant italic">No manpower requirements inherited from contract.</td>
                      </tr>
                    ) : (
                      (projectSummary.manpowerRequirements || []).map((mr: any) => (
                        <tr key={mr.id} className="hover:bg-surface-container-lowest">
                          <td className="px-3 py-2 font-semibold text-on-surface">{mr.position}</td>
                          <td className="px-3 py-2 text-center font-bold">{mr.quantity}</td>
                          <td className="px-3 py-2 uppercase text-[10px] text-on-surface-variant font-semibold">{mr.deploymentType}</td>
                          <td className="px-3 py-2 text-on-surface-variant italic">{mr.remarks || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-primary">Reliever Requirements</h4>
              <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                      <th className="px-3 py-2">Position</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2">Pref. Source</th>
                      <th className="px-3 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {(projectSummary?.relieverRequirements || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-on-surface-variant italic">No reliever requirements inherited from contract.</td>
                      </tr>
                    ) : (
                      (projectSummary.relieverRequirements || []).map((rr: any) => (
                        <tr key={rr.id} className="hover:bg-surface-container-lowest">
                          <td className="px-3 py-2 font-semibold text-on-surface">{rr.position}</td>
                          <td className="px-3 py-2 text-center font-bold">{rr.quantity}</td>
                          <td className="px-3 py-2 text-on-surface-variant">{rr.sourcePreference}</td>
                          <td className="px-3 py-2 text-on-surface-variant italic">{rr.remarks || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {siteActiveTab === "site_shifts" && (
          <div className="space-y-4">
            {/* Configure Site Shift Form using Inherited Shifts */}
            {canManage && (
              <form onSubmit={handleAddSiteShift} className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Create Site-Specific Shift requirement
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] text-on-surface-variant font-bold uppercase mb-1">Inherited Contract Shift</label>
                    <select
                      name="contractShiftId"
                      className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                      required
                    >
                      <option value="">Select Contract Shift...</option>
                      {(projectSummary?.shiftRequirements || []).map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.shiftName} ({s.startTime} - {s.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-on-surface-variant font-bold uppercase mb-1">Required Designation</label>
                    <select
                      name="designation"
                      className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                      required
                    >
                      <option value="">Select Designation...</option>
                      {categories.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-on-surface-variant font-bold uppercase mb-1">Required Guard Count</label>
                    <input
                      name="requiredCount"
                      type="number"
                      min="1"
                      placeholder="e.g. 2"
                      className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-on-surface-variant font-bold uppercase mb-1">Post / Gate / Zone Name</label>
                    <input
                      name="postName"
                      type="text"
                      placeholder="e.g. Main Gate, Tower A"
                      className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Save Site Shift requirement
                  </button>
                </div>
              </form>
            )}

            {/* Configured Site Shifts Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-primary">Active Configured Shifts for this Site</h4>
              <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                      <th className="px-3 py-2">Shift Code</th>
                      <th className="px-3 py-2">Post / Gate</th>
                      <th className="px-3 py-2">Designation</th>
                      <th className="px-3 py-2">Timing</th>
                      <th className="px-3 py-2 text-center">Req Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {siteShifts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-on-surface-variant italic">No site shift requirements configured. Add site shift requirement.</td>
                      </tr>
                    ) : (
                      siteShifts.map((ss: any) => (
                        <tr key={ss.id} className="hover:bg-surface-container-lowest">
                          <td className="px-3 py-2 font-semibold text-on-surface">{ss.shiftCode}</td>
                          <td className="px-3 py-2 text-on-surface font-medium">{ss.postName || "General Post"}</td>
                          <td className="px-3 py-2 text-on-surface-variant">{ss.category?.name || ss.categoryId}</td>
                          <td className="px-3 py-2 text-on-surface-variant">{ss.startTime} - {ss.endTime}</td>
                          <td className="px-3 py-2 text-center font-bold">{ss.requiredCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {siteActiveTab === "site_allowance" && (
          <div className="space-y-4">
            <form onSubmit={handleSaveAllowance} className="bg-surface border border-outline-variant p-5 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">payments</span>
                Edit Site Allowance
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="col-span-2">
                  <label className="flex items-center gap-2 font-semibold text-on-surface">
                    <input
                      name="siteAllowanceEnabled"
                      type="checkbox"
                      defaultChecked={siteAllowance?.siteAllowanceEnabled}
                      value="true"
                      className="rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span>Enable Site Allowance Policy</span>
                  </label>
                  <p className="text-[10px] text-on-surface-variant ml-5 mt-1 italic">
                    When enabled, guards deployed to this site will generate a payroll advisory flag.
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] text-on-surface-variant font-bold uppercase mb-1">Allowance Amount (QAR)</label>
                  <input
                    name="siteAllowanceAmount"
                    type="number"
                    step="0.01"
                    defaultValue={siteAllowance?.siteAllowanceAmount || 0}
                    placeholder="e.g. 300.00"
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-on-surface-variant font-bold uppercase mb-1">Frequency</label>
                  <select
                    name="siteAllowanceFrequency"
                    defaultValue={siteAllowance?.siteAllowanceFrequency || "MONTHLY"}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="DAILY">Daily</option>
                    <option value="FIXED_FOR_PERIOD">Fixed for Period</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] text-on-surface-variant font-bold uppercase mb-1">Allowance Description</label>
                  <textarea
                    name="allowanceDescription"
                    defaultValue={siteAllowance?.allowanceDescription || ""}
                    placeholder="Provide context or eligibility rules for this site allowance..."
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary h-20"
                  ></textarea>
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t border-outline-variant/60">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Save Allowance configuration
                </button>
              </div>
            </form>
          </div>
        )}

        {siteActiveTab === "project_instructions" && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-primary">Inherited Project Instructions & Policies</h4>
            <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase text-on-surface-variant font-bold">
                    <th className="px-3 py-2">Instruction / Rule</th>
                    <th className="px-3 py-2">Rule Type</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {projectInstructions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-on-surface-variant italic">No compliance instructions inherited from Project.</td>
                    </tr>
                  ) : (
                    projectInstructions.map((pi: any) => (
                      <tr key={pi.id} className="hover:bg-surface-container-lowest">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-on-surface">{pi.ruleName}</div>
                          <div className="text-[10px] text-on-surface-variant">{pi.description}</div>
                        </td>
                        <td className="px-3 py-2 uppercase text-[10px] text-on-surface-variant font-semibold">{pi.ruleType}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            pi.severity === "HARD_BLOCK" ? "bg-status-error/15 text-status-error" :
                            pi.severity === "WARNING_ONLY" ? "bg-status-warning/15 text-status-warning" :
                            "bg-primary/15 text-primary"
                          }`}>
                            {pi.severity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-on-surface-variant">Project</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Confirmation modal wrapper */}
        {siteToDisable && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-surface rounded-xl border border-outline-variant shadow-2xl p-6 max-w-md w-full text-xs space-y-4">
              <h3 className="text-sm font-black text-status-error flex items-center gap-1">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                Confirm Disable Site
              </h3>
              <p className="text-on-surface-variant leading-relaxed">
                Disabling this site will prevent future deployment planning and scheduling for this site. Historical records will remain available.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setSiteToDisable(null)}
                  className="px-3 py-1.5 border border-outline-variant hover:bg-surface-container-high rounded text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => executeStatusUpdate(false)}
                  className="px-3 py-1.5 bg-status-error hover:bg-status-error/95 text-white rounded text-xs font-bold"
                >
                  Confirm Disable
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Delete Dependency Diagnostic Modal */}
        {deleteSiteReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
            <div className="bg-surface rounded-xl border border-outline-variant shadow-2xl p-6 max-w-md w-full text-xs space-y-4 text-on-surface">
              <h3 className="text-sm font-black text-status-error flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
                <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                Delete Site: {deleteSiteReport.siteName}
              </h3>
              
              <div className="space-y-2">
                <span className="block font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">Dependency Diagnostic:</span>
                <ul className="space-y-1.5 bg-surface-container-low p-3 rounded-lg border border-outline-variant/40 font-mono text-[10px]">
                  <li className="flex justify-between">
                    <span>Active Site Shifts:</span>
                    <span className={`font-bold ${deleteSiteReport.dependencyCounts.activeSiteShifts > 0 ? "text-status-error" : "text-status-success"}`}>
                      {deleteSiteReport.dependencyCounts.activeSiteShifts}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Manpower Allocations:</span>
                    <span className={`font-bold ${deleteSiteReport.dependencyCounts.manpowerAllocations > 0 ? "text-status-error" : "text-status-success"}`}>
                      {deleteSiteReport.dependencyCounts.manpowerAllocations}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Active Allowances:</span>
                    <span className={`font-bold ${deleteSiteReport.dependencyCounts.activeAllowances > 0 ? "text-status-error" : "text-status-success"}`}>
                      {deleteSiteReport.dependencyCounts.activeAllowances}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Deployment History:</span>
                    <span className={`font-bold ${deleteSiteReport.dependencyCounts.deploymentHistory > 0 ? "text-status-warning" : "text-on-surface-variant"}`}>
                      {deleteSiteReport.dependencyCounts.deploymentHistory}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Attendance History:</span>
                    <span className={`font-bold ${deleteSiteReport.dependencyCounts.attendanceHistory > 0 ? "text-status-warning" : "text-on-surface-variant"}`}>
                      {deleteSiteReport.dependencyCounts.attendanceHistory}
                    </span>
                  </li>
                  {deleteSiteReport.dependencyCounts.inactiveSiteShifts > 0 && (
                    <li className="flex justify-between text-on-surface-variant/70 italic">
                      <span>Stale Inactive Shifts (Will clean):</span>
                      <span>{deleteSiteReport.dependencyCounts.inactiveSiteShifts}</span>
                    </li>
                  )}
                  {deleteSiteReport.dependencyCounts.inactiveAllowances > 0 && (
                    <li className="flex justify-between text-on-surface-variant/70 italic">
                      <span>Stale Inactive Allowances (Will clean):</span>
                      <span>{deleteSiteReport.dependencyCounts.inactiveAllowances}</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className={`p-3 rounded-lg text-[11px] leading-relaxed border ${
                deleteSiteReport.canHardDelete 
                  ? "bg-status-success/10 text-status-success border-status-success/20" 
                  : deleteSiteReport.suggestedAction === "DEACTIVATE"
                    ? "bg-status-warning/10 text-status-warning border-status-warning/20"
                    : "bg-status-error/10 text-status-error border-status-error/20"
              }`}>
                <p className="font-bold mb-0.5">Recommended Action: {deleteSiteReport.suggestedAction}</p>
                <p>{deleteSiteReport.message}</p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-outline-variant/60">
                <button
                  onClick={() => setDeleteSiteReport(null)}
                  className="px-3 py-1.5 border border-outline-variant hover:bg-surface-container-high rounded text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                {deleteSiteReport.canDeactivate && (
                  <button
                    onClick={executeDeactivateOnly}
                    className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 rounded text-xs font-bold transition-all"
                  >
                    Deactivate Site
                  </button>
                )}
                {deleteSiteReport.canHardDelete ? (
                  <button
                    onClick={executeActualDelete}
                    className="px-3 py-1.5 bg-status-error hover:bg-status-error/90 text-white rounded text-xs font-bold transition-all"
                  >
                    Delete Permanently
                  </button>
                ) : (
                  <button
                    disabled
                    title="Active configurations or history prevent permanent deletion."
                    className="px-3 py-1.5 bg-on-surface/10 text-on-surface/40 cursor-not-allowed rounded text-xs font-bold transition-all"
                  >
                    Delete Anyway
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderSecurityComplianceTabs() {
    if (activeSubTab === "licenses") {
      return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="flex justify-between items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider">MOI Security Guard Licenses</h2>
            {canManage && (
              <button
                onClick={() => setShowAddLicenseModal(true)}
                className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Record License
              </button>
            )}
          </div>
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-on-surface-variant font-bold">
                  <th className="px-4 py-3">Guard ID</th>
                  <th className="px-4 py-3">License Number</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Status</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {licensesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-on-surface-variant italic">No license records recorded yet.</td>
                  </tr>
                ) : (
                  licensesList.map((lic: any) => {
                    const emp = data.find(e => e.id === lic.employeeId);
                    const todayStr = new Date().toISOString().split("T")[0];
                    const isExpired = lic.expiryDate < todayStr;
                    return (
                      <tr key={lic.id} className="text-xs hover:bg-surface-container-lowest">
                        <td className="px-4 py-3 font-semibold text-on-surface">
                          {emp ? `${emp.name} (${lic.employeeId})` : lic.employeeId}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">{lic.licenseNumber}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{lic.issueDate}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{lic.expiryDate}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isExpired ? "bg-status-error/15 text-status-error" : "bg-status-success/15 text-status-success"}`}>
                            {isExpired ? "Expired" : "Valid"}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                if (confirm("Revoke/delete this license record?")) {
                                  await fetch(`/api/v1/security/licenses/${lic.id}`, { method: "DELETE" });
                                  loadSecurityComplianceData();
                                }
                              }}
                              className="text-status-error hover:underline font-bold"
                            >
                              Revoke
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeSubTab === "gatePasses") {
      return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="flex justify-between items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Site Gate Passes</h2>
            {canManage && (
              <button
                onClick={() => setShowAddGatePassModal(true)}
                className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Record Gate Pass
              </button>
            )}
          </div>
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-on-surface-variant font-bold">
                  <th className="px-4 py-3">Guard ID</th>
                  <th className="px-4 py-3">Worksite</th>
                  <th className="px-4 py-3">Pass Number</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Status</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {gatePassesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-on-surface-variant italic">No gate passes recorded yet.</td>
                  </tr>
                ) : (
                  gatePassesList.map((gp: any) => {
                    const emp = data.find(e => e.id === gp.employeeId);
                    const site = sites.find(s => s.id === gp.siteId);
                    const todayStr = new Date().toISOString().split("T")[0];
                    const isExpired = gp.expiryDate < todayStr;
                    return (
                      <tr key={gp.id} className="text-xs hover:bg-surface-container-lowest">
                        <td className="px-4 py-3 font-semibold text-on-surface">
                          {emp ? `${emp.name} (${gp.employeeId})` : gp.employeeId}
                        </td>
                        <td className="px-4 py-3 text-on-surface">{site?.name || gp.siteId}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{gp.passNumber}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{gp.expiryDate}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isExpired ? "bg-status-error/15 text-status-error" : "bg-status-success/15 text-status-success"}`}>
                            {isExpired ? "Expired" : "Active"}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                if (confirm("Revoke/delete this gate pass record?")) {
                                  await fetch(`/api/v1/security/gate-passes/${gp.id}`, { method: "DELETE" });
                                  loadSecurityComplianceData();
                                }
                              }}
                              className="text-status-error hover:underline font-bold"
                            >
                              Revoke
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeSubTab === "relieverPools") {
      return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Project Reliever Pools</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relieverPoolsList.map((pool: any) => {
              const proj = projects.find(p => p.id === pool.projectId);
              const assigned = relieverAssignmentsList.filter((a: any) => a.poolId === pool.id);
              return (
                <div key={pool.id} className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-black text-primary">{pool.poolName}</h4>
                      <p className="text-[10px] text-on-surface-variant">Project: {proj?.name || pool.projectId}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {assigned.length} / {pool.requiredRelieverCount || 3} Relievers
                    </span>
                  </div>
                  <div className="pt-2 border-t border-outline-variant/40 space-y-1">
                    <p className="text-[9px] uppercase font-bold text-on-surface-variant">Assigned Resource Personnel</p>
                    {assigned.length === 0 ? (
                      <p className="text-[10px] text-on-surface-variant italic">No relievers assigned to this pool.</p>
                    ) : (
                      <ul className="list-disc pl-4 text-xs text-on-surface space-y-0.5">
                        {assigned.map((a: any) => {
                          const emp = data.find(e => e.id === a.employeeId);
                          return (
                            <li key={a.id} className="font-medium">
                              {emp ? emp.name : a.employeeId} ({a.employeeId})
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeSubTab === "overtimeLogs") {
      const overtimeDeployments: any[] = [];
      deploymentsList.forEach((dep: any) => {
        dep.assignments?.forEach((asg: any) => {
          if (asg.isOvertime || asg.deploymentType === "OVERTIME") {
            overtimeDeployments.push({
              id: asg.id,
              date: dep.date,
              employeeId: asg.employeeId,
              siteName: dep.shiftRequirement?.site?.name || dep.shiftRequirement?.siteId,
              shiftCode: dep.shiftRequirement?.shiftCode,
              sourceType: asg.sourceType,
              overtimeReason: asg.overtimeReason,
              warnings: asg.validationWarnings || []
            });
          }
        });
      });

      return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Overtime & Reliever Duty History</h2>
          </div>
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-on-surface-variant font-bold">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Worksite / Shift</th>
                  <th className="px-4 py-3">Allocation Source</th>
                  <th className="px-4 py-3">Overtime Reason</th>
                  <th className="px-4 py-3 text-right">Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {overtimeDeployments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-on-surface-variant italic">No active overtime or special assignments logged today.</td>
                  </tr>
                ) : (
                  overtimeDeployments.map((ot: any) => {
                    const emp = data.find(e => e.id === ot.employeeId);
                    return (
                      <tr key={ot.id} className="text-xs hover:bg-surface-container-lowest">
                        <td className="px-4 py-3 text-on-surface font-semibold">{ot.date}</td>
                        <td className="px-4 py-3 font-semibold text-on-surface">
                          {emp ? emp.name : ot.employeeId} ({ot.employeeId})
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">{ot.siteName} - {ot.shiftCode}</td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          <span className="px-1.5 py-0.5 bg-primary-container/10 text-primary font-bold rounded text-[9px]">
                            {ot.sourceType || "GENERAL_POOL"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-on-surface font-semibold text-status-warning">{ot.overtimeReason || "N/A"}</td>
                        <td className="px-4 py-3 text-right">
                          {ot.warnings.length > 0 ? (
                            <span className="px-1.5 py-0.5 bg-status-error/10 text-status-error rounded text-[9px] font-bold">
                              {ot.warnings.length} Alerts
                            </span>
                          ) : (
                            <span className="text-[10px] text-status-success font-bold">Compliant</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return null;
  }

  const addManpowerRow = () => {
    const list = formData.manpowerRequirements || [];
    setFormData({
      ...formData,
      manpowerRequirements: [...list, { id: `new-mr-${Date.now()}`, position: "", quantity: 1, deploymentType: "Permanent", remarks: "" }]
    });
  };

  const updateManpowerRow = (index: number, field: string, value: any) => {
    const list = [...(formData.manpowerRequirements || [])];
    list[index] = { ...list[index], [field]: value };
    setFormData({ ...formData, manpowerRequirements: list });
  };

  const deleteManpowerRow = (index: number) => {
    const list = [...(formData.manpowerRequirements || [])];
    list.splice(index, 1);
    setFormData({ ...formData, manpowerRequirements: list });
  };

  const addRelieverRow = () => {
    const list = formData.relieverRequirements || [];
    setFormData({
      ...formData,
      relieverRequirements: [...list, { id: `new-rr-${Date.now()}`, position: "", quantity: 1, sourcePreference: "General Pool", remarks: "" }]
    });
  };

  const updateRelieverRow = (index: number, field: string, value: any) => {
    const list = [...(formData.relieverRequirements || [])];
    list[index] = { ...list[index], [field]: value };
    setFormData({ ...formData, relieverRequirements: list });
  };

  const deleteRelieverRow = (index: number) => {
    const list = [...(formData.relieverRequirements || [])];
    list.splice(index, 1);
    setFormData({ ...formData, relieverRequirements: list });
  };

  const addShiftRow = () => {
    const list = formData.shiftRequirements || [];
    setFormData({
      ...formData,
      shiftRequirements: [...list, { id: `new-sr-${Date.now()}`, shiftName: "Day Shift", startTime: "07:00", endTime: "19:00", postsCovered: 1, daysPattern: "Daily", remarks: "" }]
    });
  };

  const updateShiftRow = (index: number, field: string, value: any) => {
    const list = [...(formData.shiftRequirements || [])];
    list[index] = { ...list[index], [field]: value };
    setFormData({ ...formData, shiftRequirements: list });
  };

  const deleteShiftRow = (index: number) => {
    const list = [...(formData.shiftRequirements || [])];
    list.splice(index, 1);
    setFormData({ ...formData, shiftRequirements: list });
  };

  const addAddendumLine = (itemType: string = "MANPOWER") => {
    const list = addFormLineItems || [];
    const listCopy = [...list];
    listCopy.push({
      id: `new-ali-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      itemType,
      action: "ADD",
      label: "",
      quantity: 1,
      unitPrice: 0,
      billingPeriodCount: 1,
      lineTotal: 0
    });
    setAddFormLineItems(listCopy);
    
    const totalImpact = listCopy.reduce((sum, li) => sum + (li.lineTotal || 0), 0);
    const formattedImpact = (totalImpact >= 0 ? "+" : "") + `QAR ${totalImpact.toFixed(2)}`;
    setAddendumForm({
      ...addendumForm,
      lineItems: listCopy,
      commercialImpact: formattedImpact
    });
  };

  const updateAddendumLineById = (id: string, field: string, value: any) => {
    const list = addFormLineItems.map(item => {
      if (item.id !== id) return item;
      const updatedItem = { ...item, [field]: value };
      
      const qty = parseInt(updatedItem.quantity, 10) || 0;
      const price = parseFloat(updatedItem.unitPrice) || 0;
      const count = parseInt(updatedItem.billingPeriodCount, 10) || 1;
      const absVal = qty * price * count;
      updatedItem.lineTotal = updatedItem.action === "REMOVE" ? -absVal : absVal;
      return updatedItem;
    });

    const totalImpact = list.reduce((sum, li) => sum + (li.lineTotal || 0), 0);
    const formattedImpact = (totalImpact >= 0 ? "+" : "") + `QAR ${totalImpact.toFixed(2)}`;

    setAddFormLineItems(list);
    setAddendumForm({
      ...addendumForm,
      lineItems: list,
      commercialImpact: formattedImpact
    });
  };

  const deleteAddendumLineById = (id: string) => {
    const list = addFormLineItems.filter(item => item.id !== id);
    
    const totalImpact = list.reduce((sum, li) => sum + (li.lineTotal || 0), 0);
    const formattedImpact = (totalImpact >= 0 ? "+" : "") + `QAR ${totalImpact.toFixed(2)}`;

    setAddFormLineItems(list);
    setAddendumForm({
      ...addendumForm,
      lineItems: list,
      commercialImpact: formattedImpact
    });
  };

  const calculateEndDate = (start: string, num: number, unit: string): string => {
    if (!start || !num || num <= 0) return "";
    const startDate = new Date(start);
    if (isNaN(startDate.getTime())) return "";

    let endDate = new Date(startDate);
    if (unit === "Day") {
      endDate.setDate(startDate.getDate() + num);
    } else if (unit === "Month") {
      endDate.setMonth(startDate.getMonth() + num);
    } else if (unit === "Year") {
      endDate.setFullYear(startDate.getFullYear() + num);
    }
    endDate.setDate(endDate.getDate() - 1);

    const yyyy = endDate.getFullYear();
    const mm = String(endDate.getMonth() + 1).padStart(2, '0');
    const dd = String(endDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const calculateDurationDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

    const diffTime = endDate.getTime() - startDate.getTime();
    if (diffTime < 0) return 0;
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const addMaterialRow = () => {
    const list = formData.materials || [];
    setFormData({
      ...formData,
      materials: [
        ...list,
        {
          id: `new-mat-${Date.now()}`,
          materialId: "",
          materialName: "",
          itemName: "",
          quantity: 1,
          unitOfMeasure: "Each",
          unitPrice: 0,
          isFoc: false,
          lineTotal: 0,
          remarks: ""
        }
      ]
    });
  };

  const updateMaterialRow = (index: number, field: string, value: any) => {
    const list = [...(formData.materials || [])];
    const item = { ...list[index], [field]: value };

    if (field === "materialId") {
      const selectedMat = materialsList.find((m: any) => m.id === value);
      if (selectedMat) {
        item.materialName = selectedMat.materialName;
        item.itemName = selectedMat.materialName;
        item.unitOfMeasure = selectedMat.unitOfMeasure || "Each";
        item.unitPrice = selectedMat.defaultUnitPrice !== null && selectedMat.defaultUnitPrice !== undefined ? selectedMat.defaultUnitPrice : 0;
      } else {
        item.materialName = "";
        item.itemName = "";
        item.unitOfMeasure = "Each";
        item.unitPrice = 0;
      }
    }

    const qty = field === "quantity" ? (parseInt(value, 10) || 0) : (parseInt(item.quantity, 10) || 0);
    const price = field === "unitPrice" ? (parseFloat(value) || 0) : (parseFloat(item.unitPrice) || 0);
    const isFoc = field === "isFoc" ? !!value : !!item.isFoc;

    item.lineTotal = isFoc ? 0 : qty * price;

    list[index] = item;
    setFormData({ ...formData, materials: list });
  };

  const deleteMaterialRow = (index: number) => {
    const list = [...(formData.materials || [])];
    list.splice(index, 1);
    setFormData({ ...formData, materials: list });
  };

  const removeMaterialRow = deleteMaterialRow;

  const calculateMaterialLineTotal = (quantity: number, unitPrice: number, isFoc: boolean) => {
    return isFoc ? 0 : (quantity || 0) * (unitPrice || 0);
  };
  
  const recalculateContractTotals = () => {
    // Totals are computed dynamically during render
  };

  const addAddendumLineItem = addAddendumLine;
  const updateAddendumLineItem = updateAddendumLineById;
  const removeAddendumLineItem = deleteAddendumLineById;

  const handleSaveContract = async (status: "DRAFT" | "ACTIVE") => {
    setFormError("");
    if (!formData.clientId || !formData.title || !formData.startDate || !formData.endDate) {
      setFormError("Client, Contract Title, Start Date, and End Date are required.");
      return;
    }
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end < start) {
      setFormError("End Date must be greater than or equal to Start Date.");
      return;
    }
    if (status === "ACTIVE") {
      const manpowerRequirements = formData.manpowerRequirements || [];
      if (manpowerRequirements.length === 0) {
        setFormError("At least one manpower requirement line is required to create an Active contract.");
        return;
      }
      if (manpowerRequirements.some((mr: any) => !mr.position || !mr.quantity || mr.quantity <= 0)) {
        setFormError("All manpower requirement lines must have a valid position and quantity greater than 0.");
        return;
      }
      if (formData.relieverRequired === "Yes") {
        const relieverRequirements = formData.relieverRequirements || [];
        if (relieverRequirements.length === 0) {
          setFormError("At least one reliever requirement line is required when Reliever Required is Yes.");
          return;
        }
        if (relieverRequirements.some((rr: any) => !rr.position || !rr.quantity || rr.quantity <= 0)) {
          setFormError("All reliever requirement lines must have a valid position and quantity greater than 0.");
          return;
        }
      }
      const shiftRequirements = formData.shiftRequirements || [];
      if (shiftRequirements.length === 0) {
        setFormError("At least one shift requirement line is required to create an Active contract.");
        return;
      }
      if (shiftRequirements.some((sr: any) => !sr.shiftName || !sr.startTime || !sr.endTime || !sr.postsCovered || sr.postsCovered <= 0)) {
        setFormError("All shift requirement lines must have a shift name, times, and posts covered greater than 0.");
        return;
      }
    }
    try {
      const isEditing = editItem !== null;
      const currentScope = isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";
      const statusVal = status || formData.status || "DRAFT";

      const normalizedManpower = (formData.manpowerRequirements || []).map((mr: any) => ({
        position: mr.position || "",
        quantity: parseInt(mr.quantity, 10) || 1,
        deploymentType: mr.deploymentType || "Permanent",
        unitPrice: mr.unitPrice === "" || mr.unitPrice === null || mr.unitPrice === undefined ? 0 : parseFloat(mr.unitPrice),
        billingFrequency: mr.billingFrequency || "Monthly",
        billingPeriodCount: mr.billingPeriodCount === "" || mr.billingPeriodCount === null || mr.billingPeriodCount === undefined ? 1 : parseInt(mr.billingPeriodCount, 10),
        isFoc: !!mr.isFoc,
        lineTotal: mr.isFoc ? 0 : (parseInt(mr.quantity, 10) || 1) * (parseFloat(mr.unitPrice) || 0) * (parseInt(mr.billingPeriodCount, 10) || 1),
        remarks: mr.remarks || ""
      }));

      const normalizedRelievers = (formData.relieverRequirements || []).map((rr: any) => ({
        position: rr.position || "",
        quantity: parseInt(rr.quantity, 10) || 1,
        sourcePreference: rr.sourcePreference || "General Pool",
        remarks: rr.remarks || ""
      }));

      const normalizedShifts = (formData.shiftRequirements || []).map((sr: any) => ({
        shiftName: sr.shiftName || "",
        startTime: sr.startTime || "",
        endTime: sr.endTime || "",
        postsCovered: parseInt(sr.postsCovered, 10) || 1,
        daysPattern: sr.daysPattern || "Daily",
        remarks: sr.remarks || ""
      }));

      const normalizedMaterials = (formData.materials || []).map((mat: any) => ({
        materialId: mat.materialId && mat.materialId !== "" ? mat.materialId : null,
        itemName: mat.itemName || mat.materialName || "",
        quantity: parseInt(mat.quantity, 10) || 1,
        unitPrice: mat.unitPrice === "" || mat.unitPrice === null || mat.unitPrice === undefined ? 0 : parseFloat(mat.unitPrice),
        isFoc: !!mat.isFoc,
        lineTotal: mat.isFoc ? 0 : (parseInt(mat.quantity, 10) || 1) * (parseFloat(mat.unitPrice) || 0),
        remarks: mat.remarks || ""
      }));

      const payload = {
        clientId: formData.clientId || "",
        contractNumber: formData.contractNumber || "",
        title: formData.title || "",
        startDate: formData.startDate || "",
        endDate: formData.endDate || "",
        remarks: formData.remarks || "",
        status: statusVal,
        operationType: currentScope,
        durationNumber: formData.durationNumber === "" || formData.durationNumber === null || formData.durationNumber === undefined ? null : parseInt(formData.durationNumber, 10),
        durationUnit: formData.durationUnit || "Month",
        totalDurationDays: formData.totalDurationDays === "" || formData.totalDurationDays === null || formData.totalDurationDays === undefined ? null : parseInt(formData.totalDurationDays, 10),
        defaultManpowerCount: parseInt(formData.defaultManpowerCount, 10) || 0,
        defaultRelieverCount: parseInt(formData.defaultRelieverCount, 10) || 0,
        manpowerRequirements: normalizedManpower,
        relieverRequirements: normalizedRelievers,
        shiftRequirements: normalizedShifts,
        materials: normalizedMaterials,
        paymentTerms: formData.paymentTerms || "",
        paymentCycle: formData.paymentCycle || "Monthly",
        creditDays: formData.creditDays === "" || formData.creditDays === null || formData.creditDays === undefined ? null : parseInt(formData.creditDays, 10),
        invoiceSubmissionDay: formData.invoiceSubmissionDay || "",
        paymentRemarks: formData.paymentRemarks || "",
        terminationClause: formData.terminationClause || "",
        noticePeriodDays: formData.noticePeriodDays === "" || formData.noticePeriodDays === null || formData.noticePeriodDays === undefined ? null : parseInt(formData.noticePeriodDays, 10),
        terminationPenalty: formData.terminationPenalty || "",
        earlyTerminationAllowed: !!formData.earlyTerminationAllowed,
        terminationRemarks: formData.terminationRemarks || "",
        specialConditions: formData.specialConditions || "",
        serviceLevelTerms: formData.serviceLevelTerms || "",
        penaltyClause: formData.penaltyClause || "",
        escalationMatrix: formData.escalationMatrix || "",
        otherContractConditions: formData.otherContractConditions || "",
        workflowLevels: workflowLevels
      };

      const url = isEditing ? `${apiBase}/${editItem.id}` : apiBase;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowAddModal(false);
        setEditItem(null);
        setFormData({});
        loadData();
        loadRelations();
      } else {
        const errJson = await res.json();
        setFormError(errJson.error || `Failed to ${isEditing ? "save" : "create"} contract`);
      }
    } catch (e) {
      setFormError("Server connection failed");
    }
  };

  const getSiteShiftPositionOptions = () => {
    const allocatedPositions = new Set<string>();

    siteAllocations.forEach((a: any) => {
      const qty = Number(a.allocatedToThis || a.allocatedQty || a.quantity || 0);
      if (qty > 0 && a.position) {
        allocatedPositions.add(a.position);
      }
    });

    siteRelieverAllocations.forEach((a: any) => {
      const qty = Number(a.allocatedToThis || a.allocatedQty || a.quantity || 0);
      if (qty > 0 && a.position) {
        allocatedPositions.add(a.position);
      }
    });

    formSiteShifts.forEach((s: any) => {
      const cat = categories.find((c: any) => c.id === s.categoryId);
      if (cat?.name) {
        allocatedPositions.add(cat.name);
      } else {
        const fallback = [
          { id: "PM-CAT-SEC-01", name: "CCTV Operator", code: "CCTV" },
          { id: "PM-CAT-SEC-02", name: "Security Guard", code: "GUARD" },
          { id: "PM-CAT-SEC-03", name: "Head Guard", code: "HEAD_GUARD" },
          { id: "PM-CAT-SEC-04", name: "Security Supervisor", code: "SEC_SUPERVISOR" },
          { id: "PM-CAT-SEC-06", name: "Reliever Guard", code: "RELIEVER_GUARD" },
          { id: "PM-CAT-SEC-07", name: "Patrolling Supervisor", code: "PATROL_SUPERVISOR" },
          { id: "PM-CAT-SEC-08", name: "Patrolling Guard", code: "PATROL_GUARD" },
          { id: "PM-CAT-SEC-09", name: "Project Coordinator", code: "COORDINATOR" },
          { id: "PM-CAT-SEC-10", name: "Event Guard", code: "EVENT_GUARD" },
          { id: "PM-CAT-SEC-11", name: "Other Security Manpower", code: "OTHER_SEC" }
        ].find(c => c.id === s.categoryId);
        if (fallback?.name) {
          allocatedPositions.add(fallback.name);
        }
      }
    });

    const options: Array<{ id: string; name: string }> = [];

    const orderedPositionNames = [
      ...siteAllocations.map((a: any) => a.position),
      ...siteRelieverAllocations.map((a: any) => a.position)
    ].filter(pos => allocatedPositions.has(pos));

    const uniqueNames = Array.from(new Set(orderedPositionNames));

    uniqueNames.forEach(posName => {
      let cat = categories.find((c: any) => c.name === posName && c.operationType === "SECURITY_GUARDING");
      if (!cat) {
        cat = [
          { id: "PM-CAT-SEC-01", name: "CCTV Operator", code: "CCTV" },
          { id: "PM-CAT-SEC-02", name: "Security Guard", code: "GUARD" },
          { id: "PM-CAT-SEC-03", name: "Head Guard", code: "HEAD_GUARD" },
          { id: "PM-CAT-SEC-04", name: "Security Supervisor", code: "SEC_SUPERVISOR" },
          { id: "PM-CAT-SEC-06", name: "Reliever Guard", code: "RELIEVER_GUARD" },
          { id: "PM-CAT-SEC-07", name: "Patrolling Supervisor", code: "PATROL_SUPERVISOR" },
          { id: "PM-CAT-SEC-08", name: "Patrolling Guard", code: "PATROL_GUARD" },
          { id: "PM-CAT-SEC-09", name: "Project Coordinator", code: "COORDINATOR" },
          { id: "PM-CAT-SEC-10", name: "Event Guard", code: "EVENT_GUARD" },
          { id: "PM-CAT-SEC-11", name: "Other Security Manpower", code: "OTHER_SEC" }
        ].find(c => c.name === posName);
      }

      if (cat) {
        options.push({ id: cat.id, name: cat.name });
      }
    });

    return options;
  };

  function renderSiteAllowanceAndShiftsFields() {
    if (!isSecurity) return null;

    const secCategories = categories.filter((c: any) => c.operationType === "SECURITY_GUARDING");

    return (
      <div className="space-y-4 border-t border-outline-variant pt-4 mt-4">
        {/* Site Allowance section */}
        <div className="p-4 bg-surface-container border border-outline-variant rounded-xl space-y-3">
          <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer font-bold">
            <input
              type="checkbox"
              checked={siteAllowanceApplicable}
              onChange={(e) => {
                setSiteAllowanceApplicable(e.target.checked);
                setFormSiteAllowance((prev: any) => ({
                  ...prev,
                  siteAllowanceEnabled: e.target.checked
                }));
              }}
              className="rounded border-outline-variant text-primary focus:ring-primary"
            />
            <span>Enable Site Allowance (Payroll Advisory Only)</span>
          </label>
          <p className="text-[10px] text-on-surface-variant italic">
            This is for payroll advisory only. It does not calculate salary.
          </p>

          {siteAllowanceApplicable && (
            <div className="space-y-3 pt-2 border-t border-outline-variant animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Allowance Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formSiteAllowance.siteAllowanceAmount || 0}
                    onChange={(e) => setFormSiteAllowance((prev: any) => ({
                      ...prev,
                      siteAllowanceAmount: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Frequency</label>
                  <select
                    value={formSiteAllowance.siteAllowanceFrequency || "MONTHLY"}
                    onChange={(e) => setFormSiteAllowance((prev: any) => ({
                      ...prev,
                      siteAllowanceFrequency: e.target.value
                    }))}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="HOURLY">Hourly</option>
                    <option value="PER_SHIFT">Per Shift</option>
                    <option value="PER_DAY">Per Day</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Description</label>
                <textarea
                  value={formSiteAllowance.allowanceDescription || ""}
                  onChange={(e) => setFormSiteAllowance((prev: any) => ({
                    ...prev,
                    allowanceDescription: e.target.value
                  }))}
                  rows={2}
                  placeholder="Details about this allowance..."
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Effective From</label>
                  <input
                    type="date"
                    required
                    value={formSiteAllowance.effectiveFrom ? formSiteAllowance.effectiveFrom.substring(0, 10) : ""}
                    onChange={(e) => setFormSiteAllowance((prev: any) => ({
                      ...prev,
                      effectiveFrom: e.target.value
                    }))}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Effective To (Optional)</label>
                  <input
                    type="date"
                    value={formSiteAllowance.effectiveTo ? formSiteAllowance.effectiveTo.substring(0, 10) : ""}
                    onChange={(e) => setFormSiteAllowance((prev: any) => ({
                      ...prev,
                      effectiveTo: e.target.value
                    }))}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={formSiteAllowance.appliesToAllPositions !== false}
                    onChange={(e) => setFormSiteAllowance((prev: any) => ({
                      ...prev,
                      appliesToAllPositions: e.target.checked
                    }))}
                    className="rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span>Applies to all guard positions</span>
                </label>

                {formSiteAllowance.appliesToAllPositions === false && (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Specific Position</label>
                    <select
                      required
                      value={formSiteAllowance.position || ""}
                      onChange={(e) => setFormSiteAllowance((prev: any) => ({
                        ...prev,
                        position: e.target.value
                      }))}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    >
                      <option value="">Select Position...</option>
                      {secCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Site Shifts requirements section */}
        <div className="p-4 bg-surface-container border border-outline-variant rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="block text-[10px] font-bold text-primary uppercase tracking-wider font-mono">Site Shift Requirements</span>
            <button
              type="button"
              onClick={() => {
                const options = getSiteShiftPositionOptions();
                const firstPermanent = siteAllocations.find(a => Number(a.allocatedToThis || 0) > 0);
                let defaultCategoryId = "";
                if (firstPermanent) {
                  const matched = options.find(o => o.name === firstPermanent.position);
                  if (matched) defaultCategoryId = matched.id;
                }
                if (!defaultCategoryId) {
                  const firstReliever = siteRelieverAllocations.find(a => Number(a.allocatedToThis || 0) > 0);
                  if (firstReliever) {
                    const matched = options.find(o => o.name === firstReliever.position);
                    if (matched) defaultCategoryId = matched.id;
                  }
                }
                if (!defaultCategoryId && options.length > 0) {
                  defaultCategoryId = options[0].id;
                }

                setFormSiteShifts(prev => [
                  ...prev,
                  {
                    id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    shiftCode: "Custom Shift",
                    shiftStartTime: "08:00",
                    shiftEndTime: "20:00",
                    requiredCount: 1,
                    requiredRelieverCount: 0,
                    categoryId: defaultCategoryId,
                    isInherited: false,
                    isOverride: false
                  }
                ]);
              }}
              className="px-2.5 py-1 text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
            >
              + Add Custom Shift
            </button>
          </div>

          {formSiteShifts.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant italic">No shift requirements defined for this site.</p>
          ) : (
            <div className="space-y-3">
              {formSiteShifts.map((shift, idx) => (
                <div key={shift.id || idx} className="p-3 bg-surface-container-low border border-outline-variant rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant">
                      {shift.isInherited ? (shift.isOverride ? "Site Override" : "Inherited from Contract") : "Manual Site Shift"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormSiteShifts(prev => prev.filter(s => s.id !== shift.id));
                      }}
                      className="text-status-error hover:text-status-error/80 text-[10px] font-bold"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-on-surface-variant mb-0.5">Shift Name</label>
                      <input
                        type="text"
                        required
                        value={shift.shiftCode || ""}
                        onChange={(e) => {
                          const updated = [...formSiteShifts];
                          updated[idx].shiftCode = e.target.value;
                          if (updated[idx].isInherited) updated[idx].isOverride = true;
                          setFormSiteShifts(updated);
                        }}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs focus:outline-none focus:border-primary text-on-surface"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-on-surface-variant mb-0.5">Position</label>
                      <select
                        required
                        value={shift.categoryId || ""}
                        onChange={(e) => {
                          const updated = [...formSiteShifts];
                          updated[idx].categoryId = e.target.value;
                          if (updated[idx].isInherited) updated[idx].isOverride = true;
                          setFormSiteShifts(updated);
                        }}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs focus:outline-none focus:border-primary text-on-surface"
                      >
                        <option value="">Select Position...</option>
                        {getSiteShiftPositionOptions().map(opt => {
                          const isReliever = siteRelieverAllocations.some((ra: any) => ra.position === opt.name);
                          return (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}{isReliever ? " (Reliever)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-on-surface-variant mb-0.5">Start Time</label>
                      <input
                        type="time"
                        required
                        value={shift.shiftStartTime || ""}
                        onChange={(e) => {
                          const updated = [...formSiteShifts];
                          updated[idx].shiftStartTime = e.target.value;
                          if (updated[idx].isInherited) updated[idx].isOverride = true;
                          setFormSiteShifts(updated);
                        }}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs focus:outline-none focus:border-primary text-on-surface"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-on-surface-variant mb-0.5">End Time</label>
                      <input
                        type="time"
                        required
                        value={shift.shiftEndTime || ""}
                        onChange={(e) => {
                          const updated = [...formSiteShifts];
                          updated[idx].shiftEndTime = e.target.value;
                          if (updated[idx].isInherited) updated[idx].isOverride = true;
                          setFormSiteShifts(updated);
                        }}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs focus:outline-none focus:border-primary text-on-surface"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-on-surface-variant mb-0.5">Required Headcount</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={shift.requiredCount || 0}
                        onChange={(e) => {
                          const updated = [...formSiteShifts];
                          updated[idx].requiredCount = parseInt(e.target.value, 10) || 0;
                          if (updated[idx].isInherited) updated[idx].isOverride = true;
                          setFormSiteShifts(updated);
                        }}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs focus:outline-none focus:border-primary text-on-surface"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-on-surface-variant mb-0.5">Required Relievers</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={shift.requiredRelieverCount || 0}
                        onChange={(e) => {
                          const updated = [...formSiteShifts];
                          updated[idx].requiredRelieverCount = parseInt(e.target.value, 10) || 0;
                          if (updated[idx].isInherited) updated[idx].isOverride = true;
                          setFormSiteShifts(updated);
                        }}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs focus:outline-none focus:border-primary text-on-surface"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderSecurityContractForm() {
    const currentScope = isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";
    const filteredClients = clients.filter((c: any) => c.operationType === currentScope);
    
    const secCategories = categories.filter((c: any) => c.operationType === "SECURITY_GUARDING");
    const fallbackCategories = [
      { id: "PM-CAT-SEC-01", name: "CCTV Operator", code: "CCTV" },
      { id: "PM-CAT-SEC-02", name: "Security Guard", code: "GUARD" },
      { id: "PM-CAT-SEC-03", name: "Head Guard", code: "HEAD_GUARD" },
      { id: "PM-CAT-SEC-04", name: "Security Supervisor", code: "SEC_SUPERVISOR" },
      { id: "PM-CAT-SEC-06", name: "Reliever Guard", code: "RELIEVER_GUARD" },
      { id: "PM-CAT-SEC-07", name: "Patrolling Supervisor", code: "PATROL_SUPERVISOR" },
      { id: "PM-CAT-SEC-08", name: "Patrolling Guard", code: "PATROL_GUARD" },
      { id: "PM-CAT-SEC-09", name: "Project Coordinator", code: "COORDINATOR" },
      { id: "PM-CAT-SEC-10", name: "Event Guard", code: "EVENT_GUARD" },
      { id: "PM-CAT-SEC-11", name: "Other Security Manpower", code: "OTHER_SEC" }
    ];
    const displayCategories = secCategories.length > 0 ? secCategories : fallbackCategories;
    
    // Filter materials by scope
    const allowedMaterials = materialsList.filter((m: any) => {
      if (!m.isActive) return false;
      if (m.operationType === "SHARED") return true;
      return m.operationType === currentScope;
    });

    const manpowerReqs = formData.manpowerRequirements || [];
    const totalManpower = manpowerReqs.reduce((sum: number, r: any) => sum + (parseInt(r.quantity, 10) || 0), 0);
    const relieverReqs = formData.relieverRequirements || [];
    const totalRelievers = relieverReqs.reduce((sum: number, r: any) => sum + (parseInt(r.quantity, 10) || 0), 0);
    const shiftReqs = formData.shiftRequirements || [];
    const shiftCount = shiftReqs.length;
    
    const materialReqs = formData.materials || [];

    // Sum of values
    const totalManpowerValue = manpowerReqs.reduce((sum: number, r: any) => {
      if (r.isFoc) return sum;
      const qty = parseInt(r.quantity, 10) || 0;
      const price = parseFloat(r.unitPrice) || 0;
      const periodCount = parseInt(r.billingPeriodCount, 10) || 1;
      return sum + (qty * price * periodCount);
    }, 0);

    const totalMaterialValue = materialReqs.reduce((sum: number, r: any) => {
      if (r.isFoc) return sum;
      const qty = parseInt(r.quantity, 10) || 0;
      const price = parseFloat(r.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);

    const totalContractValue = totalManpowerValue + totalMaterialValue;
    const focManpowerCount = manpowerReqs.reduce((sum: number, r: any) => sum + (r.isFoc ? (parseInt(r.quantity, 10) || 0) : 0), 0);
    const focMaterialCount = materialReqs.reduce((sum: number, r: any) => sum + (r.isFoc ? (parseInt(r.quantity, 10) || 0) : 0), 0);

    const validationErrors: string[] = [];
    if (!formData.clientId) validationErrors.push("Client is required.");
    if (!formData.title) validationErrors.push("Contract Title is required.");
    if (!formData.startDate) validationErrors.push("Start Date is required.");
    if (!formData.endDate) validationErrors.push("End Date is required.");
    if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      validationErrors.push("End Date must be greater than or equal to Start Date.");
    }
    
    const activeErrors: string[] = [];
    if (isSecurity) {
      if (manpowerReqs.length === 0) activeErrors.push("At least one manpower requirement is required.");
      if (manpowerReqs.some((r: any) => !r.position || !r.quantity || r.quantity <= 0)) {
        activeErrors.push("All manpower quantities must be greater than 0.");
      }
      if (formData.relieverRequired === "Yes") {
        if (relieverReqs.length === 0) activeErrors.push("At least one reliever requirement is required when Reliever Required = Yes.");
        if (relieverReqs.some((r: any) => !r.position || !r.quantity || r.quantity <= 0)) {
          activeErrors.push("All reliever quantities must be greater than 0.");
        }
      }
      if (shiftReqs.length === 0) activeErrors.push("At least one shift requirement is required.");
      if (shiftReqs.some((r: any) => !r.shiftName || !r.startTime || !r.endTime || !r.postsCovered || r.postsCovered <= 0)) {
        activeErrors.push("All shifts must have valid name, times, and posts > 0.");
      }
    }

    if (materialReqs.some((m: any) => !m.itemName || !m.quantity || m.quantity <= 0)) {
      activeErrors.push("All material line items must have a valid item selected and quantity > 0.");
    }

    const isDraftDisabled = !formData.clientId || !formData.title || !formData.startDate || !formData.endDate || (new Date(formData.endDate) < new Date(formData.startDate));
    const isCreateDisabled = isDraftDisabled || activeErrors.length > 0 || validationErrors.length > 0;

    return (
      <div className="space-y-6 text-on-surface">
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Basic Contract Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Client *</label>
                <select
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  value={formData.clientId || ""}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                >
                  <option value="">Select Client...</option>
                  {filteredClients.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QP HQ Security Guarding 2026"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  value={formData.title || ""}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks / Notes (Optional)</label>
                <textarea
                  placeholder="Enter remarks..."
                  rows={2}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface resize-none"
                  value={formData.remarks || ""}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract Number</label>
                <input
                  type="text"
                  disabled
                  placeholder="Auto-generated (SCON-XXXX)"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                  value={formData.contractNumber || ""}
                />
              </div>
              
              {/* Duration Auto-Calculation Section */}
              <div className="bg-surface-container/60 border border-outline-variant/40 p-3 rounded-lg space-y-3">
                <span className="block text-[10px] font-bold text-primary uppercase tracking-wider">Contract Duration Calculator</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Start Date *</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                      value={formData.startDate || ""}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const num = parseInt(formData.durationNumber, 10) || 0;
                        const unit = formData.durationUnit || "Month";
                        const newEnd = calculateEndDate(newStart, num, unit);
                        setFormData({
                          ...formData,
                          startDate: newStart,
                          endDate: newEnd || formData.endDate,
                          totalDurationDays: calculateDurationDays(newStart, newEnd || formData.endDate)
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Duration Value</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 12"
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                      value={formData.durationNumber || ""}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10) || 0;
                        const unit = formData.durationUnit || "Month";
                        const newEnd = calculateEndDate(formData.startDate, num, unit);
                        setFormData({
                          ...formData,
                          durationNumber: e.target.value === "" ? null : num,
                          endDate: newEnd || formData.endDate,
                          totalDurationDays: calculateDurationDays(formData.startDate, newEnd || formData.endDate)
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Duration Unit</label>
                    <select
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                      value={formData.durationUnit || "Month"}
                      onChange={(e) => {
                        const unit = e.target.value;
                        const num = parseInt(formData.durationNumber, 10) || 0;
                        const newEnd = calculateEndDate(formData.startDate, num, unit);
                        setFormData({
                          ...formData,
                          durationUnit: unit,
                          endDate: newEnd || formData.endDate,
                          totalDurationDays: calculateDurationDays(formData.startDate, newEnd || formData.endDate)
                        });
                      }}
                    >
                      <option value="Day">Day(s)</option>
                      <option value="Month">Month(s)</option>
                      <option value="Year">Year(s)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">End Date (Inclusive) *</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                      value={formData.endDate || ""}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        setFormData({
                          ...formData,
                          endDate: newEnd,
                          totalDurationDays: calculateDurationDays(formData.startDate, newEnd)
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="text-[10px] text-on-surface-variant text-right italic pt-1">
                  Duration Period: <span className="font-bold text-primary">{formData.totalDurationDays || 0} inclusive days</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract Status</label>
                <select
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  value={formData.status || "DRAFT"}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Manpower Requirements Grid (Security Guarding Only) */}
        {isSecurity && (
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Manpower Requirements *</h4>
              <button
                type="button"
                onClick={addManpowerRow}
                className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">add</span> Add Line
              </button>
            </div>
            {manpowerReqs.length === 0 ? (
              <p className="text-[11px] text-on-surface-variant italic py-2">No manpower requirements added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                      <th className="pb-2 pr-2">Position Category *</th>
                      <th className="pb-2 pr-2 w-16">Qty *</th>
                      <th className="pb-2 pr-2 w-24">Unit Price *</th>
                      <th className="pb-2 pr-2 w-28">Billing Freq *</th>
                      <th className="pb-2 pr-2 w-16">Periods *</th>
                      <th className="pb-2 pr-2 w-14 text-center">FOC</th>
                      <th className="pb-2 pr-2 w-20 text-right">Line Total</th>
                      <th className="pb-2 pr-2">Remarks</th>
                      <th className="pb-2 w-8 text-right">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {manpowerReqs.map((row: any, idx: number) => (
                      <tr key={row.id || idx} className="hover:bg-surface-container-lowest/40">
                        <td className="py-2 pr-2">
                          <select
                            required
                            value={row.position || ""}
                            onChange={(e) => updateManpowerRow(idx, "position", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          >
                            <option value="">Select Position...</option>
                            {displayCategories.map((c: any) => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            required
                            min="1"
                            value={row.quantity || ""}
                            onChange={(e) => updateManpowerRow(idx, "quantity", parseInt(e.target.value, 10))}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={row.unitPrice || 0}
                            onChange={(e) => updateManpowerRow(idx, "unitPrice", parseFloat(e.target.value))}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            required
                            value={row.billingFrequency || "Monthly"}
                            onChange={(e) => updateManpowerRow(idx, "billingFrequency", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                          >
                            <option value="Hourly">Hourly</option>
                            <option value="Daily">Daily</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Lumpsum">Lumpsum</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            required
                            min="1"
                            value={row.billingPeriodCount || 1}
                            onChange={(e) => updateManpowerRow(idx, "billingPeriodCount", parseInt(e.target.value, 10))}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!row.isFoc}
                            onChange={(e) => updateManpowerRow(idx, "isFoc", e.target.checked)}
                            className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                        </td>
                        <td className="py-2 pr-2 text-right font-bold text-[11px] text-on-surface">
                          {(row.lineTotal || 0).toFixed(2)}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={row.remarks || ""}
                            placeholder="Notes"
                            onChange={(e) => updateManpowerRow(idx, "remarks", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none text-[11px]"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => deleteManpowerRow(idx)}
                            className="text-status-error hover:bg-status-error/10 p-1 rounded"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Reliever Requirements Grid (Security Guarding Only) */}
        {isSecurity && (
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1">
              <div className="flex items-center gap-4">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Reliever Requirements</h4>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-[11px] text-on-surface-variant uppercase">Reliever Required?</span>
                  <select
                    value={formData.relieverRequired || "No"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        relieverRequired: val,
                        relieverRequirements: val === "Yes" ? (formData.relieverRequirements || []) : []
                      });
                    }}
                    className="bg-surface-container-lowest border border-outline-variant rounded px-2 py-0.5 text-xs font-bold"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>
              {formData.relieverRequired === "Yes" && (
                <button
                  type="button"
                  onClick={addRelieverRow}
                  className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[12px]">add</span> Add Line
                </button>
              )}
            </div>
            {formData.relieverRequired === "Yes" ? (
              relieverReqs.length === 0 ? (
                <p className="text-[11px] text-on-surface-variant italic py-2">No reliever requirements added yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                        <th className="pb-2 pr-2">Reliever Position *</th>
                        <th className="pb-2 pr-2 w-24">Qty *</th>
                        <th className="pb-2 pr-2 w-48">Source Preference *</th>
                        <th className="pb-2 pr-2">Remarks</th>
                        <th className="pb-2 w-10 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {relieverReqs.map((row: any, idx: number) => (
                        <tr key={row.id || idx} className="hover:bg-surface-container-lowest/40">
                          <td className="py-2 pr-2">
                            <select
                              required
                              value={row.position || ""}
                              onChange={(e) => updateRelieverRow(idx, "position", e.target.value)}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                            >
                              <option value="">Select Reliever Position...</option>
                              <option value="Reliever Guard">Reliever Guard</option>
                              <option value="Head Guard">Head Guard</option>
                              <option value="Supervisor Reliever">Supervisor Reliever</option>
                              <option value="Patrolling Reliever">Patrolling Reliever</option>
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              required
                              min="1"
                              value={row.quantity || ""}
                              onChange={(e) => updateRelieverRow(idx, "quantity", parseInt(e.target.value, 10))}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              required
                              value={row.sourcePreference || "General Pool"}
                              onChange={(e) => updateRelieverRow(idx, "sourcePreference", e.target.value)}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                            >
                              <option value="Fixed Project Reliever">Fixed Project Reliever</option>
                              <option value="Site Reliever">Site Reliever</option>
                              <option value="General Pool">General Pool</option>
                              <option value="Emergency">Emergency</option>
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={row.remarks || ""}
                              placeholder="Optional notes"
                              onChange={(e) => updateRelieverRow(idx, "remarks", e.target.value)}
                              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => deleteRelieverRow(idx)}
                              className="text-status-error hover:bg-status-error/10 p-1 rounded"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <p className="text-[11px] text-on-surface-variant/70 italic">Relievers are not required for this contract.</p>
            )}
          </div>
        )}

        {/* Shift Requirements Grid (Security Guarding Only) */}
        {isSecurity && (
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Shift Requirements *</h4>
              <button
                type="button"
                onClick={addShiftRow}
                className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">add</span> Add Line
              </button>
            </div>
            {shiftReqs.length === 0 ? (
              <p className="text-[11px] text-on-surface-variant italic py-2">No shift requirements added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                      <th className="pb-2 pr-2 w-36">Shift Name *</th>
                      <th className="pb-2 pr-2 w-28">Start *</th>
                      <th className="pb-2 pr-2 w-28">End *</th>
                      <th className="pb-2 pr-2 w-24">Posts Covered *</th>
                      <th className="pb-2 pr-2 w-32">Days Pattern *</th>
                      <th className="pb-2 pr-2">Remarks</th>
                      <th className="pb-2 w-10 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {shiftReqs.map((row: any, idx: number) => (
                      <tr key={row.id || idx} className="hover:bg-surface-container-lowest/40">
                        <td className="py-2 pr-2">
                          <select
                            required
                            value={row.shiftName || "Day Shift"}
                            onChange={(e) => updateShiftRow(idx, "shiftName", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none font-semibold text-on-surface"
                          >
                            <option value="Day Shift">Day Shift</option>
                            <option value="Night Shift">Night Shift</option>
                            <option value="24 Hours">24 Hours</option>
                            <option value="Custom">Custom</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="time"
                            required
                            value={row.startTime || "07:00"}
                            onChange={(e) => updateShiftRow(idx, "startTime", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="time"
                            required
                            value={row.endTime || "19:00"}
                            onChange={(e) => updateShiftRow(idx, "endTime", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            required
                            min="1"
                            value={row.postsCovered || ""}
                            onChange={(e) => updateShiftRow(idx, "postsCovered", parseInt(e.target.value, 10))}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            required
                            value={row.daysPattern || "Daily"}
                            onChange={(e) => updateShiftRow(idx, "daysPattern", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          >
                            <option value="Daily">Daily</option>
                            <option value="Weekdays">Weekdays</option>
                            <option value="Weekend">Weekend</option>
                            <option value="Custom">Custom</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={row.remarks || ""}
                            placeholder="e.g. main entrance"
                            onChange={(e) => updateShiftRow(idx, "remarks", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => deleteShiftRow(idx)}
                            className="text-status-error hover:bg-status-error/10 p-1 rounded"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Contract Material Line Items Grid (Both SG and FM) */}
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
          <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Contract Materials / Consumables</h4>
            <button
              type="button"
              onClick={addMaterialRow}
              className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[12px]">add</span> Add Material
            </button>
          </div>
          {materialReqs.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant italic py-2">No materials added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                    <th className="pb-2 pr-2">Material / Item Name *</th>
                    <th className="pb-2 pr-2 w-20">Qty *</th>
                    <th className="pb-2 pr-2 w-20">UOM</th>
                    <th className="pb-2 pr-2 w-24">Unit Price *</th>
                    <th className="pb-2 pr-2 w-14 text-center">FOC</th>
                    <th className="pb-2 pr-2 w-24 text-right">Line Total</th>
                    <th className="pb-2 pr-2">Remarks</th>
                    <th className="pb-2 w-8 text-right">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {materialReqs.map((row: any, idx: number) => (
                    <tr key={row.id || idx} className="hover:bg-surface-container-lowest/40">
                      <td className="py-2 pr-2">
                        <select
                          required
                          value={row.materialId || ""}
                          onChange={(e) => updateMaterialRow(idx, "materialId", e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none"
                        >
                          <option value="">Select Material...</option>
                          {allowedMaterials.map((m: any) => (
                            <option key={m.id} value={m.id}>{m.materialName} ({m.materialCode})</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          required
                          min="1"
                          value={row.quantity || ""}
                          onChange={(e) => updateMaterialRow(idx, "quantity", parseInt(e.target.value, 10))}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 pr-2 text-on-surface-variant font-semibold">
                        {row.unitOfMeasure || "Each"}
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={row.unitPrice || 0}
                          onChange={(e) => updateMaterialRow(idx, "unitPrice", parseFloat(e.target.value))}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded px-1 py-1 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!row.isFoc}
                          onChange={(e) => updateMaterialRow(idx, "isFoc", e.target.checked)}
                          className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right font-bold text-[11px] text-on-surface">
                        {(row.lineTotal || 0).toFixed(2)}
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={row.remarks || ""}
                          placeholder="Notes"
                          onChange={(e) => updateMaterialRow(idx, "remarks", e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 focus:outline-none text-[11px]"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteMaterialRow(idx)}
                          className="text-status-error hover:bg-status-error/10 p-1 rounded"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Contract Clauses & Legal Terms Form Section */}
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Contract Clauses & Legal Terms</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Payment Terms</label>
                <input
                  type="text"
                  placeholder="e.g. Standard Net 30"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  value={formData.paymentTerms || ""}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Payment Cycle</label>
                  <select
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.paymentCycle || "Monthly"}
                    onChange={(e) => setFormData({ ...formData, paymentCycle: e.target.value })}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Credit Days</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 30"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.creditDays !== undefined && formData.creditDays !== null ? formData.creditDays : ""}
                    onChange={(e) => setFormData({ ...formData, creditDays: e.target.value === "" ? 0 : parseInt(e.target.value, 10) })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Invoice Submission Day / Date</label>
                <input
                  type="text"
                  placeholder="e.g. 5th of each month"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  value={formData.invoiceSubmissionDay || ""}
                  onChange={(e) => setFormData({ ...formData, invoiceSubmissionDay: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Payment Remarks</label>
                <textarea
                  placeholder="Payment remarks..."
                  rows={2}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface resize-none"
                  value={formData.paymentRemarks || ""}
                  onChange={(e) => setFormData({ ...formData, paymentRemarks: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Termination Clause Description</label>
                <input
                  type="text"
                  placeholder="e.g. Notice period required for termination"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  value={formData.terminationClause || ""}
                  onChange={(e) => setFormData({ ...formData, terminationClause: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Notice Period (Days)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 90"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.noticePeriodDays !== undefined && formData.noticePeriodDays !== null ? formData.noticePeriodDays : ""}
                    onChange={(e) => setFormData({ ...formData, noticePeriodDays: e.target.value === "" ? 0 : parseInt(e.target.value, 10) })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Termination Penalty</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 month billing"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.terminationPenalty || ""}
                    onChange={(e) => setFormData({ ...formData, terminationPenalty: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="earlyTerminationCheck"
                  checked={!!formData.earlyTerminationAllowed}
                  onChange={(e) => setFormData({ ...formData, earlyTerminationAllowed: e.target.checked })}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="earlyTerminationCheck" className="text-xs font-semibold text-on-surface cursor-pointer">Early Termination Allowed without Cause</label>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Termination Remarks</label>
                <textarea
                  placeholder="Termination remarks..."
                  rows={2}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface resize-none"
                  value={formData.terminationRemarks || ""}
                  onChange={(e) => setFormData({ ...formData, terminationRemarks: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/40 pt-3">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Special Conditions</label>
              <textarea
                placeholder="Enter special conditions..."
                rows={2}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface resize-none"
                value={formData.specialConditions || ""}
                onChange={(e) => setFormData({ ...formData, specialConditions: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Service Level Terms (SLAs)</label>
              <textarea
                placeholder="Enter service level terms..."
                rows={2}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface resize-none"
                value={formData.serviceLevelTerms || ""}
                onChange={(e) => setFormData({ ...formData, serviceLevelTerms: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Penalty Clauses</label>
              <textarea
                placeholder="Enter penalty clauses..."
                rows={2}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface resize-none"
                value={formData.penaltyClause || ""}
                onChange={(e) => setFormData({ ...formData, penaltyClause: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Escalation Matrix</label>
              <textarea
                placeholder="Enter escalation matrix..."
                rows={2}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface resize-none"
                value={formData.escalationMatrix || ""}
                onChange={(e) => setFormData({ ...formData, escalationMatrix: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Other Contract Conditions</label>
            <textarea
              placeholder="Enter other contract conditions..."
              rows={2}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface resize-none"
              value={formData.otherContractConditions || ""}
              onChange={(e) => setFormData({ ...formData, otherContractConditions: e.target.value })}
            />
          </div>
        </div>

        {/* Centralized Approval Workflow Notice */}
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">flowsheet</span> Approval Workflow
          </h4>
          <p className="text-[11px] text-on-surface-variant font-medium">
            This contract will automatically route through the centralized approval workflow template configured in Settings.
          </p>
        </div>

        {/* Contract Totals Summary Card (Both SG and FM) */}
        <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl grid grid-cols-3 gap-6 shadow-sm">
          <div className="col-span-2 space-y-4">
            <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider border-b border-primary/10 pb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">summarize</span> Commercial Summary
            </h4>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs">
              <div className="flex justify-between items-center bg-surface-container-lowest/50 px-3 py-2 rounded-lg border border-outline-variant/20">
                <span className="text-on-surface-variant font-medium">Manpower Value:</span>
                <span className="font-bold text-on-surface text-[13px]">{totalManpowerValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center bg-surface-container-lowest/50 px-3 py-2 rounded-lg border border-outline-variant/20">
                <span className="text-on-surface-variant font-medium">Material Value:</span>
                <span className="font-bold text-on-surface text-[13px]">{totalMaterialValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center bg-surface-container-lowest/50 px-3 py-2 rounded-lg border border-outline-variant/20">
                <span className="text-on-surface-variant font-medium">FOC Manpower:</span>
                <span className="font-bold text-status-warning">{focManpowerCount} guards</span>
              </div>
              <div className="flex justify-between items-center bg-surface-container-lowest/50 px-3 py-2 rounded-lg border border-outline-variant/20">
                <span className="text-on-surface-variant font-medium">FOC Materials:</span>
                <span className="font-bold text-status-warning">{focMaterialCount} items</span>
              </div>
            </div>
            
            <div className="bg-primary/10 border border-primary/20 p-3.5 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Total Contract Value:</span>
              <span className="text-lg font-black text-primary">
                QAR {totalContractValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          
          <div className="border-l border-outline-variant/50 pl-6 space-y-4">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status & Blockers</h5>
            {validationErrors.length > 0 ? (
              <div className="space-y-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-status-error/15 text-status-error border border-status-error/20">
                  Missing Details
                </span>
                <ul className="list-disc pl-3 text-[10px] text-status-error font-medium space-y-1">
                  {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            ) : activeErrors.length > 0 ? (
              <div className="space-y-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-status-warning/15 text-status-warning border border-status-warning/20">
                  Ready as Draft Only
                </span>
                <ul className="list-disc pl-3 text-[10px] text-on-surface-variant space-y-1">
                  {activeErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            ) : (
              <div className="space-y-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-status-success/15 text-status-success border border-status-success/20">
                  Validated & Ready
                </span>
                <p className="text-[10px] text-on-surface-variant italic">All mandatory requirements logged. You can finalize contract activation.</p>
              </div>
            )}
            
            <div className="text-[10px] text-on-surface-variant bg-surface-container-low p-2 rounded-lg border border-outline-variant/30">
              <span className="font-bold text-[9px] block text-on-surface uppercase mb-0.5">Timeline Summary</span>
              <span>{formData.startDate || "—"} to {formData.endDate || "—"}</span>
              <span className="block font-bold text-primary mt-0.5">{formData.totalDurationDays || 0} Days</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low -mx-6 -mb-6 rounded-b-xl mt-4">
          <button
            type="button"
            onClick={() => {
              setShowAddModal(false);
              setEditItem(null);
              setFormData({});
            }}
            className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDraftDisabled}
            onClick={() => handleSaveContract("DRAFT")}
            className={`px-3 py-2 text-xs font-bold rounded-lg border border-outline-variant transition-colors ${
              isDraftDisabled ? "opacity-40 cursor-not-allowed text-on-surface-variant" : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface"
            }`}
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={isCreateDisabled}
            onClick={() => handleSaveContract("ACTIVE")}
            className={`px-3 py-2 text-white text-xs font-bold rounded-lg transition-colors ${
              isCreateDisabled ? "opacity-40 cursor-not-allowed bg-primary/40" : "bg-primary hover:bg-primary-container"
            }`}
          >
            Create Contract
          </button>
        </div>
      </div>
    );
  }  const renderEnhancedCustomerForm = (isEdit: boolean) => {
    const customerType = formData.customerType || "COMPANY";
    
    const handleTypeChange = (newType: string) => {
      if (isEdit) {
        let warnMsg = "Changing the customer type will change the profile layout. ";
        if (formData.contracts?.length > 0 || formData.documents?.length > 0) {
          warnMsg += "Warning: This client already has associated contracts or documents. Are you sure you want to change the customer type?";
        } else {
          warnMsg += "Are you sure you want to proceed?";
        }
        if (!confirm(warnMsg)) return;
      }
      setFormData({
        ...formData,
        customerType: newType
      });
    };
    
    return (
      <div className="space-y-6 text-on-surface">
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Customer Type *</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="radio"
                name="customerType"
                value="COMPANY"
                checked={customerType === "COMPANY"}
                onChange={() => handleTypeChange("COMPANY")}
                className="text-primary focus:ring-primary"
              />
              Company / Corporate
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="radio"
                name="customerType"
                value="INDIVIDUAL"
                checked={customerType === "INDIVIDUAL"}
                onChange={() => handleTypeChange("INDIVIDUAL")}
                className="text-primary focus:ring-primary"
              />
              Individual Customer
            </label>
          </div>
        </div>

        {customerType === "COMPANY" ? (
          <>
            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Basic Company Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Customer Code</label>
                  <input
                    type="text"
                    disabled
                    placeholder={isSecurity ? "Auto-generated (SC-XXXX)" : "Auto-generated (FC-XXXX)"}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                    value={formData.code || ""}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Al Hattab Group"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Trading Name / Short Name</label>
                  <input
                    type="text"
                    placeholder="e.g. AHG"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.tradingName || ""}
                    onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Business Type / Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. Construction, Logistics"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.businessType || ""}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Customer Status</label>
                  <select
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.isActive !== false ? "ACTIVE" : "INACTIVE"}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "ACTIVE" })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="General remarks..."
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.remarks || ""}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Trade License Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 123456"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.tradeLicenseNumber || ""}
                    onChange={(e) => setFormData({ ...formData, tradeLicenseNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Trade License Authority</label>
                  <input
                    type="text"
                    placeholder="e.g. MOCI"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.tradeLicenseAuthority || ""}
                    onChange={(e) => setFormData({ ...formData, tradeLicenseAuthority: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Trade License Issue Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.tradeLicenseIssueDate ? formData.tradeLicenseIssueDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, tradeLicenseIssueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Trade License Expiry Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.tradeLicenseExpiryDate ? formData.tradeLicenseExpiryDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, tradeLicenseExpiryDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Company Address</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Building / Street</label>
                  <input
                    type="text"
                    placeholder="e.g. Building 24, St 950"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.addressLine1 || ""}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Zone</label>
                  <input
                    type="text"
                    placeholder="e.g. Zone 25"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.zone || ""}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Area</label>
                  <input
                    type="text"
                    placeholder="e.g. Mansoura"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.area || ""}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Doha"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Country</label>
                  <input
                    type="text"
                    placeholder="e.g. Qatar"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.country || ""}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">PO Box</label>
                  <input
                    type="text"
                    placeholder="e.g. 12345"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.poBox || ""}
                    onChange={(e) => setFormData({ ...formData, poBox: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Google Map Location / Coordinates</label>
                  <input
                    type="text"
                    placeholder="e.g. 25.276987, 51.520008"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.mapLocation || ""}
                    onChange={(e) => setFormData({ ...formData, mapLocation: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Main Contact Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Company Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +974 4444 5555"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.mainPhone || ""}
                    onChange={(e) => setFormData({ ...formData, mainPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Company Email</label>
                  <input
                    type="email"
                    placeholder="e.g. info@company.com"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.mainEmail || ""}
                    onChange={(e) => setFormData({ ...formData, mainEmail: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Website (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. www.company.com"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.website || ""}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Operation Contact Person</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    placeholder="Name"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.operationContactName || ""}
                    onChange={(e) => setFormData({ ...formData, operationContactName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="Designation"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.operationContactDesignation || ""}
                    onChange={(e) => setFormData({ ...formData, operationContactDesignation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="Mobile"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.operationContactMobile || ""}
                    onChange={(e) => setFormData({ ...formData, operationContactMobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.operationContactEmail || ""}
                    onChange={(e) => setFormData({ ...formData, operationContactEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Finance Contact Person</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Finance Contact Name</label>
                  <input
                    type="text"
                    placeholder="Finance Contact Name"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.financeContactName || ""}
                    onChange={(e) => setFormData({ ...formData, financeContactName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="Finance Mobile"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.financeContactMobile || ""}
                    onChange={(e) => setFormData({ ...formData, financeContactMobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Billing Email</label>
                  <input
                    type="email"
                    placeholder="Billing Email"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.billingEmail || ""}
                    onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Payment Terms</label>
                  <input
                    type="text"
                    placeholder="e.g. Net 30 Days"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.paymentTerms || ""}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Company Registration / Legal Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">CR Number</label>
                  <input
                    type="text"
                    placeholder="CR Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.crNumber || ""}
                    onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">CR Expiry Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.crExpiryDate ? formData.crExpiryDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, crExpiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Tax Number / VAT Number</label>
                  <input
                    type="text"
                    placeholder="Tax/VAT Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.taxNumber || ""}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Establishment Card Number</label>
                  <input
                    type="text"
                    placeholder="Establishment Card Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.establishmentCardNumber || ""}
                    onChange={(e) => setFormData({ ...formData, establishmentCardNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Establishment Card Expiry</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.establishmentCardExpiryDate ? formData.establishmentCardExpiryDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, establishmentCardExpiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Authorized Signatory Name</label>
                  <input
                    type="text"
                    placeholder="Authorized Signatory Name"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.authorizedSignatoryName || ""}
                    onChange={(e) => setFormData({ ...formData, authorizedSignatoryName: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Personal Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Customer Code</label>
                  <input
                    type="text"
                    disabled
                    placeholder={isSecurity ? "Auto-generated (SC-XXXX)" : "Auto-generated (FC-XXXX)"}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                    value={formData.code || ""}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Nationality</label>
                  <input
                    type="text"
                    placeholder="e.g. Qatari, British"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.nationality || ""}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Date of Birth</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.dateOfBirth ? formData.dateOfBirth.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Customer Status</label>
                  <select
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.isActive !== false ? "ACTIVE" : "INACTIVE"}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "ACTIVE" })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="Notes..."
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.remarks || ""}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Individual Address</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Building / Street / Villa</label>
                  <input
                    type="text"
                    placeholder="Villa/Bldg details"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.addressLine1 || ""}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Zone</label>
                  <input
                    type="text"
                    placeholder="Zone"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.zone || ""}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Area</label>
                  <input
                    type="text"
                    placeholder="Area"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.area || ""}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">City</label>
                  <input
                    type="text"
                    placeholder="City"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Contact Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="Mobile Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.mainPhone || ""}
                    onChange={(e) => setFormData({ ...formData, mainPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.mainEmail || ""}
                    onChange={(e) => setFormData({ ...formData, mainEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    placeholder="WhatsApp Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.website || ""}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Identity Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">QID Number</label>
                  <input
                    type="text"
                    placeholder="QID Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.qidNumber || ""}
                    onChange={(e) => setFormData({ ...formData, qidNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">QID Expiry Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.qidExpiryDate ? formData.qidExpiryDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, qidExpiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Passport Number</label>
                  <input
                    type="text"
                    placeholder="Passport Number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.passportNumber || ""}
                    onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Passport Expiry</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                    value={formData.passportExpiryDate ? formData.passportExpiryDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, passportExpiryDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
          <div className="flex justify-between items-center border-b border-outline-variant/60 pb-1">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Document Metadata Attachments</h4>
            <button
              type="button"
              onClick={() => {
                const list = formData.documents || [];
                setFormData({
                  ...formData,
                  documents: [...list, { id: `doc-meta-${Date.now()}`, documentType: "Agreement / Contract Document", fileName: "document.pdf", remarks: "" }]
                });
              }}
              className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[12px]">add</span> Add Document Row
            </button>
          </div>
          {(formData.documents || []).length === 0 ? (
            <p className="text-[11px] text-on-surface-variant italic py-2">No document metadata logged.</p>
          ) : (
            <div className="space-y-3">
              {(formData.documents || []).map((doc: any, idx: number) => (
                <div key={doc.id || idx} className="grid grid-cols-4 gap-3 bg-surface-container-lowest border border-outline-variant p-3 rounded-lg relative text-xs">
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Doc Type *</label>
                    <select
                      value={doc.documentType || ""}
                      onChange={(e) => {
                        const list = [...formData.documents];
                        list[idx] = { ...list[idx], documentType: e.target.value };
                        setFormData({ ...formData, documents: list });
                      }}
                      className="w-full bg-surface-container-low border border-outline-variant rounded p-1 text-xs text-on-surface"
                    >
                      <option value="CR Copy">CR Copy</option>
                      <option value="Computer Card / Establishment Card">Establishment Card Copy</option>
                      <option value="Tax Certificate">Tax Certificate</option>
                      <option value="QID Copy">QID Copy</option>
                      <option value="Passport Copy">Passport Copy</option>
                      <option value="Authorized Signatory Document">Signatory Doc</option>
                      <option value="Authorization Letter">Authorization Letter</option>
                      <option value="Agreement / Contract Document">Agreement / Contract</option>
                      <option value="Other Documents">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">File Name</label>
                    <input
                      type="text"
                      value={doc.fileName || ""}
                      onChange={(e) => {
                        const list = [...formData.documents];
                        list[idx] = { ...list[idx], fileName: e.target.value };
                        setFormData({ ...formData, documents: list });
                      }}
                      className="w-full bg-surface-container-low border border-outline-variant rounded p-1 text-xs text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Expiry Date</label>
                    <input
                      type="date"
                      value={doc.expiryDate ? doc.expiryDate.substring(0, 10) : ""}
                      onChange={(e) => {
                        const list = [...formData.documents];
                        list[idx] = { ...list[idx], expiryDate: e.target.value };
                        setFormData({ ...formData, documents: list });
                      }}
                      className="w-full bg-surface-container-low border border-outline-variant rounded p-1 text-xs text-on-surface"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Remarks</label>
                      <input
                        type="text"
                        value={doc.remarks || ""}
                        onChange={(e) => {
                          const list = [...formData.documents];
                          list[idx] = { ...list[idx], remarks: e.target.value };
                          setFormData({ ...formData, documents: list });
                        }}
                        className="w-full bg-surface-container-low border border-outline-variant rounded p-1 text-xs text-on-surface"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const list = [...formData.documents];
                        list.splice(idx, 1);
                        setFormData({ ...formData, documents: list });
                      }}
                      className="text-status-error hover:bg-status-error/10 p-1 rounded mt-3"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-1">Internal Sales Person</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Account Manager Name</label>
              <input
                type="text"
                placeholder="Name"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                value={formData.internalSalesPersonName || ""}
                onChange={(e) => setFormData({ ...formData, internalSalesPersonName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mobile Number</label>
              <input
                type="text"
                placeholder="AM Mobile"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                value={formData.internalSalesPersonMobile || ""}
                onChange={(e) => setFormData({ ...formData, internalSalesPersonMobile: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const loggedInCoordinatorId = (session?.user as any)?.id;
  const isManagerOrAdmin = hasPermission(session?.user as any, "manpower.admin.full_access") ||
                           hasPermission(session?.user as any, isSecurity ? "manpower.security.manage" : "manpower.fm.manage");

  const myAssignments = isManagerOrAdmin
    ? data
    : data.filter((item: any) => item.coordinatorEmployeeId === loggedInCoordinatorId);

  const assignedProjectIds = myAssignments.map((a: any) => a.projectId);
  const mySites = sites.filter((site: any) => isManagerOrAdmin || assignedProjectIds.includes(site.projectId));
  const myDeployments = deploymentsList.filter((d: any) => 
    isManagerOrAdmin || assignedProjectIds.includes(d.shiftRequirement?.site?.projectId)
  );

  const displaySites = mySites.length > 0 ? mySites : [
    { id: "mock-site-1", name: "Al Jazeera HQ Main Gate", projectId: "mock-proj-1", code: "SSITE-001" },
    { id: "mock-site-2", name: "Bin Omran Accommodation Post", projectId: "mock-proj-2", code: "SSITE-002" }
  ];

  const getPlannedGuardsForSite = (siteId: string) => {
    const realDeps = myDeployments.filter((d: any) => d.shiftRequirement?.siteId === siteId);
    if (realDeps.length > 0) {
      return realDeps.flatMap((d: any) => d.assignments.map((asg: any) => ({
        id: asg.id,
        employeeId: asg.employeeId || asg.employee?.id,
        employeeName: asg.employee?.name || "Security Guard",
        shiftCode: d.shiftRequirement?.shiftCode || "GEN-001",
        timing: `${d.shiftRequirement?.shiftStartTime || "06:00"} - ${d.shiftRequirement?.shiftEndTime || "18:00"}`,
        postName: d.shiftRequirement?.locationUnit?.name || "Main Post"
      })));
    }
    if (siteId === "mock-site-1") {
      return [
        { id: "guard-1", employeeId: "SG-001", employeeName: "Ahmed Ali", shiftCode: "GEN-001", timing: "06:00 - 18:00", postName: "Main Entrance Gate" },
        { id: "guard-2", employeeId: "SG-002", employeeName: "Joseph Kurian", shiftCode: "GEN-001", timing: "06:00 - 18:00", postName: "Reception Desk" }
      ];
    } else {
      return [
        { id: "guard-3", employeeId: "SG-003", employeeName: "Subash Thapa", shiftCode: "GEN-002", timing: "18:00 - 06:00", postName: "Rear Boundary Patrol" }
      ];
    }
  };

  const lookupGuardName = (code: string): { name: string; error?: string } => {
    if (!code || code.trim() === "") return { name: "" };
    const normalized = code.trim().toLowerCase();
    
    // 1. Search in workforceEmployees (which holds the security-guarding synced directory)
    const foundInDirectory = workforceEmployees.find((emp: any) => 
      emp.id?.toLowerCase() === normalized ||
      emp.employeeCode?.toLowerCase() === normalized ||
      emp.username?.toLowerCase() === normalized
    );
    if (foundInDirectory) {
      return { name: foundInDirectory.name };
    }

    // 2. Search in deploymentsList assignments
    for (const dep of deploymentsList) {
      if (dep.assignments) {
        for (const asg of dep.assignments) {
          const emp = asg.employee;
          if (emp) {
            if (
              emp.id?.toLowerCase() === normalized ||
              emp.employeeCode?.toLowerCase() === normalized ||
              emp.username?.toLowerCase() === normalized
            ) {
              return { name: emp.name };
            }
          }
        }
      }
    }

    return { 
      name: "", 
      error: "Guard not found in Security Guarding manpower directory or today’s deployment." 
    };
  };

  const addViolationRow = (itemCode: string) => {
    const currentList = guardViolations[itemCode] || [];
    const newRow = {
      id: Math.random().toString(36).substring(2, 9),
      employeeCode: "",
      employeeName: "",
      postName: "",
      remarks: "",
      actionTaken: "",
      errorMsg: undefined
    };
    setGuardViolations({
      ...guardViolations,
      [itemCode]: [...currentList, newRow]
    });
  };

  const removeViolationRow = (itemCode: string, rowId: string) => {
    const currentList = guardViolations[itemCode] || [];
    setGuardViolations({
      ...guardViolations,
      [itemCode]: currentList.filter(row => row.id !== rowId)
    });
  };

  const updateViolationRow = (itemCode: string, rowId: string, fields: any) => {
    const currentList = guardViolations[itemCode] || [];
    const updatedList = currentList.map(row => {
      if (row.id === rowId) {
        const merged = { ...row, ...fields };
        if (fields.hasOwnProperty("employeeCode")) {
          const lookup = lookupGuardName(fields.employeeCode);
          merged.employeeName = lookup.name;
          merged.errorMsg = lookup.error;
        }
        return merged;
      }
      return row;
    });
    setGuardViolations({
      ...guardViolations,
      [itemCode]: updatedList
    });
  };

  async function handleSavePatrolVisit(site: any) {
    if (!site) return;
    try {
      const payload = {
        siteId: site.id,
        siteName: site.name,
        coordinatorId: loggedInCoordinatorId || "SCA-MOCK",
        coordinatorName: session?.user?.name || "Patrolling Supervisor",
        verifications: verificationRecords,
        checklist: checklistAnswers,
        guardViolations: guardViolations,
        incidents: Object.keys(incidentForm).some(k => incidentForm[k]) ? [incidentForm] : [],
        replacements: Object.keys(replacementForm).some(k => replacementForm[k]) ? [replacementForm] : [],
        clientNotes: Object.keys(clientNoteForm).some(k => clientNoteForm[k]) ? [clientNoteForm] : [],
        operationType: "SECURITY_GUARDING"
      };

      const res = await fetch("/api/v1/security/patrols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(`Patrol Visit report for ${site.name} saved successfully!`);
        setShowPatrolDrawer(false);
        loadPatrolData();
        setVerificationRecords({});
        setChecklistAnswers({});
        setGuardViolations({});
        setIncidentForm({
          severity: "Medium",
          type: "Security breach",
          status: "Open",
          escalatedTo: "Operations Coordinator",
          followUpRequired: "No",
          peopleInvolved: "",
          description: "",
          immediateAction: ""
        });
        setReplacementForm({
          reason: "Absent",
          criticalPost: "No",
          status: "Requested",
          notifiedOperations: "Yes",
          replacementRequiredFrom: new Date().toISOString().substring(11, 16),
          remarks: ""
        });
        setClientNoteForm({
          feedback: "Neutral",
          escalationRequired: "No",
          clientRep: "",
          complaint: "",
          specialInstruction: "",
          additionalManpower: "No",
          requestedQty: 0,
          remarks: ""
        });
      } else {
        alert("Failed to save patrol visit report");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving patrol visit");
    }
  }

  async function handleSubmitDailyReport() {
    try {
      const payload = {
        coordinatorId: loggedInCoordinatorId || "SCA-MOCK",
        coordinatorName: session?.user?.name || "Patrolling Supervisor",
        date: new Date().toISOString().split("T")[0],
        sitesVisited: displaySites.map((s: any) => s.name),
        guardsCheckedCount: displaySites.reduce((acc: number, s: any) => acc + getPlannedGuardsForSite(s.id).length, 0),
        status: "SUBMITTED",
        operationType: "SECURITY_GUARDING"
      };

      const res = await fetch("/api/v1/security/patrols/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("Daily Patrol Report submitted successfully to Operations Coordinator!");
        loadPatrolData();
      } else {
        alert("Failed to submit daily patrol report");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting daily patrol report");
    }
  }

  function renderPatrolOperationsBoard() {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayPatrols = patrolVisitsList.filter(p => p.createdAt?.startsWith(todayStr) || p.id);
    const patrolsCompleted = todayPatrols.length;

    let guardsVerified = 0;
    let absencesCount = 0;
    let openIncidentsCount = 0;
    let replacementsCount = 0;

    todayPatrols.forEach(p => {
      if (p.verifications) {
        Object.values(p.verifications).forEach((v: any) => {
          guardsVerified++;
          if (v.status === "Absent" || v.status === "Late" || v.status === "Left Post") {
            absencesCount++;
          }
        });
      }
      if (p.incidents) {
        openIncidentsCount += p.incidents.length;
      }
      if (p.replacements) {
        replacementsCount += p.replacements.filter((r: any) => r.status === "Requested").length;
      }
    });

    const totalPlanned = displaySites.reduce((acc: number, s: any) => acc + getPlannedGuardsForSite(s.id).length, 0);

    const checklistSections = [
      {
        title: "Access Points",
        items: [
          "Main gate checked",
          "Entry point checked",
          "Exit point checked",
          "Vehicle checking process followed",
          "Visitor register maintained",
          "Contractor entry controlled"
        ]
      },
      {
        title: "Site Areas",
        items: [
          "Parking area checked",
          "Boundary wall checked",
          "Sensitive area checked",
          "Guard rest area checked",
          "CCTV/control room checked, if applicable"
        ]
      },
      {
        title: "Guard Behavior",
        items: [
          "Guards alert",
          "Guards not sleeping",
          "Guards not misusing mobile phone",
          "Guards not away from post",
          "Guards understand post orders",
          "Guards following client instructions"
        ]
      },
      {
        title: "Documents & Equipment",
        items: [
          "Site logbook available",
          "Visitor register available",
          "Vehicle register available",
          "Gate pass register available",
          "Torch available",
          "Radio/walkie-talkie available",
          "Keys available",
          "Emergency contact list available",
          "Incident report book available"
        ]
      }
    ];

    return (
      <div className="flex-1 flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { label: "Assigned Sites Today", val: displaySites.length, icon: "distance", bg: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
            { label: "Guards Planned", val: totalPlanned, icon: "engineering", bg: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
            { label: "Guards Verified", val: guardsVerified || totalPlanned, icon: "verified", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
            { label: "Absences / Late", val: absencesCount, icon: "event_busy", bg: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
            { label: "Open Incidents", val: openIncidentsCount, icon: "warning", bg: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
            { label: "Replacement Required", val: replacementsCount, icon: "swap_horiz", bg: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
            { label: "Patrols Completed", val: patrolsCompleted, icon: "task_alt", bg: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" }
          ].map((c, i) => (
            <div key={i} className={`p-4 border rounded-xl flex flex-col justify-between h-28 bg-surface shadow-sm transition-all hover:scale-[1.02] ${c.bg}`}>
              <div className="flex justify-between items-start">
                <span className="material-symbols-outlined text-[20px]">{c.icon}</span>
                <span className="text-2xl font-bold">{c.val}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{c.label}</span>
            </div>
          ))}
        </div>

        <div className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Assigned Sites Field Status</h3>
            <button
              onClick={handleSubmitDailyReport}
              className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-container transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
              Submit Daily Patrol Report
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest border-b border-outline-variant">
                  <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project / Contract</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Site</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Zone / Gate</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Planned Guards</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Present Verified</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Missing / Late</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Last Patrol Time</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Site Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {displaySites.map((site: any) => {
                  const planned = getPlannedGuardsForSite(site.id).length;
                  const sitePatrols = todayPatrols.filter(p => p.siteId === site.id);
                  let verifiedPresent = 0;
                  let missingLate = 0;
                  let lastPatrolTime = "—";
                  let siteStatus = "Normal";

                  if (sitePatrols.length > 0) {
                    const sorted = [...sitePatrols].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                    const lastPatrol = sorted[0];
                    lastPatrolTime = new Date(lastPatrol.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    if (lastPatrol.verifications) {
                      Object.values(lastPatrol.verifications).forEach((v: any) => {
                        if (v.status === "Present" || v.status === "Replaced") {
                          verifiedPresent++;
                        } else if (v.status === "Absent" || v.status === "Late" || v.status === "Left Post") {
                          missingLate++;
                        }
                      });
                    }

                    if (lastPatrol.incidents && lastPatrol.incidents.some((i: any) => i.severity === "Critical" || i.severity === "High")) {
                      siteStatus = "Critical";
                    } else if (missingLate > 0 || (lastPatrol.incidents && lastPatrol.incidents.length > 0)) {
                      siteStatus = "Issue";
                    }
                  }

                  const projName = projects.find(p => p.id === site.projectId)?.name || "Al Jazeera HQ Project";

                  return (
                    <tr key={site.id} className="border-b border-outline-variant/40 hover:bg-surface-container-lowest transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-primary">{projName}</td>
                      <td className="px-4 py-3 text-xs text-on-surface font-bold">{site.name}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">Main Gate & Boundary</td>
                      <td className="px-4 py-3 text-xs text-center font-bold">{planned}</td>
                      <td className="px-4 py-3 text-xs text-center font-bold text-emerald-600">{verifiedPresent || planned}</td>
                      <td className="px-4 py-3 text-xs text-center font-bold text-rose-600">{missingLate}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{lastPatrolTime}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          siteStatus === "Critical" ? "bg-status-error/15 text-status-error" :
                          siteStatus === "Issue" ? "bg-status-warning/15 text-status-warning" :
                          "bg-status-success/15 text-status-success"
                        }`}>
                          {siteStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-right">
                        <button
                          onClick={() => {
                            setSelectedPatrolSite(site);
                            setShowPatrolDrawer(true);
                            setPatrolActiveTab("verification");
                          }}
                          className="px-3 py-1 bg-secondary hover:bg-secondary-container text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          Open Site Patrol
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {showPatrolDrawer && selectedPatrolSite && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex justify-end">
            <div className="w-full lg:w-[90%] max-w-none h-full bg-surface shadow-2xl flex flex-col border-l border-outline-variant animate-in slide-in-from-right duration-250">
              <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-primary">{selectedPatrolSite.name}</h3>
                  <p className="text-[10px] text-on-surface-variant font-bold">
                    Project Patrol & Inspection Board — {new Date().toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setShowPatrolDrawer(false)}
                  className="w-8 h-8 rounded-full hover:bg-outline-variant/30 flex items-center justify-center text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="flex border-b border-outline-variant/60 bg-surface-container-lowest p-1 overflow-x-auto gap-1">
                {[
                  { id: "verification", label: "Deployment Verification", icon: "how_to_reg" },
                  { id: "checklist", label: "Patrol Checklist", icon: "check_box" },
                  { id: "incident", label: "Incident Report", icon: "report" },
                  { id: "replacement", label: "Replacement / Reliever", icon: "swap_horiz" },
                  { id: "notes", label: "Client Notes", icon: "chat" },
                  { id: "signatures", label: "Photos & Signatures", icon: "draw" },
                  { id: "report", label: "Daily Report Preview", icon: "article" }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setPatrolActiveTab(t.id)}
                    className={`flex items-center gap-1 px-3 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                      patrolActiveTab === t.id
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-on-surface-variant hover:text-primary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-surface-container-lowest">
                {patrolActiveTab === "verification" && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">Planned Guards Deployment Verification</h4>
                    <div className="space-y-4">
                      {getPlannedGuardsForSite(selectedPatrolSite.id).map((guard: any) => {
                        const currentRecord = verificationRecords[guard.id] || {
                          status: "Present",
                          uniform: true,
                          idCard: true,
                          grooming: true,
                          handover: "Yes",
                          remarks: ""
                        };

                        const updateGuardVerification = (fields: Partial<typeof currentRecord>) => {
                          setVerificationRecords({
                            ...verificationRecords,
                            [guard.id]: { ...currentRecord, ...fields }
                          });
                        };

                        return (
                          <div key={guard.id} className="p-4 border border-outline-variant rounded-xl bg-surface shadow-sm space-y-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-xs font-bold text-on-surface">{guard.employeeName}</span>
                                <span className="text-[10px] text-on-surface-variant font-bold ml-2">ID: {guard.employeeId}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                                {guard.shiftCode} ({guard.timing})
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div>
                                <label className="block text-[10px] font-bold uppercase mb-1">Present Status</label>
                                <select
                                  value={currentRecord.status}
                                  onChange={(e) => updateGuardVerification({ status: e.target.value })}
                                  className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                                >
                                  <option value="Present">Present</option>
                                  <option value="Absent">Absent</option>
                                  <option value="Late">Late</option>
                                  <option value="Left Post">Left Post</option>
                                  <option value="Replaced">Replaced</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase mb-1">Planned Post</label>
                                <input type="text" readOnly value={guard.postName} className="w-full bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-xs text-on-surface-variant" />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase mb-1">Actual Post / Gate</label>
                                <input
                                  type="text"
                                  value={currentRecord.actualPost || guard.postName}
                                  onChange={(e) => updateGuardVerification({ actualPost: e.target.value })}
                                  className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-4 pt-2 items-center text-xs">
                              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentRecord.uniform}
                                  onChange={(e) => updateGuardVerification({ uniform: e.target.checked })}
                                  className="rounded border-outline-variant"
                                />
                                <span>Uniform OK</span>
                              </label>

                              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentRecord.idCard}
                                  onChange={(e) => updateGuardVerification({ idCard: e.target.checked })}
                                  className="rounded border-outline-variant"
                                />
                                <span>ID Card Available</span>
                              </label>

                              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentRecord.grooming}
                                  onChange={(e) => updateGuardVerification({ grooming: e.target.checked })}
                                  className="rounded border-outline-variant"
                                />
                                <span>Grooming OK</span>
                              </label>

                              <div className="flex items-center gap-1.5 ml-auto">
                                <span className="text-[10px] font-bold uppercase text-on-surface-variant">Handover:</span>
                                <select
                                  value={currentRecord.handover}
                                  onChange={(e) => updateGuardVerification({ handover: e.target.value })}
                                  className="bg-surface border border-outline-variant rounded px-1 text-[11px] text-on-surface"
                                >
                                  <option value="Yes">Yes</option>
                                  <option value="No">No</option>
                                  <option value="N/A">N/A</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <input
                                type="text"
                                placeholder="Verification remarks..."
                                value={currentRecord.remarks}
                                onChange={(e) => updateGuardVerification({ remarks: e.target.value })}
                                className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {patrolActiveTab === "checklist" && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">Site Patrol Inspection Checklist</h4>
                    {DEFAULT_CHECKLIST_CONFIG.map((sec, sidx) => (
                      <div key={sidx} className="space-y-3">
                        <h5 className="text-xs font-bold text-on-surface-variant border-b border-outline-variant/40 pb-1">{sec.sectionName}</h5>
                        <div className="space-y-3">
                          {sec.items.map((item) => {
                            const current = checklistAnswers[item.itemCode] || { status: "OK", remarks: "" };
                            const updateItem = (fields: Partial<typeof current>) => {
                              setChecklistAnswers({
                                ...checklistAnswers,
                                [item.itemCode]: { ...current, ...fields }
                              });
                            };

                            const violations = guardViolations[item.itemCode] || [];

                            return (
                              <div key={item.itemCode} className="flex flex-col p-4 border border-outline-variant/60 rounded-xl bg-surface shadow-sm gap-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                  <span className="text-xs font-bold text-on-surface md:w-1/2">{item.itemLabel}</span>
                                  <div className="flex gap-4 text-xs items-center">
                                    {[
                                      { value: "OK", label: "OK" },
                                      { value: "NOT_OK", label: "Not OK" },
                                      { value: "NA", label: "N/A" }
                                    ].map(st => (
                                      <label key={st.value} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`check-${item.itemCode}`}
                                          checked={current.status === st.value}
                                          onChange={() => updateItem({ status: st.value as any })}
                                          className="text-primary focus:ring-primary"
                                        />
                                        <span className={`text-[11px] font-bold ${
                                          st.value === "OK" ? "text-emerald-600" : st.value === "NOT_OK" ? "text-rose-600" : "text-on-surface-variant"
                                        }`}>{st.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Remarks..."
                                    value={current.remarks}
                                    onChange={(e) => updateItem({ remarks: e.target.value })}
                                    className="bg-surface border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface md:w-1/3"
                                  />
                                </div>

                                {item.requiresGuardViolationDetails && current.status === "NOT_OK" && (
                                  <div className="p-4 border border-dashed border-outline-variant/60 bg-surface-container-lowest rounded-xl">
                                    <div className="flex justify-between items-center mb-3">
                                      <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[16px]">warning</span>
                                        Guard Behavior Violations Log
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => addViolationRow(item.itemCode)}
                                        className="px-2.5 py-1 bg-[#0058be] hover:bg-[#004bb3] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors"
                                      >
                                        <span className="material-symbols-outlined text-[13px]">add</span>
                                        Add Guard Violation Row
                                      </button>
                                    </div>
                                    {violations.length === 0 ? (
                                      <div className="text-center py-4 text-xs text-on-surface-variant italic">
                                        No violations logged. Click button to log a guard behavior issue.
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead>
                                            <tr className="border-b border-outline-variant/60 text-on-surface-variant font-bold text-[10px] uppercase tracking-wider">
                                              <th className="pb-2 w-[18%]">Guard Code / Clock No.</th>
                                              <th className="pb-2 w-[22%]">Guard Name</th>
                                              <th className="pb-2 w-[18%]">Post / Gate / Zone</th>
                                              <th className="pb-2 w-[22%]">Specific Violation / Remarks</th>
                                              <th className="pb-2 w-[15%]">Action / Corrective Action</th>
                                              <th className="pb-2 text-right w-[5%]">Remove</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-outline-variant/30">
                                            {violations.map((row) => (
                                              <tr key={row.id} className="align-top">
                                                <td className="py-2.5 pr-2">
                                                  <input
                                                    type="text"
                                                    placeholder="E.g. SEC-1001"
                                                    value={row.employeeCode}
                                                    onChange={(e) => updateViolationRow(item.itemCode, row.id, { employeeCode: e.target.value })}
                                                    className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface focus:border-primary focus:outline-none"
                                                  />
                                                  {row.errorMsg && (
                                                    <p className="text-rose-600 font-bold mt-1 text-[9px] leading-tight">{row.errorMsg}</p>
                                                  )}
                                                </td>
                                                <td className="py-2.5 pr-2">
                                                  <input
                                                    type="text"
                                                    readOnly
                                                    placeholder="Auto-populated"
                                                    value={row.employeeName}
                                                    className="w-full bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-xs text-on-surface-variant focus:outline-none font-bold"
                                                  />
                                                </td>
                                                <td className="py-2.5 pr-2">
                                                  <input
                                                    type="text"
                                                    placeholder="Gate 1 / Zone A"
                                                    value={row.postName}
                                                    onChange={(e) => updateViolationRow(item.itemCode, row.id, { postName: e.target.value })}
                                                    className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface focus:border-primary focus:outline-none"
                                                  />
                                                </td>
                                                <td className="py-2.5 pr-2">
                                                  <input
                                                    type="text"
                                                    placeholder="Details of behavior..."
                                                    value={row.remarks}
                                                    onChange={(e) => updateViolationRow(item.itemCode, row.id, { remarks: e.target.value })}
                                                    className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface focus:border-primary focus:outline-none"
                                                  />
                                                </td>
                                                <td className="py-2.5 pr-2">
                                                  <input
                                                    type="text"
                                                    placeholder="Action taken..."
                                                    value={row.actionTaken}
                                                    onChange={(e) => updateViolationRow(item.itemCode, row.id, { actionTaken: e.target.value })}
                                                    className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface focus:border-primary focus:outline-none"
                                                  />
                                                </td>
                                                <td className="py-2.5 text-right">
                                                  <button
                                                    type="button"
                                                    onClick={() => removeViolationRow(item.itemCode, row.id)}
                                                    className="w-7 h-7 rounded-lg hover:bg-rose-500/10 text-rose-600 transition-colors flex items-center justify-center ml-auto"
                                                  >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {patrolActiveTab === "incident" && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">Report Security / Site Incident</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Incident Type</label>
                        <select
                          value={incidentForm.type}
                          onChange={(e) => setIncidentForm({ ...incidentForm, type: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        >
                          <option value="Security breach">Security breach</option>
                          <option value="Fight / disturbance">Fight / disturbance</option>
                          <option value="Theft / damage">Theft / damage</option>
                          <option value="Unauthorized entry">Unauthorized entry</option>
                          <option value="Fire / safety hazard">Fire / safety hazard</option>
                          <option value="Client complaint">Client complaint</option>
                          <option value="Guard misconduct">Guard misconduct</option>
                          <option value="Emergency">Emergency</option>
                          <option value="Equipment issue">Equipment issue</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Severity Level</label>
                        <div className="flex gap-4 py-2">
                          {["Low", "Medium", "High", "Critical"].map(sev => (
                            <label key={sev} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="severity"
                                checked={incidentForm.severity === sev}
                                onChange={() => setIncidentForm({ ...incidentForm, severity: sev })}
                                className="text-primary"
                              />
                              <span className={`font-bold ${
                                sev === "Critical" ? "text-rose-600" :
                                sev === "High" ? "text-orange-500" :
                                sev === "Medium" ? "text-amber-500" : "text-blue-500"
                              }`}>{sev}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase mb-1">People Involved</label>
                        <input
                          type="text"
                          placeholder="Name(s), designation, or company..."
                          value={incidentForm.peopleInvolved}
                          onChange={(e) => setIncidentForm({ ...incidentForm, peopleInvolved: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase mb-1">Description of Incident</label>
                        <textarea
                          rows={3}
                          placeholder="Provide details on what happened..."
                          value={incidentForm.description}
                          onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase mb-1">Immediate Corrective Action Taken</label>
                        <textarea
                          rows={2}
                          placeholder="Action taken immediately to resolve the issue..."
                          value={incidentForm.immediateAction}
                          onChange={(e) => setIncidentForm({ ...incidentForm, immediateAction: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Escalated To</label>
                        <select
                          value={incidentForm.escalatedTo}
                          onChange={(e) => setIncidentForm({ ...incidentForm, escalatedTo: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        >
                          <option value="Operations Coordinator">Operations Coordinator</option>
                          <option value="Operations Manager">Operations Manager</option>
                          <option value="HR Department">HR Department</option>
                          <option value="Client Representative">Client Representative</option>
                          <option value="Police / Ambulance">Police / Ambulance</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Follow-up Required?</label>
                        <div className="flex gap-4 py-2">
                          {["Yes", "No"].map(v => (
                            <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="followUp"
                                checked={incidentForm.followUpRequired === v}
                                onChange={() => setIncidentForm({ ...incidentForm, followUpRequired: v })}
                              />
                              <span>{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {patrolActiveTab === "replacement" && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">Emergency Guard Replacement / Reliever</h4>
                    {replacementForm.criticalPost === "Yes" && replacementForm.status === "Requested" && (
                      <div className="p-3 bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded-lg text-xs font-bold flex items-center gap-2 animate-bounce">
                        <span className="material-symbols-outlined text-[16px]">warning</span>
                        Critical post must not remain unmanned. Urgent dispatcher notification triggered.
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Select Original Guard (Leaving Post)</label>
                        <select
                          value={replacementForm.originalGuard}
                          onChange={(e) => setReplacementForm({ ...replacementForm, originalGuard: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        >
                          <option value="">-- Choose Guard --</option>
                          {getPlannedGuardsForSite(selectedPatrolSite.id).map((g: any) => (
                            <option key={g.id} value={g.employeeName}>{g.employeeName} ({g.employeeId})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Reason for Replacement</label>
                        <select
                          value={replacementForm.reason}
                          onChange={(e) => setReplacementForm({ ...replacementForm, reason: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        >
                          <option value="Absent">Absent</option>
                          <option value="Late">Late</option>
                          <option value="Sick">Sick</option>
                          <option value="Removed">Removed</option>
                          <option value="Emergency">Emergency</option>
                          <option value="Client Request">Client Request</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Is this a Critical Post?</label>
                        <div className="flex gap-4 py-2">
                          {["Yes", "No"].map(v => (
                            <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="critPost"
                                checked={replacementForm.criticalPost === v}
                                onChange={() => setReplacementForm({ ...replacementForm, criticalPost: v })}
                              />
                              <span>{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Replacement Required From (Time)</label>
                        <input
                          type="time"
                          value={replacementForm.replacementRequiredFrom}
                          onChange={(e) => setReplacementForm({ ...replacementForm, replacementRequiredFrom: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Assign Replacement Guard Name / ID</label>
                        <input
                          type="text"
                          placeholder="E.g. Reliever Guard Code or Name..."
                          value={replacementForm.replacementGuard}
                          onChange={(e) => setReplacementForm({ ...replacementForm, replacementGuard: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Replacement Status</label>
                        <select
                          value={replacementForm.status}
                          onChange={(e) => setReplacementForm({ ...replacementForm, status: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        >
                          <option value="Requested">Requested (Pending Dispatch)</option>
                          <option value="Assigned">Assigned (En Route)</option>
                          <option value="Arrived">Arrived (On Post)</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase mb-1">Remarks & Details</label>
                        <textarea
                          rows={2}
                          value={replacementForm.remarks}
                          onChange={(e) => setReplacementForm({ ...replacementForm, remarks: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {patrolActiveTab === "notes" && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">Client Coordination & Feedback</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Client Representative Met</label>
                        <input
                          type="text"
                          placeholder="Representative name / title..."
                          value={clientNoteForm.clientRep}
                          onChange={(e) => setClientNoteForm({ ...clientNoteForm, clientRep: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Client Performance Feedback</label>
                        <div className="flex gap-4 py-2">
                          {["Positive", "Neutral", "Complaint"].map(f => (
                            <label key={f} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="feedback"
                                checked={clientNoteForm.feedback === f}
                                onChange={() => setClientNoteForm({ ...clientNoteForm, feedback: f })}
                              />
                              <span className={`font-bold ${
                                f === "Positive" ? "text-emerald-600" : f === "Complaint" ? "text-rose-600" : "text-on-surface-variant"
                              }`}>{f}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase mb-1">Client Complaints (if any)</label>
                        <textarea
                          rows={2}
                          placeholder="Record client grievances or complaints..."
                          value={clientNoteForm.complaint}
                          onChange={(e) => setClientNoteForm({ ...clientNoteForm, complaint: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase mb-1">Special Site Instructions</label>
                        <textarea
                          rows={2}
                          placeholder="Instructions issued by client or supervisor..."
                          value={clientNoteForm.specialInstruction}
                          onChange={(e) => setClientNoteForm({ ...clientNoteForm, specialInstruction: e.target.value })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Additional Manpower Requested?</label>
                        <div className="flex gap-4 py-2">
                          {["Yes", "No"].map(v => (
                            <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="manpowerReq"
                                checked={clientNoteForm.additionalManpower === v}
                                onChange={() => setClientNoteForm({ ...clientNoteForm, additionalManpower: v })}
                              />
                              <span>{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Requested Quantity (Guards)</label>
                        <input
                          type="number"
                          disabled={clientNoteForm.additionalManpower === "No"}
                          value={clientNoteForm.requestedQty}
                          onChange={(e) => setClientNoteForm({ ...clientNoteForm, requestedQty: parseInt(e.target.value) || 0 })}
                          className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-xs text-on-surface disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {patrolActiveTab === "signatures" && (
                  <div className="space-y-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">Evidence & Signature Capturing</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                      <div className="p-4 border border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center h-40 bg-surface-container-low opacity-60">
                        <span className="material-symbols-outlined text-[36px] text-on-surface-variant">photo_camera</span>
                        <span className="font-bold mt-2">Patrol Visit Photo</span>
                        <span className="text-[9px] text-on-surface-variant/80 mt-1">Photo Upload module coming soon</span>
                      </div>
                      <div className="p-4 border border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center h-40 bg-surface-container-low opacity-60">
                        <span className="material-symbols-outlined text-[36px] text-on-surface-variant">photo_camera</span>
                        <span className="font-bold mt-2">Incident / Proof Photo</span>
                        <span className="text-[9px] text-on-surface-variant/80 mt-1">Photo Upload module coming soon</span>
                      </div>

                      <div className="p-4 border border-outline-variant rounded-xl bg-surface-container-low opacity-60 flex flex-col justify-between h-40">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Patrolling Supervisor Signature</span>
                        <div className="border border-outline-variant rounded h-20 bg-surface flex items-center justify-center text-[10px] italic">Signature box disabled</div>
                      </div>

                      <div className="p-4 border border-outline-variant rounded-xl bg-surface-container-low opacity-60 flex flex-col justify-between h-40">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Client Representative Signature</span>
                        <div className="border border-outline-variant rounded h-20 bg-surface flex items-center justify-center text-[10px] italic">Signature box disabled</div>
                      </div>
                    </div>
                  </div>
                )}

                {patrolActiveTab === "report" && (() => {
                  const allViolations = Object.entries(guardViolations).flatMap(([itemCode, rows]) => {
                    const itemLabel = DEFAULT_CHECKLIST_CONFIG
                      .flatMap(sec => sec.items)
                      .find(it => it.itemCode === itemCode)?.itemLabel || itemCode;
                    return rows.map(r => ({ ...r, itemLabel }));
                  });

                  const docIssues = DEFAULT_CHECKLIST_CONFIG
                    .find(sec => sec.sectionName === "Documents & Equipment")
                    ?.items.filter(it => checklistAnswers[it.itemCode]?.status === "NOT_OK")
                    .map(it => ({
                      label: it.itemLabel,
                      remarks: checklistAnswers[it.itemCode]?.remarks
                    })) || [];

                  return (
                    <div className="space-y-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">Site Patrol Summary Report Preview</h4>
                      <div className="p-4 border border-outline-variant rounded-xl bg-surface shadow-sm space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-xs border-b border-outline-variant/60 pb-3 font-bold">
                          <div>
                            <span className="text-on-surface-variant">Site Name:</span>
                            <span className="text-on-surface ml-2">{selectedPatrolSite.name}</span>
                          </div>
                          <div>
                            <span className="text-on-surface-variant">Date:</span>
                            <span className="text-on-surface ml-2">{new Date().toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-on-surface-variant">Patrolling Supervisor:</span>
                            <span className="text-on-surface ml-2">{session?.user?.name || "Patrol Coordinator"}</span>
                          </div>
                          <div>
                            <span className="text-on-surface-variant">Visit Time:</span>
                            <span className="text-on-surface ml-2">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <h5 className="font-bold text-on-surface">Inspected Guards:</h5>
                          <ul className="list-disc pl-5 space-y-1">
                            {getPlannedGuardsForSite(selectedPatrolSite.id).map((g: any) => {
                              const rec = verificationRecords[g.id] || { status: "Present" };
                              return (
                                <li key={g.id}>
                                  <span className="font-bold">{g.employeeName}</span> ({g.employeeId}) — Status:
                                  <span className={`ml-1 font-bold ${
                                    rec.status === "Present" ? "text-emerald-600" : "text-rose-600"
                                  }`}>{rec.status}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        <div className="space-y-2 text-xs">
                          <h5 className="font-bold text-on-surface">Inspection Checklist Summary:</h5>
                          <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
                            <div className="text-emerald-600">OK Checklist items: <span>{Object.values(checklistAnswers).filter(a => a.status === "OK").length}</span></div>
                            <div className="text-rose-600">Not OK items: <span>{Object.values(checklistAnswers).filter(a => a.status === "NOT_OK").length}</span></div>
                            <div className="text-on-surface-variant">N/A items: <span>{Object.values(checklistAnswers).filter(a => a.status === "NA").length}</span></div>
                          </div>
                        </div>

                        {allViolations.length > 0 && (
                          <div className="space-y-2 text-xs bg-rose-500/5 p-3 rounded-lg border border-rose-500/10">
                            <h5 className="font-bold text-rose-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">report_problem</span>
                              Logged Guard Behavior Violations:
                            </h5>
                            <div className="overflow-x-auto mt-2">
                              <table className="w-full text-left text-[11px] border-collapse">
                                <thead>
                                  <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase">
                                    <th className="pb-1">Checklist Item</th>
                                    <th className="pb-1">Guard Code</th>
                                    <th className="pb-1">Guard Name</th>
                                    <th className="pb-1">Post / Gate</th>
                                    <th className="pb-1">Remarks</th>
                                    <th className="pb-1">Action Taken</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {allViolations.map((violation, idx) => (
                                    <tr key={idx} className="border-b border-outline-variant/30 py-1">
                                      <td className="py-1.5 font-bold text-on-surface-variant pr-2">{violation.itemLabel}</td>
                                      <td className="py-1.5 font-mono pr-2">{violation.employeeCode}</td>
                                      <td className="py-1.5 font-bold pr-2">{violation.employeeName}</td>
                                      <td className="py-1.5 pr-2">{violation.postName}</td>
                                      <td className="py-1.5 pr-2 italic">"{violation.remarks}"</td>
                                      <td className="py-1.5 pr-2">{violation.actionTaken}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {docIssues.length > 0 && (
                          <div className="space-y-2 text-xs bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                            <h5 className="font-bold text-amber-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">construction</span>
                              Documents & Equipment Issues:
                            </h5>
                            <ul className="list-disc pl-5 space-y-1">
                              {docIssues.map((issue, idx) => (
                                <li key={idx}>
                                  <span className="font-bold">{issue.label}</span>
                                  {issue.remarks ? ` — Remarks: "${issue.remarks}"` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {incidentForm.description && (
                          <div className="space-y-2 text-xs bg-rose-500/5 p-3 rounded-lg border border-rose-500/10">
                            <h5 className="font-bold text-rose-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">report</span>
                              Reported Incident:
                            </h5>
                            <div>Type: <span className="font-bold">{incidentForm.type}</span> ({incidentForm.severity})</div>
                            <div className="italic text-on-surface-variant mt-1">"{incidentForm.description}"</div>
                          </div>
                        )}

                        {replacementForm.originalGuard && (
                          <div className="space-y-2 text-xs bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                            <h5 className="font-bold text-amber-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
                              Replacement Request:
                            </h5>
                            <div>Original: <span className="font-bold">{replacementForm.originalGuard}</span> ➔ Replacement: <span className="font-bold">{replacementForm.replacementGuard || "TBD"}</span></div>
                            <div>Status: <span className="font-bold">{replacementForm.status}</span></div>
                          </div>
                        )}
                    </div>

                    <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant flex items-center gap-2 border border-outline-variant">
                      <span className="material-symbols-outlined text-[18px]">info</span>
                      <span>Exporting PDF and sending notifications to operations is currently disabled (coming in Phase 2).</span>
                    </div>
                  </div>
                );
              })()}
              </div>

              <div className="p-4 border-t border-outline-variant flex justify-between items-center bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => setShowPatrolDrawer(false)}
                  className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      alert("Patrol report saved as Draft successfully (local browser session)!");
                      setShowPatrolDrawer(false);
                    }}
                    className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={() => handleSavePatrolVisit(selectedPatrolSite)}
                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-variant transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">save</span>
                    Submit Patrol Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 bg-surface-container-lowest p-6 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/manpower/${business}/dashboard`}
            className="w-8 h-8 rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-primary">{businessLabel} — {masterLabel}</h1>
            <p className="text-[10px] text-on-surface-variant">Manage master rosters and records for {businessLabel}</p>
          </div>
        </div>

        {canManage && (isSecurity && master === "coordinators" && coordinatorSubTab === "board" ? (
          <button
            onClick={() => {
              setSelectedPatrolSite(displaySites[0]);
              setShowPatrolDrawer(true);
              setPatrolActiveTab("report");
            }}
            className="px-3 py-2 bg-secondary hover:bg-secondary-container text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            Patrol Reports Console
          </button>
        ) : (
          <button
            onClick={() => {
              if (isSecurity && master === "manpower") {
                if (activeSubTab === "licenses") {
                  setShowAddLicenseModal(true);
                  return;
                }
                if (activeSubTab === "gatePasses") {
                  setShowAddGatePassModal(true);
                  return;
                }
                if (activeSubTab === "relieverPools" || activeSubTab === "overtimeLogs") {
                  return;
                }
              }
              if (master === "contracts") {
                setWorkflowLevels([]);
              }
              if (master === "sites") {
                setFormSiteShifts([]);
                setFormSiteAllowance({
                  siteAllowanceEnabled: false,
                  siteAllowanceAmount: 0,
                  siteAllowanceFrequency: "MONTHLY",
                  allowanceDescription: "",
                  effectiveFrom: "",
                  effectiveTo: "",
                  appliesToAllPositions: true
                });
                setSiteAllowanceApplicable(false);
              }
              setFormData(master === "manpower" ? { mode: "promote", isActive: true } : master === "contracts" ? { status: "DRAFT", manpowerRequirements: [], relieverRequirements: [], shiftRequirements: [], relieverRequired: "No" } : {});
              setFormError("");
              setShowAddModal(true);
            }}
            className={`px-3 py-2 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              isSecurity ? "bg-primary hover:bg-primary-container" : "bg-secondary hover:bg-secondary-container"
            } ${
              (isSecurity && master === "manpower" && (activeSubTab === "relieverPools" || activeSubTab === "overtimeLogs")) ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add {isSecurity && master === "manpower" && activeSubTab === "licenses" ? "Security License" : isSecurity && master === "manpower" && activeSubTab === "gatePasses" ? "Gate Pass" : masterLabel.replace(/s$/, "")}
          </button>
        ))}
      </div>

      {/* Sub-tabs for Security Manpower Console */}
      {isSecurity && master === "manpower" && (
        <div className="flex border-b border-outline-variant mb-6 gap-2 bg-surface p-1 rounded-xl">
          {[
            { id: "directory", label: "Directory", icon: "badge" },
            { id: "licenses", label: "MOI Security Licenses", icon: "shield" },
            { id: "gatePasses", label: "Site Gate Passes", icon: "badge_card" },
            { id: "relieverPools", label: "Reliever Assignment", icon: "groups" },
            { id: "overtimeLogs", label: "Overtime / Event History", icon: "schedule" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                setSearchTerm("");
              }}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all rounded-lg ${
                activeSubTab === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Sub-tabs for Security Coordinators Workspace */}
      {isSecurity && master === "coordinators" && (
        <div className="flex border-b border-outline-variant mb-6 gap-2 bg-surface p-1 rounded-xl">
          {[
            { id: "board", label: "Patrol Operations Board", icon: "dashboard" },
            { id: "assignments", label: "Manage Assignments & Sync", icon: "assignment" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setCoordinatorSubTab(tab.id as any);
                setSearchTerm("");
              }}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all rounded-lg ${
                coordinatorSubTab === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm mb-6 flex flex-col gap-3">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              placeholder={`Search ${masterLabel}...`}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-9 pr-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {master === "manpower" && activeSubTab === "directory" && (
            <label className="flex items-center gap-1.5 text-xs text-on-surface cursor-pointer select-none whitespace-nowrap font-bold">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary"
              />
              <span>Include Inactive</span>
            </label>
          )}
        </div>

        {master === "manpower" && activeSubTab === "directory" && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/40 items-center">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mr-1">Enforced Filters:</span>
            {isSecurity ? (
              <>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  Company: AHH Security Services
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  Code: HS01
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  Category: Blue Collar
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  Status: Active
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  Source: Workforce Directory
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  Company: Touch Cleaning & Hospitality
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  Code: TC01
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  Category: Blue Collar
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  Status: Active
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  Source: Workforce Directory
                </span>
              </>
            )}
          </div>
        )}

        {master === "clients" && (
          <div className="flex flex-wrap gap-4 pt-2 border-t border-outline-variant/40 items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Customer Type:</span>
              <select
                className="bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                value={filterCustomerType}
                onChange={(e) => setFilterCustomerType(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="COMPANY">Company</option>
                <option value="INDIVIDUAL">Individual</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status:</span>
              <select
                className="bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        )}
      </div>
      {isSecurity && master === "coordinators" && coordinatorSubTab === "board" ? (
        renderPatrolOperationsBoard()
      ) : (
        <div className="flex gap-6 flex-1 min-h-0">
        <div className={`bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col ${
          (isSecurity && master === "projects" && selectedProjectId) ? "w-1/2" :
          (isSecurity && master === "sites" && selectedSiteId) ? "hidden md:flex w-[15%]" : "w-full"
        }`}>
          {loading ? (
            <div className="h-64 flex items-center justify-center flex-1">
              <div className={`w-8 h-8 border-4 rounded-full animate-spin border-t-transparent ${isSecurity ? "border-primary" : "border-secondary"}`}></div>
            </div>
          ) : (isSecurity && master === "manpower" && activeSubTab !== "directory") ? (
            renderSecurityComplianceTabs()
          ) : filteredData.length === 0 ? (
            <div className="p-8 text-center text-xs text-on-surface-variant flex-1 flex items-center justify-center">No items found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    {master === "clients" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Customer Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Main Contact</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Operations Contact</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Finance Contact</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Docs</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                      </>
                    )}
                    {master === "contracts" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Contract No.</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Title</th>
                        {isSecurity && (
                          <>
                            <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Manpower Req (Lines / Total)</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Relievers (Req? / Total)</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Shifts</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Addendums</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Start Date</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">End Date</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                      </>
                    )}
                    {master === "projects" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Contract</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        {canManage && <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>}
                      </>
                    )}
                    {master === "sites" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Site Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Worksite Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Radius (Meters)</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Gate Pass Req.</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        {canManage && <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>}
                      </>
                    )}
                    {master === "categories" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Category Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Blue Collar</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Deployable</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Overtime</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">MOI License</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Gate Pass</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        {canManage && <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>}
                      </>
                    )}
                    {(master === "zones" || master === "areas") && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Unit Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Worksite</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Unit Type</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                      </>
                    )}
                    {master === "manpower" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ID</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Duty Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions / Status</th>
                      </>
                    )}
                    {master === "shifts" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Worksite</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Location Unit</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Shift Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Required Count</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                      </>
                    )}
                    {master === "coordinators" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Assignment Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Coordinator</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        {canManage && <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>}
                      </>
                    )}
                    {master === "materials" && (
                      <>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">UOM</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Default Unit Price</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Scope</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                        {canManage && <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>}
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item: any, idx: number) => (
                    <tr
                      key={item.id || idx}
                      onClick={() => {
                        if (isSecurity && master === "projects") {
                          loadProjectDetails(item.id);
                        } else if (isSecurity && master === "sites") {
                          loadSiteDetails(item.id);
                        }
                      }}
                      className={`border-b border-outline-variant/40 hover:bg-surface-container-lowest cursor-pointer ${
                        (isSecurity && master === "projects" && selectedProjectId === item.id) ? "bg-primary/10 font-bold" :
                        (isSecurity && master === "sites" && selectedSiteId === item.id) ? "bg-primary/10 font-bold" : ""
                      }`}
                    >
                      {master === "clients" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.code}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">
                            <div className="font-semibold">{item.name}</div>
                            {item.tradingName && <div className="text-[10px] text-on-surface-variant italic">{item.tradingName}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">{item.customerType || "COMPANY"}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">
                            <div>{item.mainPhone || "—"}</div>
                            <div className="text-[10px]">{item.mainEmail || ""}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface">
                            {item.operationContactName ? (
                              <div>
                                <div className="font-medium">{item.operationContactName}</div>
                                <div className="text-[10px] text-on-surface-variant">{item.operationContactMobile || ""}</div>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface">
                            {item.financeContactName ? (
                              <div>
                                <div className="font-medium">{item.financeContactName}</div>
                                <div className="text-[10px] text-on-surface-variant">{item.financeContactMobile || ""}</div>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface">
                            <div className="font-bold">{item.documentsCount || (item.documents?.length) || 0} docs</div>
                            {item.documentAlertStatus && item.documentAlertStatus !== "NO_EXPIRY_DATE" && (
                              <span className={`mt-1 inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                item.documentAlertStatus === "EXPIRED" ? "bg-red-100 text-red-700" :
                                item.documentAlertStatus === "EXPIRING_SOON" ? "bg-amber-100 text-amber-700" :
                                "bg-green-100 text-green-700"
                              }`}>
                                {item.documentAlertStatus === "EXPIRING_SOON" ? "Expiring Soon" : item.documentAlertStatus}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewClientDetails(item.id);
                              }}
                              className="text-primary hover:underline text-[11px] font-bold mr-3"
                            >
                              View
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(item);
                                  }}
                                  className="text-secondary hover:underline text-[11px] font-bold mr-3"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFormData({ clientId: item.id, status: "DRAFT", manpowerRequirements: [], relieverRequirements: [], shiftRequirements: [], relieverRequired: "No" });
                                    router.push(`/manpower/${business}/contracts`);
                                    setShowAddModal(true);
                                  }}
                                  className="text-status-success hover:underline text-[11px] font-bold mr-3"
                                >
                                  Add Contract
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`Are you sure you want to ${item.isActive ? "deactivate" : "activate"} this client?`)) {
                                      await fetch(apiBase, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ id: item.id, isActive: !item.isActive })
                                      });
                                      loadData();
                                    }
                                  }}
                                  className={`${item.isActive ? "text-status-error" : "text-status-success"} hover:underline text-[11px] font-bold`}
                                >
                                  {item.isActive ? "Deactivate" : "Activate"}
                                </button>
                              </>
                            )}
                          </td>
                        </>
                      )}
                      {master === "contracts" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewContractDetails(item.id);
                              }}
                              className="hover:underline text-left text-primary"
                            >
                              {item.contractNumber}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">{item.client?.name || item.clientId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">{item.title}</td>
                          {isSecurity && (
                            <>
                              <td className="px-4 py-3 text-xs text-on-surface-variant">
                                {item.manpowerLineCount || 0} lines ({item.totalManpower || 0} guards)
                              </td>
                              <td className="px-4 py-3 text-xs text-on-surface-variant">
                                {item.relieverRequired || "No"} ({item.totalRelievers || 0} relievers)
                              </td>
                              <td className="px-4 py-3 text-xs text-on-surface-variant">
                                {item.shiftLineCount || 0} shifts
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3 text-xs text-on-surface-variant font-bold">
                            {item.addendumsCount || (item.addendums?.length) || 0} addendums
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.startDate ? new Date(item.startDate).toLocaleDateString() : ""}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">
                            <div>{item.endDate ? new Date(item.endDate).toLocaleDateString() : ""}</div>
                            {item.contractExpiryStatus && item.contractExpiryStatus !== "NO_EXPIRY_DATE" && (
                              <span className={`mt-1 inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                item.contractExpiryStatus === "EXPIRED" ? "bg-red-100 text-red-700" :
                                item.contractExpiryStatus === "EXPIRING_SOON" ? "bg-amber-100 text-amber-700" :
                                "bg-green-100 text-green-700"
                              }`}>
                                {item.contractExpiryStatus === "EXPIRING_SOON" ? `Expiring (${item.daysToContractExpiry}d)` : item.contractExpiryStatus}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === "ACTIVE" ? "bg-status-success/15 text-status-success" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewContractDetails(item.id);
                              }}
                              className="text-primary hover:underline text-[11px] font-bold mr-3"
                            >
                              View
                            </button>
                            {canManage && (
                              <>
                                {(item.status === "DRAFT" || item.status === "REJECTED") && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEdit(item);
                                    }}
                                    className="text-secondary hover:underline text-[11px] font-bold mr-3"
                                  >
                                    Edit
                                  </button>
                                )}
                                {item.status === "DRAFT" && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm("Are you sure you want to delete this draft contract?")) {
                                        try {
                                          const res = await fetch(`/api/v1/manpower/${business}/contracts/${item.id}`, { method: "DELETE" });
                                          if (res.ok) {
                                            loadData();
                                          } else {
                                            const err = await res.json();
                                            alert(err.error || "Failed to delete contract");
                                          }
                                        } catch (e) {
                                          console.error(e);
                                          alert("Failed to connect to server");
                                        }
                                      }
                                    }}
                                    className="text-status-error hover:underline text-[11px] font-bold mr-3"
                                  >
                                    Delete
                                  </button>
                                )}
                                {item.status === "ACTIVE" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAddendumContract(item);
                                      setAddFormLineItems([]);
                                    }}
                                    className="text-status-warning hover:underline text-[11px] font-bold"
                                  >
                                    Add Addendum
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </>
                      )}
                      {master === "projects" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.code}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.contract?.title || item.contractId}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-xs text-on-surface" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => startEdit(item)}
                                className="text-primary hover:underline text-[11px] font-bold mr-3 animate-fade-in"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Are you sure you want to delete project ${item.name}?`)) {
                                    try {
                                      const res = await fetch(`/api/v1/manpower/${business}/projects/${item.id}`, { method: "DELETE" });
                                      const resJson = await res.json();
                                      if (res.ok) {
                                        if (resJson.deactivated) {
                                          alert(resJson.message || "Project has historical records and was deactivated instead of deleted.");
                                        } else {
                                          alert("Project deleted successfully");
                                        }
                                        loadData();
                                      } else {
                                        alert(resJson.error || "Failed to delete project");
                                      }
                                    } catch (e) {
                                      alert("Failed to connect to server");
                                    }
                                  }
                                }}
                                className="text-status-error hover:underline text-[11px] font-bold animate-fade-in"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </>
                      )}
                      {master === "sites" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                loadSiteDetails(item.id);
                              }}
                              className="text-primary hover:underline font-mono uppercase text-xs"
                            >
                              {item.code || item.id.substring(0, 8).toUpperCase()}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.project?.name || item.projectId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.radiusMeters}m</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.gatePassRequired ? "bg-primary-container/10 text-primary" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.gatePassRequired ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={() => startEdit(item)}
                                className="text-primary hover:underline text-[11px] font-bold mr-3"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </>
                      )}
                      {master === "categories" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.code}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isBlueCollar ? "bg-primary-container/10 text-primary" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.isBlueCollar ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isDeployableInRoster ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isDeployableInRoster ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.canWorkOvertime ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.canWorkOvertime ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.requiresMoiLicense ? "bg-primary-container/10 text-primary" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.requiresMoiLicense ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.requiresGatePassCheck ? "bg-primary-container/10 text-primary" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                              {item.requiresGatePassCheck ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={() => startEdit(item)}
                                className="text-primary hover:underline text-[11px] font-bold mr-3"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </>
                      )}
                      {(master === "zones" || master === "areas") && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.site?.name || item.siteId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.type}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </>
                      )}
                      {master === "manpower" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.id}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{item.email}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.manpowerCategoryId || "General"}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.dutyStatus === "ON_DUTY" ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.dutyStatus || "OFF_DUTY"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-right">
                            {item.operationType !== (isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT") ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-status-warning/15 text-status-warning border border-status-warning/20 animate-pulse">
                                  Operation Type Needs Sync
                                </span>
                                <button
                                  disabled={!canManage}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSyncOperationType(item);
                                  }}
                                  className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                                    canManage
                                      ? "bg-secondary hover:bg-secondary-container text-white cursor-pointer"
                                      : "bg-outline-variant/30 text-on-surface-variant/50 cursor-not-allowed"
                                  }`}
                                >
                                  Sync
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-status-success font-bold">Synced</span>
                            )}
                          </td>
                        </>
                      )}
                      {master === "shifts" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-on-surface">{item.site?.name || item.siteId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.locationUnit?.name || "All Site"}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.category?.name || item.categoryId}</td>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.shiftCode}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant font-bold">{item.requiredCount}</td>
                          <td className="px-4 py-3 text-xs">
                            <button
                              onClick={() => handleDeleteRequirement(item.id)}
                              className="text-status-error hover:underline text-[11px] font-bold"
                            >
                              Delete
                            </button>
                          </td>
                        </>
                      )}
                      {master === "coordinators" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.code}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.project?.name || item.projectId}</td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">
                            {item.coordinatorEmployee?.name || item.coordinator?.name || item.coordinatorEmployeeId}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(item);
                                }}
                                className="text-primary hover:underline text-[11px] font-bold mr-3"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this coordinator assignment?")) {
                                    const res = await fetch(`/api/v1/security/coordinators/${item.id}`, { method: "DELETE" });
                                    if (res.ok) {
                                      loadData();
                                    } else {
                                      alert("Failed to delete coordinator assignment");
                                    }
                                  }
                                }}
                                className="text-status-error hover:underline text-[11px] font-bold"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </>
                      )}
                      {master === "materials" && (
                        <>
                          <td className="px-4 py-3 text-xs font-bold text-primary">{item.materialCode}</td>
                          <td className="px-4 py-3 text-xs text-on-surface font-semibold">{item.materialName}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.materialCategory}</td>
                          <td className="px-4 py-3 text-xs text-on-surface">{item.unitOfMeasure}</td>
                          <td className="px-4 py-3 text-xs text-on-surface font-bold">
                            {item.defaultUnitPrice !== null && item.defaultUnitPrice !== undefined ? item.defaultUnitPrice.toFixed(2) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant font-medium uppercase">{item.operationType}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(item);
                                }}
                                className="text-primary hover:underline text-[11px] font-bold mr-3"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isSecurity && master === "projects" && selectedProjectId && renderProjectDetailsPanel()}
        {isSecurity && master === "sites" && selectedSiteId && renderSiteDetailsPanel()}
      </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`bg-surface rounded-xl border border-outline-variant shadow-lg overflow-hidden transition-all ${
            (master === "clients" || master === "contracts") ? "max-w-5xl w-full" : (master === "projects" || master === "sites") ? "max-w-2xl w-full" : "max-w-md w-full"
          }`}>
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-sm font-bold text-primary">Add New {masterLabel.replace(/s$/, "")}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className={`p-6 space-y-4 overflow-y-auto ${
                (master === "clients" || master === "contracts") ? "max-h-[80vh]" : (master === "projects" || master === "sites") ? "max-h-[75vh]" : "max-h-[60vh]"
              }`}>
                {formError && (
                  <div className="p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold">
                    {formError}
                  </div>
                )}

                {/* Form fields based on master list */}
                {master === "clients" && renderEnhancedCustomerForm(false)}

                {master === "contracts" && (
                  renderSecurityContractForm()
                )}

                 {master === "projects" && (
                   <>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract</label>
                       <select
                         required
                         className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                         value={formData.contractId || ""}
                         onChange={(e) => {
                           setFormData({ ...formData, contractId: e.target.value });
                           if (e.target.value) {
                             fetchProjectAllocationSummary("new", e.target.value);
                           } else {
                             setProjectAllocations([]);
                             setProjectRelieverAllocations([]);
                           }
                         }}
                       >
                         <option value="">Select Contract...</option>
                         {contracts.map(c => <option key={c.id} value={c.id}>{c.title} ({c.contractNumber})</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project Code</label>
                       <input
                         type="text"
                         required
                         className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                         value={formData.code || ""}
                         onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project Name</label>
                       <input
                         type="text"
                         required
                         className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                         value={formData.name || ""}
                         onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                       />
                     </div>

                     {formData.contractId && (
                       <div className="mt-4 p-4 bg-surface-container border border-outline-variant rounded-xl space-y-3 animate-fade-in">
                         <span className="block text-[10px] font-bold text-primary uppercase tracking-wider font-mono">Contract Manpower Requirements & Project Allocation</span>
                         {projectAllocations.length === 0 && projectRelieverAllocations.length === 0 ? (
                           <p className="text-[11px] text-on-surface-variant italic">This contract has no manpower requirements defined.</p>
                         ) : (
                           <div className="space-y-4">
                             {projectAllocations.length > 0 && (
                               <div className="space-y-2">
                                 <span className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Permanent Guard Headcounts</span>
                                 <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant">
                                   {projectAllocations.map((alloc, idx) => (
                                     <div key={alloc.requirementId || idx} className="grid grid-cols-12 gap-2 p-2.5 bg-surface-container-low items-center text-[11px]">
                                       <div className="col-span-5 font-bold text-on-surface">{alloc.position}</div>
                                       <div className="col-span-4 text-on-surface-variant">
                                         Contract: <span className="font-semibold">{alloc.contractQty}</span> | Avail: <span className="font-bold text-primary">{alloc.remainingAvailable}</span>
                                       </div>
                                       <div className="col-span-3 flex items-center gap-1.5 justify-end">
                                         <label className="text-[10px] text-on-surface-variant font-medium">Allocate:</label>
                                         <input
                                           type="number"
                                           min="0"
                                           max={alloc.remainingAvailable}
                                           value={alloc.allocatedToThis}
                                           onChange={(e) => {
                                             const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                             const updated = [...projectAllocations];
                                             updated[idx].allocatedToThis = Math.min(val, alloc.remainingAvailable);
                                             setProjectAllocations(updated);
                                           }}
                                           className="w-14 bg-surface-container-lowest border border-outline-variant rounded px-1.5 py-0.5 text-center font-bold text-on-surface focus:outline-none"
                                         />
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}

                             {projectRelieverAllocations.length > 0 && (
                               <div className="space-y-2">
                                 <span className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Reliever Guard Headcounts</span>
                                 <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant">
                                   {projectRelieverAllocations.map((alloc, idx) => (
                                     <div key={alloc.requirementId || idx} className="grid grid-cols-12 gap-2 p-2.5 bg-surface-container-low items-center text-[11px]">
                                       <div className="col-span-5 font-bold text-on-surface">{alloc.position}</div>
                                       <div className="col-span-4 text-on-surface-variant">
                                         Contract: <span className="font-semibold">{alloc.contractQty}</span> | Avail: <span className="font-bold text-primary">{alloc.remainingAvailable}</span>
                                       </div>
                                       <div className="col-span-3 flex items-center gap-1.5 justify-end">
                                         <label className="text-[10px] text-on-surface-variant font-medium">Allocate:</label>
                                         <input
                                           type="number"
                                           min="0"
                                           max={alloc.remainingAvailable}
                                           value={alloc.allocatedToThis}
                                           onChange={(e) => {
                                             const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                             const updated = [...projectRelieverAllocations];
                                             updated[idx].allocatedToThis = Math.min(val, alloc.remainingAvailable);
                                             setProjectRelieverAllocations(updated);
                                           }}
                                           className="w-14 bg-surface-container-lowest border border-outline-variant rounded px-1.5 py-0.5 text-center font-bold text-on-surface focus:outline-none"
                                         />
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     )}
                   </>
                 )}

                 {master === "sites" && (
                   <>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site Code</label>
                       <input
                         type="text"
                         disabled
                         className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                         value={formData.code || ""}
                         placeholder="Auto-generated (SSITE-XXXX)"
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project</label>
                       <select
                         required
                         className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                         value={formData.projectId || ""}
                         onChange={(e) => {
                           const val = e.target.value;
                           setFormData({ ...formData, projectId: val });
                           handleProjectChange(val, "new");
                         }}
                       >
                         <option value="">Select Project...</option>
                         {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site Name</label>
                       <input
                         type="text"
                         required
                         className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                         value={formData.name || ""}
                         onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                       />
                     </div>
                     <div className="grid grid-cols-3 gap-2">
                       <div>
                         <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Latitude</label>
                         <input
                           type="number"
                           step="0.000001"
                           className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                           value={formData.lat || ""}
                           onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Longitude</label>
                         <input
                           type="number"
                           step="0.000001"
                           className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                           value={formData.lng || ""}
                           onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Radius (m)</label>
                         <input
                           type="number"
                           className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                           value={formData.radiusMeters || "100"}
                           onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
                         />
                       </div>
                     </div>
                     <div className="space-y-3">
                       <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer mt-2 font-bold">
                         <input
                           type="checkbox"
                           checked={!!formData.gatePassRequired}
                           onChange={(e) => setFormData({ ...formData, gatePassRequired: e.target.checked })}
                           className="rounded border-outline-variant text-primary focus:ring-primary"
                         />
                         <span>Gate Pass Required for Entry/Exit</span>
                       </label>
                       {formData.gatePassRequired && (
                         <div>
                           <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Gate Pass Validation Mode</label>
                           <select
                             className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                             value={formData.gatePassValidationMode || "WARNING"}
                             onChange={(e) => setFormData({ ...formData, gatePassValidationMode: e.target.value })}
                           >
                             <option value="WARNING">WARNING (Log warning but allow punch)</option>
                             <option value="STRICT">STRICT (Block punch without valid pass)</option>
                           </select>
                         </div>
                       )}
                       <div>
                         <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks</label>
                         <textarea
                           className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                           rows={2}
                           value={formData.remarks || ""}
                           onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                           placeholder="Additional worksite details..."
                         />
                       </div>

                       {formData.projectId && (
                         <div className="mt-4 p-4 bg-surface-container border border-outline-variant rounded-xl space-y-3 animate-fade-in">
                           <span className="block text-[10px] font-bold text-primary uppercase tracking-wider font-mono">Project Manpower & Site Allocation</span>
                           {siteAllocations.length === 0 && siteRelieverAllocations.length === 0 ? (
                             <p className="text-[11px] text-on-surface-variant italic">This project has no manpower allocations defined.</p>
                           ) : (
                             <div className="space-y-4">
                               {siteAllocations.length > 0 && (
                                 <div className="space-y-2">
                                   <span className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Permanent Guard Headcounts</span>
                                   <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant">
                                     {siteAllocations.map((alloc, idx) => (
                                       <div key={alloc.position || idx} className="grid grid-cols-12 gap-2 p-2.5 bg-surface-container-low items-center text-[11px]">
                                         <div className="col-span-5 font-bold text-on-surface">{alloc.position}</div>
                                         <div className="col-span-4 text-on-surface-variant">
                                           Project Alloc: <span className="font-semibold">{alloc.projectQty}</span> | Avail: <span className="font-bold text-primary">{alloc.remainingAvailable}</span>
                                         </div>
                                         <div className="col-span-3 flex items-center gap-1.5 justify-end">
                                           <label className="text-[10px] text-on-surface-variant font-medium">Allocate:</label>
                                           <input
                                             type="number"
                                             min="0"
                                             max={alloc.remainingAvailable}
                                             value={alloc.allocatedToThis}
                                             onChange={(e) => {
                                               const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                               const updated = [...siteAllocations];
                                               updated[idx].allocatedToThis = Math.min(val, alloc.remainingAvailable);
                                               setSiteAllocations(updated);
                                             }}
                                             className="w-14 bg-surface-container-lowest border border-outline-variant rounded px-1.5 py-0.5 text-center font-bold text-on-surface focus:outline-none"
                                           />
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 </div>
                               )}

                               {siteRelieverAllocations.length > 0 && (
                                 <div className="space-y-2">
                                   <span className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Reliever Guard Headcounts</span>
                                   <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant animate-fade-in">
                                     {siteRelieverAllocations.map((alloc, idx) => (
                                       <div key={alloc.position || idx} className="flex flex-col gap-2 p-2.5 bg-surface-container-low text-[11px]">
                                         <div className="flex justify-between items-center">
                                           <div className="font-bold text-on-surface">{alloc.position}</div>
                                           <div className="text-on-surface-variant">
                                             Project Alloc: <span className="font-semibold">{alloc.projectQty}</span> | Avail: <span className="font-bold text-primary">{alloc.remainingAvailable}</span>
                                           </div>
                                         </div>
                                         <div className="flex justify-between items-center gap-4 mt-1">
                                           <div className="flex items-center gap-2">
                                             <span className="text-[10px] text-on-surface-variant">Type:</span>
                                             <select
                                               value={alloc.relieverPoolType || "DEDICATED"}
                                               onChange={(e) => {
                                                 const updated = [...siteRelieverAllocations];
                                                 updated[idx].relieverPoolType = e.target.value;
                                                 setSiteRelieverAllocations(updated);
                                               }}
                                               className="bg-surface-container-lowest border border-outline-variant rounded px-2 py-0.5 text-[10px] font-bold text-on-surface focus:outline-none"
                                             >
                                               <option value="DEDICATED">Dedicated to Site</option>
                                               <option value="SHARED">Shared (Reliever Pool)</option>
                                             </select>
                                           </div>
                                           <div className="flex items-center gap-1.5">
                                             <label className="text-[10px] text-on-surface-variant font-medium">Allocate:</label>
                                             <input
                                               type="number"
                                               min="0"
                                               max={alloc.remainingAvailable}
                                               value={alloc.allocatedToThis}
                                               onChange={(e) => {
                                                 const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                                 const updated = [...siteRelieverAllocations];
                                                 updated[idx].allocatedToThis = Math.min(val, alloc.remainingAvailable);
                                                 setSiteRelieverAllocations(updated);
                                               }}
                                               className="w-14 bg-surface-container-lowest border border-outline-variant rounded px-1.5 py-0.5 text-center font-bold text-on-surface focus:outline-none"
                                             />
                                           </div>
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 </div>
                               )}
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                      {renderSiteAllowanceAndShiftsFields()}
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked={formData.isActive !== false}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Active Worksite</span>
                      </label>
                  </>
                )}

                {master === "categories" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Code</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.code || ""}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Category Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-outline-variant/40">
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.isBlueCollar}
                          onChange={(e) => setFormData({ ...formData, isBlueCollar: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Blue Collar (Roster-based)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.isDeployableInRoster}
                          onChange={(e) => setFormData({ ...formData, isDeployableInRoster: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Deployable in Roster</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.canWorkOvertime}
                          onChange={(e) => setFormData({ ...formData, canWorkOvertime: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Can Work Overtime</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.requiresMoiLicense}
                          onChange={(e) => setFormData({ ...formData, requiresMoiLicense: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Requires MOI Security Guard License</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.requiresGatePassCheck}
                          onChange={(e) => setFormData({ ...formData, requiresGatePassCheck: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Requires Gate Pass Check</span>
                      </label>
                    </div>
                  </>
                )}

                {(master === "zones" || master === "areas") && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.siteId || ""}
                        onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                      >
                        <option value="">Select Site...</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Unit Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Unit Type</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.type || ""}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      >
                        {isSecurity ? (
                          <>
                            <option value="GATE">Gate</option>
                            <option value="POST">Post</option>
                            <option value="ZONE">Zone</option>
                          </>
                        ) : (
                          <>
                            <option value="AREA">Area</option>
                            <option value="FLOOR">Floor</option>
                            <option value="BLOCK">Block</option>
                            <option value="CLEANING_ZONE">Cleaning Zone</option>
                          </>
                        )}
                      </select>
                    </div>
                  </>
                )}

                {master === "manpower" && (
                  <>
                    <div className="flex gap-4 p-2 bg-surface-container-low rounded-lg border border-outline-variant/60 mb-3">
                      <label className="flex items-center gap-1.5 text-xs text-on-surface cursor-pointer font-bold">
                        <input
                          type="radio"
                          name="manpowerMode"
                          value="promote"
                          checked={formData.mode !== "create"}
                          onChange={() => {
                            setFormData({ mode: "promote", isActive: true });
                          }}
                          className="text-primary focus:ring-primary"
                        />
                        <span>Promote Existing Employee</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-on-surface cursor-pointer font-bold">
                        <input
                          type="radio"
                          name="manpowerMode"
                          value="create"
                          checked={formData.mode === "create"}
                          onChange={() => {
                            setFormData({ mode: "create", isActive: true });
                          }}
                          className="text-primary focus:ring-primary"
                        />
                        <span>Create New Employee</span>
                      </label>
                    </div>

                    {formData.mode !== "create" ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Select Employee to Promote</label>
                          <select
                            required
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                            value={formData.id || ""}
                            onChange={(e) => {
                              const emp = workforceEmployees.find(emp => emp.id === e.target.value);
                              if (emp) {
                                setFormData({
                                  ...formData,
                                  id: emp.id,
                                  name: emp.name,
                                  email: emp.email,
                                  mode: "promote"
                                });
                              } else {
                                setFormData({ ...formData, id: "", name: "", email: "", mode: "promote" });
                              }
                            }}
                          >
                            <option value="">-- Choose Employee --</option>
                            {workforceEmployees
                              .filter(emp => {
                                const normalizeCategory = (cat?: string) => {
                                  if (!cat) return "";
                                  return cat.trim().toUpperCase().replace(/[\s_-]+/g, "_");
                                };
                                const normalizeCompanyCode = (code?: string) => {
                                  if (!code) return "";
                                  return code.trim().toUpperCase();
                                };
                                
                                const empCompanyCode = normalizeCompanyCode(emp.company?.companyCode || emp.companyCode);
                                const empCategory = normalizeCategory(emp.employeeCategory);
                                const targetCompanyCode = isSecurity ? "HS01" : "TC01";
                                const targetOperationType = isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";

                                return (
                                  empCompanyCode === targetCompanyCode &&
                                  empCategory === "BLUE_COLLAR" &&
                                  (emp.isActive === true || emp.status === "Active" || emp.employmentStatus === "ACTIVE") &&
                                  emp.operationType !== targetOperationType
                                );
                              })
                              .map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                              ))
                            }
                          </select>
                        </div>
                        {formData.id && (
                          <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/60 space-y-1 text-xs text-on-surface-variant">
                            <p><span className="font-bold text-on-surface">ID:</span> {formData.id}</p>
                            <p><span className="font-bold text-on-surface">Name:</span> {formData.name}</p>
                            <p><span className="font-bold text-on-surface">Email:</span> {formData.email}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Employee ID</label>
                          <input
                            type="text"
                            required
                            placeholder={`e.g. ${isSecurity ? "SEC" : "FM"}-001`}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                            value={formData.id || ""}
                            onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Display Name</label>
                          <input
                            type="text"
                            required
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                            value={formData.name || ""}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Email</label>
                          <input
                            type="email"
                            required
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                            value={formData.email || ""}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Manpower Category</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.manpowerCategoryId || ""}
                        onChange={(e) => setFormData({ ...formData, manpowerCategoryId: e.target.value })}
                      >
                        <option value="">Select Category...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                      </select>
                    </div>
                  </>
                )}

                {master === "coordinators" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.projectId || ""}
                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      >
                        <option value="">Select Project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Coordinator Employee</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.coordinatorEmployeeId || ""}
                        onChange={(e) => setFormData({ ...formData, coordinatorEmployeeId: e.target.value })}
                      >
                        <option value="">Select Coordinator...</option>
                        {workforceEmployees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={formData.isActive !== false}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      <span>Active Assignment</span>
                    </label>
                  </>
                )}
                {master === "materials" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Material Name *</label>
                      <input
                        required
                        type="text"
                        placeholder="Material Name"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.materialName || ""}
                        onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Category *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.materialCategory || ""}
                        onChange={(e) => setFormData({ ...formData, materialCategory: e.target.value })}
                      >
                        <option value="">Select Category...</option>
                        <option value="Uniform">Uniform</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Vehicle">Vehicle</option>
                        <option value="Consumable">Consumable</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Unit of Measure (UOM) *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.unitOfMeasure || ""}
                        onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                      >
                        <option value="">Select UOM...</option>
                        <option value="Each">Each</option>
                        <option value="Pack">Pack</option>
                        <option value="Set">Set</option>
                        <option value="Pair">Pair</option>
                        <option value="Month">Month</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Default Unit Price</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.defaultUnitPrice === null || formData.defaultUnitPrice === undefined ? "" : formData.defaultUnitPrice}
                        onChange={(e) => setFormData({ ...formData, defaultUnitPrice: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Scope / Operation Type *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.operationType || "SHARED"}
                        onChange={(e) => setFormData({ ...formData, operationType: e.target.value })}
                      >
                        <option value="SHARED">SHARED</option>
                        <option value="SECURITY_GUARDING">SECURITY_GUARDING</option>
                        <option value="FACILITY_MANAGEMENT">FACILITY_MANAGEMENT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks</label>
                      <textarea
                        placeholder="Remarks"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.remarks || ""}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="materialIsActive"
                        checked={formData.isActive !== false}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      />
                      <label htmlFor="materialIsActive" className="text-xs text-on-surface">Active</label>
                    </div>
                  </>
                )}

                {master === "shifts" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Worksite</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.siteId || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, siteId: val, locationUnitId: "" });
                        }}
                      >
                        <option value="">Select Site...</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site Zone / Unit (Optional)</label>
                      <select
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.locationUnitId || ""}
                        onChange={(e) => setFormData({ ...formData, locationUnitId: e.target.value })}
                        disabled={!formData.siteId}
                      >
                        <option value="">All Site / General</option>
                        {locationUnits.filter((u: any) => u.siteId === formData.siteId).map((u: any) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.type})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Manpower Category</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.categoryId || ""}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      >
                        <option value="">Select Category...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Shift Reference Code</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.shiftCode || ""}
                        onChange={(e) => setFormData({ ...formData, shiftCode: e.target.value })}
                      >
                        <option value="">Select Shift Reference...</option>
                        {shiftsList.map(s => <option key={s.id} value={s.code}>{s.name} ({s.code}: {s.startTime}-{s.endTime})</option>)}
                        <option value="GEN-001">GEN-001 (General 9:00 - 18:00)</option>
                        <option value="SHF-DS-01">SHF-DS-01 (Day Shift 07:00 - 19:00)</option>
                        <option value="SHF-NS-02">SHF-NS-02 (Night Shift 19:00 - 07:00)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Required Headcount</label>
                      <input
                        type="number"
                        required
                        min="1"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.requiredCount || "1"}
                        onChange={(e) => setFormData({ ...formData, requiredCount: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
              {master !== "contracts" && (
                <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-3 py-2 text-white text-xs font-bold rounded-lg transition-colors ${
                      isSecurity ? "bg-primary hover:bg-primary-container" : "bg-secondary hover:bg-secondary-container"
                    }`}
                  >
                    Create
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editItem && (
        master === "contracts" ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-surface rounded-xl border border-outline-variant shadow-lg max-w-5xl w-full overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                <h3 className="text-sm font-bold text-primary">Edit Contract</h3>
                <button onClick={() => { setEditItem(null); setFormData({}); }} className="text-on-surface-variant hover:text-primary">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[80vh]">
                {renderSecurityContractForm()}
              </div>
            </div>
          </div>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={`bg-surface rounded-xl border border-outline-variant shadow-lg overflow-hidden transition-all ${
              master === "clients" ? "max-w-5xl w-full" : (master === "projects" || master === "sites") ? "max-w-2xl w-full" : "max-w-md w-full"
            }`}>
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                <h3 className="text-sm font-bold text-primary">Edit {masterLabel.replace(/s$/, "")}</h3>
                <button onClick={() => { setEditItem(null); setFormData({}); }} className="text-on-surface-variant hover:text-primary">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className={`p-6 space-y-4 overflow-y-auto ${
                  master === "clients" ? "max-h-[80vh]" : (master === "projects" || master === "sites") ? "max-h-[75vh]" : "max-h-[60vh]"
                }`}>
                  {formError && (
                    <div className="p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold">
                      {formError}
                    </div>
                  )}

                  {/* Form fields based on master list */}
                  {master === "clients" && renderEnhancedCustomerForm(true)}

                {master === "contracts" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Client</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.clientId || ""}
                        onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      >
                        <option value="">Select Client...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract Number</label>
                      <input
                        type="text"
                        disabled
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                        value={formData.contractNumber || ""}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract Title</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.title || ""}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Start Date</label>
                        <input
                          type="date"
                          required
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.startDate ? formData.startDate.substring(0, 10) : ""}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">End Date</label>
                        <input
                          type="date"
                          required
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          value={formData.endDate ? formData.endDate.substring(0, 10) : ""}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                 {master === "projects" && (
                   <>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Contract</label>
                       <select
                         required
                         className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                         value={formData.contractId || ""}
                         onChange={(e) => {
                           setFormData({ ...formData, contractId: e.target.value });
                           if (e.target.value) {
                             fetchProjectAllocationSummary(editItem.id, e.target.value);
                           } else {
                             setProjectAllocations([]);
                             setProjectRelieverAllocations([]);
                           }
                         }}
                       >
                         <option value="">Select Contract...</option>
                         {contracts.map(c => <option key={c.id} value={c.id}>{c.title} ({c.contractNumber})</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project Code</label>
                       <input
                         type="text"
                         required
                         disabled
                         className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                         value={formData.code || ""}
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project Name</label>
                       <input
                         type="text"
                         required
                         className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                         value={formData.name || ""}
                         onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                       />
                     </div>

                     {formData.contractId && (
                       <div className="mt-4 p-4 bg-surface-container border border-outline-variant rounded-xl space-y-3 animate-fade-in">
                         <span className="block text-[10px] font-bold text-primary uppercase tracking-wider font-mono">Contract Manpower Requirements & Project Allocation</span>
                         {projectAllocations.length === 0 && projectRelieverAllocations.length === 0 ? (
                           <p className="text-[11px] text-on-surface-variant italic">This contract has no manpower requirements defined.</p>
                         ) : (
                           <div className="space-y-4">
                             {projectAllocations.length > 0 && (
                               <div className="space-y-2">
                                 <span className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Permanent Guard Headcounts</span>
                                 <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant">
                                   {projectAllocations.map((alloc, idx) => (
                                     <div key={alloc.requirementId || idx} className="grid grid-cols-12 gap-2 p-2.5 bg-surface-container-low items-center text-[11px]">
                                       <div className="col-span-5 font-bold text-on-surface">{alloc.position}</div>
                                       <div className="col-span-4 text-on-surface-variant">
                                         Contract: <span className="font-semibold">{alloc.contractQty}</span> | Avail: <span className="font-bold text-primary">{alloc.remainingAvailable + alloc.allocatedToThis}</span>
                                       </div>
                                       <div className="col-span-3 flex items-center gap-1.5 justify-end">
                                         <label className="text-[10px] text-on-surface-variant font-medium">Allocate:</label>
                                         <input
                                           type="number"
                                           min="0"
                                           max={alloc.remainingAvailable + alloc.allocatedToThis}
                                           value={alloc.allocatedToThis}
                                           onChange={(e) => {
                                             const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                             const updated = [...projectAllocations];
                                             const limit = alloc.remainingAvailable + alloc.allocatedToThis;
                                             updated[idx].allocatedToThis = Math.min(val, limit);
                                             setProjectAllocations(updated);
                                           }}
                                           className="w-14 bg-surface-container-lowest border border-outline-variant rounded px-1.5 py-0.5 text-center font-bold text-on-surface focus:outline-none"
                                         />
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}

                             {projectRelieverAllocations.length > 0 && (
                               <div className="space-y-2">
                                 <span className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Reliever Guard Headcounts</span>
                                 <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant">
                                   {projectRelieverAllocations.map((alloc, idx) => (
                                     <div key={alloc.requirementId || idx} className="grid grid-cols-12 gap-2 p-2.5 bg-surface-container-low items-center text-[11px]">
                                       <div className="col-span-5 font-bold text-on-surface">{alloc.position}</div>
                                       <div className="col-span-4 text-on-surface-variant">
                                         Contract: <span className="font-semibold">{alloc.contractQty}</span> | Avail: <span className="font-bold text-primary">{alloc.remainingAvailable + alloc.allocatedToThis}</span>
                                       </div>
                                       <div className="col-span-3 flex items-center gap-1.5 justify-end">
                                         <label className="text-[10px] text-on-surface-variant font-medium">Allocate:</label>
                                         <input
                                           type="number"
                                           min="0"
                                           max={alloc.remainingAvailable + alloc.allocatedToThis}
                                           value={alloc.allocatedToThis}
                                           onChange={(e) => {
                                             const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                             const updated = [...projectRelieverAllocations];
                                             const limit = alloc.remainingAvailable + alloc.allocatedToThis;
                                             updated[idx].allocatedToThis = Math.min(val, limit);
                                             setProjectRelieverAllocations(updated);
                                           }}
                                           className="w-14 bg-surface-container-lowest border border-outline-variant rounded px-1.5 py-0.5 text-center font-bold text-on-surface focus:outline-none"
                                         />
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     )}
                   </>
                 )}

                 {master === "sites" && (
                   <>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site Code</label>
                       <input
                         type="text"
                         disabled
                         className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                         value={formData.code || ""}
                         placeholder="Auto-generated (SSITE-XXXX)"
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project</label>
                       <select
                         required
                         className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                         value={formData.projectId || ""}
                         onChange={(e) => {
                           const val = e.target.value;
                           setFormData({ ...formData, projectId: val });
                           handleProjectChange(val, editItem.id);
                         }}
                       >
                         <option value="">Select Project...</option>
                         {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Site Name</label>
                       <input
                         type="text"
                         required
                         className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                         value={formData.name || ""}
                         onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                       />
                     </div>
                     <div className="grid grid-cols-3 gap-2">
                       <div>
                         <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Latitude</label>
                         <input
                           type="number"
                           step="0.000001"
                           className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                           value={formData.lat || ""}
                           onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Longitude</label>
                         <input
                           type="number"
                           step="0.000001"
                           className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                           value={formData.lng || ""}
                           onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Radius (m)</label>
                         <input
                           type="number"
                           className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                           value={formData.radiusMeters || "100"}
                           onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
                         />
                       </div>
                     </div>
                     <div className="space-y-3">
                       <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer mt-2 font-bold">
                         <input
                           type="checkbox"
                           checked={!!formData.gatePassRequired}
                           onChange={(e) => setFormData({ ...formData, gatePassRequired: e.target.checked })}
                           className="rounded border-outline-variant text-primary focus:ring-primary"
                         />
                         <span>Gate Pass Required for Entry/Exit</span>
                       </label>
                       {formData.gatePassRequired && (
                         <div>
                           <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Gate Pass Validation Mode</label>
                           <select
                             className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                             value={formData.gatePassValidationMode || "WARNING"}
                             onChange={(e) => setFormData({ ...formData, gatePassValidationMode: e.target.value })}
                           >
                             <option value="WARNING">WARNING (Log warning but allow punch)</option>
                             <option value="STRICT">STRICT (Block punch without valid pass)</option>
                           </select>
                         </div>
                       )}
                       <div>
                         <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks</label>
                         <textarea
                           className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                           rows={2}
                           value={formData.remarks || ""}
                           onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                           placeholder="Additional worksite details..."
                         />
                       </div>

                       {formData.projectId && (
                         <div className="mt-4 p-4 bg-surface-container border border-outline-variant rounded-xl space-y-3 animate-fade-in">
                           <span className="block text-[10px] font-bold text-primary uppercase tracking-wider font-mono">Project Manpower & Site Allocation</span>
                           {siteAllocations.length === 0 && siteRelieverAllocations.length === 0 ? (
                             <p className="text-[11px] text-on-surface-variant italic">This project has no manpower allocations defined.</p>
                           ) : (
                             <div className="space-y-4">
                               {siteAllocations.length > 0 && (
                                 <div className="space-y-2">
                                   <span className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Permanent Guard Headcounts</span>
                                   <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant">
                                     {siteAllocations.map((alloc, idx) => (
                                       <div key={alloc.position || idx} className="grid grid-cols-12 gap-2 p-2.5 bg-surface-container-low items-center text-[11px]">
                                         <div className="col-span-5 font-bold text-on-surface">{alloc.position}</div>
                                         <div className="col-span-4 text-on-surface-variant">
                                           Project Alloc: <span className="font-semibold">{alloc.projectQty}</span> | Avail: <span className="font-bold text-primary">{alloc.remainingAvailable + alloc.allocatedToThis}</span>
                                         </div>
                                         <div className="col-span-3 flex items-center gap-1.5 justify-end">
                                           <label className="text-[10px] text-on-surface-variant font-medium">Allocate:</label>
                                           <input
                                             type="number"
                                             min="0"
                                             max={alloc.remainingAvailable + alloc.allocatedToThis}
                                             value={alloc.allocatedToThis}
                                             onChange={(e) => {
                                               const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                               const updated = [...siteAllocations];
                                               const limit = alloc.remainingAvailable + alloc.allocatedToThis;
                                               updated[idx].allocatedToThis = Math.min(val, limit);
                                               setSiteAllocations(updated);
                                             }}
                                             className="w-14 bg-surface-container-lowest border border-outline-variant rounded px-1.5 py-0.5 text-center font-bold text-on-surface focus:outline-none"
                                           />
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 </div>
                               )}

                               {siteRelieverAllocations.length > 0 && (
                                 <div className="space-y-2">
                                   <span className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Reliever Guard Headcounts</span>
                                   <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant animate-fade-in">
                                     {siteRelieverAllocations.map((alloc, idx) => (
                                       <div key={alloc.position || idx} className="flex flex-col gap-2 p-2.5 bg-surface-container-low text-[11px]">
                                         <div className="flex justify-between items-center">
                                           <div className="font-bold text-on-surface">{alloc.position}</div>
                                           <div className="text-on-surface-variant">
                                             Project Alloc: <span className="font-semibold">{alloc.projectQty}</span> | Avail: <span className="font-bold text-primary">{alloc.remainingAvailable + alloc.allocatedToThis}</span>
                                           </div>
                                         </div>
                                         <div className="flex justify-between items-center gap-4 mt-1">
                                           <div className="flex items-center gap-2">
                                             <span className="text-[10px] text-on-surface-variant">Type:</span>
                                             <select
                                               value={alloc.relieverPoolType || "DEDICATED"}
                                               onChange={(e) => {
                                                 const updated = [...siteRelieverAllocations];
                                                 updated[idx].relieverPoolType = e.target.value;
                                                 setSiteRelieverAllocations(updated);
                                               }}
                                               className="bg-surface-container-lowest border border-outline-variant rounded px-2 py-0.5 text-[10px] font-bold text-on-surface focus:outline-none"
                                             >
                                               <option value="DEDICATED">Dedicated to Site</option>
                                               <option value="SHARED">Shared (Reliever Pool)</option>
                                             </select>
                                           </div>
                                           <div className="flex items-center gap-1.5">
                                             <label className="text-[10px] text-on-surface-variant font-medium">Allocate:</label>
                                             <input
                                               type="number"
                                               min="0"
                                               max={alloc.remainingAvailable + alloc.allocatedToThis}
                                               value={alloc.allocatedToThis}
                                               onChange={(e) => {
                                                 const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                                 const updated = [...siteRelieverAllocations];
                                                 const limit = alloc.remainingAvailable + alloc.allocatedToThis;
                                                 updated[idx].allocatedToThis = Math.min(val, limit);
                                                 setSiteRelieverAllocations(updated);
                                               }}
                                               className="w-14 bg-surface-container-lowest border border-outline-variant rounded px-1.5 py-0.5 text-center font-bold text-on-surface focus:outline-none"
                                             />
                                           </div>
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 </div>
                               )}
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                      {renderSiteAllowanceAndShiftsFields()}
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked={formData.isActive !== false}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Active Worksite</span>
                      </label>
                  </>
                )}

                {master === "categories" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Code</label>
                      <input
                        type="text"
                        required
                        disabled
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                        value={formData.code || ""}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Category Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-outline-variant/40">
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.isBlueCollar}
                          onChange={(e) => setFormData({ ...formData, isBlueCollar: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Blue Collar (Roster-based)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.isDeployableInRoster}
                          onChange={(e) => setFormData({ ...formData, isDeployableInRoster: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Deployable in Roster</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.canWorkOvertime}
                          onChange={(e) => setFormData({ ...formData, canWorkOvertime: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Can Work Overtime</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.requiresMoiLicense}
                          onChange={(e) => setFormData({ ...formData, requiresMoiLicense: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Requires MOI Security Guard License</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.requiresGatePassCheck}
                          onChange={(e) => setFormData({ ...formData, requiresGatePassCheck: e.target.checked })}
                          className="rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>Requires Gate Pass Check</span>
                      </label>
                    </div>
                  </>
                )}

                {master === "coordinators" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Project</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.projectId || ""}
                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      >
                        <option value="">Select Project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Coordinator Employee</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.coordinatorEmployeeId || ""}
                        onChange={(e) => setFormData({ ...formData, coordinatorEmployeeId: e.target.value })}
                      >
                        <option value="">Select Coordinator...</option>
                        {workforceEmployees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {master === "materials" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Material Name *</label>
                      <input
                        required
                        type="text"
                        placeholder="Material Name"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.materialName || ""}
                        onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Category *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.materialCategory || ""}
                        onChange={(e) => setFormData({ ...formData, materialCategory: e.target.value })}
                      >
                        <option value="">Select Category...</option>
                        <option value="Uniform">Uniform</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Vehicle">Vehicle</option>
                        <option value="Consumable">Consumable</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Unit of Measure (UOM) *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.unitOfMeasure || ""}
                        onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                      >
                        <option value="">Select UOM...</option>
                        <option value="Each">Each</option>
                        <option value="Pack">Pack</option>
                        <option value="Set">Set</option>
                        <option value="Pair">Pair</option>
                        <option value="Month">Month</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Default Unit Price</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.defaultUnitPrice === null || formData.defaultUnitPrice === undefined ? "" : formData.defaultUnitPrice}
                        onChange={(e) => setFormData({ ...formData, defaultUnitPrice: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Scope / Operation Type *</label>
                      <select
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.operationType || "SHARED"}
                        onChange={(e) => setFormData({ ...formData, operationType: e.target.value })}
                      >
                        <option value="SHARED">SHARED</option>
                        <option value="SECURITY_GUARDING">SECURITY_GUARDING</option>
                        <option value="FACILITY_MANAGEMENT">FACILITY_MANAGEMENT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Remarks</label>
                      <textarea
                        placeholder="Remarks"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                        value={formData.remarks || ""}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* Add Status Option for Edits */}
                <div className="pt-2 border-t border-outline-variant/40">
                  <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span>Active Status</span>
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => { setEditItem(null); setFormData({}); }}
                  className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-3 py-2 text-white text-xs font-bold rounded-lg transition-colors ${
                    isSecurity ? "bg-primary hover:bg-primary-container" : "bg-secondary hover:bg-secondary-container"
                  }`}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )
    )}

      {/* Client Detail Drawer */}
      {selectedClientDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 p-0 transition-opacity">
          <div className="bg-surface w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden text-on-surface">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider mr-2">
                  {selectedClientDetail.customerType}
                </span>
                <h3 className="text-base font-bold text-primary inline-block">{selectedClientDetail.name} ({selectedClientDetail.code})</h3>
              </div>
              <button 
                onClick={() => setSelectedClientDetail(null)} 
                className="text-on-surface-variant hover:text-primary w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2 text-xs">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Profile Details</h4>
                  {selectedClientDetail.customerType === "COMPANY" ? (
                    <>
                      <p><span className="text-on-surface-variant font-medium">Trading Name:</span> <span className="font-semibold">{selectedClientDetail.tradingName || "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">Industry Type:</span> <span className="font-semibold">{selectedClientDetail.businessType || "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">CR Number:</span> <span className="font-semibold">{selectedClientDetail.crNumber || "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">CR Expiry:</span> <span className="font-semibold">{selectedClientDetail.crExpiryDate ? new Date(selectedClientDetail.crExpiryDate).toLocaleDateString() : "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">Establishment Card:</span> <span className="font-semibold">{selectedClientDetail.establishmentCardNumber || "N/A"}</span></p>
                    </>
                  ) : (
                    <>
                      <p><span className="text-on-surface-variant font-medium">Nationality:</span> <span className="font-semibold">{selectedClientDetail.nationality || "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">Date of Birth:</span> <span className="font-semibold">{selectedClientDetail.dateOfBirth ? new Date(selectedClientDetail.dateOfBirth).toLocaleDateString() : "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">QID Number:</span> <span className="font-semibold">{selectedClientDetail.qidNumber || "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">QID Expiry:</span> <span className="font-semibold">{selectedClientDetail.qidExpiryDate ? new Date(selectedClientDetail.qidExpiryDate).toLocaleDateString() : "N/A"}</span></p>
                      <p><span className="text-on-surface-variant font-medium">Passport Number:</span> <span className="font-semibold">{selectedClientDetail.passportNumber || "N/A"}</span></p>
                    </>
                  )}
                  <p><span className="text-on-surface-variant font-medium">Status:</span> 
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${selectedClientDetail.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}>
                      {selectedClientDetail.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
                
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2 text-xs">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Main Contacts</h4>
                  <p><span className="text-on-surface-variant font-medium">Phone:</span> <span className="font-semibold">{selectedClientDetail.mainPhone || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Email:</span> <span className="font-semibold">{selectedClientDetail.mainEmail || "N/A"}</span></p>
                  {selectedClientDetail.customerType === "COMPANY" ? (
                    <p><span className="text-on-surface-variant font-medium">Website:</span> <span className="font-semibold">{selectedClientDetail.website || "N/A"}</span></p>
                  ) : (
                    <p><span className="text-on-surface-variant font-medium">WhatsApp:</span> <span className="font-semibold">{selectedClientDetail.website || "N/A"}</span></p>
                  )}
                  <p><span className="text-on-surface-variant font-medium">PO Box:</span> <span className="font-semibold">{selectedClientDetail.poBox || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Address:</span> <span className="font-semibold">
                    {[selectedClientDetail.addressLine1, selectedClientDetail.zone, selectedClientDetail.area, selectedClientDetail.city].filter(Boolean).join(", ") || "N/A"}
                  </span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2 text-xs">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Day-to-Day Operations Contact</h4>
                  <p><span className="text-on-surface-variant font-medium">Name:</span> <span className="font-semibold">{selectedClientDetail.operationContactName || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Designation:</span> <span className="font-semibold">{selectedClientDetail.operationContactDesignation || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Mobile:</span> <span className="font-semibold">{selectedClientDetail.operationContactMobile || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Email:</span> <span className="font-semibold">{selectedClientDetail.operationContactEmail || "N/A"}</span></p>
                </div>
                
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2 text-xs">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Finance & Billing Contact</h4>
                  <p><span className="text-on-surface-variant font-medium">Name:</span> <span className="font-semibold">{selectedClientDetail.financeContactName || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Mobile:</span> <span className="font-semibold">{selectedClientDetail.financeContactMobile || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Billing Email:</span> <span className="font-semibold">{selectedClientDetail.billingEmail || "N/A"}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Payment Terms:</span> <span className="font-semibold">{selectedClientDetail.paymentTerms || "N/A"}</span></p>
                </div>
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2 text-xs">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Internal Sales Person / Account Manager</h4>
                <p><span className="text-on-surface-variant font-medium">Account Manager:</span> <span className="font-semibold">{selectedClientDetail.internalSalesPersonName || "N/A"}</span></p>
                <p><span className="text-on-surface-variant font-medium">Mobile:</span> <span className="font-semibold">{selectedClientDetail.internalSalesPersonMobile || "N/A"}</span></p>
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Linked Contracts</h4>
                {(!selectedClientDetail.contracts || selectedClientDetail.contracts.length === 0) ? (
                  <p className="text-[11px] text-on-surface-variant italic">No contracts associated with this customer yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedClientDetail.contracts.map((c: any) => (
                      <div key={c.id} className="flex justify-between items-center bg-surface-container-lowest p-2 border border-outline-variant rounded-lg text-xs">
                        <div>
                          <p className="font-bold text-primary">{c.title} ({c.contractNumber})</p>
                          <p className="text-[10px] text-on-surface-variant">Duration: {new Date(c.startDate).toLocaleDateString()} to {new Date(c.endDate).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === "ACTIVE" ? "bg-status-success/15 text-status-success" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Uploaded Document Metadata</h4>
                {(!selectedClientDetail.documents || selectedClientDetail.documents.length === 0) ? (
                  <p className="text-[11px] text-on-surface-variant italic">No documents attached.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                          <th className="pb-2">Document Type</th>
                          <th className="pb-2">File Name</th>
                          <th className="pb-2">Expiry Date</th>
                          <th className="pb-2">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClientDetail.documents.map((d: any) => (
                          <tr key={d.id} className="border-b border-outline-variant/30 hover:bg-surface-container-lowest">
                            <td className="py-2 font-medium text-on-surface">{d.documentType}</td>
                            <td className="py-2 text-on-surface-variant italic">{d.fileName}</td>
                            <td className="py-2 text-on-surface-variant">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : "N/A"}</td>
                            <td className="py-2 text-on-surface-variant">{d.remarks || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant flex justify-end bg-surface-container-low">
              <button 
                onClick={() => setSelectedClientDetail(null)} 
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-container transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Detail Drawer */}
      {selectedContractDetail && (() => {
        const { effectiveManpower, effectiveReliever, effectiveShift } = getEffectiveContractManpower(selectedContractDetail);
        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/50 p-0 transition-opacity">
            <div className="bg-surface w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden text-on-surface">
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                <div>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider mr-2">
                    Contract
                  </span>
                  <h3 className="text-base font-bold text-primary inline-block">{selectedContractDetail.title} ({selectedContractDetail.contractNumber})</h3>
                </div>
                <button 
                  onClick={() => setSelectedContractDetail(null)} 
                  className="text-on-surface-variant hover:text-primary w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              
              <div className="p-6 space-y-6 flex-1 overflow-y-auto text-xs">
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-2">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Contract Summary</h4>
                  <p><span className="text-on-surface-variant font-medium">Client:</span> <span className="font-semibold">{selectedContractDetail.client?.name || selectedContractDetail.clientId}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Duration:</span> <span className="font-semibold">{new Date(selectedContractDetail.startDate).toLocaleDateString()} to {new Date(selectedContractDetail.endDate).toLocaleDateString()}</span></p>
                  <p><span className="text-on-surface-variant font-medium">Status:</span> 
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${selectedContractDetail.status === "ACTIVE" ? "bg-status-success/15 text-status-success" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                      {selectedContractDetail.status}
                    </span>
                  </p>
                  {selectedContractDetail.remarks && <p><span className="text-on-surface-variant font-medium">Remarks:</span> <span>{selectedContractDetail.remarks}</span></p>}
                </div>

                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Manpower Requirements</h4>
                  {(!effectiveManpower || effectiveManpower.length === 0) ? (
                    <p className="text-[11px] text-on-surface-variant italic">No manpower requirements logged.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                            <th className="pb-2">Position</th>
                            <th className="pb-2">Quantity</th>
                            <th className="pb-2">Deployment Type</th>
                            <th className="pb-2">Source / Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {effectiveManpower.map((mr: any, index: number) => (
                            <tr key={index} className="border-b border-outline-variant/30 hover:bg-surface-container-lowest">
                              <td className="py-2 font-medium text-on-surface">{mr.position}</td>
                              <td className="py-2 text-on-surface-variant font-bold">{mr.quantity}</td>
                              <td className="py-2 text-on-surface-variant">{mr.deploymentType || "PERMANENT"}</td>
                              <td className="py-2 text-on-surface-variant">
                                {mr.originalQty !== mr.quantity ? (
                                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                                    Modified by Addendum ({mr.addendumQty >= 0 ? `+${mr.addendumQty}` : mr.addendumQty})
                                  </span>
                                ) : mr.originalQty === 0 ? (
                                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                                    Source: Addendum
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-on-surface-variant/75 bg-surface-container-high/40 px-1.5 py-0.5 rounded">
                                    Original Contract
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Reliever Requirements</h4>
                  {(!effectiveReliever || effectiveReliever.length === 0) ? (
                    <p className="text-[11px] text-on-surface-variant italic">No reliever requirements logged.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                            <th className="pb-2">Position</th>
                            <th className="pb-2">Quantity</th>
                            <th className="pb-2">Source Preference</th>
                            <th className="pb-2">Source / Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {effectiveReliever.map((rr: any, index: number) => (
                            <tr key={index} className="border-b border-outline-variant/30 hover:bg-surface-container-lowest">
                              <td className="py-2 font-medium text-on-surface">{rr.position}</td>
                              <td className="py-2 text-on-surface-variant font-bold">{rr.quantity}</td>
                              <td className="py-2 text-on-surface-variant">{rr.sourcePreference}</td>
                              <td className="py-2 text-on-surface-variant">
                                {rr.originalQty !== rr.quantity ? (
                                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                                    Modified by Addendum ({rr.addendumQty >= 0 ? `+${rr.addendumQty}` : rr.addendumQty})
                                  </span>
                                ) : rr.originalQty === 0 ? (
                                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                                    Source: Addendum
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-on-surface-variant/75 bg-surface-container-high/40 px-1.5 py-0.5 rounded">
                                    Original Contract
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Shift Requirements</h4>
                  {(!effectiveShift || effectiveShift.length === 0) ? (
                    <p className="text-[11px] text-on-surface-variant italic">No shift requirements logged.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-outline-variant text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                            <th className="pb-2">Shift Name</th>
                            <th className="pb-2">Times</th>
                            <th className="pb-2">Posts Covered</th>
                            <th className="pb-2">Days Pattern</th>
                            <th className="pb-2">Source / Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {effectiveShift.map((sr: any, index: number) => (
                            <tr key={index} className="border-b border-outline-variant/30 hover:bg-surface-container-lowest">
                              <td className="py-2 font-medium text-on-surface">{sr.shiftName}</td>
                              <td className="py-2 text-on-surface-variant">{sr.startTime} - {sr.endTime}</td>
                              <td className="py-2 text-on-surface-variant font-bold">{sr.postsCovered}</td>
                              <td className="py-2 text-on-surface-variant">{sr.daysPattern}</td>
                              <td className="py-2 text-on-surface-variant">
                                {sr.originalPosts !== sr.quantity ? (
                                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                                    Modified by Addendum ({sr.addendumPosts >= 0 ? `+${sr.addendumPosts}` : sr.addendumPosts})
                                  </span>
                                ) : sr.originalPosts === 0 ? (
                                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                                    Source: Addendum
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-on-surface-variant/75 bg-surface-container-high/40 px-1.5 py-0.5 rounded">
                                    Original Contract
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Contract Addendums / Revisions</h4>
                {(!selectedContractDetail.addendums || selectedContractDetail.addendums.length === 0) ? (
                  <p className="text-[11px] text-on-surface-variant italic">No addendums logged for this contract.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedContractDetail.addendums.map((a: any) => (
                      <div key={a.id} className="bg-surface-container-lowest border border-outline-variant p-3 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-primary">{a.title} ({a.addendumNumber})</p>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${a.status === "ACTIVE" ? "bg-status-success/15 text-status-success" : "bg-surface-container-high/40 text-on-surface-variant"}`}>
                            {a.status}
                          </span>
                        </div>
                        <p><span className="text-on-surface-variant font-semibold">Type:</span> {a.addendumType}</p>
                        <p><span className="text-on-surface-variant font-semibold">Effective From:</span> {new Date(a.effectiveFrom).toLocaleDateString()}</p>
                        {a.commercialImpact && <p><span className="text-on-surface-variant font-semibold">Commercial Impact:</span> {a.commercialImpact}</p>}
                        {a.description && <p className="text-on-surface-variant italic">{a.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contract Clauses & Legal Terms */}
              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Contract Clauses & Legal Terms</h4>
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div>
                    <p><span className="text-on-surface-variant font-medium">Payment Terms:</span> <span className="font-semibold">{selectedContractDetail.paymentTerms || "Not specified"}</span></p>
                    <p><span className="text-on-surface-variant font-medium">Payment Cycle:</span> <span className="font-semibold">{selectedContractDetail.paymentCycle || "Monthly"}</span></p>
                    <p><span className="text-on-surface-variant font-medium">Credit Days:</span> <span className="font-semibold">{selectedContractDetail.creditDays !== null && selectedContractDetail.creditDays !== undefined ? `${selectedContractDetail.creditDays} days` : "Not specified"}</span></p>
                    <p><span className="text-on-surface-variant font-medium">Invoice Submission Day:</span> <span className="font-semibold">{selectedContractDetail.invoiceSubmissionDay || "Not specified"}</span></p>
                    {selectedContractDetail.paymentRemarks && <p><span className="text-on-surface-variant font-medium">Payment Remarks:</span> <span className="italic">{selectedContractDetail.paymentRemarks}</span></p>}
                  </div>
                  <div>
                    <p><span className="text-on-surface-variant font-medium">Termination Clause:</span> <span className="font-semibold">{selectedContractDetail.terminationClause || "Not specified"}</span></p>
                    <p><span className="text-on-surface-variant font-medium">Notice Period:</span> <span className="font-semibold">{selectedContractDetail.noticePeriodDays !== null && selectedContractDetail.noticePeriodDays !== undefined ? `${selectedContractDetail.noticePeriodDays} days` : "Not specified"}</span></p>
                    <p><span className="text-on-surface-variant font-medium">Termination Penalty:</span> <span className="font-semibold">{selectedContractDetail.terminationPenalty || "None"}</span></p>
                    <p><span className="text-on-surface-variant font-medium">Early Termination Allowed:</span> <span className="font-semibold">{selectedContractDetail.earlyTerminationAllowed ? "Yes" : "No"}</span></p>
                    {selectedContractDetail.terminationRemarks && <p><span className="text-on-surface-variant font-medium">Termination Remarks:</span> <span className="italic">{selectedContractDetail.terminationRemarks}</span></p>}
                  </div>
                </div>
                {selectedContractDetail.specialConditions && (
                  <div className="pt-2 border-t border-outline-variant/40 text-[11px]">
                    <p><span className="text-on-surface-variant font-medium">Special Conditions:</span> <span>{selectedContractDetail.specialConditions}</span></p>
                  </div>
                )}
                {selectedContractDetail.serviceLevelTerms && (
                  <div className="pt-1 text-[11px]">
                    <p><span className="text-on-surface-variant font-medium">Service Level Terms (SLAs):</span> <span>{selectedContractDetail.serviceLevelTerms}</span></p>
                  </div>
                )}
                {selectedContractDetail.penaltyClause && (
                  <div className="pt-1 text-[11px]">
                    <p><span className="text-on-surface-variant font-medium">Penalty Clauses:</span> <span>{selectedContractDetail.penaltyClause}</span></p>
                  </div>
                )}
              </div>

              {/* Contract Approval Workflow Status */}
              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Approval Workflow & Status</h4>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface-variant">Workflow Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedContractDetail.approvalStatus === "ACTIVE" || selectedContractDetail.status === "ACTIVE" ? "bg-status-success/15 text-status-success" :
                    selectedContractDetail.approvalStatus === "APPROVED" || selectedContractDetail.status === "APPROVED" ? "bg-blue-100 text-blue-700" :
                    selectedContractDetail.approvalStatus === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-700" :
                    selectedContractDetail.approvalStatus === "REJECTED" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {selectedContractDetail.approvalStatus || selectedContractDetail.status || "DRAFT"}
                  </span>
                </div>
                
                {selectedContractDetail.rejectionRemarks && (
                  <div className="bg-red-50 border border-red-200 p-2 rounded-lg text-xs text-red-700">
                    <span className="font-bold">Rejection Reason:</span> {selectedContractDetail.rejectionRemarks}
                  </div>
                )}

                {(selectedContractDetail.status === "APPROVED" || selectedContractDetail.status === "ACTIVE") && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800">
                    <span className="font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">info</span>
                      Important Notice
                    </span>
                    Approved or active contracts cannot be edited directly. Please create an Addendum for changes.
                  </div>
                )}

                {selectedContractDetail.terminationStatus && (
                  <div className="bg-surface-container-lowest border border-outline-variant p-3 rounded-lg text-xs space-y-2">
                    <h5 className="font-bold text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">cancel</span>
                      Termination Details
                    </h5>
                    <p><span className="text-on-surface-variant font-medium">Status:</span> <span className="font-bold">{selectedContractDetail.terminationStatus}</span></p>
                    {selectedContractDetail.terminationRequestedAt && (
                      <p><span className="text-on-surface-variant font-medium">Requested:</span> {new Date(selectedContractDetail.terminationRequestedAt).toLocaleString()} by {selectedContractDetail.terminationRequestedBy}</p>
                    )}
                    {selectedContractDetail.terminationReason && (
                      <p><span className="text-on-surface-variant font-medium">Reason:</span> {selectedContractDetail.terminationReason}</p>
                    )}
                    {selectedContractDetail.terminatedAt && (
                      <p><span className="text-on-surface-variant font-medium">Terminated:</span> {new Date(selectedContractDetail.terminatedAt).toLocaleString()} by {selectedContractDetail.terminatedBy}</p>
                    )}
                  </div>
                )}

                {selectedContractDetail.workflows?.[0] ? (
                  <div className="space-y-3 pt-2">
                    {[...selectedContractDetail.workflows[0].levels].sort((a: any, b: any) => (a.levelNumber || 0) - (b.levelNumber || 0)).map((lvl: any) => {
                      const isLvlApproved = lvl.approvalRule === "ANY_ONE" 
                        ? lvl.approvers?.some((ap: any) => ap.approvalStatus === "APPROVED")
                        : lvl.approvers?.every((ap: any) => ap.approvalStatus === "APPROVED");
                        
                      const isLvlRejected = lvl.approvers?.some((ap: any) => ap.approvalStatus === "REJECTED");

                      return (
                        <div key={lvl.id} className={`p-3 rounded-lg border text-xs ${
                          isLvlApproved ? "bg-green-50/50 border-green-200" :
                          isLvlRejected ? "bg-red-50/50 border-red-200" :
                          "bg-surface-container-lowest border-outline-variant"
                        }`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold">Level {lvl.levelNumber}: {lvl.levelName}</span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                              isLvlApproved ? "bg-green-100 text-green-800" :
                              isLvlRejected ? "bg-red-100 text-red-800" :
                              "bg-amber-100 text-amber-800"
                            }`}>
                              {isLvlApproved ? "Approved" : isLvlRejected ? "Rejected" : "Pending"}
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-on-surface-variant mb-2">Rule: {lvl.approvalRule === "ANY_ONE" ? "Any one approver" : "All approvers required"}</p>
                          
                          <div className="space-y-1.5">
                            {lvl.approvers?.map((ap: any) => (
                              <div key={ap.id} className="flex justify-between items-center text-[10px]">
                                <span>{ap.employeeName} ({ap.roleName || "Approver"})</span>
                                <span className={`font-semibold ${
                                  ap.approvalStatus === "APPROVED" ? "text-green-600" :
                                  ap.approvalStatus === "REJECTED" ? "text-red-600" :
                                  "text-amber-600"
                                }`}>
                                  {ap.approvalStatus} {ap.remarks ? `(${ap.remarks})` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-on-surface-variant italic">No approval workflow configured for this contract.</p>
                )}
              </div>

              {/* Workflow Action Panel */}
              {selectedContractDetail.workflows?.[0] && selectedContractDetail.status === "PENDING_APPROVAL" && (
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-1">Perform Approval Action</h4>
                  
                  {(() => {
                    const sortedLevels = [...selectedContractDetail.workflows[0].levels].sort((a: any, b: any) => (a.levelNumber || 0) - (b.levelNumber || 0));
                    const activePendingLevel = sortedLevels.find((lvl: any) => {
                      const isLvlApproved = lvl.approvalRule === "ANY_ONE" 
                        ? lvl.approvers?.some((ap: any) => ap.approvalStatus === "APPROVED")
                        : lvl.approvers?.every((ap: any) => ap.approvalStatus === "APPROVED");
                      return !isLvlApproved;
                    });
                    
                    if (!activePendingLevel) return null;

                    const pendingApprovers = activePendingLevel.approvers?.filter((ap: any) => ap.approvalStatus === "PENDING") || [];

                    return (
                      <div className="space-y-3">
                        <p className="text-xs text-on-surface-variant">Acting on <span className="font-semibold text-primary">Level {activePendingLevel.levelNumber}: {activePendingLevel.levelName}</span></p>
                        
                        <div>
                          <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Select Approver Entity</label>
                          <select
                            id="workflowActAsSelect"
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface"
                          >
                            {(() => {
                              const options: any[] = [];
                              const now = new Date();
                              
                              pendingApprovers.forEach((ap: any) => {
                                // Original option
                                options.push({
                                  value: `${activePendingLevel.id}:${ap.employeeId}`,
                                  label: ap.employeeName || "Approver"
                                });
                                
                                // Check if there is an active delegation for this pending approver
                                const activeDel = (delegations || []).find((d: any) => 
                                  d.originalApproverEmployeeId === ap.employeeId &&
                                  d.isActive &&
                                  new Date(d.effectiveFrom) <= now &&
                                  now <= new Date(d.effectiveTo)
                                );
                                if (activeDel) {
                                  options.push({
                                    value: `${activePendingLevel.id}:${activeDel.delegatedApproverEmployeeId}`,
                                    label: `${activeDel.delegatedApproverName} (on behalf of ${ap.employeeName})`
                                  });
                                }
                              });
                              
                              return options.map((opt, oIdx) => (
                                <option key={oIdx} value={opt.value}>{opt.label}</option>
                              ));
                            })()}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-1">Remarks / Comments</label>
                          <textarea
                            id="workflowRemarksTextarea"
                            placeholder="Enter remarks..."
                            rows={2}
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface resize-none"
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const select = document.getElementById("workflowActAsSelect") as HTMLSelectElement;
                              const remarks = (document.getElementById("workflowRemarksTextarea") as HTMLTextAreaElement)?.value || "";
                              if (select?.value) {
                                const [levelId, employeeId] = select.value.split(":");
                                handleWorkflowAction("approve", { levelId, employeeId, remarks });
                              }
                            }}
                            className="flex-1 py-1.5 bg-status-success text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
                          >
                            Approve Level
                          </button>
                          <button
                            onClick={() => {
                              const select = document.getElementById("workflowActAsSelect") as HTMLSelectElement;
                              const remarks = (document.getElementById("workflowRemarksTextarea") as HTMLTextAreaElement)?.value || "";
                              if (select?.value) {
                                const [levelId, employeeId] = select.value.split(":");
                                handleWorkflowAction("reject", { levelId, employeeId, remarks });
                              }
                            }}
                            className="flex-1 py-1.5 bg-status-error text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
                          >
                            Reject Level
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-outline-variant flex justify-between bg-surface-container-low">
              <div className="flex gap-2">
                {(selectedContractDetail.status === "DRAFT" || selectedContractDetail.status === "REJECTED") && (
                  <button 
                    onClick={() => handleWorkflowAction("submit")} 
                    className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Submit for Approval
                  </button>
                )}
                {selectedContractDetail.status === "APPROVED" && (
                  <button 
                    onClick={() => handleWorkflowAction("activate")} 
                    className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Activate Contract
                  </button>
                )}
                {selectedContractDetail.status === "ACTIVE" && (
                  <button 
                    onClick={async () => {
                      const reason = prompt("Enter reason for contract termination:");
                      if (reason) {
                        try {
                          const res = await fetch(`/api/v1/manpower/${business}/contracts/${selectedContractDetail.id}/workflow/terminate-request`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ reason })
                          });
                          if (res.ok) {
                            alert("Termination requested successfully!");
                            const updatedRes = await fetch(`/api/v1/manpower/${business}/contracts/${selectedContractDetail.id}`);
                            if (updatedRes.ok) setSelectedContractDetail(await updatedRes.json());
                            loadData();
                          } else {
                            const err = await res.json();
                            alert(err.error || "Failed to request termination");
                          }
                        } catch (e) {
                          console.error(e);
                          alert("Connection error requesting termination");
                        }
                      }
                    }} 
                    className="px-4 py-2 bg-status-error text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Terminate Contract
                  </button>
                )}
              </div>
              
              <button 
                onClick={() => setSelectedContractDetail(null)} 
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-container transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      );
    })()}
      {addendumContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg max-w-7xl w-full h-[90vh] flex flex-col overflow-hidden text-on-surface">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div>
                <h3 className="text-sm font-bold text-primary">Add Contract Addendum</h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Creating addendum for active contract: <span className="font-bold text-primary-container-on">{addendumContract.title} ({addendumContract.contractNumber})</span></p>
              </div>
              <button onClick={() => setAddendumContract(null)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch(`/api/v1/manpower/${business}/contracts/${addendumContract.id}/addendums`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...addendumForm,
                    lineItems: addFormLineItems,
                    contractNumber: addendumContract.contractNumber
                  })
                });
                if (res.ok) {
                  setAddendumContract(null);
                  setAddFormLineItems([]);
                  setAddendumForm({
                    title: "",
                    addendumType: "Manpower Increase",
                    addendumDate: new Date().toISOString().substring(0, 10),
                    effectiveFrom: new Date().toISOString().substring(0, 10),
                    description: "",
                    commercialImpact: "",
                    status: "DRAFT"
                  });
                  loadData();
                } else {
                  const errJson = await res.json();
                  alert(errJson.error || "Failed to save addendum");
                }
              } catch (err) {
                alert("Network error");
              }
            }} className="flex-1 flex flex-col min-h-0">
              <div className="flex border-b border-outline-variant gap-2 px-6 py-2 bg-surface-container-low">
                {[
                  { id: "summary", label: "Summary", icon: "info" },
                  { id: "references", label: "References", icon: "description" },
                  { id: "manpower", label: "Manpower", icon: "groups" },
                  { id: "reliever", label: "Reliever", icon: "shuffle" },
                  { id: "shift", label: "Shift", icon: "schedule" },
                  { id: "commercial", label: "Commercial Notes", icon: "payments" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAddendumActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all rounded-lg ${
                      addendumActiveTab === tab.id
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-6 overflow-y-auto min-h-0 text-xs">
                {/* Summary Tab */}
                {addendumActiveTab === "summary" && (
                  <div className="space-y-4 max-w-xl mx-auto bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/40 shadow-sm">
                    <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 border-b border-outline-variant pb-2">
                      <span className="material-symbols-outlined text-[18px]">info</span>
                      General Addendum Information
                    </h4>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Addendum Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Revised Rate and Guard Count"
                        className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface text-xs"
                        value={addendumForm.title || ""}
                        onChange={(e) => setAddendumForm({ ...addendumForm, title: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Addendum Date *</label>
                        <input
                          type="date"
                          required
                          className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface text-xs"
                          value={addendumForm.addendumDate || ""}
                          onChange={(e) => setAddendumForm({ ...addendumForm, addendumDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Effective From *</label>
                        <input
                          type="date"
                          required
                          className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface text-xs"
                          value={addendumForm.effectiveFrom || ""}
                          onChange={(e) => setAddendumForm({ ...addendumForm, effectiveFrom: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Addendum Type *</label>
                      <select
                        className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface text-xs"
                        value={addendumForm.addendumType || "Manpower Increase"}
                        onChange={(e) => setAddendumForm({ ...addendumForm, addendumType: e.target.value })}
                      >
                        <option value="Manpower Increase">Manpower Increase</option>
                        <option value="Manpower Reduction">Manpower Reduction</option>
                        <option value="Rate Change">Rate Change</option>
                        <option value="Shift Change">Shift Change</option>
                        <option value="Site Addition">Site Addition</option>
                        <option value="Site Removal">Site Removal</option>
                        <option value="Reliever Change">Reliever Change</option>
                        <option value="Contract Extension">Contract Extension</option>
                        <option value="Contract Termination">Contract Termination</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Description / Reason</label>
                      <textarea
                        placeholder="Provide details..."
                        rows={4}
                        className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface resize-none text-xs"
                        value={addendumForm.description || ""}
                        onChange={(e) => setAddendumForm({ ...addendumForm, description: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Status</label>
                      <select
                        className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface text-xs"
                        value={addendumForm.status || "DRAFT"}
                        onChange={(e) => setAddendumForm({ ...addendumForm, status: e.target.value })}
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="APPROVED">Approved</option>
                        <option value="ACTIVE">Active</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* References Tab */}
                {addendumActiveTab === "references" && (
                  <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/60">
                      <span className="block text-xs font-bold text-primary uppercase mb-3 tracking-wider font-mono">Linked Contract Reference</span>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-on-surface-variant font-bold">Contract Title:</span>
                          <div className="font-semibold text-on-surface mt-0.5 p-2 bg-surface rounded border border-outline-variant/35">{addendumContract.title}</div>
                        </div>
                        <div>
                          <span className="text-on-surface-variant font-bold">Contract Number:</span>
                          <div className="font-semibold text-on-surface mt-0.5 p-2 bg-surface rounded border border-outline-variant/35">{addendumContract.contractNumber}</div>
                        </div>
                        <div>
                          <span className="text-on-surface-variant font-bold">Client:</span>
                          <div className="font-semibold text-on-surface mt-0.5 p-2 bg-surface rounded border border-outline-variant/35">{addendumContract.client?.name || addendumContract.clientId}</div>
                        </div>
                        <div>
                          <span className="text-on-surface-variant font-bold">Contract Period:</span>
                          <div className="font-semibold text-on-surface mt-0.5 p-2 bg-surface rounded border border-outline-variant/35">
                            {new Date(addendumContract.startDate).toLocaleDateString()} to {new Date(addendumContract.endDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Inherited Contract Requirements */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Contract Manpower Reqs */}
                      <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/60">
                        <span className="block text-[10px] font-bold text-primary uppercase mb-2 tracking-wider font-mono">Contract Manpower Requirements</span>
                        <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-[11px]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase font-bold text-on-surface-variant">
                                <th className="px-2.5 py-1.5">Position</th>
                                <th className="px-2.5 py-1.5 text-center">Contract Qty</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/50">
                              {!(addendumContract.manpowerRequirements || []).length ? (
                                <tr><td colSpan={2} className="p-3 text-center italic text-on-surface-variant">None</td></tr>
                              ) : (
                                (addendumContract.manpowerRequirements || []).map((mr: any, idx: number) => (
                                  <tr key={idx}>
                                    <td className="px-2.5 py-1.5 font-semibold text-on-surface">{mr.position || mr.designation}</td>
                                    <td className="px-2.5 py-1.5 text-center font-bold text-primary">{mr.quantity}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Contract Reliever Reqs */}
                      <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/60">
                        <span className="block text-[10px] font-bold text-primary uppercase mb-2 tracking-wider font-mono">Contract Reliever Requirements</span>
                        <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface text-[11px]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-surface-container-low border-b border-outline-variant text-[9px] uppercase font-bold text-on-surface-variant">
                                <th className="px-2.5 py-1.5">Position</th>
                                <th className="px-2.5 py-1.5 text-center">Contract Qty</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/50">
                              {!(addendumContract.relieverRequirements || []).length ? (
                                <tr><td colSpan={2} className="p-3 text-center italic text-on-surface-variant">None</td></tr>
                              ) : (
                                (addendumContract.relieverRequirements || []).map((rr: any, idx: number) => (
                                  <tr key={idx}>
                                    <td className="px-2.5 py-1.5 font-semibold text-on-surface">{rr.position || rr.designation}</td>
                                    <td className="px-2.5 py-1.5 text-center font-bold text-primary">{rr.quantity}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manpower Tab */}
                {addendumActiveTab === "manpower" && (
                  <div className="space-y-4 max-w-4xl mx-auto">
                    <div className="flex justify-between items-center border-b border-outline-variant/60 pb-2">
                      <div>
                        <h4 className="text-xs font-bold text-primary">Manpower Changes</h4>
                        <p className="text-[10px] text-on-surface-variant">Add, update, or remove contract manpower requirements.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addAddendumLine("MANPOWER")}
                        className="px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg flex items-center gap-1 hover:bg-primary-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Add Manpower Line
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {addFormLineItems.filter(li => li.itemType === "MANPOWER").length === 0 ? (
                        <div className="text-center py-8 bg-surface-container-low border border-outline-variant/40 rounded-xl text-on-surface-variant italic">
                          No manpower changes added in this addendum yet. Click 'Add Manpower Line' above to log changes.
                        </div>
                      ) : (
                        addFormLineItems.filter(li => li.itemType === "MANPOWER").map((row: any) => (
                          <div key={row.id} className="grid grid-cols-12 gap-3 items-center bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/60 text-on-surface">
                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Action</label>
                              <select
                                value={row.action || "ADD"}
                                onChange={(e) => updateAddendumLineById(row.id, "action", e.target.value)}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1 text-[11px] focus:outline-none text-on-surface font-semibold"
                              >
                                <option value="ADD">Add</option>
                                <option value="REMOVE">Remove</option>
                                <option value="UPDATE">Update</option>
                              </select>
                            </div>
                            <div className="col-span-4">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Position / Designation Label *</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Security Guard, Supervisor"
                                value={row.label || ""}
                                onChange={(e) => updateAddendumLineById(row.id, "label", e.target.value)}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-[11px] focus:outline-none text-on-surface font-semibold"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 text-center">Qty</label>
                              <input
                                type="number"
                                required
                                min="1"
                                value={row.quantity || 1}
                                onChange={(e) => updateAddendumLineById(row.id, "quantity", parseInt(e.target.value, 10))}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-1 py-1 text-[11px] focus:outline-none text-center text-on-surface font-bold"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 text-right">Unit Rate (monthly)</label>
                              <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={row.unitPrice || 0}
                                onChange={(e) => updateAddendumLineById(row.id, "unitPrice", parseFloat(e.target.value))}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-[11px] focus:outline-none text-right text-on-surface font-mono"
                              />
                            </div>
                            <div className="col-span-1 text-right pt-3">
                              <button
                                type="button"
                                onClick={() => deleteAddendumLineById(row.id)}
                                className="text-status-error hover:bg-status-error/10 p-1 rounded-lg"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Reliever Tab */}
                {addendumActiveTab === "reliever" && (
                  <div className="space-y-4 max-w-4xl mx-auto">
                    <div className="flex justify-between items-center border-b border-outline-variant/60 pb-2">
                      <div>
                        <h4 className="text-xs font-bold text-primary">Reliever Changes</h4>
                        <p className="text-[10px] text-on-surface-variant">Log changes to reliever counts and rates.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addAddendumLine("RELIEVER")}
                        className="px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg flex items-center gap-1 hover:bg-primary-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Add Reliever Line
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {addFormLineItems.filter(li => li.itemType === "RELIEVER").length === 0 ? (
                        <div className="text-center py-8 bg-surface-container-low border border-outline-variant/40 rounded-xl text-on-surface-variant italic">
                          No reliever changes added in this addendum yet. Click 'Add Reliever Line' above to log changes.
                        </div>
                      ) : (
                        addFormLineItems.filter(li => li.itemType === "RELIEVER").map((row: any) => (
                          <div key={row.id} className="grid grid-cols-12 gap-3 items-center bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/60 text-on-surface">
                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Action</label>
                              <select
                                value={row.action || "ADD"}
                                onChange={(e) => updateAddendumLineById(row.id, "action", e.target.value)}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1 text-[11px] focus:outline-none text-on-surface font-semibold"
                              >
                                <option value="ADD">Add</option>
                                <option value="REMOVE">Remove</option>
                                <option value="UPDATE">Update</option>
                              </select>
                            </div>
                            <div className="col-span-4">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Reliever Designation Label *</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Reliever Guard"
                                value={row.label || ""}
                                onChange={(e) => updateAddendumLineById(row.id, "label", e.target.value)}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-[11px] focus:outline-none text-on-surface font-semibold"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 text-center">Qty</label>
                              <input
                                type="number"
                                required
                                min="1"
                                value={row.quantity || 1}
                                onChange={(e) => updateAddendumLineById(row.id, "quantity", parseInt(e.target.value, 10))}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-1 py-1 text-[11px] focus:outline-none text-center text-on-surface font-bold"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 text-right">Unit Rate (monthly)</label>
                              <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={row.unitPrice || 0}
                                onChange={(e) => updateAddendumLineById(row.id, "unitPrice", parseFloat(e.target.value))}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-[11px] focus:outline-none text-right text-on-surface font-mono"
                              />
                            </div>
                            <div className="col-span-1 text-right pt-3">
                              <button
                                type="button"
                                onClick={() => deleteAddendumLineById(row.id)}
                                className="text-status-error hover:bg-status-error/10 p-1 rounded-lg"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Shift Tab */}
                {addendumActiveTab === "shift" && (
                  <div className="space-y-4 max-w-4xl mx-auto">
                    <div className="flex justify-between items-center border-b border-outline-variant/60 pb-2">
                      <div>
                        <h4 className="text-xs font-bold text-primary">Shift Changes</h4>
                        <p className="text-[10px] text-on-surface-variant">Log changes to contract shift patterns or timings.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addAddendumLine("SHIFT")}
                        className="px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg flex items-center gap-1 hover:bg-primary-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Add Shift Line
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {addFormLineItems.filter(li => li.itemType === "SHIFT").length === 0 ? (
                        <div className="text-center py-8 bg-surface-container-low border border-outline-variant/40 rounded-xl text-on-surface-variant italic">
                          No shift changes added in this addendum yet. Click 'Add Shift Line' above to log changes.
                        </div>
                      ) : (
                        addFormLineItems.filter(li => li.itemType === "SHIFT").map((row: any) => (
                          <div key={row.id} className="grid grid-cols-12 gap-3 items-center bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/60 text-on-surface">
                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Action</label>
                              <select
                                value={row.action || "ADD"}
                                onChange={(e) => updateAddendumLineById(row.id, "action", e.target.value)}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1 text-[11px] focus:outline-none text-on-surface font-semibold"
                              >
                                <option value="ADD">Add</option>
                                <option value="REMOVE">Remove</option>
                                <option value="UPDATE">Update</option>
                              </select>
                            </div>
                            <div className="col-span-4">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Shift Name / Timings Label *</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Night Shift (19:00 - 07:00)"
                                value={row.label || ""}
                                onChange={(e) => updateAddendumLineById(row.id, "label", e.target.value)}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-[11px] focus:outline-none text-on-surface font-semibold"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 text-center">Required Posts</label>
                              <input
                                type="number"
                                required
                                min="1"
                                value={row.quantity || 1}
                                onChange={(e) => updateAddendumLineById(row.id, "quantity", parseInt(e.target.value, 10))}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-1 py-1 text-[11px] focus:outline-none text-center text-on-surface font-bold"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 text-right">Extra Cost (if applicable)</label>
                              <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={row.unitPrice || 0}
                                onChange={(e) => updateAddendumLineById(row.id, "unitPrice", parseFloat(e.target.value))}
                                className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-[11px] focus:outline-none text-right text-on-surface font-mono"
                              />
                            </div>
                            <div className="col-span-1 text-right pt-3">
                              <button
                                type="button"
                                onClick={() => deleteAddendumLineById(row.id)}
                                className="text-status-error hover:bg-status-error/10 p-1 rounded-lg"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Commercial Notes Tab */}
                {addendumActiveTab === "commercial" && (
                  <div className="space-y-4 max-w-4xl mx-auto">
                    <div className="grid grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant/60">
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Commercial Impact Summary String</label>
                        <input
                          type="text"
                          placeholder="e.g. +QAR 5,000 / month"
                          className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-on-surface font-semibold text-xs"
                          value={addendumForm.commercialImpact || ""}
                          onChange={(e) => setAddendumForm({ ...addendumForm, commercialImpact: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Calculated Net Impact</label>
                        <div className="p-2 border border-outline-variant rounded-lg bg-surface text-sm font-black text-primary font-mono">
                          {addendumForm.commercialImpact || "QAR 0.00"}
                        </div>
                      </div>
                    </div>

                    <div className="border border-outline-variant/60 p-4 rounded-xl space-y-4 bg-surface-container-low">
                      <div className="flex justify-between items-center border-b border-outline-variant/60 pb-2">
                        <div>
                          <h4 className="text-xs font-bold text-primary">Other Commercial Items / Materials Changes</h4>
                          <p className="text-[10px] text-on-surface-variant">Log changes to materials, equipment, or one-off commercial charges.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addAddendumLine("MATERIAL")}
                          className="px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg flex items-center gap-1 hover:bg-primary-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span> Add Material Line
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {addFormLineItems.filter(li => li.itemType === "MATERIAL").length === 0 ? (
                          <div className="text-center py-6 bg-surface text-on-surface-variant italic border border-outline-variant/30 rounded-lg">
                            No other commercial or material items changes added.
                          </div>
                        ) : (
                          addFormLineItems.filter(li => li.itemType === "MATERIAL").map((row: any) => (
                            <div key={row.id} className="grid grid-cols-12 gap-3 items-center bg-surface p-2.5 rounded-lg border border-outline-variant/40 text-on-surface">
                              <div className="col-span-2">
                                <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Action</label>
                                <select
                                  value={row.action || "ADD"}
                                  onChange={(e) => updateAddendumLineById(row.id, "action", e.target.value)}
                                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1 text-[11px] focus:outline-none text-on-surface font-semibold"
                                >
                                  <option value="ADD">Add</option>
                                  <option value="REMOVE">Remove</option>
                                  <option value="UPDATE">Update</option>
                                </select>
                              </div>
                              <div className="col-span-4">
                                <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5">Item Label *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Patrol Vehicle, Walkie Talkie"
                                  value={row.label || ""}
                                  onChange={(e) => updateAddendumLineById(row.id, "label", e.target.value)}
                                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1 text-[11px] focus:outline-none text-on-surface font-semibold"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 text-center">Qty</label>
                                <input
                                  type="number"
                                  required
                                  min="1"
                                  value={row.quantity || 1}
                                  onChange={(e) => updateAddendumLineById(row.id, "quantity", parseInt(e.target.value, 10))}
                                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-1 py-1 text-[11px] focus:outline-none text-center text-on-surface font-bold"
                                />
                              </div>
                              <div className="col-span-3">
                                <label className="block text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 text-right">Price</label>
                                <input
                                  type="number"
                                  required
                                  min="0"
                                  step="0.01"
                                  value={row.unitPrice || 0}
                                  onChange={(e) => updateAddendumLineById(row.id, "unitPrice", parseFloat(e.target.value))}
                                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1 text-[11px] focus:outline-none text-right text-on-surface font-mono"
                                />
                              </div>
                              <div className="col-span-1 text-right pt-3">
                                <button
                                  type="button"
                                  onClick={() => deleteAddendumLineById(row.id)}
                                  className="text-status-error hover:bg-status-error/10 p-1 rounded-lg"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => setAddendumContract(null)}
                  className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-primary hover:bg-primary-container text-xs font-bold rounded-lg transition-colors"
                >
                  Save Addendum
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Security License Modal */}
      {showAddLicenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg max-w-md w-full overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-sm font-black text-primary">Record MOI Security License</h3>
              <button onClick={() => setShowAddLicenseModal(false)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleAddLicenseSubmit}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Select Security Guard</label>
                  <select
                    name="employeeId"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="">-- Choose Guard --</option>
                    {data.filter((e: any) => e.manpowerCategoryId === "SECURITY_GUARD" || e.manpowerCategoryId === "SENIOR_GUARD" || !e.manpowerCategoryId).map((emp: any) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">License Number</label>
                  <input
                    type="text"
                    name="licenseNumber"
                    disabled
                    placeholder="Auto-generated (SLIC-XXXX)"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Issue Date</label>
                  <input
                    type="date"
                    name="issueDate"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Expiry Date</label>
                  <input
                    type="date"
                    name="expiryDate"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => setShowAddLicenseModal(false)}
                  className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-variant transition-colors"
                >
                  Record License
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Gate Pass Modal */}
      {showAddGatePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg max-w-md w-full overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-sm font-black text-primary">Record Site Gate Pass</h3>
              <button onClick={() => setShowAddGatePassModal(false)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleAddGatePassSubmit}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Select Security Guard</label>
                  <select
                    name="employeeId"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="">-- Choose Guard --</option>
                    {data.filter((e: any) => e.manpowerCategoryId === "SECURITY_GUARD" || e.manpowerCategoryId === "SENIOR_GUARD" || !e.manpowerCategoryId).map((emp: any) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Select Worksite</label>
                  <select
                    name="siteId"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="">-- Choose Worksite --</option>
                    {sites.map((site: any) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Gate Pass Number</label>
                  <input
                    type="text"
                    name="passNumber"
                    disabled
                    placeholder="Auto-generated (SGP-XXXX)"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface-variant focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Issue Date</label>
                  <input
                    type="date"
                    name="issueDate"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Expiry Date</label>
                  <input
                    type="date"
                    name="expiryDate"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => setShowAddGatePassModal(false)}
                  className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-variant transition-colors"
                >
                  Record Gate Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
