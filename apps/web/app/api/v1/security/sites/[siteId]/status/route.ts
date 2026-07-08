import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { isDbConnected, readDb, writeDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function PATCH(
  request: Request,
  { params }: { params: { siteId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const siteId = params.siteId;

  try {
    const payload = await request.json();
    const { isActive } = payload;

    if (isActive === undefined) {
      return NextResponse.json({ error: "isActive is required" }, { status: 400 });
    }

    const isDb = isDbConnected();

    if (isDb) {
      await prisma.manpowerSite.update({
        where: { id: siteId },
        data: { isActive: !!isActive }
      });
    } else {
      const db = readDb() as any;
      const index = (db.manpowerSites || []).findIndex((s: any) => s.id === siteId);
      if (index !== -1) {
        db.manpowerSites[index].isActive = !!isActive;
        writeDb(db);
      } else {
        return NextResponse.json({ error: "Site not found in memory" }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Failed to update site status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
