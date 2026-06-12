import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const rateId = params.id;
    const payload = await request.json();
    
    // Convert numerical inputs
    if (payload.multiplier !== undefined) payload.multiplier = parseFloat(payload.multiplier);
    if (payload.fixedRateAmount !== undefined) payload.fixedRateAmount = payload.fixedRateAmount ? parseFloat(payload.fixedRateAmount) : null;
    if (payload.appliesAfterMinutes !== undefined) payload.appliesAfterMinutes = parseInt(payload.appliesAfterMinutes);

    const rate = await mockDb.updateOvertimeRate(rateId, payload);
    return NextResponse.json(rate);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update overtime rate" }, { status: 400 });
  }
}
