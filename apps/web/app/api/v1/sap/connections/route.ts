import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const connections = await mockDb.getSapConnections();
    // Mask sensitive fields in response
    const masked = connections.map(conn => ({
      ...conn,
      clientId: conn.clientId ? `${conn.clientId.substring(0, 4)}***` : "",
      privateKeyVaultId: conn.privateKeyVaultId ? `${conn.privateKeyVaultId.substring(0, 6)}***` : ""
    }));
    return NextResponse.json(masked);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch connections" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.systemName || !body.odataUrl || !body.clientId || !body.companyId || !body.userId || !body.privateKeyVaultId) {
      return NextResponse.json({ error: "Missing required connection configuration parameters" }, { status: 400 });
    }

    const conn = await mockDb.createSapConnection(body);
    return NextResponse.json(conn, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create connection" }, { status: 500 });
  }
}
