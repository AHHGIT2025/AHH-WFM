import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const reason = payload.reason || "No reason provided";
    const user = auth.session?.user?.name || auth.session?.user?.email || "Admin";
    const contract = await mockDb.requestContractTermination(params.id, user, reason);
    return NextResponse.json(contract);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to request contract termination" }, { status: 500 });
  }
}
