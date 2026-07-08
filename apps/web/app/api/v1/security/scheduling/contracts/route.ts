import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  try {
    const isDb = isDbConnected();
    let contracts: any[] = [];
    if (isDb) {
      const where: any = { operationType: "SECURITY_GUARDING" };
      if (clientId && clientId !== "all") where.clientId = clientId;
      contracts = await prisma.manpowerContract.findMany({
        where,
        orderBy: { contractNumber: "asc" }
      });
    } else {
      const db = readDb() as any;
      contracts = (db.manpowerContracts || []).filter((c: any) => {
        if (c.operationType !== "SECURITY_GUARDING") return false;
        if (clientId && clientId !== "all" && c.clientId !== clientId) return false;
        return true;
      });
    }
    return NextResponse.json(contracts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
