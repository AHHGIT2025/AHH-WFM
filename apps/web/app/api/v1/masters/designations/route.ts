import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const designations = await mockDb.getDesignations();
    return NextResponse.json(designations);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch designations" }, { status: 500 });
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
    const designation = await mockDb.createDesignation(payload);
    return NextResponse.json(designation);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create designation" }, { status: 500 });
  }
}
