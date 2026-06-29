import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const contracts = await mockDb.getManpowerContracts("FACILITY_MANAGEMENT");
    return NextResponse.json(contracts);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch contracts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.clientId || !payload.contractNumber || !payload.title || !payload.startDate || !payload.endDate) {
      return NextResponse.json({ error: "Client, Contract Number, Title, Start Date, and End Date are required" }, { status: 400 });
    }
    const contract = await mockDb.createManpowerContract({
      ...payload,
      operationType: "FACILITY_MANAGEMENT"
    });
    return NextResponse.json(contract);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create contract" }, { status: 500 });
  }
}
