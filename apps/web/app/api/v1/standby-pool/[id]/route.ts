import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const rule = await mockDb.updateRelieverStandbyRule(params.id, payload);
    if (!rule) {
      return NextResponse.json({ error: "Standby pool rule not found" }, { status: 404 });
    }
    return NextResponse.json(rule);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update standby pool rule" }, { status: 500 });
  }
}
