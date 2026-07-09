import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { getSiteDependencies } from "@/lib/site-helpers";

export async function GET(
  request: Request,
  { params }: { params: { siteId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view") &&
      !hasPermission(auth.session?.user, "security.scheduling.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const siteId = params.siteId;

  try {
    const report = await getSiteDependencies(siteId);
    if (!report) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error: any) {
    console.error("Failed to load site dependencies:", error);
    return NextResponse.json({ error: error.message || "Failed to load site dependencies" }, { status: 500 });
  }
}
