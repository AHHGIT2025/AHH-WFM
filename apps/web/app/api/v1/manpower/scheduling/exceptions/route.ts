import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;

  // Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.view")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to view roster planning exceptions." }, { status: 403 });
  }

  try {
    const exceptions = await prisma.rosterPlanningException.findMany({
      where: {
        contractId,
        siteId,
        resolved: false
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ success: true, exceptions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch planning exceptions" }, { status: 500 });
  }
}
