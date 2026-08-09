import { prisma } from "@ahh-wfm/database";
import { getQatarDate, getQatarDateString } from "@/lib/roster-engine";
import { getRelieverEligibilityWhere } from "@/lib/contract-helpers";

export interface RosterCoverageParams {
  companyId?: string;
  operationType?: string;
  businessDateStr?: string;
}

export interface RosterCoverageResult {
  businessDate: string;
  requiredSlotsCount: number;
  assignedSlotsCount: number;
  uncoveredSlotsCount: number;
  coveragePercentage: number;
  relieverReqsCount: number;
  assignedRelieversCount: number;
  availableStandbyCount: number;
  uncoveredRelieverDemand: number;
  readinessStatus: "READY" | "ATTENTION" | "CRITICAL";
}

export async function getRosterCoverageAggregations(
  params: RosterCoverageParams,
  prismaClient?: any
): Promise<RosterCoverageResult> {
  const db = prismaClient || prisma;

  const { companyId, operationType, businessDateStr: rawDateStr } = params;
  const businessDate = rawDateStr ? rawDateStr.trim() : getQatarDateString(new Date());
  const targetDate = getQatarDate(businessDate);

  const slotWhere: any = { businessDate: targetDate };
  if (companyId) slotWhere.companyId = companyId;
  if (operationType && operationType !== "ALL") slotWhere.operationType = operationType;

  const totalSlotsCount = await db.rosterRequirementSlot.count({ where: slotWhere });
  const filledSlotsCount = await db.rosterRequirementSlot.count({
    where: { ...slotWhere, fulfillmentStatus: "FILLED" }
  });
  const uncoveredSlotsCount = await db.rosterRequirementSlot.count({
    where: { ...slotWhere, fulfillmentStatus: { in: ["VACANT", "UNCOVERED"] } }
  });

  const coveragePercentage =
    totalSlotsCount > 0 ? Math.round((filledSlotsCount / totalSlotsCount) * 100) : 100;

  const relieverReqsCount = await db.contractRelieverRequirement.count({
    where: {
      contract: {
        status: "ACTIVE",
        ...(operationType && operationType !== "ALL" ? { operationType } : {})
      }
    }
  });

  const assignedRelieversCount = await db.shiftRelieverAssignment.count({
    where: { date: businessDate }
  });

  const availableStandbyCount = await db.employee.count({
    where: getRelieverEligibilityWhere({ companyId, operationType })
  });

  const uncoveredRelieverDemand = Math.max(0, relieverReqsCount - assignedRelieversCount);
  let readinessStatus: "READY" | "ATTENTION" | "CRITICAL" = "READY";
  if (uncoveredRelieverDemand > 0) {
    readinessStatus = availableStandbyCount >= uncoveredRelieverDemand ? "ATTENTION" : "CRITICAL";
  }

  return {
    businessDate,
    requiredSlotsCount: totalSlotsCount,
    assignedSlotsCount: filledSlotsCount,
    uncoveredSlotsCount,
    coveragePercentage,
    relieverReqsCount,
    assignedRelieversCount,
    availableStandbyCount,
    uncoveredRelieverDemand,
    readinessStatus
  };
}
