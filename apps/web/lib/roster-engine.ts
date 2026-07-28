import { prisma } from "@ahh-wfm/database";
import { resolveEmployeeTradePosition } from "./roster-display-utils";

export function getQatarDateString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Qatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(d);
}

export function getQatarDate(date: Date | string): Date {
  return new Date(getQatarDateString(date));
}

export interface EffectiveRequirement {
  contractRequirementId: string;
  position: string;
  quantity: number;
  sourceType: "CONTRACT_REQUIREMENT" | "ADDENDUM_REQUIREMENT" | "TEMPORARY_EVENT_REQUIREMENT";
  addendumId?: string | null;
  addendumLineItemId?: string | null;
  sourceEffectiveFrom: Date;
  sourceEffectiveTo?: Date | null;
  sourceVersion: number;
}

// Resolves what requirements are active for a specific contract on a given date
export async function getEffectiveRequirementsForDate(
  contractId: string,
  businessDate: Date
): Promise<EffectiveRequirement[]> {
  const dateStr = getQatarDateString(businessDate);
  const dateObj = new Date(dateStr);

  // Load contract with requirements
  const contract = await prisma.manpowerContract.findUnique({
    where: { id: contractId },
    include: {
      manpowerRequirements: true,
      addendums: {
        where: { status: "APPROVED" },
        include: { lineItems: true }
      }
    }
  });

  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  const effectiveReqs: Map<string, EffectiveRequirement> = new Map();

  // 1. Initialize with baseline requirements
  for (const req of contract.manpowerRequirements) {
    effectiveReqs.set(req.position, {
      contractRequirementId: req.id,
      position: req.position,
      quantity: req.quantity,
      sourceType: contract.contractType === "TEMPORARY" || contract.contractType === "EVENT" 
        ? "TEMPORARY_EVENT_REQUIREMENT" 
        : "CONTRACT_REQUIREMENT",
      sourceEffectiveFrom: new Date(getQatarDateString(contract.startDate)),
      sourceEffectiveTo: contract.endDate ? new Date(getQatarDateString(contract.endDate)) : null,
      sourceVersion: 1
    });
  }

  // 2. Sort addendums chronologically by effectiveFrom to apply them in order
  const activeAddendums = contract.addendums
    .filter(a => {
      const fromStr = getQatarDateString(a.effectiveFrom);
      const toStr = a.effectiveTo ? getQatarDateString(a.effectiveTo) : null;
      return dateStr >= fromStr && (!toStr || dateStr <= toStr);
    })
    .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());

  // 3. Apply addendum modifications
  for (const addendum of activeAddendums) {
    for (const item of addendum.lineItems) {
      if (item.itemType === "MANPOWER") {
        const position = item.itemName;
        const baselineReq = contract.manpowerRequirements.find(r => r.position === position);
        const fallbackReqId = baselineReq ? baselineReq.id : `req-added-${position}`;

        if (item.changeType === "REMOVE") {
          effectiveReqs.delete(position);
        } else {
          // ADD or MODIFY
          effectiveReqs.set(position, {
            contractRequirementId: baselineReq?.id || fallbackReqId,
            position,
            quantity: Math.round(item.quantity),
            sourceType: "ADDENDUM_REQUIREMENT",
            addendumId: addendum.id,
            addendumLineItemId: item.id,
            sourceEffectiveFrom: new Date(getQatarDateString(addendum.effectiveFrom)),
            sourceEffectiveTo: addendum.effectiveTo ? new Date(getQatarDateString(addendum.effectiveTo)) : null,
            sourceVersion: 2
          });
        }
      }
    }
  }

  return Array.from(effectiveReqs.values());
}

// Core slot generation engine
export async function syncSlotsForContractDate(
  contractId: string,
  businessDate: Date,
  tx: any = prisma
): Promise<{ generated: number; cancelled: number; exceptions: string[] }> {
  const dateStr = getQatarDateString(businessDate);
  const qatarDate = new Date(dateStr);

  const contract = await tx.manpowerContract.findUnique({
    where: { id: contractId },
    include: { shiftRequirements: true }
  });

  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  // 1. Draft contracts do not generate slots
  if (contract.status === "DRAFT") {
    return { generated: 0, cancelled: 0, exceptions: [] };
  }

  // Check if business date is outside contract active period
  const startStr = getQatarDateString(contract.startDate);
  const endStr = contract.endDate ? getQatarDateString(contract.endDate) : null;
  if (dateStr < startStr || (endStr && dateStr > endStr)) {
    return { generated: 0, cancelled: 0, exceptions: [] };
  }

  // 2. Check if contract is terminated on or before this date
  const isTerminated = contract.status === "TERMINATED" && contract.terminatedAt && qatarDate >= new Date(getQatarDateString(contract.terminatedAt));

  // Determine location details and resolve sites to sync
  // Load or create project for foreign key constraints
  let project = await tx.manpowerProject.findFirst({
    where: { contractId: contract.id }
  });
  if (!project) {
    project = await tx.manpowerProject.create({
      data: {
        contractId: contract.id,
        name: `${contract.title} - Project`,
        code: `PROJ-${contract.contractNumber}-${Date.now()}`,
        operationType: contract.operationType,
        isActive: true
      }
    });
  }

  const sitesToSync: Array<{ projectId: string; siteId: string | null; externalVenueSnapshot: string | null }> = [];

  if (contract.siteId) {
    sitesToSync.push({ projectId: project.id, siteId: contract.siteId, externalVenueSnapshot: null });
  } else if (contract.eventVenue) {
    sitesToSync.push({ projectId: project.id, siteId: null, externalVenueSnapshot: contract.eventVenue });
  } else {
    const projectsWithSites = await tx.manpowerProject.findMany({
      where: { contractId: contract.id },
      include: { sites: { where: { operationType: contract.operationType } } }
    });
    for (const proj of projectsWithSites) {
      for (const site of proj.sites) {
        sitesToSync.push({ projectId: proj.id, siteId: site.id, externalVenueSnapshot: null });
      }
    }
  }

  if (sitesToSync.length === 0) {
    throw new Error(`Contract ${contract.contractNumber} is missing a valid project/site allocation or event location.`);
  }

  // Load any company record to satisfy foreign key if needed
  const company = await tx.company.findFirst();
  const dbCompanyId = company?.id || null;

  const generatedKeys: Set<string> = new Set();
  const exceptions: string[] = [];

  let generatedCount = 0;
  let cancelledCount = 0;

  if (isTerminated) {
    // Contract is terminated: future slots must be cancelled
    const slots = await tx.rosterRequirementSlot.findMany({
      where: { contractId, businessDate: qatarDate, fulfillmentStatus: { not: "CANCELLED" } },
      include: { assignments: { where: { historyStatus: "ACTIVE" } } }
    });

    for (const slot of slots) {
      if (slot.assignments.length > 0) {
        // Raise exceptions for assigned slots that are terminated
        exceptions.push(`CONTRACT_TERMINATED_WITH_ASSIGNMENT: Slot ${slot.id} has active assignment under terminated contract.`);
        await tx.rosterPlanningException.create({
          data: {
            operationType: contract.operationType,
            contractId,
            siteId: contract.siteId,
            exceptionType: "CONTRACT_TERMINATED_WITH_ASSIGNMENT",
            severity: "CRITICAL",
            message: `Contract terminated with active assignment on ${dateStr} for position ${slot.snapshotPosition}.`,
            details: { slotId: slot.id, employeeId: slot.assignments[0].employeeId }
          }
        });
      } else {
        // Soft cancel vacant slots
        await tx.rosterRequirementSlot.update({
          where: { id: slot.id },
          data: { fulfillmentStatus: "CANCELLED", scheduleStatus: "COMPLETED" }
        });
        cancelledCount++;
      }
    }
    return { generated: 0, cancelled: cancelledCount, exceptions };
  }

  // Validate requirements existence before generating
  const manpowerCount = await tx.contractManpowerRequirement.count({
    where: { contractId }
  });
  if (manpowerCount === 0) {
    throw new Error(`Contract ${contract.contractNumber} has no manpower requirements.`);
  }
  if (contract.shiftRequirements.length === 0) {
    throw new Error(`Contract ${contract.contractNumber} has no active shift requirements.`);
  }

  // Get active requirements for this date
  const activeReqs = await getEffectiveRequirementsForDate(contractId, qatarDate);

  // Generate slots for each resolved site
  for (const siteInfo of sitesToSync) {
    const locationKey = siteInfo.siteId 
      ? `site:${siteInfo.siteId}` 
      : (siteInfo.externalVenueSnapshot ? `venue:${siteInfo.externalVenueSnapshot}` : "unknown");

    for (const req of activeReqs) {
      const shifts = contract.shiftRequirements.length > 0
        ? contract.shiftRequirements
        : [{ id: null, shiftName: "Standard Shift", startTime: "06:00", endTime: "18:00" }];

      for (const shift of shifts) {
        const shiftKey = shift.id ? `shift:${shift.id}` : "shift:DEFAULT";
        
        // Generate up to quantity slots
        for (let i = 1; i <= req.quantity; i++) {
          const genSitePart = siteInfo.siteId || siteInfo.externalVenueSnapshot || "null";
          const generationKey = `${req.contractRequirementId}:${dateStr}:${shiftKey}:${genSitePart}:${i}`;
          generatedKeys.add(generationKey);

          // Find or create slot idempotently
          const existingSlot = await tx.rosterRequirementSlot.findUnique({
            where: { generationKey },
            include: { assignments: { where: { historyStatus: "ACTIVE" } } }
          });

          if (!existingSlot) {
            await tx.rosterRequirementSlot.create({
              data: {
                operationType: contract.operationType,
                companyId: dbCompanyId,
                contractId,
                projectId: siteInfo.projectId,
                siteId: siteInfo.siteId,
                externalVenueSnapshot: siteInfo.externalVenueSnapshot,
                locationKey,
                contractRequirementId: req.contractRequirementId,
                addendumId: req.addendumId,
                addendumLineItemId: req.addendumLineItemId,
                sourceType: req.sourceType,
                sourceEffectiveFrom: req.sourceEffectiveFrom,
                sourceEffectiveTo: req.sourceEffectiveTo,
                sourceVersion: req.sourceVersion,
                businessDate: qatarDate,
                shiftRequirementId: shift.id,
                shiftKey,
                slotIndex: i,
                generationKey,
                snapshotPosition: req.position,
                snapshotShiftName: shift.shiftName,
                snapshotStartTime: shift.startTime,
                snapshotEndTime: shift.endTime,
                fulfillmentStatus: "VACANT",
                scheduleStatus: "DRAFT"
              }
            });
            generatedCount++;
          } else if (existingSlot.fulfillmentStatus === "CANCELLED") {
            // Reactivate previously cancelled slot if quantity/requirements restored
            await tx.rosterRequirementSlot.update({
              where: { id: existingSlot.id },
              data: { fulfillmentStatus: "VACANT" }
            });
            generatedCount++;
          }
        }
      }
    }
  }

  // 4. Cancel excess slots (if quantity decreased)
  const existingSlots = await tx.rosterRequirementSlot.findMany({
    where: { contractId, businessDate: qatarDate, fulfillmentStatus: { not: "CANCELLED" } },
    include: { assignments: { where: { historyStatus: "ACTIVE" } } }
  });

  for (const slot of existingSlots) {
    if (!generatedKeys.has(slot.generationKey)) {
      // Slot is no longer valid (excess)
      if (slot.assignments.length > 0) {
        // Raise EXCESS_ASSIGNED_SLOT exception
        exceptions.push(`EXCESS_ASSIGNED_SLOT: Slot ${slot.id} has active assignment but requirement was reduced.`);
        await tx.rosterPlanningException.create({
          data: {
            operationType: contract.operationType,
            contractId,
            siteId: contract.siteId,
            exceptionType: "EXCESS_ASSIGNED_SLOT",
            severity: "WARNING",
            message: `Requirement quantity decreased, leaving excess assigned slot on ${dateStr} for position ${slot.snapshotPosition}.`,
            details: { slotId: slot.id, employeeId: slot.assignments[0].employeeId }
          }
        });
      } else {
        // Cancel vacant excess slot
        await tx.rosterRequirementSlot.update({
          where: { id: slot.id },
          data: { fulfillmentStatus: "CANCELLED" }
        });
        cancelledCount++;
      }
    }
  }

  return { generated: generatedCount, cancelled: cancelledCount, exceptions };
}

// Synchronizes a range of dates for a contract
export async function syncSlotsForContractRange(
  contractId: string,
  startDate: Date,
  endDate: Date
): Promise<{ generated: number; cancelled: number; exceptions: string[] }> {
  let totalGenerated = 0;
  let totalCancelled = 0;
  const allExceptions: string[] = [];

  const start = getQatarDate(startDate);
  const end = getQatarDate(endDate);

  // Loop through date range day by day
  const curr = new Date(start);
  while (curr <= end) {
    const res = await prisma.$transaction(async (tx) => {
      return await syncSlotsForContractDate(contractId, curr, tx);
    });
    totalGenerated += res.generated;
    totalCancelled += res.cancelled;
    allExceptions.push(...res.exceptions);

    curr.setDate(curr.getDate() + 1);
  }

  return { generated: totalGenerated, cancelled: totalCancelled, exceptions: allExceptions };
}

// Resolves or creates a ShiftTemplate for legacy ShiftAssignment compatibility
export async function resolveOrCreateShiftTemplate(
  name: string,
  startTime: string,
  endTime: string,
  tx: any = prisma
): Promise<string> {
  const existing = await tx.shiftTemplate.findFirst({
    where: { startTime, endTime }
  });
  if (existing) {
    return existing.id;
  }
  const created = await tx.shiftTemplate.create({
    data: {
      name,
      startTime,
      endTime,
      isSplit: false,
      isFlexible: false
    }
  });
  return created.id;
}

// Resolves or creates a ManpowerShiftRequirement for legacy ManpowerDeployment compatibility
export async function resolveOrCreateManpowerShiftRequirement(
  siteId: string,
  positionName: string,
  shiftName: string,
  startTime: string,
  endTime: string,
  operationType: string,
  tx: any = prisma
): Promise<string> {
  let category = await tx.manpowerCategory.findFirst({
    where: { name: positionName, operationType }
  });
  if (!category) {
    const code = `MC-${positionName.toUpperCase().replace(/\s+/g, "")}`.slice(0, 100);
    category = await tx.manpowerCategory.findUnique({
      where: { code }
    });
    if (!category) {
      category = await tx.manpowerCategory.create({
        data: {
          name: positionName,
          code,
          operationType,
          isBlueCollar: true,
          isDeployableInRoster: true
        }
      });
    }
  }

  const existing = await tx.manpowerShiftRequirement.findFirst({
    where: {
      siteId,
      categoryId: category.id,
      shiftStartTime: startTime,
      shiftEndTime: endTime
    }
  });

  if (existing) {
    return existing.id;
  }

  const created = await tx.manpowerShiftRequirement.create({
    data: {
      siteId,
      categoryId: category.id,
      shiftCode: `SC-${startTime.replace(":", "")}-${endTime.replace(":", "")}`.slice(0, 100),
      requiredCount: 1,
      shiftStartTime: startTime,
      shiftEndTime: endTime,
      operationType
    }
  });

  return created.id;
}

// Projects a slot assignment changes into legacy ShiftAssignment and ManpowerDeployment models
export async function syncAssignmentToLegacy(
  assignmentId: string,
  tx: any = prisma
): Promise<{ success: boolean; error: string | null }> {
  try {
    const assignment = await tx.rosterSlotAssignment.findUnique({
      where: { id: assignmentId },
      include: { slot: true }
    });

    if (!assignment) {
      return { success: false, error: `Assignment ${assignmentId} not found` };
    }

    const { slot } = assignment;

    // 1. If assignment is ended or cancelled, deactivate legacy records
    if (assignment.historyStatus === "CANCELLED" || assignment.historyStatus === "ENDED") {
      if (assignment.legacyShiftAssignmentId) {
        await tx.shiftAssignment.updateMany({
          where: { id: assignment.legacyShiftAssignmentId },
          data: { assignmentStatus: "CANCELLED" }
        });
      }
      if (assignment.legacyDeploymentId) {
        await tx.manpowerDeploymentAssignment.updateMany({
          where: { id: assignment.legacyDeploymentId },
          data: { deploymentType: "CANCELLED" } // status update proxy
        });
      }

      await tx.rosterSlotAssignment.update({
        where: { id: assignmentId },
        data: {
          syncStatus: "SUCCESS",
          lastSyncedAt: new Date(),
          syncError: null
        }
      });
      return { success: true, error: null };
    }

    // 2. Project into legacy ShiftAssignment
    let legacyShiftAssignmentId = assignment.legacyShiftAssignmentId;
    if (!legacyShiftAssignmentId) {
      const shiftTemplateId = await resolveOrCreateShiftTemplate(
        slot.snapshotShiftName,
        slot.snapshotStartTime,
        slot.snapshotEndTime,
        tx
      );

      // Check for an existing record on same date, employee, and shift template to be idempotent
      const existingSA = await tx.shiftAssignment.findFirst({
        where: {
          employeeId: assignment.employeeId,
          date: slot.businessDate,
          shiftTemplateId
        }
      });

      if (existingSA) {
        legacyShiftAssignmentId = existingSA.id;
      } else {
        const newSA = await tx.shiftAssignment.create({
          data: {
            employeeId: assignment.employeeId,
            shiftTemplateId,
            date: slot.businessDate,
            projectId: slot.projectId,
            siteId: slot.siteId,
            assignmentStatus: "ACTIVE"
          }
        });
        legacyShiftAssignmentId = newSA.id;
      }
    } else {
      await tx.shiftAssignment.updateMany({
        where: { id: legacyShiftAssignmentId },
        data: { assignmentStatus: "ACTIVE" }
      });
    }

    // 3. Project into legacy ManpowerDeployment (if internal site is specified)
    let legacyDeploymentId = assignment.legacyDeploymentId;
    if (slot.siteId) {
      const shiftReqId = await resolveOrCreateManpowerShiftRequirement(
        slot.siteId,
        slot.snapshotPosition,
        slot.snapshotShiftName,
        slot.snapshotStartTime,
        slot.snapshotEndTime,
        slot.operationType,
        tx
      );

      // Resolve or create ManpowerDeployment
      let deployment = await tx.manpowerDeployment.findFirst({
        where: {
          date: slot.businessDate,
          shiftRequirementId: shiftReqId,
          operationType: slot.operationType
        }
      });

      if (!deployment) {
        deployment = await tx.manpowerDeployment.create({
          data: {
            date: slot.businessDate,
            shiftRequirementId: shiftReqId,
            operationType: slot.operationType,
            approvalStatus: "APPROVED"
          }
        });
      }

      if (!legacyDeploymentId) {
        // Check for existing assignment to prevent duplicates
        const existingDA = await tx.manpowerDeploymentAssignment.findFirst({
          where: {
            deploymentId: deployment.id,
            employeeId: assignment.employeeId
          }
        });

        if (existingDA) {
          legacyDeploymentId = existingDA.id;
        } else {
          const newDA = await tx.manpowerDeploymentAssignment.create({
            data: {
              deploymentId: deployment.id,
              employeeId: assignment.employeeId,
              deploymentType: "PERMANENT",
              sourceType: "GENERAL_POOL"
            }
          });
          legacyDeploymentId = newDA.id;
        }
      } else {
        await tx.manpowerDeploymentAssignment.updateMany({
          where: { id: legacyDeploymentId },
          data: { deploymentType: "PERMANENT" }
        });
      }
    }

    // 4. Update sync success metadata
    await tx.rosterSlotAssignment.update({
      where: { id: assignmentId },
      data: {
        legacyShiftAssignmentId,
        legacyDeploymentId,
        syncStatus: "SUCCESS",
        lastSyncedAt: new Date(),
        syncError: null
      }
    });

    return { success: true, error: null };
  } catch (err: any) {
    const errMsg = err.message || String(err);
    await tx.rosterSlotAssignment.update({
      where: { id: assignmentId },
      data: {
        syncStatus: "FAILED",
        lastSyncedAt: new Date(),
        syncError: errMsg
      }
    });
    return { success: false, error: errMsg };
  }
}

// Bounded batch execution of legacy sync
export async function syncPublishedAssignmentsBatch(
  assignmentIds: string[],
  batchSize = 20
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < assignmentIds.length; i += batchSize) {
    const batch = assignmentIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (id) => {
        const res = await prisma.$transaction(async (tx) => {
          return await syncAssignmentToLegacy(id, tx);
        });
        if (res.success) succeeded++;
        else failed++;
      })
    );
  }

  return { succeeded, failed };
}

// Check if two shift time ranges overlap, accounting for overnight wraps
export function areShiftsOverlapping(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const parseMin = (t: string) => {
    const parts = t.split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  };

  const s1 = parseMin(start1);
  let e1 = parseMin(end1);
  const s2 = parseMin(start2);
  let e2 = parseMin(end2);

  if (e1 < s1) e1 += 24 * 60;
  if (e2 < s2) e2 += 24 * 60;

  return s1 < e2 && s2 < e1;
}

// Complete server-side scheduling eligibility checks (Roster, Legacy Shift, Deployments, Leaves, and Qualifications)
export async function checkEmployeeSchedulingEligibility(
  employeeId: string,
  slotId: string,
  tx: any = prisma
): Promise<{ canDeploy: boolean; errors: string[]; warnings: string[]; checklist: any[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checklist: any[] = [];

  const slot = await tx.rosterRequirementSlot.findUnique({
    where: { id: slotId },
    include: { contract: true }
  });

  if (!slot) {
    throw new Error(`Slot ${slotId} not found`);
  }

  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    include: {
      designation: true,
      positionCategory: true,
      company: true
    }
  });

  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  // 0. Scheduling Period Lock check
  const dateStr = getQatarDateString(slot.businessDate);
  const qatarDate = new Date(dateStr);
  const periodStr = `${qatarDate.getFullYear()}-${String(qatarDate.getMonth() + 1).padStart(2, '0')}`;
  const periodLock = await tx.manpowerSchedulingPeriodLock.findUnique({
    where: { operationType_period: { operationType: slot.operationType, period: periodStr } }
  });
  if (slot.scheduleStatus === "LOCKED" || (periodLock && periodLock.locked)) {
    errors.push(`Period locked: Scheduling period ${periodStr} is locked.`);
    checklist.push({ rule: "PERIOD_LOCK", status: "FAIL", details: `Period ${periodStr} is locked` });
  } else {
    checklist.push({ rule: "PERIOD_LOCK", status: "PASS", details: "Unlocked" });
  }

  // 1. Workforce status check
  if (employee.isActive === false || employee.employmentStatus === "INACTIVE" || employee.employmentStatus === "DELETED") {
    errors.push("Employee is inactive or deactivated in Workforce Directory.");
    checklist.push({ rule: "ACTIVE_STATUS", status: "FAIL", details: "Inactive in directory" });
  } else {
    checklist.push({ rule: "ACTIVE_STATUS", status: "PASS", details: "Active" });
  }

  // 2. Operation Type Cross-Scope isolation check
  const employeeOpType = employee.operationType;
  if (employeeOpType && employeeOpType !== slot.operationType) {
    errors.push(`Cross-scope violation: Employee is in '${employeeOpType}', slot requires '${slot.operationType}'.`);
    checklist.push({ rule: "OPERATIONAL_SCOPE", status: "FAIL", details: `Scope mismatch (employee: ${employeeOpType}, slot: ${slot.operationType})` });
  } else {
    checklist.push({ rule: "OPERATIONAL_SCOPE", status: "PASS", details: `Matched: ${slot.operationType}` });
  }

  // 3. Approved Leave overlap check
  const leaves = await tx.leaveRequest.findMany({
    where: {
      employeeId,
      status: { in: ["Approved", "APPROVED"] },
      startDate: { lte: qatarDate },
      endDate: { gte: qatarDate }
    }
  });

  if (leaves.length > 0) {
    errors.push("Leave conflict: Employee has an approved leave request on this date.");
    checklist.push({ rule: "LEAVE_STATUS", status: "FAIL", details: `Approved leave: ${leaves[0].type}` });
  } else {
    checklist.push({ rule: "LEAVE_STATUS", status: "PASS", details: "Available" });
  }

  // 4. Overlapping Roster Assignment
  const rosterAssignments = await tx.rosterSlotAssignment.findMany({
    where: {
      employeeId,
      historyStatus: "ACTIVE",
      slot: {
        businessDate: qatarDate,
        fulfillmentStatus: { not: "CANCELLED" }
      }
    },
    include: { slot: true }
  });

  let scheduleConflict = false;
  for (const asg of rosterAssignments) {
    if (asg.slotId !== slotId && areShiftsOverlapping(slot.snapshotStartTime, slot.snapshotEndTime, asg.slot.snapshotStartTime, asg.slot.snapshotEndTime)) {
      errors.push(`Roster conflict: Overlaps with roster slot ${asg.slot.snapshotShiftName} (${asg.slot.snapshotStartTime}-${asg.slot.snapshotEndTime}).`);
      scheduleConflict = true;
      break;
    }
  }

  // 5. Overlapping Legacy ShiftAssignment
  const legacyShifts = await tx.shiftAssignment.findMany({
    where: {
      employeeId,
      date: qatarDate,
      assignmentStatus: "ACTIVE"
    },
    include: { shiftTemplate: true }
  });

  for (const ls of legacyShifts) {
    if (ls.shiftTemplate && areShiftsOverlapping(slot.snapshotStartTime, slot.snapshotEndTime, ls.shiftTemplate.startTime, ls.shiftTemplate.endTime)) {
      errors.push(`Legacy shift conflict: Overlaps with legacy shift ${ls.shiftTemplate.name} (${ls.shiftTemplate.startTime}-${ls.shiftTemplate.endTime}).`);
      scheduleConflict = true;
      break;
    }
  }

  // 6. Overlapping Legacy ManpowerDeploymentAssignment
  const legacyDeployments = await tx.manpowerDeploymentAssignment.findMany({
    where: {
      employeeId,
      deploymentType: { not: "CANCELLED" },
      deployment: {
        date: qatarDate
      }
    },
    include: { deployment: { include: { shiftRequirement: true } } }
  });

  for (const ld of legacyDeployments) {
    const start = ld.deployment.shiftRequirement.shiftStartTime || "06:00";
    const end = ld.deployment.shiftRequirement.shiftEndTime || "18:00";
    if (areShiftsOverlapping(slot.snapshotStartTime, slot.snapshotEndTime, start, end)) {
      errors.push(`Legacy deployment conflict: Overlaps with legacy deployment assignment (${start}-${end}).`);
      scheduleConflict = true;
      break;
    }
  }

  if (scheduleConflict) {
    checklist.push({ rule: "SCHEDULE_CONFLICT", status: "FAIL", details: "Overlapping schedule detected" });
  } else {
    checklist.push({ rule: "SCHEDULE_CONFLICT", status: "PASS", details: "No overlaps" });
  }

  // 7. Security specific licensing / gate pass check
  if (slot.operationType === "SECURITY_GUARDING") {
    // Check if contract or site requires gate pass/license
    const contractRequirements = await tx.contractManpowerRequirement.findUnique({
      where: { id: slot.contractRequirementId }
    });

    // Check MOI License
    const isMoiRequired = contractRequirements?.requiresMoiLicense || false; // default false
    if (isMoiRequired) {
      // Mock-up check: we can look for securityLicenseExpiry on employee
      const licExpiry = employee.securityLicenseExpiry;
      if (!licExpiry) {
        errors.push("Missing MOI License: Employee lacks mandatory MOI security guarding license.");
        checklist.push({ rule: "SECURITY_LICENSE", status: "FAIL", details: "No MOI License" });
      } else {
        const expiryDate = new Date(licExpiry);
        if (expiryDate < qatarDate) {
          errors.push(`Expired MOI License: Security license expired on ${licExpiry}.`);
          checklist.push({ rule: "SECURITY_LICENSE", status: "FAIL", details: `Expired ${licExpiry}` });
        } else {
          checklist.push({ rule: "SECURITY_LICENSE", status: "PASS", details: `Valid until ${licExpiry}` });
        }
      }
    } else {
      checklist.push({ rule: "SECURITY_LICENSE", status: "INFO", details: "Not required" });
    }
  } else {
    checklist.push({ rule: "SECURITY_LICENSE", status: "INFO", details: "Not applicable (FM)" });
  }

  // 8. Category-aware Position / Designation Matching check
  const requiredPositionRaw = slot.snapshotPosition || "";
  const requiredPositionNorm = requiredPositionRaw.toLowerCase().trim();
  const empCategory = (employee?.employeeCategory || "").toUpperCase();
  const isBlueCollar = empCategory === "BLUE_COLLAR" || (!empCategory && Boolean(employee?.positionCategory));
  const isWhiteCollar = empCategory === "WHITE_COLLAR";

  if (isBlueCollar) {
    const empTradePosition = resolveEmployeeTradePosition(employee);
    const empTradeNorm = empTradePosition.toLowerCase().trim();

    const hasSlotPosId = slot.snapshotPositionCategoryId || slot.positionCategoryId;
    const hasEmpPosId = employee.positionCategoryId;
    let isMatch = false;

    if (hasSlotPosId && hasEmpPosId) {
      isMatch = hasSlotPosId === hasEmpPosId;
    } else if (requiredPositionNorm && empTradeNorm && empTradePosition !== "Not specified") {
      isMatch = requiredPositionNorm.includes(empTradeNorm) || empTradeNorm.includes(requiredPositionNorm);
    } else if (!requiredPositionNorm) {
      isMatch = true;
    } else {
      isMatch = false;
    }

    if (!isMatch && empTradePosition !== "Not specified") {
      warnings.push(`Trade/Position mismatch: Slot requires '${requiredPositionRaw}', employee Trade/Position is '${empTradePosition}'.`);
      checklist.push({
        rule: "TRADE_POSITION_MATCH",
        status: "WARN",
        details: `Expected ${requiredPositionRaw}, got ${empTradePosition}`
      });
    } else if (empTradePosition === "Not specified") {
      warnings.push(`Trade/Position missing: Employee operational Trade/Position is not specified.`);
      checklist.push({
        rule: "TRADE_POSITION_MATCH",
        status: "WARN",
        details: `Employee Trade/Position not specified`
      });
    } else {
      checklist.push({
        rule: "TRADE_POSITION_MATCH",
        status: "PASS",
        details: "Matched Trade/Position"
      });
    }
  } else if (isWhiteCollar) {
    const employeeDesignation = employee.designation?.name || "";
    const empDesigNorm = employeeDesignation.toLowerCase().trim();

    if (requiredPositionNorm && empDesigNorm && !empDesigNorm.includes(requiredPositionNorm) && !requiredPositionNorm.includes(empDesigNorm)) {
      warnings.push(`Designation mismatch: Slot requires '${requiredPositionRaw}', employee designation is '${employeeDesignation || "Staff"}'.`);
      checklist.push({
        rule: "DESIGNATION_MATCH",
        status: "WARN",
        details: `Expected ${requiredPositionRaw}, got ${employeeDesignation || "Staff"}`
      });
    } else {
      checklist.push({
        rule: "DESIGNATION_MATCH",
        status: "PASS",
        details: "Matched designation"
      });
    }
  } else {
    checklist.push({
      rule: "POSITION_MATCH",
      status: "INFO",
      details: "Unknown employee category for position validation"
    });
  }

  return {
    canDeploy: errors.length === 0,
    errors,
    warnings,
    checklist
  };
}

export async function transitionPlanningException(
  exceptionId: string,
  targetStatus: "COVERAGE_REQUIRED" | "RELIEVER_ASSIGNED" | "RESOLVED" | "CANCELLED",
  auditData: {
    actorId: string;
    reason?: string;
  },
  tx: any
): Promise<any> {
  const exception = await tx.rosterPlanningException.findUnique({
    where: { id: exceptionId },
    include: {
      relievers: {
        where: { historyStatus: "ACTIVE" }
      }
    }
  });

  if (!exception) {
    throw new Error(`Exception ${exceptionId} not found`);
  }

  const resolved = targetStatus === "RESOLVED";
  const resolvedAt = resolved ? new Date() : exception.resolvedAt;
  const resolvedById = resolved ? auditData.actorId : exception.resolvedById;

  const cancelled = targetStatus === "CANCELLED";
  const cancelledAt = cancelled ? new Date() : exception.cancelledAt;
  const cancelledById = cancelled ? auditData.actorId : exception.cancelledById;
  const cancellationReason = cancelled ? (auditData.reason || null) : exception.cancellationReason;

  const activeExceptionKey = (targetStatus === "RESOLVED" || targetStatus === "CANCELLED")
    ? null
    : exception.primaryAssignmentId;

  if (targetStatus === "CANCELLED") {
    const activeRelievers = exception.relievers;
    for (const reliever of activeRelievers) {
      await tx.rosterSlotAssignment.update({
        where: { id: reliever.id },
        data: {
          historyStatus: "CANCELLED",
          activeCoverageKey: null,
          unassignedById: auditData.actorId,
          unassignedAt: new Date(),
          unassignmentReason: auditData.reason || "Exception cancelled"
        }
      });
      if (reliever.legacyShiftAssignmentId) {
        await tx.shiftAssignment.updateMany({
          where: { id: reliever.legacyShiftAssignmentId },
          data: { assignmentStatus: "CANCELLED" }
        });
      }
      if (reliever.legacyDeploymentId) {
        await tx.manpowerDeploymentAssignment.updateMany({
          where: { id: reliever.legacyDeploymentId },
          data: { deploymentType: "CANCELLED" }
        });
      }
    }
  }

  if (targetStatus === "RESOLVED") {
    const activeRelievers = exception.relievers;
    for (const reliever of activeRelievers) {
      await tx.rosterSlotAssignment.update({
        where: { id: reliever.id },
        data: {
          activeCoverageKey: null
        }
      });
    }
  }

  return await tx.rosterPlanningException.update({
    where: { id: exceptionId },
    data: {
      status: targetStatus,
      resolved,
      resolvedAt,
      resolvedById,
      cancelledAt,
      cancelledById,
      cancellationReason,
      activeExceptionKey
    }
  });
}

export function generateActiveExceptionKey(slotId: string, employeeId: string): string {
  return `${slotId}-${employeeId}-EXCEPTION`;
}

export async function createAbsenceException(
  tx: any,
  assignment: any,
  exceptionType: "DAY_OFF" | "LEAVE" | "SICK_LEAVE" | "ABSENT",
  leaveRequestId?: string
) {
  const activeExceptionKey = generateActiveExceptionKey(assignment.slotId, assignment.employeeId);
  return await tx.rosterPlanningException.upsert({
    where: { activeExceptionKey },
    create: {
      operationType: assignment.slot.operationType,
      contractId: assignment.slot.contractId,
      siteId: assignment.slot.siteId,
      exceptionType,
      severity: "CRITICAL",
      message: `${exceptionType} recorded for assigned slot. Coverage required.`,
      status: "COVERAGE_REQUIRED",
      businessDate: assignment.slot.businessDate,
      slotId: assignment.slotId,
      employeeId: assignment.employeeId,
      primaryAssignmentId: assignment.id,
      leaveRequestId: leaveRequestId || null,
      activeExceptionKey,
      resolved: false
    },
    update: {
      exceptionType,
      status: "COVERAGE_REQUIRED",
      leaveRequestId: leaveRequestId || null
    }
  });
}
