import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operationTypeParam = searchParams.get("operationType");

  const auth = await checkApiAuth(undefined, {
    requiredOperation: (operationTypeParam as any) || undefined,
    requiredPermission: "secfac.workers.view"
  });
  if (auth.error) return auth.error;

  try {
    const now = new Date();

    const [
      activeLocks,
      lastNotificationJob,
      lastEvaluationJob,
      pendingCount,
      retryCount,
      deadLetterCount,
      sentCountLast24h,
      failedCountLast24h
    ] = await Promise.all([
      prisma.secFacWorkerLock.findMany(),
      prisma.secFacWorkerJob.findFirst({
        where: { jobType: "NOTIFICATION_OUTBOX_CYCLE" },
        orderBy: { createdAt: "desc" }
      }),
      prisma.secFacWorkerJob.findFirst({
        where: { jobType: "EVALUATION_CYCLE" },
        orderBy: { createdAt: "desc" }
      }),
      prisma.secFacAlertNotification.count({ where: { status: "PENDING" } }),
      prisma.secFacAlertNotification.count({ where: { status: "RETRY_SCHEDULED" } }),
      prisma.secFacAlertNotification.count({ where: { status: "DEAD_LETTER" } }),
      prisma.secFacAlertNotification.count({
        where: {
          status: "SENT",
          sentAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.secFacAlertNotification.count({
        where: {
          status: { in: ["FAILED", "DEAD_LETTER"] },
          failedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    const staleLocks = activeLocks.filter(l => l.expiresAt.getTime() <= now.getTime());
    const isNotificationWorkerHealthy = process.env.SECFAC_NOTIFICATION_WORKER_ENABLED === "true" && lastNotificationJob?.heartbeatAt
      ? (now.getTime() - new Date(lastNotificationJob.heartbeatAt).getTime()) < 120000
      : false;

    const isEvaluationWorkerHealthy = process.env.SECFAC_EVALUATION_WORKER_ENABLED === "true" && lastEvaluationJob?.heartbeatAt
      ? (now.getTime() - new Date(lastEvaluationJob.heartbeatAt).getTime()) < 600000
      : false;

    const total24h = sentCountLast24h + failedCountLast24h;
    const deliverySuccessRate = total24h > 0 ? Math.round((sentCountLast24h / total24h) * 100) : 100;

    return NextResponse.json({
      workers: {
        notificationWorker: {
          enabled: process.env.SECFAC_NOTIFICATION_WORKER_ENABLED === "true",
          healthy: isNotificationWorkerHealthy,
          lastJob: lastNotificationJob
        },
        evaluationWorker: {
          enabled: process.env.SECFAC_EVALUATION_WORKER_ENABLED === "true",
          healthy: isEvaluationWorkerHealthy,
          lastJob: lastEvaluationJob
        }
      },
      queues: {
        pendingCount,
        retryCount,
        deadLetterCount
      },
      locks: {
        totalActive: activeLocks.length,
        staleCount: staleLocks.length,
        activeLocks
      },
      metrics24h: {
        sentCount: sentCountLast24h,
        failedCount: failedCountLast24h,
        deliverySuccessRate
      }
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/workers/health error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
