import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { getAuthorizedCompanyIds, isAdminUser } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const locations = await mockDb.getAllowedPunchLocations();
    if (isAdminUser(user)) {
      return NextResponse.json(locations);
    }
    const allowedCompanyIds = getAuthorizedCompanyIds(user);
    const scoped = locations.filter((l: any) => Boolean(l.companyId) && allowedCompanyIds.includes(l.companyId));
    return NextResponse.json(scoped);
  } catch (error: any) {
    console.error("Error fetching allowed punch locations:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}
