import { NextResponse } from "next/server";
import { mockDb, readDb, writeDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

function toNullableFloat(value: unknown): number | null {
  if (value === "" || value === undefined || value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid number");
  return parsed;
}

function toRadiusFloat(value: unknown): number {
  if (value === "" || value === undefined || value === null) return 100;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid number");
  return parsed;
}

export async function GET() {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const sites = await mockDb.getManpowerSites("SECURITY_GUARDING");
    return NextResponse.json(sites);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
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
    const body = await request.json();
    const {
      projectId,
      code,
      name,
      lat,
      lng,
      radiusMeters,
      gatePassRequired,
      gatePassValidationMode,
      remarks,
      allocations = [],
      siteAllowanceApplicable,
      siteAllowance,
      siteShiftRequirements = []
    } = body;

    if (!projectId || !name) {
      return NextResponse.json({ error: "Project and Site Name are required" }, { status: 400 });
    }

    let normalizedLat: number | null = null;
    let normalizedLng: number | null = null;
    let normalizedRadius = 100;
    try {
      normalizedLat = toNullableFloat(lat);
      normalizedLng = toNullableFloat(lng);
      normalizedRadius = toRadiusFloat(radiusMeters);
    } catch (err) {
      return NextResponse.json({ error: "Latitude, Longitude and Radius must be valid numbers." }, { status: 400 });
    }

    const isDb = isDbConnected();
    if (isDb) {
      // 1. Validate project exists and belongs to SECURITY_GUARDING
      const project = await prisma.manpowerProject.findUnique({
        where: { id: projectId }
      });
      if (!project || project.operationType !== "SECURITY_GUARDING") {
        return NextResponse.json({ error: "Invalid project selected." }, { status: 400 });
      }

      // 2. Validate allocations do not exceed remaining project allocations
      const projectAllocations = await prisma.securityProjectManpowerAllocation.findMany({
        where: { projectId }
      });
      const siblingSites = await prisma.manpowerSite.findMany({
        where: { projectId, isActive: true }
      });
      const siblingSiteIds = siblingSites.map(s => s.id);
      const otherAllocations = await prisma.securitySiteManpowerAllocation.findMany({
        where: { siteId: { in: siblingSiteIds } }
      });

      // Aggregate incoming allocations by position + deploymentType
      const aggAllocations: Record<string, { position: string; quantity: number; deploymentType: string; relieverPoolType: string }> = {};
      for (const a of allocations) {
        if (!a.position) {
          return NextResponse.json({ error: "Position is required for all allocations." }, { status: 400 });
        }
        const qty = Number(a.allocatedQty || 0);
        if (qty < 0) {
          return NextResponse.json({ error: "Allocation quantity cannot be negative." }, { status: 400 });
        }
        const key = `${a.position}-${a.deploymentType || "PERMANENT"}`;
        if (aggAllocations[key]) {
          aggAllocations[key].quantity += qty;
        } else {
          aggAllocations[key] = {
            position: a.position,
            quantity: qty,
            deploymentType: a.deploymentType || "PERMANENT",
            relieverPoolType: a.relieverPoolType || "DEDICATED"
          };
        }
      }

      // Validate capacity
      for (const key in aggAllocations) {
        const item = aggAllocations[key];
        if (item.deploymentType === "PERMANENT") {
          const projAlloc = projectAllocations.find(pa => pa.position === item.position);
          const projQty = projAlloc ? projAlloc.quantity : 0;
          const otherQty = otherAllocations
            .filter(oa => oa.position === item.position && oa.deploymentType === "PERMANENT")
            .reduce((sum, oa) => sum + oa.quantity, 0);
          if (otherQty + item.quantity > projQty) {
            return NextResponse.json({
              error: `Site allocation of ${item.quantity} for position "${item.position}" exceeds the available project allocation (${projQty - otherQty} remaining).`
            }, { status: 400 });
          }
        }
      }

      // Validate site allowance fields
      if (siteAllowanceApplicable && siteAllowance) {
        if (!siteAllowance.effectiveFrom) {
          return NextResponse.json({ error: "Effective From date is required for site allowance." }, { status: 400 });
        }
        if (siteAllowance.effectiveTo && new Date(siteAllowance.effectiveTo) < new Date(siteAllowance.effectiveFrom)) {
          return NextResponse.json({ error: "Effective To date cannot be before Effective From date." }, { status: 400 });
        }
        if (isNaN(Number(siteAllowance.siteAllowanceAmount || 0)) || Number(siteAllowance.siteAllowanceAmount || 0) < 0) {
          return NextResponse.json({ error: "Site allowance amount must be a non-negative number." }, { status: 400 });
        }
      }

      // Validate site shifts
      if (siteShiftRequirements && Array.isArray(siteShiftRequirements)) {
        for (const shift of siteShiftRequirements) {
          if (!shift.shiftCode || !shift.categoryId) {
            return NextResponse.json({ error: "Shift name and position are required." }, { status: 400 });
          }
          if (!shift.shiftStartTime || !shift.shiftEndTime) {
            return NextResponse.json({ error: `Start time and End time are required for shift ${shift.shiftCode}.` }, { status: 400 });
          }
          if (Number(shift.requiredCount) <= 0) {
            return NextResponse.json({ error: `Required count for shift ${shift.shiftCode} must be greater than 0.` }, { status: 400 });
          }
        }
      }

      // 3. Save inside Transaction
      const result = await prisma.$transaction(async (tx) => {
        const site = await tx.manpowerSite.create({
          data: {
            projectId,
            code: code || `SSITE-${Math.floor(1000 + Math.random() * 9000)}`,
            name,
            lat: normalizedLat,
            lng: normalizedLng,
            radiusMeters: normalizedRadius,
            gatePassRequired: !!gatePassRequired,
            gatePassValidationMode: gatePassValidationMode || "WARNING",
            remarks: remarks || "",
            operationType: "SECURITY_GUARDING"
          }
        });

        // Save allocations
        for (const key in aggAllocations) {
          const item = aggAllocations[key];
          if (item.quantity > 0) {
            await tx.securitySiteManpowerAllocation.create({
              data: {
                siteId: site.id,
                position: item.position,
                quantity: item.quantity,
                deploymentType: item.deploymentType,
                relieverPoolType: item.relieverPoolType
              }
            });
          }
        }

        // Save allowance
        if (siteAllowanceApplicable && siteAllowance) {
          await tx.securitySiteAllowance.create({
            data: {
              siteId: site.id,
              siteAllowanceEnabled: true,
              siteAllowanceAmount: Number(siteAllowance.siteAllowanceAmount || 0),
              siteAllowanceFrequency: siteAllowance.siteAllowanceFrequency || "MONTHLY",
              allowanceDescription: siteAllowance.allowanceDescription || "",
              appliesToAllPositions: siteAllowance.appliesToAllPositions !== false,
              position: siteAllowance.appliesToAllPositions !== false ? null : siteAllowance.position || null,
              effectiveFrom: siteAllowance.effectiveFrom ? new Date(siteAllowance.effectiveFrom) : null,
              effectiveTo: siteAllowance.effectiveTo ? new Date(siteAllowance.effectiveTo) : null,
              isActive: true
            }
          });
        }

        // Save shifts
        for (const shift of siteShiftRequirements) {
          if (Number(shift.requiredCount) > 0) {
            await tx.manpowerShiftRequirement.create({
              data: {
                siteId: site.id,
                categoryId: shift.categoryId,
                shiftCode: shift.shiftCode,
                requiredCount: Number(shift.requiredCount),
                requiredRelieverCount: Number(shift.requiredRelieverCount || 0),
                shiftStartTime: shift.shiftStartTime || null,
                shiftEndTime: shift.shiftEndTime || null,
                operationType: "SECURITY_GUARDING",
                isActive: true
              }
            });
          }
        }

        return site;
      });

      return NextResponse.json(result);
    } else {
      const site = await mockDb.createManpowerSite({
        projectId,
        code,
        name,
        lat: normalizedLat,
        lng: normalizedLng,
        radiusMeters: normalizedRadius,
        gatePassRequired,
        gatePassValidationMode,
        remarks,
        operationType: "SECURITY_GUARDING"
      });

      const db = readDb() as any;
      db.siteManpowerAllocations = db.siteManpowerAllocations || [];

      // Save allocations in mock mode
      db.siteManpowerAllocations = db.siteManpowerAllocations.filter((a: any) => a.siteId !== site.id);
      if (allocations && Array.isArray(allocations)) {
        for (const item of allocations) {
          const qty = Number(item.allocatedQty || 0);
          if (qty > 0) {
            db.siteManpowerAllocations.push({
              id: `sma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              siteId: site.id,
              position: item.position,
              quantity: qty,
              deploymentType: item.deploymentType || "PERMANENT",
              relieverPoolType: item.relieverPoolType || "DEDICATED"
            });
          }
        }
      }

      // Save site allowance in mock mode
      db.siteAllowances = db.siteAllowances || [];
      if (siteAllowanceApplicable && siteAllowance) {
        db.siteAllowances.push({
          id: `sa-${Date.now()}`,
          siteId: site.id,
          siteAllowanceEnabled: true,
          siteAllowanceAmount: Number(siteAllowance.siteAllowanceAmount || 0),
          siteAllowanceFrequency: siteAllowance.siteAllowanceFrequency || "MONTHLY",
          allowanceDescription: siteAllowance.allowanceDescription || "",
          appliesToAllPositions: siteAllowance.appliesToAllPositions !== false,
          position: siteAllowance.appliesToAllPositions !== false ? null : siteAllowance.position || null,
          effectiveFrom: siteAllowance.effectiveFrom || null,
          effectiveTo: siteAllowance.effectiveTo || null,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // Save shifts in mock mode
      db.shiftRequirements = db.shiftRequirements || [];
      db.shiftRequirements = db.shiftRequirements.filter((sr: any) => sr.siteId !== site.id);
      if (siteShiftRequirements && Array.isArray(siteShiftRequirements)) {
        for (const shift of siteShiftRequirements) {
          if (Number(shift.requiredCount) > 0) {
            db.shiftRequirements.push({
              id: `sr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              siteId: site.id,
              categoryId: shift.categoryId,
              shiftCode: shift.shiftCode,
              requiredCount: Number(shift.requiredCount),
              requiredRelieverCount: Number(shift.requiredRelieverCount || 0),
              shiftStartTime: shift.shiftStartTime || null,
              shiftEndTime: shift.shiftEndTime || null,
              operationType: "SECURITY_GUARDING",
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      writeDb(db);
      return NextResponse.json(site);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create site" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      id,
      projectId,
      name,
      lat,
      lng,
      radiusMeters,
      gatePassRequired,
      gatePassValidationMode,
      remarks,
      allocations = [],
      siteAllowanceApplicable,
      siteAllowance,
      siteShiftRequirements = []
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
    }

    let normalizedLat: number | null = null;
    let normalizedLng: number | null = null;
    let normalizedRadius = 100;
    try {
      normalizedLat = toNullableFloat(lat);
      normalizedLng = toNullableFloat(lng);
      normalizedRadius = toRadiusFloat(radiusMeters);
    } catch (err) {
      return NextResponse.json({ error: "Latitude, Longitude and Radius must be valid numbers." }, { status: 400 });
    }

    const isDb = isDbConnected();
    if (isDb) {
      // 1. Validate site exists
      const existingSite = await prisma.manpowerSite.findUnique({
        where: { id }
      });
      if (!existingSite) {
        return NextResponse.json({ error: "Site not found." }, { status: 404 });
      }

      const activeProjId = projectId || existingSite.projectId;

      // 2. Validate allocations do not exceed remaining project allocations
      const projectAllocations = await prisma.securityProjectManpowerAllocation.findMany({
        where: { projectId: activeProjId }
      });
      const siblingSites = await prisma.manpowerSite.findMany({
        where: { projectId: activeProjId, NOT: { id }, isActive: true }
      });
      const siblingSiteIds = siblingSites.map(s => s.id);
      const otherAllocations = await prisma.securitySiteManpowerAllocation.findMany({
        where: { siteId: { in: siblingSiteIds } }
      });

      // Aggregate incoming allocations by position + deploymentType
      const aggAllocations: Record<string, { position: string; quantity: number; deploymentType: string; relieverPoolType: string }> = {};
      for (const a of allocations) {
        if (!a.position) {
          return NextResponse.json({ error: "Position is required for all allocations." }, { status: 400 });
        }
        const qty = Number(a.allocatedQty || 0);
        if (qty < 0) {
          return NextResponse.json({ error: "Allocation quantity cannot be negative." }, { status: 400 });
        }
        const key = `${a.position}-${a.deploymentType || "PERMANENT"}`;
        if (aggAllocations[key]) {
          aggAllocations[key].quantity += qty;
        } else {
          aggAllocations[key] = {
            position: a.position,
            quantity: qty,
            deploymentType: a.deploymentType || "PERMANENT",
            relieverPoolType: a.relieverPoolType || "DEDICATED"
          };
        }
      }

      // Validate capacity
      for (const key in aggAllocations) {
        const item = aggAllocations[key];
        if (item.deploymentType === "PERMANENT") {
          const projAlloc = projectAllocations.find(pa => pa.position === item.position);
          const projQty = projAlloc ? projAlloc.quantity : 0;
          const otherQty = otherAllocations
            .filter(oa => oa.position === item.position && oa.deploymentType === "PERMANENT")
            .reduce((sum, oa) => sum + oa.quantity, 0);
          if (otherQty + item.quantity > projQty) {
            return NextResponse.json({
              error: `Site allocation of ${item.quantity} for position "${item.position}" exceeds the available project allocation (${projQty - otherQty} remaining).`
            }, { status: 400 });
          }
        }
      }

      // Validate site allowance fields
      if (siteAllowanceApplicable && siteAllowance) {
        if (!siteAllowance.effectiveFrom) {
          return NextResponse.json({ error: "Effective From date is required for site allowance." }, { status: 400 });
        }
        if (siteAllowance.effectiveTo && new Date(siteAllowance.effectiveTo) < new Date(siteAllowance.effectiveFrom)) {
          return NextResponse.json({ error: "Effective To date cannot be before Effective From date." }, { status: 400 });
        }
        if (isNaN(Number(siteAllowance.siteAllowanceAmount || 0)) || Number(siteAllowance.siteAllowanceAmount || 0) < 0) {
          return NextResponse.json({ error: "Site allowance amount must be a non-negative number." }, { status: 400 });
        }
      }

      // Validate site shifts
      if (siteShiftRequirements && Array.isArray(siteShiftRequirements)) {
        for (const shift of siteShiftRequirements) {
          if (!shift.shiftCode || !shift.categoryId) {
            return NextResponse.json({ error: "Shift name and position are required." }, { status: 400 });
          }
          if (!shift.shiftStartTime || !shift.shiftEndTime) {
            return NextResponse.json({ error: `Start time and End time are required for shift ${shift.shiftCode}.` }, { status: 400 });
          }
          if (Number(shift.requiredCount) <= 0) {
            return NextResponse.json({ error: `Required count for shift ${shift.shiftCode} must be greater than 0.` }, { status: 400 });
          }
        }
      }

      // 3. Save inside Transaction
      const result = await prisma.$transaction(async (tx) => {
        const site = await tx.manpowerSite.update({
          where: { id },
          data: {
            projectId: projectId || undefined,
            name: name || undefined,
            lat: normalizedLat,
            lng: normalizedLng,
            radiusMeters: normalizedRadius,
            gatePassRequired: gatePassRequired !== undefined ? !!gatePassRequired : undefined,
            gatePassValidationMode: gatePassValidationMode || undefined,
            remarks: remarks !== undefined ? remarks : undefined
          }
        });

        // Replace allocations
        await tx.securitySiteManpowerAllocation.deleteMany({
          where: { siteId: id }
        });
        for (const key in aggAllocations) {
          const item = aggAllocations[key];
          if (item.quantity > 0) {
            await tx.securitySiteManpowerAllocation.create({
              data: {
                siteId: id,
                position: item.position,
                quantity: item.quantity,
                deploymentType: item.deploymentType,
                relieverPoolType: item.relieverPoolType
              }
            });
          }
        }

        // Update site allowance
        if (siteAllowanceApplicable && siteAllowance) {
          // Deactivate any existing active allowances for this site
          await tx.securitySiteAllowance.updateMany({
            where: { siteId: id, isActive: true },
            data: { isActive: false }
          });
          
          await tx.securitySiteAllowance.create({
            data: {
              siteId: id,
              siteAllowanceEnabled: true,
              siteAllowanceAmount: Number(siteAllowance.siteAllowanceAmount || 0),
              siteAllowanceFrequency: siteAllowance.siteAllowanceFrequency || "MONTHLY",
              allowanceDescription: siteAllowance.allowanceDescription || "",
              appliesToAllPositions: siteAllowance.appliesToAllPositions !== false,
              position: siteAllowance.appliesToAllPositions !== false ? null : siteAllowance.position || null,
              effectiveFrom: siteAllowance.effectiveFrom ? new Date(siteAllowance.effectiveFrom) : null,
              effectiveTo: siteAllowance.effectiveTo ? new Date(siteAllowance.effectiveTo) : null,
              isActive: true
            }
          });
        } else {
          // Deactivate existing allowances
          await tx.securitySiteAllowance.updateMany({
            where: { siteId: id, isActive: true },
            data: { isActive: false, siteAllowanceEnabled: false }
          });
        }

        // Replace shifts
        if (siteShiftRequirements && Array.isArray(siteShiftRequirements)) {
          await tx.manpowerShiftRequirement.deleteMany({
            where: { siteId: id }
          });
          for (const shift of siteShiftRequirements) {
            if (Number(shift.requiredCount) > 0) {
              await tx.manpowerShiftRequirement.create({
                data: {
                  siteId: id,
                  categoryId: shift.categoryId,
                  shiftCode: shift.shiftCode,
                  requiredCount: Number(shift.requiredCount),
                  requiredRelieverCount: Number(shift.requiredRelieverCount || 0),
                  shiftStartTime: shift.shiftStartTime || null,
                  shiftEndTime: shift.shiftEndTime || null,
                  operationType: "SECURITY_GUARDING",
                  isActive: true
                }
              });
            }
          }
        }

        return site;
      });

      return NextResponse.json(result);
    } else {
      const site = await mockDb.updateManpowerSite(id, {
        projectId,
        name,
        lat: normalizedLat,
        lng: normalizedLng,
        radiusMeters: normalizedRadius,
        gatePassRequired,
        gatePassValidationMode,
        remarks
      });

      if (!site) {
        return NextResponse.json({ error: "Site not found" }, { status: 404 });
      }

      const db = readDb() as any;
      db.siteManpowerAllocations = db.siteManpowerAllocations || [];

      // Update allocations in mock mode
      db.siteManpowerAllocations = db.siteManpowerAllocations.filter((a: any) => a.siteId !== id);
      if (allocations && Array.isArray(allocations)) {
        for (const item of allocations) {
          const qty = Number(item.allocatedQty || 0);
          if (qty > 0) {
            db.siteManpowerAllocations.push({
              id: `sma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              siteId: id,
              position: item.position,
              quantity: qty,
              deploymentType: item.deploymentType || "PERMANENT",
              relieverPoolType: item.relieverPoolType || "DEDICATED"
            });
          }
        }
      }

      // Update site allowance in mock mode
      db.siteAllowances = db.siteAllowances || [];
      if (siteAllowanceApplicable && siteAllowance) {
        // Deactivate old active records
        db.siteAllowances.forEach((sa: any) => {
          if (sa.siteId === id) {
            sa.isActive = false;
          }
        });
        db.siteAllowances.push({
          id: `sa-${Date.now()}`,
          siteId: id,
          siteAllowanceEnabled: true,
          siteAllowanceAmount: Number(siteAllowance.siteAllowanceAmount || 0),
          siteAllowanceFrequency: siteAllowance.siteAllowanceFrequency || "MONTHLY",
          allowanceDescription: siteAllowance.allowanceDescription || "",
          appliesToAllPositions: siteAllowance.appliesToAllPositions !== false,
          position: siteAllowance.appliesToAllPositions !== false ? null : siteAllowance.position || null,
          effectiveFrom: siteAllowance.effectiveFrom || null,
          effectiveTo: siteAllowance.effectiveTo || null,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        db.siteAllowances.forEach((sa: any) => {
          if (sa.siteId === id) {
            sa.isActive = false;
            sa.siteAllowanceEnabled = false;
          }
        });
      }

      // Update shifts in mock mode
      db.shiftRequirements = db.shiftRequirements || [];
      db.shiftRequirements = db.shiftRequirements.filter((sr: any) => sr.siteId !== id);
      if (siteShiftRequirements && Array.isArray(siteShiftRequirements)) {
        for (const shift of siteShiftRequirements) {
          if (Number(shift.requiredCount) > 0) {
            db.shiftRequirements.push({
              id: `sr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              siteId: id,
              categoryId: shift.categoryId,
              shiftCode: shift.shiftCode,
              requiredCount: Number(shift.requiredCount),
              requiredRelieverCount: Number(shift.requiredRelieverCount || 0),
              shiftStartTime: shift.shiftStartTime || null,
              shiftEndTime: shift.shiftEndTime || null,
              operationType: "SECURITY_GUARDING",
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      writeDb(db);
      return NextResponse.json(site);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update site" }, { status: 500 });
  }
}
