import { NextResponse } from "next/server";
import { readDb, writeDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const projectId = params.projectId;

  try {
    const db = readDb() as any;
    let project = (db.manpowerProjects || []).find((p: any) => p.id === projectId);
    
    // Fallback if creating a new project (e.g. projectID is "new" or placeholder)
    let contractId = "";
    if (project) {
      contractId = project.contractId;
    } else {
      const { searchParams } = new URL(request.url);
      contractId = searchParams.get("contractId") || "";
    }

    if (!contractId) {
      return NextResponse.json({ error: "Contract ID is required" }, { status: 400 });
    }

    const contract = (db.manpowerContracts || []).find((c: any) => c.id === contractId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Contract requirements
    const contractRequirements = contract.manpowerRequirements || [];
    const contractRelievers = contract.relieverRequirements || [];

    // Other projects under this contract
    const siblingProjects = (db.manpowerProjects || []).filter((p: any) => p.contractId === contractId && p.id !== projectId && p.isActive !== false);
    const siblingProjectIds = siblingProjects.map((p: any) => p.id);

    // Allocations
    const allAllocations = db.projectManpowerAllocations || [];
    const allRelieverAllocations = db.projectRelieverAllocations || [];

    // Sites for this project (to compute site-level allocation consumption)
    const projectSites = (db.manpowerSites || []).filter((s: any) => s.projectId === projectId);
    const siteIds = projectSites.map((s: any) => s.id);
    const siteAllocations = db.siteManpowerAllocations || [];

    // Map manpower requirements
    const manpowerSummary = contractRequirements.map((req: any) => {
      // Find category label
      const category = (db.manpowerCategories || []).find((c: any) => c.id === req.categoryId);
      const positionName = category ? category.name : req.designation || "Unknown Guard";

      const allocatedToOthers = allAllocations
        .filter((a: any) => siblingProjectIds.includes(a.projectId) && a.contractRequirementId === req.id)
        .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

      const thisAlloc = allAllocations.find((a: any) => a.projectId === projectId && a.contractRequirementId === req.id);
      const allocatedToThis = thisAlloc ? (thisAlloc.quantity || 0) : 0;

      const remainingAvailable = Math.max(0, (req.quantity || 0) - allocatedToOthers);

      // Consumed by sites under this project
      const allocatedToSites = siteAllocations
        .filter((sa: any) => siteIds.includes(sa.siteId) && sa.position === positionName)
        .reduce((sum: number, sa: any) => sum + (sa.quantity || 0), 0);

      return {
        requirementId: req.id,
        position: positionName,
        contractQty: req.quantity || 0,
        allocatedToOthers,
        allocatedToThis,
        remainingAvailable,
        allocatedToSites,
        remainingForSites: Math.max(0, allocatedToThis - allocatedToSites)
      };
    });

    // Map reliever requirements
    const relieverSummary = contractRelievers.map((req: any) => {
      const positionName = req.designation || "Reliever Guard";

      const allocatedToOthers = allRelieverAllocations
        .filter((a: any) => siblingProjectIds.includes(a.projectId) && a.contractRequirementId === req.id)
        .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

      const thisAlloc = allRelieverAllocations.find((a: any) => a.projectId === projectId && a.contractRequirementId === req.id);
      const allocatedToThis = thisAlloc ? (thisAlloc.quantity || 0) : 0;

      const remainingAvailable = Math.max(0, (req.quantity || 0) - allocatedToOthers);

      // Consumed by sites under this project
      const allocatedToSites = siteAllocations
        .filter((sa: any) => siteIds.includes(sa.siteId) && sa.position === positionName && sa.deploymentType === "RELIEVER")
        .reduce((sum: number, sa: any) => sum + (sa.quantity || 0), 0);

      return {
        requirementId: req.id,
        position: positionName,
        contractQty: req.quantity || 0,
        allocatedToOthers,
        allocatedToThis,
        remainingAvailable,
        allocatedToSites,
        remainingForSites: Math.max(0, allocatedToThis - allocatedToSites)
      };
    });

    return NextResponse.json({
      success: true,
      projectId,
      contractId,
      contractTitle: contract.title,
      manpowerSummary,
      relieverSummary
    });

  } catch (error: any) {
    console.error("Failed to load project allocation summary:", error);
    return NextResponse.json({ error: error.message || "Failed to load allocation summary" }, { status: 500 });
  }
}
