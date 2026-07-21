import { prisma } from "@ahh-wfm/database";
import { isDbConnected } from "@ahh-wfm/mock-data";
import { acquireWorkerLock, releaseWorkerLock } from "./secfac-worker-lock";
import { timeoutPendingDispatchAssignments } from "./secfac-sos-dispatch-service";
import {
  generateWelfareChecksForActiveDeployments,
  evaluateMissedWelfareChecks
} from "./secfac-welfare-service";
import { evaluatePatrolAssurance } from "./secfac-patrol-evaluator";

export interface JobExecutionResult {
  jobCode: string;
  lockKey: string;
  success: boolean;
  durationMs: number;
  processedCount: number;
  error?: string;
}

/**
 * Runs a single worker job wrapped with distributed lock and SecFacWorkerJob tracking.
 */
async function runSingleWorkerJob(
  jobCode: string,
  lockKey: string,
  jobFn: () => Promise<number>
): Promise<JobExecutionResult> {
  const workerInstanceId = `worker-phase6a2-${process.pid || "node"}-${Date.now()}`;
  const startTime = Date.now();

  if (!isDbConnected()) {
    // Mock execution fallback
    const mockProcessed = await jobFn();
    return {
      jobCode,
      lockKey,
      success: true,
      durationMs: Date.now() - startTime,
      processedCount: mockProcessed
    };
  }

  // Acquire distributed lock
  const lock = await acquireWorkerLock(lockKey, workerInstanceId, 180);
  if (!lock.acquired) {
    return {
      jobCode,
      lockKey,
      success: false,
      durationMs: Date.now() - startTime,
      processedCount: 0,
      error: lock.reason || "Lock already held by another worker."
    };
  }

  let success = true;
  let processedCount = 0;
  let errorMsg: string | undefined;

  try {
    processedCount = await jobFn();
  } catch (err: any) {
    success = false;
    errorMsg = err?.message || String(err);
    console.error(`Error executing worker job ${jobCode}:`, err);
  } finally {
    const durationMs = Date.now() - startTime;
    const now = new Date();

    try {
      await prisma.secFacWorkerJob.create({
        data: {
          jobType: jobCode,
          lockKey,
          status: success ? "COMPLETED" : "FAILED",
          startedAt: new Date(startTime),
          completedAt: now,
          processedCount,
          successCount: success ? processedCount : 0,
          failureCount: success ? 0 : 1,
          errorSummary: errorMsg || null,
          metadata: {
            durationMs,
            workerInstanceId
          }
        }
      });
    } catch (dbErr) {
      console.error(`Failed to record worker job execution metrics for ${jobCode}:`, dbErr);
    }

    await releaseWorkerLock(lockKey, workerInstanceId);
  }

  return {
    jobCode,
    lockKey,
    success,
    durationMs: Date.now() - startTime,
    processedCount,
    error: errorMsg
  };
}

/**
 * Runs all 4 Phase 6A.2 worker jobs independently.
 * Isolated locks & error boundaries ensure failure in one job does not stop others.
 */
export async function runAllPhase6a2WorkerJobs(): Promise<{
  results: JobExecutionResult[];
  totalProcessed: number;
}> {
  const results: JobExecutionResult[] = [];

  // Job 1: SECFAC_DISPATCH_TIMEOUT
  const dispatchResult = await runSingleWorkerJob(
    "SECFAC_DISPATCH_TIMEOUT",
    "lock:secfac:dispatch-timeout",
    async () => {
      const res = await timeoutPendingDispatchAssignments();
      return res.timedOutCount;
    }
  );
  results.push(dispatchResult);

  // Job 2: SECFAC_WELFARE_GENERATE
  const welfareGenResult = await runSingleWorkerJob(
    "SECFAC_WELFARE_GENERATE",
    "lock:secfac:welfare-generate",
    async () => {
      const res = await generateWelfareChecksForActiveDeployments();
      return res.generatedCount;
    }
  );
  results.push(welfareGenResult);

  // Job 3: SECFAC_WELFARE_MISSED_EVALUATE
  const welfareMissedResult = await runSingleWorkerJob(
    "SECFAC_WELFARE_MISSED_EVALUATE",
    "lock:secfac:welfare-missed-eval",
    async () => {
      const res = await evaluateMissedWelfareChecks();
      return res.missedCount;
    }
  );
  results.push(welfareMissedResult);

  // Job 4: SECFAC_PATROL_ASSURANCE_EVALUATE
  const patrolResult = await runSingleWorkerJob(
    "SECFAC_PATROL_ASSURANCE_EVALUATE",
    "lock:secfac:patrol-assurance-eval",
    async () => {
      const res = await evaluatePatrolAssurance();
      return res.lateCheckpointsCount + res.missedCheckpointsCount;
    }
  );
  results.push(patrolResult);

  const totalProcessed = results.reduce((acc, r) => acc + r.processedCount, 0);

  return { results, totalProcessed };
}
