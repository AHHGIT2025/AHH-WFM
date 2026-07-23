import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { PrismaClient } from "@ahh-wfm/database";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "SCHEDULER", "PROJECT_COORDINATOR", "PAYROLL"], {
    requiredPermission: "manpower.roster.publication.viewHistory"
  });
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const operationType = url.searchParams.get("operationType");
  const contractId = url.searchParams.get("contractId");
  const siteId = url.searchParams.get("siteId");
  const status = url.searchParams.get("status");
  const seriesKey = url.searchParams.get("seriesKey");
  const includeSlots = url.searchParams.get("includeSlots") === "true";

  if (!operationType || !contractId) {
    return NextResponse.json({ error: "Missing required query params: operationType, contractId" }, { status: 400 });
  }

  try {
    const publications = await prisma.rosterPublication.findMany({
      where: {
        operationType,
        contractId,
        ...(siteId ? { siteId } : {}),
        ...(status ? { status } : {}),
        ...(seriesKey ? { seriesKey } : {})
      },
      include: {
        publishedBy: {
          select: { id: true, name: true }
        },
        cancelledBy: {
          select: { id: true, name: true }
        },
        supersedesPublication: {
          select: { id: true, publicationVersion: true, status: true }
        },
        ...(includeSlots
          ? {
              publicationSlots: {
                orderBy: { businessDate: "asc" }
              }
            }
          : {})
      },
      orderBy: { publicationVersion: "desc" }
    });

    return NextResponse.json({ success: true, publications });
  } catch (err: any) {
    console.error("[GET /publications Error]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
