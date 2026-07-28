import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { validateRelieverEligibility } from "@/lib/reliever-engine";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE", "HR_MANAGER"]);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const slotId = url.searchParams.get("slotId");
  const targetDate = url.searchParams.get("date");

  if (!slotId || !targetDate) {
    return NextResponse.json({ error: "slotId and date are required" }, { status: 400 });
  }

  try {
    const relievers = await validateRelieverEligibility({
      slotId,
      targetDate
    });
    return NextResponse.json({ success: true, data: relievers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch available relievers" }, { status: 500 });
  }
}
