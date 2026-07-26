import { prisma } from "@ahh-wfm/database";

export interface BillingSupportCalculationParams {
  operationType: string; // "SECURITY_GUARDING" | "FACILITY_MANAGEMENT"
  period: string;        // "YYYY-MM"
  clientId?: string;
  contractId?: string;
  projectId?: string;
  siteId?: string;
  companyId?: string;
  calculatedBy: string;
}

export interface CalculatedBillingLine {
  businessDate: string;
  clientId: string | null;
  clientNameSnapshot: string;
  contractId: string | null;
  contractCodeSnapshot: string;
  projectId: string | null;
  projectNameSnapshot: string;
  siteId: string | null;
  siteNameSnapshot: string;
  requirementSlotId: string | null;
  positionCategory: string | null;
  plannedManpower: number;
  plannedPostMinutes: number;
  assignedManpower: number;
  verifiedPresentManpower: number;
  verifiedAttendedMinutes: number;
  coveredPostMinutes: number;
  shortageCount: number;
  unapprovedExtraCount: number;
  approvedExtraCount: number;
  relieverSubstitutionCount: number;
  focRelieverMinutes: number;
  billableAdvisoryQuantity: number;
  billingBasis: string;
  warningCodes: string[];
  notes: string;
}

/**
 * Calculates MP-3C Client Billing Support Advisory data from relational identity and verified evidence.
 */
export async function calculateBillingSupportData(
  params: BillingSupportCalculationParams
): Promise<{ lines: CalculatedBillingLine[]; summary: any }> {
  const year = parseInt(params.period.split("-")[0]);
  const month = parseInt(params.period.split("-")[1]);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  // 1. Fetch Requirements & Contracts
  const requirements = await prisma.contractManpowerRequirement.findMany({
    where: {
      contract: {
        operationType: params.operationType,
        ...(params.clientId ? { clientId: params.clientId } : {}),
        ...(params.contractId ? { id: params.contractId } : {})
      }
    },
    include: {
      contract: { include: { client: true, site: { include: { project: true } } } },
      rosterSlots: true
    }
  });

  // 2. Fetch Assignments
  const assignments = await prisma.rosterSlotAssignment.findMany({
    where: {
      slot: {
        contract: {
          operationType: params.operationType,
          ...(params.clientId ? { clientId: params.clientId } : {}),
          ...(params.contractId ? { id: params.contractId } : {})
        },
        ...(params.siteId ? { siteId: params.siteId } : {}),
        businessDate: { gte: start, lte: end }
      }
    },
    include: {
      slot: {
        include: {
          contract: { include: { client: true } },
          site: { include: { project: true } }
        }
      },
      employee: true
    }
  });

  // 3. Fetch Verified Attendance
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      checkIn: { gte: start, lte: end },
      employee: { operationType: params.operationType }
    }
  });

  const lines: CalculatedBillingLine[] = [];
  let totalPlannedManpower = 0;
  let totalAssignedManpower = 0;
  let totalVerifiedPresent = 0;
  let totalBillableQuantity = 0;

  // Group by (siteId, requirementSlotId, businessDate)
  const dateMap = new Map<string, { slots: any[]; asgs: any[] }>();

  assignments.forEach((asg: any) => {
    const dStr = asg.slot.businessDate.toISOString().split("T")[0];
    const key = `${asg.slot.siteId || "NO_SITE"}:${asg.slotId}:${dStr}`;
    if (!dateMap.has(key)) {
      dateMap.set(key, { slots: [asg.slot], asgs: [] });
    }
    dateMap.get(key)!.asgs.push(asg);
  });

  requirements.forEach((req: any) => {
    (req.rosterSlots || []).forEach((slot: any) => {
      const dStr = slot.businessDate.toISOString().split("T")[0];
      const key = `${slot.siteId || "NO_SITE"}:${slot.id}:${dStr}`;
      if (!dateMap.has(key)) {
        dateMap.set(key, { slots: [slot], asgs: [] });
      }
    });
  });

  dateMap.forEach(({ slots, asgs }, key) => {
    const slot = slots[0];
    const dStr = key.split(":")[2];
    const plannedManpower = slot ? 1 : 0;
    const plannedPostMinutes = 480;

    let assignedManpower = 0;
    let verifiedPresentManpower = 0;
    let verifiedAttendedMinutes = 0;
    let relieverSubstitutionCount = 0;
    let focRelieverMinutes = 0;
    const warnings: string[] = [];

    asgs.forEach((asg: any) => {
      if (asg.assignmentType === "RELIEVER") {
        relieverSubstitutionCount++;
      } else {
        assignedManpower++;
      }

      const att = attendanceRecords.find(
        a => a.employeeId === asg.employeeId && a.checkIn.toISOString().split("T")[0] === dStr
      );

      if (att && att.checkIn && att.checkOut) {
        verifiedPresentManpower++;
        const mins = Math.round((att.checkOut.getTime() - att.checkIn.getTime()) / (1000 * 60));
        verifiedAttendedMinutes += mins;
      } else if (att) {
        verifiedPresentManpower++;
        verifiedAttendedMinutes += plannedPostMinutes;
      }
    });

    const totalCoveredCount = assignedManpower + relieverSubstitutionCount;
    const coveredPostMinutes = Math.min(verifiedAttendedMinutes, plannedPostMinutes);
    const shortageCount = Math.max(0, plannedManpower - totalCoveredCount);
    const unapprovedExtraCount = Math.max(0, totalCoveredCount - plannedManpower);
    const approvedExtraCount = 0;

    if (shortageCount > 0) warnings.push("UNDER_DEPLOYMENT_SHORTAGE");
    if (unapprovedExtraCount > 0) warnings.push("UNAPPROVED_EXTRA_DEPLOYMENT");

    const billableAdvisoryQuantity = Math.min(plannedManpower, verifiedPresentManpower);

    totalPlannedManpower += plannedManpower;
    totalAssignedManpower += assignedManpower;
    totalVerifiedPresent += verifiedPresentManpower;
    totalBillableQuantity += billableAdvisoryQuantity;

    lines.push({
      businessDate: dStr,
      clientId: slot?.contract?.clientId || null,
      clientNameSnapshot: slot?.contract?.client?.name || slot?.contract?.client?.clientName || "Client",
      contractId: slot?.contractId || null,
      contractCodeSnapshot: slot?.contract?.contractNumber || slot?.contractId || "Contract",
      projectId: slot?.site?.projectId || null,
      projectNameSnapshot: slot?.site?.project?.name || "Project",
      siteId: slot?.siteId || null,
      siteNameSnapshot: slot?.site?.name || "Site",
      requirementSlotId: slot?.id || null,
      positionCategory: slot?.snapshotPosition || "Guard/Staff",
      plannedManpower,
      plannedPostMinutes,
      assignedManpower,
      verifiedPresentManpower,
      verifiedAttendedMinutes,
      coveredPostMinutes,
      shortageCount,
      unapprovedExtraCount,
      approvedExtraCount,
      relieverSubstitutionCount,
      focRelieverMinutes,
      billableAdvisoryQuantity,
      billingBasis: "PLANNED_VS_ACTUAL_ATTENDANCE",
      warningCodes: warnings,
      notes: shortageCount > 0 ? "Under-deployment detected" : "Full post covered"
    });
  });

  return {
    lines,
    summary: {
      totalPlannedManpower,
      totalAssignedManpower,
      totalVerifiedPresent,
      totalBillableQuantity,
      lineCount: lines.length
    }
  };
}

/**
 * Creates a durable ManpowerBillingSupportRun and saves its lines.
 * Retains immutability for LOCKED or EXPORTED runs by creating a new version.
 */
export async function createDurableBillingRun(params: BillingSupportCalculationParams): Promise<any> {
  const runCode = `BILL-${params.operationType}-${params.period}-${Date.now().toString(36)}`;

  const existingRun = await prisma.manpowerBillingSupportRun.findFirst({
    where: {
      operationType: params.operationType,
      period: params.period,
      status: { in: ["LOCKED", "EXPORTED"] }
    },
    orderBy: { version: "desc" }
  });

  const nextVersion = existingRun ? existingRun.version + 1 : 1;

  if (existingRun) {
    await prisma.manpowerBillingSupportRun.update({
      where: { id: existingRun.id },
      data: { status: "SUPERSEDED", supersededAt: new Date() }
    });
  }

  const { lines, summary } = await calculateBillingSupportData(params);

  const run = await prisma.manpowerBillingSupportRun.create({
    data: {
      runCode,
      operationType: params.operationType,
      period: params.period,
      status: "CALCULATED",
      version: nextVersion,
      supersedesRunId: existingRun?.id || null,
      calculatedBy: params.calculatedBy,
      resultSummary: summary,
      lines: {
        create: lines.map(line => ({
          businessDate: new Date(line.businessDate),
          clientId: line.clientId,
          clientNameSnapshot: line.clientNameSnapshot,
          contractId: line.contractId,
          contractCodeSnapshot: line.contractCodeSnapshot,
          projectId: line.projectId,
          projectNameSnapshot: line.projectNameSnapshot,
          siteId: line.siteId,
          siteNameSnapshot: line.siteNameSnapshot,
          requirementSlotId: line.requirementSlotId,
          positionCategory: line.positionCategory,
          plannedManpower: line.plannedManpower,
          plannedPostMinutes: line.plannedPostMinutes,
          assignedManpower: line.assignedManpower,
          verifiedPresentManpower: line.verifiedPresentManpower,
          verifiedAttendedMinutes: line.verifiedAttendedMinutes,
          coveredPostMinutes: line.coveredPostMinutes,
          shortageCount: line.shortageCount,
          unapprovedExtraCount: line.unapprovedExtraCount,
          approvedExtraCount: line.approvedExtraCount,
          relieverSubstitutionCount: line.relieverSubstitutionCount,
          focRelieverMinutes: line.focRelieverMinutes,
          billableAdvisoryQuantity: line.billableAdvisoryQuantity,
          billingBasis: line.billingBasis,
          warningCodes: line.warningCodes,
          notes: line.notes
        }))
      }
    },
    include: { lines: true }
  });

  return run;
}
