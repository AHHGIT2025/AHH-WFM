import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");

  try {
    const isDb = isDbConnected();
    let projects: any[] = [];
    if (isDb) {
      const where: any = { operationType: "SECURITY_GUARDING" };
      if (contractId && contractId !== "all") where.contractId = contractId;
      projects = await prisma.manpowerProject.findMany({
        where,
        orderBy: { name: "asc" }
      });
    } else {
      const db = readDb() as any;
      projects = (db.manpowerProjects || []).filter((p: any) => {
        if (p.operationType !== "SECURITY_GUARDING") return false;
        if (contractId && contractId !== "all" && p.contractId !== contractId) return false;
        return true;
      });
    }
    return NextResponse.json(projects);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
