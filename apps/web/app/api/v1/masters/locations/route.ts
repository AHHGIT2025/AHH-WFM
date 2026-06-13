import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const locations = await mockDb.getLocations();
    return NextResponse.json(locations);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch locations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    if (!payload.locationCode || !payload.locationName) {
      return NextResponse.json({ error: "Location Code and Location Name are required" }, { status: 400 });
    }
    const location = await mockDb.createLocation(payload);
    return NextResponse.json(location);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create location" }, { status: 500 });
  }
}
