import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { isDbConnected, readDb, writeDb, mockDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

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
    let hasHistoricalRecords = false;
    let hasConfiguration = false;

    if (isDb) {
      // 1. Check database site existence
      const site = await prisma.manpowerSite.findUnique({
        where: { id: siteId }
      });
      if (!site) {
        return NextResponse.json({ error: "Site not found" }, { status: 404 });
      }

      // 2. Check shift requirements
      const shifts = await prisma.manpowerShiftRequirement.findMany({
        where: { siteId }
      });
      const shiftIds = shifts.map(s => s.id);

      if (shiftIds.length > 0) {
        hasConfiguration = true;

        // Check deployments
        const depCount = await prisma.manpowerDeployment.count({
          where: { shiftRequirementId: { in: shiftIds } }
        });
        const asgCount = await prisma.manpowerDeploymentAssignment.count({
          where: { deployment: { shiftRequirementId: { in: shiftIds } } }
        });

        if (depCount > 0 || asgCount > 0) {
          hasHistoricalRecords = true;
        }
      }

      // 3. Check attendance records
      const attendanceCount = await prisma.attendanceRecord.count({
        where: { siteId }
      });
      if (attendanceCount > 0) {
        hasHistoricalRecords = true;
      }

      // 4. Check JSON DB configuration files (allocations, site allowances, instructions)
      const db = readDb() as any;
      const siteAllocations = (db.siteManpowerAllocations || []).filter((sa: any) => sa.siteId === siteId);
      const siteAllowances = (db.siteAllowances || []).filter((sa: any) => sa.siteId === siteId);

      if (siteAllocations.length > 0 || siteAllowances.length > 0) {
        hasConfiguration = true;
      }
    } else {
      // Memory DB checks
      const db = readDb() as any;
      const site = (db.manpowerSites || []).find((s: any) => s.id === siteId);
      if (!site) {
        return NextResponse.json({ error: "Site not found" }, { status: 404 });
      }

      // Check shift requirements
      const shifts = (db.shiftRequirements || []).filter((s: any) => s.siteId === siteId);
      const shiftIds = shifts.map((s: any) => s.id);

      if (shiftIds.length > 0) {
        hasConfiguration = true;

        const depCount = (db.manpowerDeployments || []).filter((d: any) => shiftIds.includes(d.shiftRequirementId)).length;
        const asgCount = (db.manpowerDeploymentAssignments || []).filter((a: any) => {
          const dep = (db.manpowerDeployments || []).find((d: any) => d.id === a.deploymentId);
          return dep && shiftIds.includes(dep.shiftRequirementId);
        }).length;

        if (depCount > 0 || asgCount > 0) {
          hasHistoricalRecords = true;
        }
      }

      // Check attendance
      const attendanceCount = (db.attendance || []).filter((a: any) => a.siteId === siteId).length;
      if (attendanceCount > 0) {
        hasHistoricalRecords = true;
      }

      const siteAllocations = (db.siteManpowerAllocations || []).filter((sa: any) => sa.siteId === siteId);
      const siteAllowances = (db.siteAllowances || []).filter((sa: any) => sa.siteId === siteId);

      if (siteAllocations.length > 0 || siteAllowances.length > 0) {
        hasConfiguration = true;
      }
    }

    // 1. If site has historical deployment/attendance: de-activate
    if (hasHistoricalRecords) {
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
        message: "This site is already used in deployment records. It has been deactivated instead of permanently deleted."
      });
    }

    // 2. If site has configuration but no historical deployment: block delete
    if (hasConfiguration) {
      return NextResponse.json({
        error: "This site has active shift configurations, allocations, or allowances. Please remove these configurations first, or deactivate the site instead."
      }, { status: 400 });
    }

    // 3. Otherwise: allow hard delete
    if (isDb) {
      await prisma.manpowerSite.delete({
        where: { id: siteId }
      });
    } else {
      const db = readDb() as any;
      db.manpowerSites = (db.manpowerSites || []).filter((s: any) => s.id !== siteId);
      db.siteManpowerAllocations = (db.siteManpowerAllocations || []).filter((sa: any) => sa.siteId !== siteId);
      db.siteAllowances = (db.siteAllowances || []).filter((sa: any) => sa.siteId !== siteId);
      writeDb(db);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Failed to delete site:", error);
    return NextResponse.json({ error: error.message || "Failed to delete site" }, { status: 500 });
  }
}
