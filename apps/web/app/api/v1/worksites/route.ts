import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const worksites = await mockDb.getWorksites();
    return NextResponse.json(worksites);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch worksites" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.name || payload.lat === undefined || payload.lng === undefined || !payload.radiusMeters) {
      return NextResponse.json({ error: "Name, Latitude, Longitude, and Radius are required" }, { status: 400 });
    }
    const worksite = await mockDb.createWorksite(
      payload.name,
      parseFloat(payload.lat),
      parseFloat(payload.lng),
      parseFloat(payload.radiusMeters)
    );
    return NextResponse.json(worksite);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create worksite" }, { status: 500 });
  }
}
