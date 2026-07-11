import { NextResponse } from "next/server";
import { readDb, writeDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(
  request: Request,
  { params }: { params: { siteId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const siteId = params.siteId;
  const isDb = isDbConnected();

  try {
    let site: any = null;
    let project: any = null;
    let projectId = "";
    let siblingSiteIds: string[] = [];

    if (isDb) {
      if (siteId && siteId !== "new") {
        site = await prisma.manpowerSite.findUnique({
          where: { id: siteId }
        });
      }

      if (site) {
        projectId = site.projectId;
      } else {
        const { searchParams } = new URL(request.url);
        projectId = searchParams.get("projectId") || "";
      }

      if (!projectId) {
        return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
      }

      project = await prisma.manpowerProject.findUnique({
        where: { id: projectId }
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      // Sibling sites
      const siblingSites = await prisma.manpowerSite.findMany({
        where: { projectId, NOT: { id: siteId }, isActive: true }
      });
      siblingSiteIds = siblingSites.map(s => s.id);
    } else {
      const db = readDb() as any;
      if (siteId && siteId !== "new") {
        site = (db.manpowerSites || []).find((s: any) => s.id === siteId);
      }

      if (site) {
        projectId = site.projectId;
      } else {
        const { searchParams } = new URL(request.url);
        projectId = searchParams.get("projectId") || "";
      }

      if (!projectId) {
        return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
      }

      project = (db.manpowerProjects || []).find((p: any) => p.id === projectId);
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const siblingSites = (db.manpowerSites || []).filter((s: any) => s.projectId === projectId && s.id !== siteId && s.isActive !== false);
      siblingSiteIds = siblingSites.map((s: any) => s.id);
    }

    // Load allocations (database in SQL mode, db.json in mock mode)
    let projectAllocations: any[] = [];
    let projectRelievers: any[] = [];
    let siteAllocations: any[] = [];

    if (isDb) {
      const dbSiteAllocations = await prisma.securitySiteManpowerAllocation.findMany({
        where: { siteId }
      });
      siteAllocations = dbSiteAllocations.map(sa => ({
        id: sa.id,
        siteId: sa.siteId,
        position: sa.position,
        quantity: sa.quantity,
        deploymentType: sa.deploymentType,
        relieverPoolType: sa.relieverPoolType
      }));
      const dbAllocations = await prisma.securityProjectManpowerAllocation.findMany({
        where: { projectId }
      });
      projectAllocations = dbAllocations.map(a => ({
        id: a.id,
        projectId: a.projectId,
        contractRequirementId: a.contractRequirementId,
        position: a.position,
        quantity: a.quantity
      }));

      const dbRelieverPools = await prisma.securityProjectRelieverPool.findMany({
        where: { projectId },
        include: { category: true }
      });
      projectRelievers = dbRelieverPools.map(p => ({
        id: p.id,
        projectId: p.projectId,
        contractRequirementId: "",
        position: p.category?.name || "",
        quantity: p.requiredRelieverCount
      }));
    } else {
      const db = readDb() as any;
      projectAllocations = (db.projectManpowerAllocations || []).filter((a: any) => a.projectId === projectId);
      projectRelievers = (db.projectRelieverAllocations || []).filter((a: any) => a.projectId === projectId);
      siteAllocations = db.siteManpowerAllocations || [];
    }

    // Map manpower requirements
    const manpowerSummary = projectAllocations.map((pAlloc: any) => {
      const positionName = pAlloc.position;

      const allocatedToOthers = siteAllocations
        .filter((sa: any) => siblingSiteIds.includes(sa.siteId) && sa.position === positionName && sa.deploymentType === "PERMANENT")
        .reduce((sum: number, sa: any) => sum + (sa.quantity || 0), 0);

      const thisAlloc = siteAllocations.find((sa: any) => sa.siteId === siteId && sa.position === positionName && sa.deploymentType === "PERMANENT");
      const allocatedToThis = thisAlloc ? (thisAlloc.quantity || 0) : 0;

      const remainingAvailable = Math.max(0, (pAlloc.quantity || 0) - allocatedToOthers);

      return {
        position: positionName,
        projectQty: pAlloc.quantity || 0,
        allocatedToOthers,
        allocatedToThis,
        remainingAvailable
      };
    });

    // Map reliever requirements
    const relieverSummary = projectRelievers.map((pAlloc: any) => {
      const positionName = pAlloc.position;

      const allocatedToOthers = siteAllocations
        .filter((sa: any) => siblingSiteIds.includes(sa.siteId) && sa.position === positionName && sa.deploymentType === "RELIEVER")
        .reduce((sum: number, sa: any) => sum + (sa.quantity || 0), 0);

      const thisAlloc = siteAllocations.find((sa: any) => sa.siteId === siteId && sa.position === positionName && sa.deploymentType === "RELIEVER");
      const allocatedToThis = thisAlloc ? (thisAlloc.quantity || 0) : 0;

      const remainingAvailable = Math.max(0, (pAlloc.quantity || 0) - allocatedToOthers);

      return {
        position: positionName,
        projectQty: pAlloc.quantity || 0,
        allocatedToOthers,
        allocatedToThis,
        remainingAvailable,
        relieverPoolType: thisAlloc ? (thisAlloc.relieverPoolType || "DEDICATED") : "DEDICATED"
      };
    });

    return NextResponse.json({
      success: true,
      siteId,
      projectId,
      projectTitle: project.name,
      manpowerSummary,
      relieverSummary
    });

  } catch (error: any) {
    console.error("Failed to load site allocation summary:", error);
    return NextResponse.json({ error: error.message || "Failed to load site allocation summary" }, { status: 500 });
  }
}
