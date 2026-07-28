import { prisma } from "@ahh-wfm/database";
import { Prisma } from "@ahh-wfm/database";

export interface RelieverEligibilityCriteria {
  slotId: string;
  targetDate: string; // YYYY-MM-DD
}

export interface EligibleRelieverResult {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  isEligible: boolean;
  exclusionReasons: string[];
}

export async function validateRelieverEligibility(
  criteria: RelieverEligibilityCriteria
): Promise<EligibleRelieverResult[]> {
  const slot = await prisma.rosterRequirementSlot.findUnique({
    where: { id: criteria.slotId }
  });

  if (!slot) {
    throw new Error(`Slot ${criteria.slotId} not found`);
  }

  if (slot.fulfillmentStatus === "CANCELLED") {
    throw new Error("Authoritative slot is cancelled or superseded");
  }

  // 1. Fetch potential employees matching scope
  // For simplicity in this engine, we fetch employees in the same company/project/site with the same position category.
  // In a real large DB we would chunk this, but for MVP we filter.

  const targetDate = new Date(criteria.targetDate);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const potentialEmployees = await prisma.employee.findMany({
    where: {
      isActive: true,
      operationType: slot.operationType
    },
    include: {
      deployments: {
        where: {
          status: "ACTIVE",
          projectId: slot.projectId,
          ...(slot.siteId ? { siteId: slot.siteId } : {})
        }
      },
      leaves: {
        where: {
          status: "APPROVED",
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        }
      },
      assignedRosterSlots: {
        where: {
          historyStatus: "ACTIVE",
          slot: {
            businessDate: criteria.targetDate,
            scheduleStatus: { notIn: ["CANCELLED"] }
          }
        },
        include: { slot: true }
      }
    }
  });

  const results: EligibleRelieverResult[] = [];

  for (const emp of potentialEmployees) {
    const reasons: string[] = [];

    // Rule: Must have an active deployment to the project/site
    if (emp.deployments.length === 0) {
      reasons.push("Not actively deployed to required Project/Site for this date");
    }

    // Rule: No overlapping approved leave
    if (emp.leaves.length > 0) {
      reasons.push("Has overlapping approved LEAVE");
    }

    // Rule: No overlapping primary or reliever assignment
    let hasOverlap = false;
    for (const assignment of emp.assignedRosterSlots) {
      // Assuming same businessDate means overlap in this basic check. 
      // For detailed shift overlap, we'd check snapshotStartTime and snapshotEndTime.
      if (
        (slot.snapshotStartTime && assignment.slot.snapshotEndTime && slot.snapshotStartTime < assignment.slot.snapshotEndTime) &&
        (slot.snapshotEndTime && assignment.slot.snapshotStartTime && slot.snapshotEndTime > assignment.slot.snapshotStartTime)
      ) {
         hasOverlap = true;
         if (assignment.assignmentType === "RELIEVER") {
           reasons.push("Already assigned as RELIEVER on overlapping shift");
         } else {
           reasons.push("Already assigned as PRIMARY on overlapping shift");
         }
      }
    }

    // Rule: Work calendar & rest rules (Stubbed for now, normally calls validateRestDayLifecycle)
    // Rule: Working-time thresholds (Stubbed for now)

    results.push({
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.id,
      isEligible: reasons.length === 0,
      exclusionReasons: reasons,
    });
  }

  return results;
}
