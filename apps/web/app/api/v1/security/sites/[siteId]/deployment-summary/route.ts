import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";
import { getActiveSiteShiftConfigs } from "@/lib/server-helpers";

export async function GET(
  request: Request,
  { params }: { params: { siteId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const siteId = params.siteId;

  try {
    const isDb = isDbConnected();
    let site: any = null;
    let project: any = null;
    let contract: any = null;
    let client: any = null;
    let siteShifts: any[] = [];
    let siteAllowance: any = null;
    let projectInstructions: any[] = [];
    let assignmentsCount = 0;

    if (isDb) {
      site = await prisma.manpowerSite.findUnique({
        where: { id: siteId },
        include: { project: { include: { contract: { include: { client: true } } } } }
      });
      if (site) {
        project = site.project;
        contract = project?.contract;
        client = contract?.client;

        const activeShifts = await getActiveSiteShiftConfigs(siteId);
        const shiftsWithCategory = [];
        for (const s of activeShifts) {
          const loaded = await prisma.manpowerShiftRequirement.findUnique({
            where: { id: s.id },
            include: { category: true }
          });
          if (loaded) shiftsWithCategory.push(loaded);
        }
        siteShifts = shiftsWithCategory;
      }
    } else {
      const db = readDb() as any;
      site = (db.manpowerSites || []).find((s: any) => s.id === siteId);
      if (site) {
        project = (db.manpowerProjects || []).find((p: any) => p.id === site.projectId);
        if (project) {
          contract = (db.manpowerContracts || []).find((c: any) => c.id === project.contractId);
          if (contract) {
            client = (db.manpowerClients || []).find((c: any) => c.id === contract.clientId);
          }
        }

        const cats = db.manpowerCategories || [];
        const activeShifts = await getActiveSiteShiftConfigs(siteId, db);
        siteShifts = activeShifts
          .filter((r: any) => r.operationType === "SECURITY_GUARDING")
          .map((r: any) => ({
            ...r,
            category: cats.find((c: any) => c.id === r.categoryId) || null
          }));
      }
    }

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const db = readDb() as any;
    siteAllowance = (db.siteAllowances || []).find((sa: any) => sa.siteId === siteId && sa.isActive !== false);
    projectInstructions = (db.projectInstructions || []).filter((pi: any) => pi.projectId === site.projectId && pi.isActive !== false);

    // Compute required manpower
    const requiredManpower = siteShifts.reduce((sum, ss) => sum + (ss.requiredCount || 0), 0);

    // Fetch live assignments for today
    const todayStr = new Date().toISOString().split("T")[0];
    let deployments: any[] = [];
    if (isDb) {
      const start = new Date(todayStr);
      start.setHours(0,0,0,0);
      const end = new Date(todayStr);
      end.setHours(23,59,59,999);

      deployments = await prisma.manpowerDeployment.findMany({
        where: {
          shiftRequirementId: { in: siteShifts.map(s => s.id) },
          date: { gte: start, lte: end }
        },
        include: { assignments: true }
      });
      deployments.forEach(d => {
        assignmentsCount += (d.assignments || []).length;
      });
    } else {
      const rawDeps = (db.manpowerDeployments || []).filter((d: any) => {
        const dStr = String(d.date).split("T")[0];
        return dStr === todayStr && siteShifts.map(s => s.id).includes(d.shiftRequirementId);
      });
      const depIds = rawDeps.map((d: any) => d.id);
      const rawAsgs = (db.manpowerDeploymentAssignments || []).filter((a: any) => depIds.includes(a.deploymentId) && a.status !== "CANCELLED");
      assignmentsCount = rawAsgs.length;
    }

    return NextResponse.json({
      success: true,
      site: {
        id: site.id,
        name: site.name,
        code: site.code || site.id.substring(0, 8).toUpperCase(),
        projectId: site.projectId,
        isActive: site.isActive !== false,
        radiusMeters: site.radiusMeters || 100,
        gatePassRequired: !!site.gatePassRequired
      },
      project: project ? {
        id: project.id,
        name: project.name,
        code: project.code
      } : null,
      contract: contract ? {
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title
      } : null,
      client: client ? {
        id: client.id,
        name: client.name
      } : null,
      siteShifts,
      siteAllowance: siteAllowance ? {
        id: siteAllowance.id,
        siteAllowanceEnabled: !!siteAllowance.siteAllowanceEnabled,
        siteAllowanceAmount: siteAllowance.siteAllowanceAmount || 0,
        siteAllowanceFrequency: siteAllowance.siteAllowanceFrequency || "MONTHLY",
        allowanceDescription: siteAllowance.allowanceDescription || ""
      } : null,
      projectInstructions,
      todaySummary: {
        requiredManpower,
        assignedManpower: assignmentsCount,
        vacantPosts: Math.max(0, requiredManpower - assignmentsCount)
      }
    });

  } catch (error: any) {
    console.error("Failed to load site deployment summary:", error);
    return NextResponse.json({ error: error.message || "Failed to load site deployment summary" }, { status: 500 });
  }
}
