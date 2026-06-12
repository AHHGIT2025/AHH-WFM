import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const rotations = await mockDb.getRotationTemplates();
    return NextResponse.json(rotations);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch rotation templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { name, cycleDays, pattern } = payload;
    if (!name || !cycleDays || !pattern || !Array.isArray(pattern)) {
      return NextResponse.json({ error: "Missing required fields (name, cycleDays, pattern as array)" }, { status: 400 });
    }

    const template = await mockDb.createRotationTemplate(
      name,
      parseInt(cycleDays),
      JSON.stringify(pattern)
    );
    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create rotation template" }, { status: 500 });
  }
}
