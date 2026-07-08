import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";
import { getEffectiveContractManpower } from "@/lib/contract-helpers";

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const projectId = params.projectId;

  try {
    const isDb = isDbConnected();
    let project: any = null;
    let contract: any = null;
    let client: any = null;
    let manpowerRequirements: any[] = [];
    let relieverRequirements: any[] = [];
    let shiftRequirements: any[] = [];
    let projectSites: any[] = [];
    let siteAllowances: any[] = [];
    let projectInstructions: any[] = [];
    let siteShifts: any[] = [];

    if (isDb) {
      project = await prisma.manpowerProject.findUnique({
        where: { id: projectId }
      });

      if (project) {
        // Fetch contract from Prisma with all requirements and addendums
        contract = await prisma.manpowerContract.findUnique({
          where: { id: project.contractId },
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

        if (contract) {
          client = contract.client;

          // Compute effective manpower, reliever, and shift requirements
          const { effectiveManpower, effectiveReliever, effectiveShift } = getEffectiveContractManpower(contract);
          manpowerRequirements = effectiveManpower;
          relieverRequirements = effectiveReliever;
          shiftRequirements = effectiveShift;
        }

        projectSites = await prisma.manpowerSite.findMany({
          where: { projectId: project.id }
        });

        // Load site shift requirements to calculate site distribution
        siteShifts = await prisma.manpowerShiftRequirement.findMany({
          where: { siteId: { in: projectSites.map(s => s.id) } }
        });
      }
    } else {
      const db = readDb() as any;
      project = (db.manpowerProjects || []).find((p: any) => p.id === projectId);
      if (project) {
        contract = (db.manpowerContracts || []).find((c: any) => c.id === project.contractId);
        if (contract) {
          client = (db.manpowerClients || []).find((c: any) => c.id === contract.clientId);

          // Load contract requirements and addendums from memory fallback
          contract.manpowerRequirements = contract.manpowerRequirements || (db.contractManpowerRequirements || []).filter((r: any) => r.contractId === contract.id);
          contract.relieverRequirements = contract.relieverRequirements || (db.contractRelieverRequirements || []).filter((r: any) => r.contractId === contract.id);
          contract.shiftRequirements = contract.shiftRequirements || (db.contractShiftRequirements || []).filter((r: any) => r.contractId === contract.id);
          contract.addendums = contract.addendums || (db.manpowerContractAddendums || []).filter((a: any) => a.contractId === contract.id).map((a: any) => {
            const lineItems = (db.manpowerContractAddendumLineItems || []).filter((li: any) => li.addendumId === a.id);
            return { ...a, lineItems };
          });

          // Compute effective manpower, reliever, and shift requirements
          const { effectiveManpower, effectiveReliever, effectiveShift } = getEffectiveContractManpower(contract);
          manpowerRequirements = effectiveManpower;
          relieverRequirements = effectiveReliever;
          shiftRequirements = effectiveShift;
        }

        projectSites = (db.manpowerSites || []).filter((s: any) => s.projectId === projectId);
        siteShifts = (db.shiftRequirements || []).filter((r: any) => projectSites.map(s => s.id).includes(r.siteId));
        siteAllowances = db.siteAllowances || [];
        projectInstructions = db.projectInstructions || [];
      }
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Compute Site distribution metrics
    const totalContractRequired = manpowerRequirements.reduce((sum, mr) => sum + (mr.quantity || 0), 0);
    const totalSiteDistributed = siteShifts.reduce((sum, ss) => sum + (ss.requiredCount || 0), 0);
    const remainingUndistributed = Math.max(0, totalContractRequired - totalSiteDistributed);

    // Map sites details with active shift counts
    const mappedSites = projectSites.map(s => {
      const activeShifts = siteShifts.filter(ss => ss.siteId === s.id && ss.isActive !== false);
      const reqGuards = activeShifts.reduce((sum, ss) => sum + (ss.requiredCount || 0), 0);
      
      const db = readDb() as any;
      const allowance = (db.siteAllowances || []).find((sa: any) => sa.siteId === s.id && sa.isActive !== false && sa.siteAllowanceEnabled === true);
      const instructions = (db.projectInstructions || []).filter((pi: any) => pi.projectId === projectId && pi.isActive !== false);

      return {
        id: s.id,
        name: s.name,
        code: s.code || s.id.substring(0, 8).toUpperCase(),
        isActive: s.isActive !== false,
        activeShiftsCount: activeShifts.length,
        requiredGuards: reqGuards,
        allowanceEnabled: !!allowance,
        allowanceAmount: allowance ? allowance.siteAllowanceAmount : 0,
        instructionsCount: instructions.length
      };
    });

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        contractId: project.contractId
      },
      contract: contract ? {
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        status: contract.status,
        startDate: contract.startDate,
        endDate: contract.endDate,
        clientName: client?.name || contract.clientId
      } : null,
      manpowerRequirements,
      relieverRequirements,
      shiftRequirements,
      sites: mappedSites,
      distribution: {
        totalContractRequired,
        totalSiteDistributed,
        remainingUndistributed
      }
    });

  } catch (error: any) {
    console.error("Failed to load project deployment summary:", error);
    return NextResponse.json({ error: error.message || "Failed to load project deployment summary" }, { status: 500 });
  }
}
