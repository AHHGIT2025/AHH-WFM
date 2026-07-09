import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  try {
    const isDb = isDbConnected();
    let clients: any[] = [];
    if (isDb) {
      clients = await prisma.manpowerClient.findMany({
        where: { operationType: "SECURITY_GUARDING", isActive: true },
        orderBy: { name: "asc" }
      });
    } else {
      const db = readDb() as any;
      clients = (db.manpowerClients || []).filter((c: any) => c.operationType === "SECURITY_GUARDING" && c.isActive !== false);
    }
    return NextResponse.json(clients);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
