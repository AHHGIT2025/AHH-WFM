import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const swapId = params.id;
    const payload = await request.json();
    const { status, reviewNotes, approvedById } = payload;
    
    if (status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json({ error: "Invalid swap status" }, { status: 400 });
    }

    const swap = await mockDb.actionShiftSwapRequest(swapId, status, reviewNotes, approvedById || (auth.session?.user as any)?.id);
    return NextResponse.json(swap);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to action shift swap request" }, { status: 400 });
  }
}
