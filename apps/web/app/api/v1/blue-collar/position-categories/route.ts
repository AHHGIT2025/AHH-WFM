import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const categories = await mockDb.getBlueCollarPositionCategories();
    return NextResponse.json(categories);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch position categories" }, { status: 500 });
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
    const category = await mockDb.createBlueCollarPositionCategory(payload);
    return NextResponse.json(category);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create position category" }, { status: 500 });
  }
}
