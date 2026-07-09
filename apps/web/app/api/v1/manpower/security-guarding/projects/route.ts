import { NextResponse } from "next/server";
import { mockDb, readDb, writeDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

export async function GET() {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const projects = await mockDb.getManpowerProjects("SECURITY_GUARDING");
    return NextResponse.json(projects);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { contractId, name, code, allocations = [], relieverAllocations = [], isActive } = payload;

    if (!contractId || !name || !code) {
      return NextResponse.json({ error: "Contract, Project Name, and Code are required" }, { status: 400 });
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
      return NextResponse.json({ error: "Cannot create project for contract in DRAFT status" }, { status: 400 });
    }

    // 2. Fetch Effective Limits and Validate Quantity Constraints
    const { getEffectiveContractManpower } = require("@/lib/contract-helpers");
    const { effectiveManpower, effectiveReliever } = getEffectiveContractManpower(contract);

    // Load other projects' allocations for validation
    let otherAllocations: any[] = [];
    let otherRelieverPools: any[] = [];

    if (isDb) {
      otherAllocations = await prisma.securityProjectManpowerAllocation.findMany({
        where: { project: { contractId } }
      });
      otherRelieverPools = await prisma.securityProjectRelieverPool.findMany({
        where: { project: { contractId } }
      });
    } else {
      const db = readDb() as any;
      const brotherProjects = (db.manpowerProjects || []).filter((p: any) => p.contractId === contractId);
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

    // 3. Persist and create
    let project: any = null;

    if (isDb) {
      project = await prisma.$transaction(async (tx) => {
        const p = await tx.manpowerProject.create({
          data: {
            contractId,
            name,
            code,
            operationType: "SECURITY_GUARDING",
            isActive: isActive !== false
          }
        });

        // Save normal manpower allocations
        if (allocations.length > 0) {
          await tx.securityProjectManpowerAllocation.createMany({
            data: allocations.map((a: any) => ({
              projectId: p.id,
              contractRequirementId: a.requirementId,
              position: a.position,
              quantity: Number(a.allocatedQty || a.quantity || 0)
            }))
          });
        }

        // Save reliever allocations
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
              projectId: p.id,
              categoryId: cat.id,
              requiredRelieverCount: Number(rel.allocatedQty || rel.quantity || 0),
              isActive: true
            }
          });
        }

        return p;
      });
    } else {
      project = await mockDb.createManpowerProject({
        contractId,
        name,
        code,
        operationType: "SECURITY_GUARDING",
        isActive: isActive !== false
      });

      const db = readDb() as any;
      db.projectManpowerAllocations = db.projectManpowerAllocations || [];
      db.projectRelieverAllocations = db.projectRelieverAllocations || [];

      for (const item of allocations) {
        db.projectManpowerAllocations.push({
          id: `pma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          projectId: project.id,
          contractRequirementId: item.requirementId,
          position: item.position,
          quantity: Number(item.allocatedQty || item.quantity || 0)
        });
      }

      for (const item of relieverAllocations) {
        db.projectRelieverAllocations.push({
          id: `pra-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          projectId: project.id,
          contractRequirementId: item.requirementId,
          position: item.position,
          quantity: Number(item.allocatedQty || item.quantity || 0)
        });
      }

      writeDb(db);
    }

    return NextResponse.json(project);
  } catch (e: any) {
    console.error("Failed to create project:", e);
    return NextResponse.json({ error: e.message || "Failed to create project" }, { status: 500 });
  }
}
