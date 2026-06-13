import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const classifications = await mockDb.getTradeClassifications();
    return NextResponse.json(classifications);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch trade classifications" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.code || !payload.name) {
      return NextResponse.json({ error: "Code and Name are required" }, { status: 400 });
    }
    const classification = await mockDb.createTradeClassification(payload);
    return NextResponse.json(classification);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create trade classification" }, { status: 500 });
  }
}
