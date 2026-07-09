import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  try {
    const isDb = isDbConnected();
    let sites: any[] = [];
    if (isDb) {
      const where: any = { operationType: "SECURITY_GUARDING" };
      if (projectId && projectId !== "all") where.projectId = projectId;
      sites = await prisma.manpowerSite.findMany({
        where,
        orderBy: { name: "asc" }
      });
    } else {
      const db = readDb() as any;
      sites = (db.manpowerSites || []).filter((s: any) => {
        if (s.operationType !== "SECURITY_GUARDING") return false;
        if (projectId && projectId !== "all" && s.projectId !== projectId) return false;
        return true;
      });
    }
    return NextResponse.json(sites);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
