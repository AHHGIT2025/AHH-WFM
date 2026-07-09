import { NextResponse } from "next/server";
import { mockDb, readDb, writeDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = readDb() as any;
    const project = (db.manpowerProjects || []).find((p: any) => p.id === params.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const contract = (db.manpowerContracts || []).find((c: any) => c.id === project.contractId);
    return NextResponse.json({
      ...project,
      contract: contract ? {
        ...contract,
        client: (db.manpowerClients || []).find((c: any) => c.id === contract.clientId)
      } : undefined
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch project" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = params.id;

  try {
    const payload = await request.json();
    const { contractId, name, isActive, allocations = [], relieverAllocations = [] } = payload;

    if (!contractId || !name) {
      return NextResponse.json({ error: "Contract ID and Name are required" }, { status: 400 });
    }

    const isDb = isDbConnected();

    // 1. Fetch Contract and validate
    let contract: any = null;
    if (isDb) {
      contract = await prisma.manpowerContract.findUnique({
        where: { id: contractId },
        include: {
          manpowerRequirements: true,
          relieverRequirements: true,
          shiftRequirements: true,
          addendums: {
            include: { lineItems: true }
          }
        }
      });
    } else {
      const db = readDb() as any;
      contract = (db.manpowerContracts || []).find((c: any) => c.id === contractId);
      if (contract) {
        contract.manpowerRequirements = contract.manpowerRequirements || (db.contractManpowerRequirements || []).filter((r: any) => r.contractId === contractId);
        contract.relieverRequirements = contract.relieverRequirements || (db.contractRelieverRequirements || []).filter((r: any) => r.contractId === contractId);
        contract.shiftRequirements = contract.shiftRequirements || (db.contractShiftRequirements || []).filter((r: any) => r.contractId === contractId);
        contract.addendums = contract.addendums || (db.manpowerContractAddendums || []).filter((a: any) => a.contractId === contractId).map((a: any) => {
          const lineItems = (db.manpowerContractAddendumLineItems || []).filter((li: any) => li.addendumId === a.id);
          return { ...a, lineItems };
        });
      }
    }

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    if (contract.operationType !== "SECURITY_GUARDING") {
      return NextResponse.json({ error: "Contract does not belong to Security Guarding scope" }, { status: 400 });
    }
    if (contract.status === "DRAFT") {
      return NextResponse.json({ error: "Cannot modify project for contract in DRAFT status" }, { status: 400 });
    }

    // 2. Fetch Effective Limits and Validate Quantity Constraints (Excluding this project's current allocations!)
    const { getEffectiveContractManpower } = require("@/lib/contract-helpers");
    const { effectiveManpower, effectiveReliever } = getEffectiveContractManpower(contract);

    // Load other projects' allocations (NOT including this project!)
    let otherAllocations: any[] = [];
    let otherRelieverPools: any[] = [];

    if (isDb) {
      otherAllocations = await prisma.securityProjectManpowerAllocation.findMany({
        where: {
          project: { contractId },
          NOT: { projectId }
        }
      });
      otherRelieverPools = await prisma.securityProjectRelieverPool.findMany({
        where: {
          project: { contractId },
          NOT: { projectId }
        }
      });
    } else {
      const db = readDb() as any;
      const brotherProjects = (db.manpowerProjects || []).filter((p: any) => p.contractId === contractId && p.id !== projectId);
      const brotherProjectIds = brotherProjects.map((p: any) => p.id);
      otherAllocations = (db.projectManpowerAllocations || []).filter((a: any) => brotherProjectIds.includes(a.projectId));
      otherRelieverPools = (db.projectRelieverAllocations || []).filter((a: any) => brotherProjectIds.includes(a.projectId));
    }

    // A. Validate Normal Allocations
    for (const alloc of allocations) {
      const qty = Number(alloc.allocatedQty || alloc.quantity || 0);
      if (qty <= 0) {
        return NextResponse.json({ error: `Allocation quantity for ${alloc.position} must be positive` }, { status: 400 });
      }

      const req = effectiveManpower.find((r: any) => r.requirementId === alloc.requirementId);
      if (!req) {
        return NextResponse.json({ error: `Invalid requirement ID ${alloc.requirementId} for normal manpower` }, { status: 400 });
      }

      const allocatedToOthers = otherAllocations
        .filter((a: any) => a.contractRequirementId === alloc.requirementId)
        .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
      const remainingAvailable = Math.max(0, (req.quantity || 0) - allocatedToOthers);

      if (qty > remainingAvailable) {
        return NextResponse.json({
          error: `Project allocation exceeds contract limits for ${alloc.position}. Requested: ${qty}, Remaining: ${remainingAvailable} (Total Contract: ${req.quantity})`
        }, { status: 400 });
      }
    }

    // B. Validate Reliever Allocations
    for (const rel of relieverAllocations) {
      const qty = Number(rel.allocatedQty || rel.quantity || 0);
      if (qty <= 0) {
        return NextResponse.json({ error: `Reliever allocation quantity for ${rel.position} must be positive` }, { status: 400 });
      }

      const req = effectiveReliever.find((r: any) => r.requirementId === rel.requirementId);
      if (!req) {
        return NextResponse.json({ error: `Invalid requirement ID ${rel.requirementId} for reliever manpower` }, { status: 400 });
      }

      let allocatedToOthers = 0;
      if (isDb) {
        const cat = await prisma.manpowerCategory.findFirst({ where: { name: rel.position } });
        if (cat) {
          allocatedToOthers = otherRelieverPools
            .filter((p: any) => p.categoryId === cat.id)
            .reduce((sum: number, p: any) => sum + (p.requiredRelieverCount || 0), 0);
        }
      } else {
        allocatedToOthers = otherRelieverPools
          .filter((a: any) => a.contractRequirementId === rel.requirementId)
          .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
      }

      const remainingAvailable = Math.max(0, (req.quantity || 0) - allocatedToOthers);

      if (qty > remainingAvailable) {
        return NextResponse.json({
          error: `Reliever allocation exceeds contract limits for ${rel.position}. Requested: ${qty}, Remaining: ${remainingAvailable} (Total Contract: ${req.quantity})`
        }, { status: 400 });
      }
    }

    // 3. Persist and Update
    let updated: any = null;

    if (isDb) {
      updated = await prisma.$transaction(async (tx) => {
        const p = await tx.manpowerProject.update({
          where: { id: projectId },
          data: {
            name,
            contractId,
            isActive: isActive !== undefined ? isActive : undefined
          }
        });

        // Delete existing allocations
        await tx.securityProjectManpowerAllocation.deleteMany({
          where: { projectId }
        });
        await tx.securityProjectRelieverPool.deleteMany({
          where: { projectId }
        });

        // Save new normal manpower allocations
        if (allocations.length > 0) {
          await tx.securityProjectManpowerAllocation.createMany({
            data: allocations.map((a: any) => ({
              projectId,
              contractRequirementId: a.requirementId,
              position: a.position,
              quantity: Number(a.allocatedQty || a.quantity || 0)
            }))
          });
        }

        // Save new reliever allocations
        for (const rel of relieverAllocations) {
          let cat = await tx.manpowerCategory.findFirst({ where: { name: rel.position } });
          if (!cat) {
            cat = await tx.manpowerCategory.create({
              data: {
                name: rel.position,
                code: `CAT-${rel.position.replace(/\s+/g, "").toUpperCase().substring(0, 10)}`,
                operationType: "SECURITY_GUARDING"
              }
            });
          }

          await tx.securityProjectRelieverPool.create({
            data: {
              projectId,
              categoryId: cat.id,
              requiredRelieverCount: Number(rel.allocatedQty || rel.quantity || 0),
              isActive: true
            }
          });
        }

        return p;
      });
    } else {
      updated = await mockDb.updateManpowerProject(projectId, {
        name,
        contractId,
        isActive
      });

      const db = readDb() as any;
      db.projectManpowerAllocations = db.projectManpowerAllocations || [];
      db.projectRelieverAllocations = db.projectRelieverAllocations || [];

      // Clear existing
      db.projectManpowerAllocations = db.projectManpowerAllocations.filter((a: any) => a.projectId !== projectId);
      db.projectRelieverAllocations = db.projectRelieverAllocations.filter((a: any) => a.projectId !== projectId);

      for (const item of allocations) {
        db.projectManpowerAllocations.push({
          id: `pma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          projectId,
          contractRequirementId: item.requirementId,
          position: item.position,
          quantity: Number(item.allocatedQty || item.quantity || 0)
        });
      }

      for (const item of relieverAllocations) {
        db.projectRelieverAllocations.push({
          id: `pra-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          projectId,
          contractRequirementId: item.requirementId,
          position: item.position,
          quantity: Number(item.allocatedQty || item.quantity || 0)
        });
      }

      writeDb(db);
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error("Failed to update project:", e);
    return NextResponse.json({ error: e.message || "Failed to update project" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  return PUT(request, context);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = params.id;

  try {
    const isDb = isDbConnected();
    let sites: any[] = [];
    let hasHistoricalRecords = false;

    if (isDb) {
      sites = await prisma.manpowerSite.findMany({
        where: { projectId }
      });
      const siteIds = sites.map(s => s.id);

      if (siteIds.length > 0) {
        const shifts = await prisma.manpowerShiftRequirement.findMany({
          where: { siteId: { in: siteIds } }
        });
        const shiftIds = shifts.map(s => s.id);

        if (shiftIds.length > 0) {
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

        const attCount = await prisma.attendanceRecord.count({
          where: { siteId: { in: siteIds } }
        });
        if (attCount > 0) {
          hasHistoricalRecords = true;
        }
      }
    } else {
      const db = readDb() as any;
      sites = (db.manpowerSites || []).filter((s: any) => s.projectId === projectId);
      const siteIds = sites.map(s => s.id);

      if (siteIds.length > 0) {
        const shifts = (db.shiftRequirements || []).filter((s: any) => siteIds.includes(s.siteId));
        const shiftIds = shifts.map((s: any) => s.id);

        if (shiftIds.length > 0) {
          const depCount = (db.manpowerDeployments || []).filter((d: any) => shiftIds.includes(d.shiftRequirementId)).length;
          const asgCount = (db.manpowerDeploymentAssignments || []).filter((a: any) => {
            const dep = (db.manpowerDeployments || []).find((d: any) => d.id === a.deploymentId);
            return dep && shiftIds.includes(dep.shiftRequirementId);
          }).length;
          if (depCount > 0 || asgCount > 0) {
            hasHistoricalRecords = true;
          }
        }

        const attCount = (db.attendance || []).filter((a: any) => siteIds.includes(a.siteId)).length;
        if (attCount > 0) {
          hasHistoricalRecords = true;
        }
      }
    }

    // 1. If project has historical records: de-activate
    if (hasHistoricalRecords) {
      await mockDb.updateManpowerProject(projectId, { isActive: false });
      return NextResponse.json({
        success: true,
        deactivated: true,
        message: "This project is already used in deployment records. It has been deactivated instead of permanently deleted."
      });
    }

    // 2. If project has linked sites but no historical records: block delete
    if (sites.length > 0) {
      return NextResponse.json({
        error: "This project has linked sites. Please delete or disable the sites before deleting the project."
      }, { status: 400 });
    }

    // 3. Otherwise: allow hard delete
    const success = await mockDb.deleteManpowerProject(projectId);
    if (!success) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: error.message || "Failed to delete project" }, { status: 500 });
  }
}
