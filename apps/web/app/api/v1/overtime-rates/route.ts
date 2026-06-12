import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const rates = await mockDb.getOvertimeRates();
    return NextResponse.json(rates);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch overtime rates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { name, overtimeType, multiplier, fixedRateAmount, currency, appliesOnWeekend, appliesOnHoliday, appliesAfterMinutes, isActive } = payload;
    
    if (!name || !overtimeType || multiplier === undefined) {
      return NextResponse.json({ error: "Missing required overtime rate parameters (name, overtimeType, multiplier)" }, { status: 400 });
    }

    const rate = await mockDb.createOvertimeRate(
      name,
      overtimeType,
      parseFloat(multiplier),
      fixedRateAmount ? parseFloat(fixedRateAmount) : undefined,
      currency || "QAR",
      !!appliesOnWeekend,
      !!appliesOnHoliday,
      appliesAfterMinutes ? parseInt(appliesAfterMinutes) : 0,
      isActive !== false
    );
    return NextResponse.json(rate);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create overtime rate" }, { status: 500 });
  }
}
