import { prisma } from "@ahh-wfm/database";

export async function processDailyClosure(
  operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT",
  businessDate: Date,
  scopeKey: string,
  companyId: string,
  userId: string
) {
  // 1. Block if mandatory relievers are unresolved
  const unresolvedExceptions = await prisma.rosterPlanningException.findMany({
    where: {
      operationType,
      businessDate,
      status: "COVERAGE_REQUIRED"
    },
    include: { primaryAssignment: true }
  });
  
  if (unresolvedExceptions.length > 0) {
    throw new Error("Cannot close day: Unresolved mandatory relievers exist.");
  }
  
  // 2. Fetch assignments to build snapshot
  const assignments = await prisma.rosterSlotAssignment.findMany({
    where: { slot: { businessDate, operationType } },
    include: { planningException: true }
  });
  
  const snapshotData = assignments.map(a => ({
    primaryAssignmentId: a.assignmentType === "PRIMARY" ? a.id : a.replacesAssignmentId,
    planningExceptionId: a.planningExceptionId,
    exceptionType: a.planningException?.exceptionType,
    sourceId: a.slotId,
    relieverAssignmentId: a.assignmentType === "RELIEVER" ? a.id : null
  }));
  
  // 3. Upsert Closure
  const closure = await prisma.manpowerDailyClosure.upsert({
    where: { businessDate_scopeKey: { businessDate, scopeKey } },
    create: {
      workerClass: "BLUE_COLLAR",
      scopeType: "COMPANY",
      scopeKey,
      companyId,
      operationType,
      businessDate,
      status: "CLOSED",
      lastClosedAt: new Date(),
      lastClosedById: userId,
      createdById: userId,
      currentRevisionNumber: 1,
      version: 1
    },
    update: {
      status: "CLOSED",
      lastClosedAt: new Date(),
      lastClosedById: userId,
      currentRevisionNumber: { increment: 1 }
    }
  });
  
  // 4. Create Snapshot
  await prisma.manpowerDailyClosureSnapshot.create({
    data: {
      closureId: closure.id,
      revisionNumber: closure.currentRevisionNumber,
      snapshotJson: JSON.stringify(snapshotData),
      snapshotHash: "hash-" + Date.now(),
      sourceCutoffAt: new Date(),
      closedById: userId,
      readiness: "READY",
      rosterCounts: JSON.stringify({ total: assignments.length }),
      attendanceCounts: JSON.stringify({}),
      reconciliationCounts: JSON.stringify({}),
      exceptionCounts: JSON.stringify({ total: unresolvedExceptions.length }),
      overtimeCandidateCounts: JSON.stringify({}),
      absenceCandidateCounts: JSON.stringify({})
    }
  });
  
  return closure;
}
