import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const clients = await mockDb.getManpowerClients("SECURITY_GUARDING");
    return NextResponse.json(clients);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.name) {
      return NextResponse.json({ error: "Client Name is required" }, { status: 400 });
    }
    const client = await mockDb.createManpowerClient({
      ...payload,
      operationType: "SECURITY_GUARDING"
    });
    return NextResponse.json(client);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create client" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.id) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
    }
    const client = await mockDb.updateManpowerClient(payload.id, payload);
    return NextResponse.json(client);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update client" }, { status: 500 });
  }
}
