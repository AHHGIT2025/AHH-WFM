import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

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
        where: { id: projectId },
        include: { contract: { include: { client: true } } }
      });
      if (project) {
        contract = project.contract;
        client = contract?.client;

        manpowerRequirements = await prisma.contractManpowerRequirement.findMany({
          where: { contractId: contract.id }
        });
        relieverRequirements = await prisma.contractRelieverRequirement.findMany({
          where: { contractId: contract.id }
        });
        shiftRequirements = await prisma.contractShiftRequirement.findMany({
          where: { contractId: contract.id }
        });

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

          manpowerRequirements = (db.contractManpowerRequirements || []).filter((mr: any) => mr.contractId === contract.id);
          relieverRequirements = (db.contractRelieverRequirements || []).filter((rr: any) => rr.contractId === contract.id);
          shiftRequirements = (db.contractShiftRequirements || []).filter((sr: any) => sr.contractId === contract.id);
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
        allowanceAmount: allowance?.siteAllowanceAmount || 0,
        instructionsCount: instructions.length
      };
    });

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        isActive: project.isActive !== false
      },
      contract: contract ? {
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
        clientName: client?.name || "Unknown Client"
      } : null,
      manpowerRequirements,
      relieverRequirements,
      shiftRequirements,
      sites: mappedSites,
      distribution: {
        totalContractRequired,
        totalSiteDistributed,
        remainingUndistributed,
        totalShifts: siteShifts.length
      }
    });

  } catch (error: any) {
    console.error("Failed to load project summary API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
