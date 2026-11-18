import { prisma } from "@ahh-wfm/database";
import { WorkflowSourceAdapter, WorkflowBusinessSummary } from "./types";
import { applyAddendumWorkflowTransition } from "@/lib/addendum-workflow";
import { generateCostingSnapshot } from "@/lib/precontract-costing";
import { generateProposalSnapshot } from "@/lib/precontract-proposal";

async function resolveRequesterDisplayName(
  rawActor: string | null | undefined,
  fallback: string
): Promise<string> {
  if (!rawActor || !rawActor.trim()) return fallback;
  const trimmed = rawActor.trim();
  try {
    const emp = await prisma.employee.findFirst({
      where: {
        OR: [{ id: trimmed }, { email: trimmed }]
      },
      select: { name: true }
    });
    if (emp?.name) return emp.name;
  } catch {
    // Fallback to rawActor if employee lookup fails
  }
  return trimmed;
}

export class WorkflowAdapterRegistry {
  private static adapters: Map<string, WorkflowSourceAdapter> = new Map();

  public static register(adapter: WorkflowSourceAdapter) {
    this.adapters.set(adapter.moduleType.toUpperCase(), adapter);
  }

  public static get(moduleType: string): WorkflowSourceAdapter | undefined {
    return this.adapters.get(moduleType.toUpperCase());
  }

  public static getOrDefault(moduleType: string): WorkflowSourceAdapter {
    const adapter = this.get(moduleType);
    if (adapter) return adapter;

    // Fallback default adapter
    return {
      moduleType,
      async getBusinessSummary(referenceId: string) {
        return {
          reference: referenceId,
          title: `Request ${referenceId}`,
          requesterName: "System User",
          createdAt: new Date().toISOString(),
          keyFields: [{ label: "Reference ID", value: referenceId }]
        };
      },
      getSourceDeepLink(referenceId: string) {
        return `/commercial/dashboard`;
      }
    };
  }
}

// 1. Costing Adapter
const CostingAdapter: WorkflowSourceAdapter = {
  moduleType: "PRE_CONTRACT_COSTING",
  async getBusinessSummary(referenceId: string) {
    try {
      const estimate = await prisma.preContractCostEstimate.findUnique({
        where: { id: referenceId },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: { items: true }
          },
          case: { include: { prospectClient: true } }
        }
      });
      if (!estimate) return null;
      const currentVersion = estimate.versions[0];
      const totalCost = currentVersion?.totalCost?.toNumber ? currentVersion.totalCost.toNumber() : (currentVersion?.totalCost ? Number(currentVersion.totalCost) : 0);
      const targetMargin = currentVersion?.targetMarginPercentage?.toNumber ? currentVersion.targetMarginPercentage.toNumber() : (currentVersion?.targetMarginPercentage ? Number(currentVersion.targetMarginPercentage) : 0);
      const totalHeadcount = currentVersion?.items?.reduce((sum: number, it: any) => sum + (it.quantity ? Number(it.quantity) : 1), 0) || 0;

      const requesterName = await resolveRequesterDisplayName(
        currentVersion?.createdBy || estimate.createdBy,
        "Commercial Estimator"
      );

      return {
        reference: estimate.estimateNumber || referenceId,
        title: `Commercial Costing #${estimate.estimateNumber || referenceId}`,
        subtitle: estimate.case?.title || "Commercial Costing",
        requesterName,
        companyId: estimate.case?.companyId,
        companyName: "Al Hattab Holding",
        createdAt: currentVersion?.createdAt ? currentVersion.createdAt.toISOString() : new Date().toISOString(),
        keyFields: [
          { label: "Case", value: estimate.case?.title || "Costing Case" },
          { label: "Total Cost", value: `QAR ${totalCost.toLocaleString()}` },
          { label: "Target Margin", value: `${targetMargin.toFixed(1)}%` },
          { label: "Total Quantity/Headcount", value: `${totalHeadcount}` }
        ],
        rawDetails: { estimate, currentVersion }
      };
    } catch (e) {
      return null;
    }
  },
  getSourceDeepLink(referenceId: string) {
    return `/commercial/costing?id=${referenceId}`;
  },
  async onWorkflowStatusChange(referenceId, action, newStatus, remarks, tx) {
    const db = tx || prisma;
    const estimate = await db.preContractCostEstimate.findUnique({
      where: { id: referenceId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { items: true }
        }
      }
    });
    if (!estimate) return;
    const currentVersion = estimate.versions[0];

    let estimateStatus = estimate.status;
    let versionStatus = currentVersion?.status || "DRAFT";
    let snapshotData: { snapshotJson?: string; checksum?: string } = {};

    if (action === "APPROVE" && newStatus === "APPROVED") {
      estimateStatus = "APPROVED";
      versionStatus = "APPROVED";
      if (currentVersion) {
        const snap = generateCostingSnapshot(estimate, currentVersion, currentVersion.items || []);
        snapshotData = { snapshotJson: snap.snapshotJson, checksum: snap.checksum };
      }
    } else if (action === "APPROVE" && newStatus === "IN_PROGRESS") {
      estimateStatus = "IN_WORKFLOW";
      versionStatus = "SUBMITTED";
    } else if (action === "REJECT") {
      estimateStatus = "REJECTED";
      versionStatus = "REJECTED";
    } else if (action === "RETURN") {
      estimateStatus = "DRAFT";
      versionStatus = "DRAFT";
    }

    if (currentVersion) {
      await db.preContractCostEstimateVersion.update({
        where: { id: currentVersion.id },
        data: {
          status: versionStatus,
          ...snapshotData,
          updatedAt: new Date()
        }
      });
    }

    await db.preContractCostEstimate.update({
      where: { id: estimate.id },
      data: {
        status: estimateStatus,
        updatedAt: new Date()
      }
    });
  }
};
WorkflowAdapterRegistry.register(CostingAdapter);
WorkflowAdapterRegistry.register({ ...CostingAdapter, moduleType: "COMMERCIAL_COSTING" });
WorkflowAdapterRegistry.register({ ...CostingAdapter, moduleType: "COSTING" });

// 2. Proposal Adapter
const ProposalAdapter: WorkflowSourceAdapter = {
  moduleType: "COMMERCIAL_PROPOSAL",
  async getBusinessSummary(referenceId: string) {
    try {
      const proposal = await prisma.preContractProposal.findUnique({
        where: { id: referenceId },
        include: {
          case: { include: { prospectClient: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 }
        }
      });
      if (!proposal) return null;
      const currentVersion = proposal.versions[0];
      const sellingPrice = currentVersion?.sellingPrice?.toNumber ? currentVersion.sellingPrice.toNumber() : (currentVersion?.sellingPrice ? Number(currentVersion.sellingPrice) : 0);

      const requesterName = await resolveRequesterDisplayName(
        currentVersion?.createdBy || proposal.createdBy,
        "Sales Team"
      );

      return {
        reference: proposal.proposalCode || referenceId,
        title: currentVersion?.title || `Commercial Proposal #${proposal.proposalCode || referenceId}`,
        subtitle: proposal.case?.title || "Commercial Proposal",
        requesterName,
        companyId: proposal.companyId,
        companyName: "Al Hattab Holding",
        createdAt: proposal.createdAt.toISOString(),
        keyFields: [
          { label: "Case Title", value: proposal.case?.title || "Commercial Opportunity" },
          { label: "Selling Price", value: `QAR ${sellingPrice.toLocaleString()}` },
          { label: "Status", value: proposal.status, badge: proposal.status }
        ],
        rawDetails: { proposal }
      };
    } catch (e) {
      return null;
    }
  },
  getSourceDeepLink(referenceId: string) {
    return `/commercial/proposals/${referenceId}`;
  },
  async onWorkflowStatusChange(referenceId, action, newStatus, remarks, tx) {
    const db = tx || prisma;
    const proposal = await db.preContractProposal.findUnique({
      where: { id: referenceId },
      include: {
        case: { include: { prospectClient: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 }
      }
    });
    if (!proposal) return;
    const currentVersion = proposal.versions[0];

    let finalStatus = "IN_WORKFLOW";
    let versionStatus = "IN_WORKFLOW";
    let snapshotData: { snapshotJson?: string; snapshotChecksum?: string } = {};

    if (action === "APPROVE" && newStatus === "APPROVED") {
      finalStatus = "APPROVED_INTERNAL";
      versionStatus = "APPROVED_INTERNAL";
      if (currentVersion) {
        const snap = generateProposalSnapshot(proposal, currentVersion);
        snapshotData = { snapshotJson: snap.snapshotJson, snapshotChecksum: snap.checksum };
      }
    } else if (action === "REJECT") {
      finalStatus = "REJECTED";
      versionStatus = "REJECTED";
    } else if (action === "RETURN") {
      finalStatus = "DRAFT";
      versionStatus = "DRAFT";
    }

    if (currentVersion) {
      await db.preContractProposalVersion.update({
        where: { id: currentVersion.id },
        data: {
          status: versionStatus,
          ...snapshotData,
          updatedAt: new Date()
        }
      });
    }

    await db.preContractProposal.update({
      where: { id: referenceId },
      data: { status: finalStatus, updatedAt: new Date() }
    });
  }
};
WorkflowAdapterRegistry.register(ProposalAdapter);
WorkflowAdapterRegistry.register({ ...ProposalAdapter, moduleType: "PRE_CONTRACT_PROPOSAL" });

// 3. Opportunity / Case Adapter
const CaseAdapter: WorkflowSourceAdapter = {
  moduleType: "PRE_CONTRACT_CASE",
  async getBusinessSummary(referenceId: string) {
    try {
      const c = await prisma.preContractCase.findUnique({
        where: { id: referenceId },
        include: { prospectClient: true }
      });
      if (!c) return null;
      const requesterName = await resolveRequesterDisplayName(c.createdBy, "Business Development");
      return {
        reference: `CASE-${c.id.substring(0, 8).toUpperCase()}`,
        title: c.title || `Commercial Case #${c.id.substring(0, 8)}`,
        subtitle: c.prospectClient?.name || "Pre-Contract Case",
        requesterName,
        companyId: c.companyId,
        companyName: "Al Hattab Holding",
        createdAt: c.createdAt.toISOString(),
        keyFields: [
          { label: "Client", value: c.prospectClient?.name || "Prospective Client" },
          { label: "Operation Type", value: c.operationType || "Commercial" },
          { label: "Lifecycle", value: c.lifecycle, badge: c.lifecycle }
        ],
        rawDetails: { c }
      };
    } catch (e) {
      return null;
    }
  },
  getSourceDeepLink(referenceId: string) {
    return `/commercial/opportunities?id=${referenceId}`;
  },
  async onWorkflowStatusChange(referenceId, action, newStatus, _remarks, tx) {
    const db = tx || prisma;
    if (action === "APPROVE" && newStatus === "APPROVED") {
      await db.preContractCase.update({
        where: { id: referenceId },
        data: {
          lifecycle: "COMPLETED",
          updatedAt: new Date()
        }
      });
    } else if (action === "RETURN") {
      await db.preContractCase.update({
        where: { id: referenceId },
        data: {
          lifecycle: "DRAFT",
          updatedAt: new Date()
        }
      });
    } else if (action === "REJECT") {
      await db.preContractCase.update({
        where: { id: referenceId },
        data: {
          lifecycle: "CANCELLED",
          businessOutcome: "LOST",
          updatedAt: new Date()
        }
      });
    }
  }
};
WorkflowAdapterRegistry.register(CaseAdapter);
WorkflowAdapterRegistry.register({ ...CaseAdapter, moduleType: "COMMERCIAL_OPPORTUNITY" });

// 3B. Site Survey Adapter (DEF-093, DEF-092, DEF-095)
const SiteSurveyAdapter: WorkflowSourceAdapter = {
  moduleType: "SITE_SURVEY",
  async getBusinessSummary(referenceId: string) {
    try {
      const survey = await prisma.preContractSurvey.findUnique({
        where: { id: referenceId },
        include: {
          case: { include: { prospectClient: true } },
          prospectiveSite: true
        }
      });
      if (!survey) return null;

      const siteLabel = survey.prospectiveSite?.name || `Survey ${survey.id.substring(0, 8).toUpperCase()}`;
      const caseTitle = survey.case?.title || "Commercial Opportunity";
      const requesterName = await resolveRequesterDisplayName(
        survey.conductedBy || survey.case?.createdBy,
        "Commercial Surveyor"
      );

      return {
        reference: `SRV-${survey.id.substring(0, 8).toUpperCase()}`,
        title: `${siteLabel} — ${caseTitle}`,
        subtitle: `${caseTitle} · ${survey.case?.prospectClient?.name || "Prospective Client"}`,
        requesterName,
        companyId: survey.companyId || survey.case?.companyId || null,
        companyName: "Al Hattab Holding",
        createdAt: survey.createdAt.toISOString(),
        keyFields: [
          { label: "Opportunity", value: caseTitle },
          { label: "Prospective Site", value: siteLabel },
          { label: "Operation Scope", value: survey.operationType || "SECURITY_GUARDING" },
          { label: "Lifecycle", value: survey.lifecycle, badge: survey.lifecycle }
        ],
        rawDetails: { survey }
      };
    } catch (e) {
      return null;
    }
  },
  getSourceDeepLink(referenceId: string) {
    return `/commercial/surveys?id=${referenceId}`;
  },
  async onWorkflowStatusChange(referenceId, action, newStatus, _remarks, tx) {
    const db = tx || prisma;
    if (action === "APPROVE" && newStatus === "APPROVED") {
      await db.preContractSurvey.update({
        where: { id: referenceId },
        data: {
          lifecycle: "COMPLETED",
          updatedAt: new Date()
        }
      });
    } else if (action === "RETURN") {
      await db.preContractSurvey.update({
        where: { id: referenceId },
        data: {
          lifecycle: "DRAFT",
          updatedAt: new Date()
        }
      });
    } else if (action === "REJECT") {
      await db.preContractSurvey.update({
        where: { id: referenceId },
        data: {
          lifecycle: "CANCELLED",
          updatedAt: new Date()
        }
      });
    }
  }
};
WorkflowAdapterRegistry.register(SiteSurveyAdapter);
WorkflowAdapterRegistry.register({ ...SiteSurveyAdapter, moduleType: "PRE_CONTRACT_SURVEY" });

// 4. Contract Adapter
const ContractAdapter: WorkflowSourceAdapter = {
  moduleType: "COMMERCIAL_CONTRACT",
  async getBusinessSummary(referenceId: string) {
    try {
      const contract = await prisma.manpowerContract.findUnique({
        where: { id: referenceId },
        include: { client: true }
      });
      if (!contract) return null;
      const val = contract.totalContractValue || 0;

      return {
        reference: contract.contractNumber || referenceId,
        title: contract.title || `Contract #${contract.contractNumber || referenceId}`,
        subtitle: contract.client?.name || "Commercial Contract",
        requesterName: "Contracts Admin",
        companyId: null,
        companyName: "Al Hattab Holding",
        createdAt: contract.createdAt.toISOString(),
        keyFields: [
          { label: "Contract Number", value: contract.contractNumber },
          { label: "Total Value", value: `QAR ${val.toLocaleString()}` },
          { label: "Status", value: contract.status, badge: contract.status }
        ],
        rawDetails: { contract }
      };
    } catch (e) {
      return null;
    }
  },
  getSourceDeepLink(referenceId: string) {
    return `/commercial/contracts?id=${referenceId}`;
  },
  async onWorkflowStatusChange(referenceId, action, newStatus, remarks, tx) {
    const db = tx || prisma;
    const now = new Date();
    let finalStatus = "PENDING_APPROVAL";
    let approvalStatus = "PENDING_APPROVAL";
    if (action === "APPROVE" && newStatus === "APPROVED") {
      finalStatus = "APPROVED";
      approvalStatus = "APPROVED";
    } else if (action === "REJECT") {
      finalStatus = "REJECTED";
      approvalStatus = "REJECTED";
    } else if (action === "RETURN") {
      finalStatus = "DRAFT";
      approvalStatus = "DRAFT";
    }

    await db.manpowerContract.update({
      where: { id: referenceId },
      data: {
        status: finalStatus,
        approvalStatus,
        ...(finalStatus === "APPROVED" ? { approvedAt: now } : {}),
        ...(finalStatus === "REJECTED" && remarks ? { rejectionRemarks: remarks } : {}),
        updatedAt: now
      }
    });

    await db.contractApprovalWorkflow.updateMany({
      where: { contractId: referenceId },
      data: {
        status: finalStatus === "APPROVED" ? "APPROVED" : finalStatus === "REJECTED" ? "REJECTED" : "PENDING",
        ...(finalStatus === "APPROVED" ? { approvedAt: now } : {}),
        ...(finalStatus === "REJECTED" ? { rejectedAt: now, finalRemarks: remarks || null } : {})
      }
    });
  }
};
WorkflowAdapterRegistry.register(ContractAdapter);
WorkflowAdapterRegistry.register({ ...ContractAdapter, moduleType: "CONTRACT_CONVERSION" });
WorkflowAdapterRegistry.register({ ...ContractAdapter, moduleType: "SECURITY_GUARDING_CONTRACT" });
WorkflowAdapterRegistry.register({ ...ContractAdapter, moduleType: "FACILITY_MANAGEMENT_CONTRACT" });

// 5. Addendum Adapter
const AddendumAdapter: WorkflowSourceAdapter = {
  moduleType: "CONTRACT_ADDENDUM",
  async getBusinessSummary(referenceId: string) {
    try {
      const addendum = await prisma.manpowerContractAddendum.findUnique({
        where: { id: referenceId },
        include: { contract: true }
      });
      if (!addendum) return null;
      const val = addendum.calculatedCommercialImpact || 0;

      return {
        reference: addendum.addendumNumber || referenceId,
        title: `Contract Addendum #${addendum.addendumNumber || referenceId}`,
        subtitle: addendum.contract?.title || "Contract Amendment",
        requesterName: "Contracts Team",
        companyId: null,
        createdAt: addendum.createdAt.toISOString(),
        keyFields: [
          { label: "Addendum Number", value: addendum.addendumNumber },
          { label: "Change Type", value: addendum.addendumType },
          { label: "Calculated Impact", value: `QAR ${val.toLocaleString()}` },
          { label: "Status", value: addendum.status, badge: addendum.status }
        ],
        rawDetails: { addendum }
      };
    } catch (e) {
      return null;
    }
  },
  getSourceDeepLink(referenceId: string) {
    return `/commercial/amendments`;
  },
  async onWorkflowStatusChange(referenceId, action, newStatus, remarks, tx) {
    await applyAddendumWorkflowTransition(referenceId, action, newStatus, tx, undefined, remarks);
  }
};
WorkflowAdapterRegistry.register(AddendumAdapter);
WorkflowAdapterRegistry.register({ ...AddendumAdapter, moduleType: "COMMERCIAL_ADDENDUM" });

// 6. Clearance Adapter
const ClearanceAdapter: WorkflowSourceAdapter = {
  moduleType: "CLEARANCE",
  async getBusinessSummary(referenceId: string) {
    try {
      const clearance = await prisma.clearanceRequest.findUnique({
        where: { id: referenceId },
        include: { approvalSteps: true, employee: true }
      });
      if (!clearance) return null;

      const empName = clearance.employeeNameSnapshot || clearance.employee?.name || clearance.employeeId;
      const empCode = clearance.employeeCodeSnapshot || clearance.employeeId;

      return {
        reference: clearance.clearanceNumber || referenceId,
        title: `Employee Clearance (${empName})`,
        subtitle: `${empCode} · ${clearance.clearanceType || "Exit Clearance"}`,
        requesterName: clearance.requestedById || "HR Officer",
        companyId: clearance.companyId,
        createdAt: clearance.requestDate ? clearance.requestDate.toISOString() : new Date().toISOString(),
        keyFields: [
          { label: "Employee Name", value: empName },
          { label: "Employee Code", value: empCode },
          { label: "Clearance Type", value: clearance.clearanceType || "Standard Exit" },
          { label: "Status", value: clearance.status, badge: clearance.status }
        ],
        rawDetails: { clearance }
      };
    } catch (e) {
      return null;
    }
  },
  getSourceDeepLink(referenceId: string) {
    return `/clearance/${referenceId}`;
  },
  async onWorkflowStatusChange(referenceId, action, newStatus, remarks, tx) {
    // Clearance status change handled directly
  }
};
WorkflowAdapterRegistry.register(ClearanceAdapter);

// 7. Leave Adapter
const LeaveAdapter: WorkflowSourceAdapter = {
  moduleType: "LEAVE_REQUEST",
  async getBusinessSummary(referenceId: string) {
    try {
      const leave = await prisma.leaveRequest.findUnique({
        where: { id: referenceId }
      });
      if (!leave) return null;

      return {
        reference: `LEAVE-${referenceId.substring(0, 8).toUpperCase()}`,
        title: `Leave Request (${leave.type || "Annual Leave"})`,
        subtitle: `${leave.startDate ? new Date(leave.startDate).toLocaleDateString() : ""} - ${leave.endDate ? new Date(leave.endDate).toLocaleDateString() : ""}`,
        requesterName: leave.employeeName || leave.employeeId,
        createdAt: leave.submittedAt ? leave.submittedAt.toISOString() : new Date().toISOString(),
        keyFields: [
          { label: "Leave Type", value: leave.type || "Annual" },
          { label: "Days", value: leave.totalDays || 1 },
          { label: "Reason", value: leave.reason || "Personal" },
          { label: "Status", value: leave.status || "Pending", badge: leave.status || "Pending" }
        ],
        rawDetails: { leave }
      };
    } catch (e) {
      return null;
    }
  },
  getSourceDeepLink(referenceId: string) {
    return `/leave`;
  }
};
WorkflowAdapterRegistry.register(LeaveAdapter);

// 8. Manpower Calendar Adapter
const CalendarAdapter: WorkflowSourceAdapter = {
  moduleType: "MANPOWER_CALENDAR",
  async getBusinessSummary(referenceId: string) {
    try {
      const cal = await prisma.manpowerHolidayCalendar.findUnique({
        where: { id: referenceId }
      });
      if (!cal) return null;

      return {
        reference: `CAL-${cal.year}-${cal.name || "Holiday Calendar"}`,
        title: `Manpower Holiday Calendar (${cal.year})`,
        subtitle: cal.name || "National & Religious Holidays",
        requesterName: cal.createdById || "HR Operations",
        companyId: cal.companyId,
        createdAt: cal.createdAt.toISOString(),
        keyFields: [
          { label: "Calendar Year", value: cal.year },
          { label: "Calendar Scope", value: cal.scope || "Company-wide" },
          { label: "Approval Status", value: cal.approvalStatus || "DRAFT", badge: cal.approvalStatus }
        ],
        rawDetails: { cal }
      };
    } catch (e) {
      return null;
    }
  },
  getSourceDeepLink(referenceId: string) {
    return `/settings/manpower-calendars`;
  }
};
WorkflowAdapterRegistry.register(CalendarAdapter);

// 9. Renewal Adapter
const RenewalAdapter: WorkflowSourceAdapter = {
  moduleType: "CONTRACT_RENEWAL",
  async getBusinessSummary(referenceId: string) {
    try {
      const ren = await prisma.manpowerContractRenewalCase.findUnique({
        where: { id: referenceId },
        include: { contract: { include: { client: true } } }
      });
      if (!ren) return null;
      return {
        reference: ren.caseNumber || referenceId,
        title: `Contract Renewal #${ren.caseNumber || referenceId}`,
        subtitle: ren.contract?.title || ren.contract?.client?.name || "Contract Renewal",
        requesterName: ren.createdByName || "Commercial Team",
        companyId: ren.companyId,
        createdAt: ren.createdAt.toISOString(),
        keyFields: [
          { label: "Case Number", value: ren.caseNumber },
          { label: "Contract", value: ren.contract?.contractNumber || "Contract" },
          { label: "Status", value: ren.status, badge: ren.status }
        ],
        rawDetails: { ren }
      };
    } catch (e) {
      return null;
    }
  },
  getSourceDeepLink(referenceId: string) {
    return `/commercial/renewals`;
  }
};
WorkflowAdapterRegistry.register(RenewalAdapter);
