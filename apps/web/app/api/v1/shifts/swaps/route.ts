import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const swaps = await mockDb.getShiftSwaps();
    return NextResponse.json(swaps);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch shift swaps" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { requestorId, targetEmployeeId, requestorShiftId, targetShiftId, reason } = payload;
    
    if (!requestorId || !targetEmployeeId || !requestorShiftId || !targetShiftId) {
      return NextResponse.json({ error: "Missing required swap fields" }, { status: 400 });
    }

    const swap = await mockDb.createShiftSwapRequest(requestorId, targetEmployeeId, requestorShiftId, targetShiftId, reason);
    return NextResponse.json(swap);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create shift swap request" }, { status: 400 });
  }
}
