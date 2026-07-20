import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth(undefined, {
    requiredPermission: "secfac.workers.view"
  });
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const jobType = searchParams.get("jobType");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 100);
    const skip = (Math.max(page, 1) - 1) * pageSize;

    const where: any = {};
    if (jobType) where.jobType = jobType;

    const [total, jobs] = await Promise.all([
      prisma.secFacWorkerJob.count({ where }),
      prisma.secFacWorkerJob.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" }
      })
    ]);

    return NextResponse.json({
      jobs,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1
      }
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/workers/jobs error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
