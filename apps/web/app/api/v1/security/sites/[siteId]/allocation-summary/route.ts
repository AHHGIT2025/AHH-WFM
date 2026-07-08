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

  try {
    const db = readDb() as any;
    let site = (db.manpowerSites || []).find((s: any) => s.id === siteId);

    // Fallback if creating a new site
    let projectId = "";
    if (site) {
      projectId = site.projectId;
    } else {
      const { searchParams } = new URL(request.url);
      projectId = searchParams.get("projectId") || "";
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const project = (db.manpowerProjects || []).find((p: any) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Sibling sites
    const siblingSites = (db.manpowerSites || []).filter((s: any) => s.projectId === projectId && s.id !== siteId && s.isActive !== false);
    const siblingSiteIds = siblingSites.map((s: any) => s.id);

    // Project allocations
    const projectAllocations = (db.projectManpowerAllocations || []).filter((a: any) => a.projectId === projectId);
    const projectRelievers = (db.projectRelieverAllocations || []).filter((a: any) => a.projectId === projectId);

    const siteAllocations = db.siteManpowerAllocations || [];

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
