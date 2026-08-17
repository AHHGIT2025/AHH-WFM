import { prisma } from "@ahh-wfm/database";
import { WorkflowSourceAdapter, WorkflowBusinessSummary } from "./types";

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

      return {
        reference: estimate.estimateNumber || referenceId,
        title: `Commercial Costing #${estimate.estimateNumber || referenceId}`,
        subtitle: estimate.case?.title || "Commercial Costing",
        requesterName: currentVersion?.createdBy || "Commercial Estimator",
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
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } }
    });
    if (!estimate) return;
    const currentVersion = estimate.versions[0];

    let versionStatus = currentVersion?.status || "DRAFT";

    if (action === "APPROVE" && newStatus === "APPROVED") {
      versionStatus = "APPROVED";
    } else if (action === "REJECT") {
      versionStatus = "REJECTED";
    } else if (action === "RETURN") {
      versionStatus = "DRAFT";
    }

    if (currentVersion) {
      await db.preContractCostEstimateVersion.update({
        where: { id: currentVersion.id },
        data: { status: versionStatus, updatedAt: new Date() }
      });
    }
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

      return {
        reference: proposal.proposalCode || referenceId,
        title: currentVersion?.title || `Commercial Proposal #${proposal.proposalCode || referenceId}`,
        subtitle: proposal.case?.title || "Commercial Proposal",
        requesterName: proposal.createdBy || "Sales Team",
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
    return `/commercial/proposals?id=${referenceId}`;
  },
  async onWorkflowStatusChange(referenceId, action, newStatus, remarks, tx) {
    const db = tx || prisma;
    let finalStatus = "IN_WORKFLOW";
    if (action === "APPROVE" && newStatus === "APPROVED") finalStatus = "APPROVED";
    else if (action === "REJECT") finalStatus = "REJECTED";
    else if (action === "RETURN") finalStatus = "DRAFT";

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
      return {
        reference: `CASE-${c.id.substring(0, 8).toUpperCase()}`,
        title: c.title || `Commercial Case #${c.id.substring(0, 8)}`,
        subtitle: c.prospectClient?.name || "Pre-Contract Case",
        requesterName: c.createdBy || "Business Development",
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
  }
};
WorkflowAdapterRegistry.register(CaseAdapter);
WorkflowAdapterRegistry.register({ ...CaseAdapter, moduleType: "COMMERCIAL_OPPORTUNITY" });

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
  }
};
WorkflowAdapterRegistry.register(ContractAdapter);
WorkflowAdapterRegistry.register({ ...ContractAdapter, moduleType: "CONTRACT_CONVERSION" });

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
