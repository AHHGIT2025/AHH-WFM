import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const templates = await mockDb.getShiftTemplates();
    return NextResponse.json(templates);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch shift templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { name, startTime, endTime, isSplit, splitStart, splitEnd, isFlexible, coreHours } = payload;
    if (!name || !startTime || !endTime) {
      return NextResponse.json({ error: "Missing required fields (name, startTime, endTime)" }, { status: 400 });
    }

    const template = await mockDb.createShiftTemplate(
      name,
      startTime,
      endTime,
      !!isSplit,
      splitStart,
      splitEnd,
      !!isFlexible,
      coreHours ? parseFloat(coreHours) : undefined
    );
    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create shift template" }, { status: 500 });
  }
}
