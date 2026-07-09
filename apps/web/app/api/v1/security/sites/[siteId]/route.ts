import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { isDbConnected, readDb, writeDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";
import { getSiteDependencies } from "@/lib/site-helpers";

export async function DELETE(
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
  const isDb = isDbConnected();

  try {
    const report = await getSiteDependencies(siteId);
    if (!report) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // 1. Historical deployment/attendance/roster exists: de-activate
    if (report.suggestedAction === "DEACTIVATE") {
      if (isDb) {
        await prisma.manpowerSite.update({
          where: { id: siteId },
          data: { isActive: false }
        });
      } else {
        const db = readDb() as any;
        const index = (db.manpowerSites || []).findIndex((s: any) => s.id === siteId);
        if (index !== -1) {
          db.manpowerSites[index].isActive = false;
          writeDb(db);
        }
      }

      return NextResponse.json({
        success: true,
        deactivated: true,
        canDelete: false,
        suggestedAction: "DEACTIVATE",
        dependencies: report.dependencyCounts,
        message: report.message
      });
    }

    // 2. Active config exists but no history: block delete
    if (report.suggestedAction === "REMOVE_CONFIG") {
      return NextResponse.json({
        success: false,
        canDelete: false,
        suggestedAction: "REMOVE_CONFIG",
        dependencies: report.dependencyCounts,
        error: report.message,
        message: report.message
      }, { status: 400 });
    }

    // 3. Otherwise: allow hard delete with cleanup of stale/inactive config
    const db = readDb() as any;
    
    // Cleanup shift configurations from memory DB if in memory mode
    if (!isDb) {
      db.shiftRequirements = (db.shiftRequirements || []).filter((s: any) => s.siteId !== siteId);
    }
    
    // Cleanup site allocations and site allowances (stored in db.json for both modes)
    db.siteManpowerAllocations = (db.siteManpowerAllocations || []).filter((sa: any) => sa.siteId !== siteId);
    db.siteAllowances = (db.siteAllowances || []).filter((sa: any) => sa.siteId !== siteId);
    
    if (isDb) {
      // Prisma has cascade delete for ManpowerShiftRequirement, so it deletes shifts automatically
      await prisma.manpowerSite.delete({
        where: { id: siteId }
      });
      writeDb(db); // Save the cleaned up allocations/allowances
    } else {
      db.manpowerSites = (db.manpowerSites || []).filter((s: any) => s.id !== siteId);
      writeDb(db);
    }

    return NextResponse.json({
      success: true,
      canDelete: true,
      suggestedAction: "HARD_DELETE_ALLOWED",
      dependencies: report.dependencyCounts
    });

  } catch (error: any) {
    console.error("Failed to delete site:", error);
    return NextResponse.json({ error: error.message || "Failed to delete site" }, { status: 500 });
  }
}
