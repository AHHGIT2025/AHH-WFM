import { NextResponse } from "next/server";
import { readDb, writeDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { getEffectiveContractManpower } from "@/lib/contract-helpers";

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const projectId = params.projectId;
  const isDb = isDbConnected();

  try {
    let project: any = null;
    let contract: any = null;
    let siblingProjectIds: string[] = [];
    let siteIds: string[] = [];

    if (isDb) {
      // 1. Fetch project if it exists (not "new" placeholder)
      if (projectId && projectId !== "new") {
        project = await prisma.manpowerProject.findUnique({
          where: { id: projectId }
        });
      }

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

      // 2. Fetch contract from Prisma with all requirements and addendums
      contract = await prisma.manpowerContract.findUnique({
        where: { id: contractId },
        include: {
          client: true,
          manpowerRequirements: true,
          relieverRequirements: true,
          shiftRequirements: true,
          addendums: {
            include: { lineItems: true }
          }
        }
      });

      if (!contract) {
        return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      }

      // Sibling projects (excluding current project)
      const siblingProjects = await prisma.manpowerProject.findMany({
        where: { contractId, NOT: { id: projectId }, isActive: true }
      });
      siblingProjectIds = siblingProjects.map(p => p.id);

      // Sites under current project
      if (projectId && projectId !== "new") {
        const projectSites = await prisma.manpowerSite.findMany({
          where: { projectId }
        });
        siteIds = projectSites.map(s => s.id);
      }
    } else {
      // Memory DB fallback
      const db = readDb() as any;
      if (projectId && projectId !== "new") {
        project = (db.manpowerProjects || []).find((p: any) => p.id === projectId);
      }

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

      contract = (db.manpowerContracts || []).find((c: any) => c.id === contractId);
      if (!contract) {
        return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      }

      // Load contract requirements and addendums from memory fallback
      contract.manpowerRequirements = contract.manpowerRequirements || (db.contractManpowerRequirements || []).filter((r: any) => r.contractId === contractId);
      contract.relieverRequirements = contract.relieverRequirements || (db.contractRelieverRequirements || []).filter((r: any) => r.contractId === contractId);
      contract.shiftRequirements = contract.shiftRequirements || (db.contractShiftRequirements || []).filter((r: any) => r.contractId === contractId);
      contract.addendums = contract.addendums || (db.manpowerContractAddendums || []).filter((a: any) => a.contractId === contractId).map((a: any) => {
        const lineItems = (db.manpowerContractAddendumLineItems || []).filter((li: any) => li.addendumId === a.id);
        return { ...a, lineItems };
      });

      const siblingProjects = (db.manpowerProjects || []).filter((p: any) => p.contractId === contractId && p.id !== projectId && p.isActive !== false);
      siblingProjectIds = siblingProjects.map((p: any) => p.id);

      if (projectId && projectId !== "new") {
        const projectSites = (db.manpowerSites || []).filter((s: any) => s.projectId === projectId);
        siteIds = projectSites.map((s: any) => s.id);
      }
    }

    // 3. Compute effective manpower, reliever, and shift requirements
    const { effectiveManpower, effectiveReliever, effectiveShift } = getEffectiveContractManpower(contract);

    // 4. Retrieve allocations (database in SQL mode, db.json in mock mode)
    let allAllocations: any[] = [];
    let allRelieverAllocations: any[] = [];
    const db = readDb() as any;
    const siteAllocations = db.siteManpowerAllocations || [];

    if (isDb) {
      const dbAllocations = await prisma.securityProjectManpowerAllocation.findMany({
        where: { project: { contractId: contract.id } }
      });
      allAllocations = dbAllocations.map(a => ({
        id: a.id,
        projectId: a.projectId,
        contractRequirementId: a.contractRequirementId,
        position: a.position,
        quantity: a.quantity
      }));

      const dbRelieverPools = await prisma.securityProjectRelieverPool.findMany({
        where: { project: { contractId: contract.id } },
        include: { category: true }
      });
      allRelieverAllocations = dbRelieverPools.map(p => ({
        id: p.id,
        projectId: p.projectId,
        contractRequirementId: "",
        position: p.category?.name || "",
        quantity: p.requiredRelieverCount
      }));
    } else {
      allAllocations = db.projectManpowerAllocations || [];
      allRelieverAllocations = db.projectRelieverAllocations || [];
    }

    // Map manpower requirements
    const manpowerSummary = effectiveManpower.map((req: any) => {
      const positionName = req.position;

      // Find category details for position category name matches
      const category = (db.manpowerCategories || []).find((c: any) => c.name === positionName);

      const allocatedToOthers = allAllocations
        .filter((a: any) => siblingProjectIds.includes(a.projectId) && (a.contractRequirementId === req.requirementId || a.position === positionName))
        .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

      const thisAlloc = allAllocations.find((a: any) => a.projectId === projectId && (a.contractRequirementId === req.requirementId || a.position === positionName));
      const allocatedToThis = thisAlloc ? (thisAlloc.quantity || 0) : 0;

      const remainingAvailable = Math.max(0, (req.quantity || 0) - allocatedToOthers);

      // Consumed by sites under this project
      const allocatedToSites = siteAllocations
        .filter((sa: any) => siteIds.includes(sa.siteId) && sa.position === positionName && sa.deploymentType === "PERMANENT")
        .reduce((sum: number, sa: any) => sum + (sa.quantity || 0), 0);

      return {
        requirementId: req.requirementId,
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
    const relieverSummary = effectiveReliever.map((req: any) => {
      const positionName = req.position;

      const allocatedToOthers = allRelieverAllocations
        .filter((a: any) => siblingProjectIds.includes(a.projectId) && (a.contractRequirementId === req.requirementId || a.position === positionName))
        .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

      const thisAlloc = allRelieverAllocations.find((a: any) => a.projectId === projectId && (a.contractRequirementId === req.requirementId || a.position === positionName));
      const allocatedToThis = thisAlloc ? (thisAlloc.quantity || 0) : 0;

      const remainingAvailable = Math.max(0, (req.quantity || 0) - allocatedToOthers);

      // Consumed by sites under this project
      const allocatedToSites = siteAllocations
        .filter((sa: any) => siteIds.includes(sa.siteId) && sa.position === positionName && sa.deploymentType === "RELIEVER")
        .reduce((sum: number, sa: any) => sum + (sa.quantity || 0), 0);

      return {
        requirementId: req.requirementId,
        position: positionName,
        contractQty: req.quantity || 0,
        allocatedToOthers,
        allocatedToThis,
        remainingAvailable,
        allocatedToSites,
        remainingForSites: Math.max(0, allocatedToThis - allocatedToSites)
      };
    });

    // Map shift requirements
    const shiftSummary = effectiveShift.map((req: any) => {
      return {
        requirementId: req.requirementId,
        shiftName: req.shiftName,
        startTime: req.startTime,
        endTime: req.endTime,
        postsCovered: req.postsCovered,
        daysPattern: req.daysPattern
      };
    });

    return NextResponse.json({
      success: true,
      projectId,
      contractId: contract.id,
      contractTitle: contract.title,
      manpowerSummary,
      relieverSummary,
      shiftSummary
    });

  } catch (error: any) {
    console.error("Failed to load project allocation summary:", error);
    return NextResponse.json({ error: error.message || "Failed to load allocation summary" }, { status: 500 });
  }
}
