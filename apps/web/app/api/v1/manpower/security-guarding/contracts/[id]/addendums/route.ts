import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const addendums = await mockDb.getManpowerContractAddendums(params.id);
    return NextResponse.json(addendums);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch contract addendums" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.title || !payload.addendumType) {
      return NextResponse.json({ error: "Addendum Title and Type are required" }, { status: 400 });
    }
    const addendum = await mockDb.createManpowerContractAddendum({
      ...payload,
      contractId: params.id
    });
    return NextResponse.json(addendum);
  } catch (e: any) {
    console.error("ADDENDUM POST ERROR:", e);
    return NextResponse.json({ error: e.message || "Failed to create contract addendum" }, { status: 500 });
  }
}
