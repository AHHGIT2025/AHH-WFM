import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view") &&
      !hasPermission(auth.session?.user, "security.scheduling.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const shiftRequirementId = searchParams.get("shiftRequirementId");

  try {
    const isDb = isDbConnected();
    let site: any = null;
    let shiftRequirement: any = null;
    let category: any = null;

    if (isDb) {
      if (shiftRequirementId) {
        shiftRequirement = await prisma.manpowerShiftRequirement.findUnique({
          where: { id: shiftRequirementId },
          include: { site: true, category: true }
        });
        if (shiftRequirement) {
          site = shiftRequirement.site;
          category = shiftRequirement.category;
        }
      } else if (siteId) {
        site = await prisma.manpowerSite.findUnique({ where: { id: siteId } });
      }
    } else {
      const db = readDb() as any;
      if (shiftRequirementId) {
        shiftRequirement = (db.shiftRequirements || []).find((r: any) => r.id === shiftRequirementId);
        if (shiftRequirement) {
          site = (db.manpowerSites || []).find((s: any) => s.id === shiftRequirement.siteId);
          category = (db.manpowerCategories || []).find((c: any) => c.id === shiftRequirement.categoryId);
        }
      } else if (siteId) {
        site = (db.manpowerSites || []).find((s: any) => s.id === siteId);
      }
    }

    // Default site requirements mapping
    const requirements = {
      requiresMoiLicense: category?.requiresMoiLicense || false,
      requiresGatePassCheck: category?.requiresGatePassCheck || site?.gatePassRequired || false,
      gatePassRequired: site?.gatePassRequired || false,
      gatePassValidationMode: site?.gatePassValidationMode || "WARNING",
      clientApprovalRequired: site?.clientApprovalRequired || false,
      strictDesignationMatch: false,
      requiredDesignation: category?.name || "Security Guard",
      requiredGrade: "G1",
      siteAllowance: site?.name?.toLowerCase().includes("allowance") ? 300 : 0
    };

    return NextResponse.json(requirements);

  } catch (error: any) {
    console.error("Failed to load site requirements API:", error);
    return NextResponse.json({
      error: error.message || String(error)
    }, { status: 500 });
  }
}
