import { NextResponse } from "next/server";
import { mockDb, readDb, writeDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
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
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const updated = await mockDb.updateManpowerProject(params.id, {
      name: payload.name,
      contractId: payload.contractId,
      isActive: payload.isActive
    });

    // Update allocations in db.json
    const db = readDb() as any;
    db.projectManpowerAllocations = db.projectManpowerAllocations || [];
    db.projectRelieverAllocations = db.projectRelieverAllocations || [];

    if (payload.allocations && Array.isArray(payload.allocations)) {
      db.projectManpowerAllocations = db.projectManpowerAllocations.filter((a: any) => a.projectId !== params.id);
      for (const item of payload.allocations) {
        db.projectManpowerAllocations.push({
          id: `pma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          projectId: params.id,
          contractRequirementId: item.requirementId,
          position: item.position,
          quantity: item.allocatedQty || 0
        });
      }
    }

    if (payload.relieverAllocations && Array.isArray(payload.relieverAllocations)) {
      db.projectRelieverAllocations = db.projectRelieverAllocations.filter((a: any) => a.projectId !== params.id);
      for (const item of payload.relieverAllocations) {
        db.projectRelieverAllocations.push({
          id: `pra-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          projectId: params.id,
          contractRequirementId: item.requirementId,
          position: item.position,
          quantity: item.allocatedQty || 0
        });
      }
    }

    writeDb(db);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update project" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  return PUT(request, context);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
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
