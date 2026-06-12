import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const holidays = await mockDb.getHolidays();
    return NextResponse.json(holidays);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch holidays" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { name, date, scope, isRecurring, siteId } = payload;
    const result = await mockDb.createHoliday(name, date, scope, isRecurring, siteId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 });
  }
}
