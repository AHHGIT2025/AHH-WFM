import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { runAllPhase6a2WorkerJobs } from "@/lib/secfac-phase6a2-worker-runner";

export async function POST(req: NextRequest) {
  try {
    const workerToken = req.headers.get("x-worker-internal-token") || new URL(req.url).searchParams.get("token");
    const expectedToken = process.env.WORKER_INTERNAL_SECRET || "secfac-worker-secret-local";

    let authorized = false;

    // 1. Internal Token Check
    if (workerToken && workerToken === expectedToken) {
      authorized = true;
    } else {
      // 2. Fallback to authenticated admin session with secfac.worker.monitor permission
      const auth = await checkApiAuth(undefined, {
        requiredPermission: "secfac.worker.monitor"
      });
      if (!auth.error) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Forbidden: Invalid worker internal token or insufficient admin permissions." }, { status: 403 });
    }

    const { results, totalProcessed } = await runAllPhase6a2WorkerJobs();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalProcessed,
      jobs: results
    });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/workers/run-phase6a2 error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
