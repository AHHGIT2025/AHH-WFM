import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { cleanStaleWorkerLocks } from "@/lib/secfac-worker-lock";

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth(undefined, {
    requiredPermission: "secfac.workers.view"
  });
  if (auth.error) return auth.error;

  try {
    const locks = await prisma.secFacWorkerLock.findMany({
      orderBy: { acquiredAt: "desc" }
    });

    const now = new Date();
    const locksWithStatus = locks.map(l => ({
      ...l,
      isExpired: l.expiresAt.getTime() <= now.getTime()
    }));

    return NextResponse.json({ locks: locksWithStatus });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/workers/locks error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await checkApiAuth(undefined, {
    requiredPermission: "secfac.workers.manage"
  });
  if (auth.error) return auth.error;

  try {
    const cleaned = await cleanStaleWorkerLocks();
    return NextResponse.json({ message: `Cleaned ${cleaned} stale worker lock(s).`, cleaned });
  } catch (e: any) {
    console.error("DELETE /api/v1/secfac/workers/locks error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
