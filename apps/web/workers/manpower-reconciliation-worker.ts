import { executeReconciliationRun } from "../lib/reconciliation-engine";
import { getQatarDateString } from "../lib/roster-engine";

const WORKER_ID = `manpower-reconciliation-worker-${process.pid}`;
const RECONCILIATION_INTERVAL_MS = Number(process.env.RECONCILIATION_WORKER_INTERVAL_MS) || 300000; // 5 minutes
const WORKER_ENABLED = process.env.RECONCILIATION_WORKER_ENABLED !== "false";

let isShuttingDown = false;

import { prisma } from "@ahh-wfm/database";
import { createAbsenceException } from "../lib/roster-engine";

async function detectApprovedLeavesForFutureSlots(operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT") {
  console.log(`[Manpower Reconciliation Worker] Scanning for overlapping approved leaves for ${operationType}...`);
  const targetDate = new Date();
  targetDate.setHours(0, 0, 0, 0);

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      endDate: { gte: targetDate },
      employee: { operationType }
    }
  });

  for (const leave of leaves) {
    const assignments = await prisma.rosterSlotAssignment.findMany({
      where: {
        employeeId: leave.employeeId,
        historyStatus: "ACTIVE",
        slot: {
          businessDate: { gte: leave.startDate as Date, lte: leave.endDate as Date },
          scheduleStatus: { notIn: ["CANCELLED"] }
        }
      },
      include: { slot: true }
    });

    for (const asg of assignments) {
      const existingException = await prisma.rosterPlanningException.findFirst({
        where: { slotId: asg.slotId, employeeId: asg.employeeId }
      });
      if (!existingException) {
        await prisma.$transaction(async (tx) => {
          await createAbsenceException(tx, asg, "LEAVE", leave.id);
        });
      }
    }
  }
}

async function recalculateDraftMP4Runs(operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT") {
  console.log(`[Manpower Reconciliation Worker] Recalculating MP-4 readiness for ${operationType}...`);
  const draftRuns = await prisma.manpowerPayrollAdvisoryRun.findMany({
    where: {
      operationType,
      status: { in: ["DRAFT", "CALCULATED", "SUPERSEDED"] as any }
    }
  });

  for (const run of draftRuns) {
    // If closure snapshots have changed, downgrade readiness
    const closures = await prisma.manpowerDailyClosure.findMany({
      where: { operationType, businessDate: { gte: run.fromDate as Date, lte: run.toDate as Date } }
    });
    const reopened = closures.some(c => c.status === "REOPENED" || c.status === "OPEN" || c.status === "UNDER_REVIEW");
    if (reopened && run.readiness !== "NEEDS_ATTENDANCE_RECONCILIATION") {
      await prisma.manpowerPayrollAdvisoryRun.update({
        where: { id: run.id },
        data: { readiness: "NEEDS_ATTENDANCE_RECONCILIATION" as any }
      });
    }
  }
}

async function runReconciliationCycle(): Promise<void> {
  if (isShuttingDown) return;

  const todayStr = getQatarDateString(new Date());
  const scopes: Array<"SECURITY_GUARDING" | "FACILITY_MANAGEMENT"> = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];

  for (const operationType of scopes) {
    if (isShuttingDown) break;

    try {
      console.log(`[Manpower Reconciliation Worker] Starting cycle for ${operationType} on ${todayStr}...`);
      const result = await executeReconciliationRun({
        operationType,
        businessDateStr: todayStr,
        runType: "SCHEDULED",
        workerInstanceId: WORKER_ID
      });
      
      await detectApprovedLeavesForFutureSlots(operationType);
      await recalculateDraftMP4Runs(operationType);

      console.log(`[Manpower Reconciliation Worker] Completed cycle for ${operationType}:`, result);
    } catch (error: any) {
      console.error(`[Manpower Reconciliation Worker] Error in cycle for ${operationType}:`, error.message || error);
    }
  }
}

async function workerLoop(): Promise<void> {
  console.log(`[Manpower Reconciliation Worker] Process started (PID: ${process.pid}, Interval: ${RECONCILIATION_INTERVAL_MS}ms)`);

  if (!WORKER_ENABLED) {
    console.log("[Manpower Reconciliation Worker] Disabled via RECONCILIATION_WORKER_ENABLED=false. Standing by...");
  }

  while (!isShuttingDown) {
    if (WORKER_ENABLED) {
      await runReconciliationCycle();
    }
    await new Promise((resolve) => setTimeout(resolve, RECONCILIATION_INTERVAL_MS));
  }

  console.log("[Manpower Reconciliation Worker] Loop terminated cleanly.");
}

process.on("SIGINT", () => {
  console.log("[Manpower Reconciliation Worker] Received SIGINT. Shutting down...");
  isShuttingDown = true;
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[Manpower Reconciliation Worker] Received SIGTERM. Shutting down...");
  isShuttingDown = true;
  process.exit(0);
});

workerLoop().catch((err) => {
  console.error("[Manpower Reconciliation Worker] Unhandled fatal error:", err);
  process.exit(1);
});
