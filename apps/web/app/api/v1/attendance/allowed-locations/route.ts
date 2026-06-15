import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const locations = await mockDb.getAllowedPunchLocations();
    return NextResponse.json(locations);
  } catch (error: any) {
    console.error("Error fetching allowed punch locations:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}
