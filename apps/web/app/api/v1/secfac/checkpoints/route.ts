import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};

  const { searchParams } = new URL(request.url);
  const operationTypeFilter = searchParams.get("operationType");
  const clientId = searchParams.get("clientId");
  const projectId = searchParams.get("projectId");
  const siteId = searchParams.get("siteId");
  const locationUnitId = searchParams.get("locationUnitId");
  const isActive = searchParams.get("isActive");
  const checkpointType = searchParams.get("checkpointType");
  const search = searchParams.get("search");

  // Apply RBAC Operation Restrictions
  let allowedOps: string[] = [];
  if (isAdmin) {
    allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
  } else {
    if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
    if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
  }

  if (allowedOps.length === 0) {
    return NextResponse.json({ success: false, error: "Forbidden: No operations access allowed" }, { status: 403 });
  }

  // Filter requested operationType based on allowed user scopes
  let targetOp = operationTypeFilter;
  if (targetOp) {
    if (!allowedOps.includes(targetOp)) {
      return NextResponse.json({ success: false, error: `Forbidden: No access to operation type ${targetOp}` }, { status: 403 });
    }
  } else {
    // If no filter, restrict to user's allowed scopes
    if (allowedOps.length === 1) {
      targetOp = allowedOps[0];
    }
  }

  try {
    const checkpoints = await mockDb.getSecfacCheckpoints({
      operationType: targetOp || undefined,
      clientId: clientId || undefined,
      projectId: projectId || undefined,
      siteId: siteId || undefined,
      locationUnitId: locationUnitId || undefined,
      isActive: isActive !== null ? isActive : undefined,
      checkpointType: checkpointType || undefined,
      search: search || undefined
    });

    // If no operationType filter was explicitly requested but user has restricted scopes,
    // filter the output in-memory for safety (in case mockDb fallback returned unfiltered items)
    let filteredCheckpoints = checkpoints;
    if (!isAdmin) {
      filteredCheckpoints = checkpoints.filter(x => allowedOps.includes(x.operationType));
    }

    return NextResponse.json({ success: true, data: filteredCheckpoints });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve checkpoints", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};

  try {
    const payload = await request.json();
    const {
      operationType,
      clientId,
      projectId,
      siteId,
      locationUnitId,
      checkpointName,
      checkpointCode,
      nfcTagId,
      qrCode,
      checkpointType,
      description,
      latitude,
      longitude,
      radiusMeters,
      scanRequired,
      photoRequired,
      checklistRequired,
      isActive
    } = payload;

    // 1. Mandatory Fields Validation
    if (!checkpointName) {
      return NextResponse.json({ success: false, error: "checkpointName is required" }, { status: 400 });
    }
    if (!siteId) {
      return NextResponse.json({ success: false, error: "siteId is required" }, { status: 400 });
    }
    if (!operationType) {
      return NextResponse.json({ success: false, error: "operationType is required" }, { status: 400 });
    }

    // 2. Validate Operation Type Value
    if (operationType !== "SECURITY_GUARDING" && operationType !== "FACILITY_MANAGEMENT") {
      return NextResponse.json({ success: false, error: "Invalid operationType value" }, { status: 400 });
    }

    // 3. User Scope Restrictions
    if (!isAdmin) {
      if (operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No security operations access allowed" }, { status: 403 });
      }
      if (operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No facility operations access allowed" }, { status: 403 });
      }
    }

    // 4. Validate Site Existence & Operation Type Match
    let site: any = null;
    if (isDbConnected()) {
      site = await prisma.manpowerSite.findUnique({
        where: { id: siteId },
        include: { project: { include: { contract: true } } }
      });
    } else {
      const db = readDb();
      site = (db.manpowerSites || []).find((s: any) => s.id === siteId);
      if (site) {
        const proj = (db.manpowerProjects || []).find((p: any) => p.id === site.projectId);
        const contract = proj ? (db.manpowerContracts || []).find((c: any) => c.id === proj.contractId) : null;
        site = { ...site, project: proj ? { ...proj, contract } : null };
      }
    }

    if (!site) {
      return NextResponse.json({ success: false, error: "Site not found" }, { status: 400 });
    }
    if (site.operationType !== operationType) {
      return NextResponse.json({ success: false, error: "Operation type mismatch between checkpoint and site" }, { status: 400 });
    }

    // 5. Validate Location Unit (if provided) belongs to the Site
    if (locationUnitId) {
      let locUnit: any = null;
      if (isDbConnected()) {
        locUnit = await prisma.manpowerLocationUnit.findUnique({
          where: { id: locationUnitId }
        });
      } else {
        const db = readDb();
        locUnit = (db.manpowerLocationUnits || []).find((l: any) => l.id === locationUnitId);
      }

      if (!locUnit) {
        return NextResponse.json({ success: false, error: "Location unit not found" }, { status: 400 });
      }
      if (locUnit.siteId !== siteId) {
        return NextResponse.json({ success: false, error: "Location unit belongs to a different site" }, { status: 400 });
      }
    }

    // 6. Validate Latitude / Longitude / Radius Values
    if (latitude !== undefined && latitude !== null && isNaN(Number(latitude))) {
      return NextResponse.json({ success: false, error: "latitude must be numeric" }, { status: 400 });
    }
    if (longitude !== undefined && longitude !== null && isNaN(Number(longitude))) {
      return NextResponse.json({ success: false, error: "longitude must be numeric" }, { status: 400 });
    }
    if (radiusMeters !== undefined && radiusMeters !== null) {
      const radiusNum = Number(radiusMeters);
      if (isNaN(radiusNum) || radiusNum <= 0) {
        return NextResponse.json({ success: false, error: "radiusMeters must be a positive number" }, { status: 400 });
      }
    }

    // 7. Validate NFC ID and QR Code Uniqueness (Pre-check in MySQL to return clean 400 errors)
    if (isDbConnected()) {
      if (nfcTagId) {
        const exists = await prisma.secfacCheckpoint.findUnique({ where: { nfcTagId } });
        if (exists) return NextResponse.json({ success: false, error: "Duplicate NFC Tag ID" }, { status: 400 });
      }
      if (qrCode) {
        const exists = await prisma.secfacCheckpoint.findUnique({ where: { qrCode } });
        if (exists) return NextResponse.json({ success: false, error: "Duplicate QR Code" }, { status: 400 });
      }
    }

    // 8. Create the Checkpoint record
    const result = await mockDb.createSecfacCheckpoint({
      operationType,
      clientId: clientId || site.project?.contract?.clientId || null,
      projectId: projectId || site.projectId || null,
      siteId,
      locationUnitId: locationUnitId || null,
      checkpointName,
      checkpointCode: checkpointCode || null,
      nfcTagId: nfcTagId || null,
      qrCode: qrCode || null,
      checkpointType: checkpointType || "SECURITY_PATROL",
      description: description || null,
      latitude: latitude !== undefined && latitude !== null ? Number(latitude) : null,
      longitude: longitude !== undefined && longitude !== null ? Number(longitude) : null,
      radiusMeters: radiusMeters !== undefined && radiusMeters !== null ? Number(radiusMeters) : null,
      scanRequired: scanRequired !== false,
      photoRequired: !!photoRequired,
      checklistRequired: !!checklistRequired,
      isActive: isActive !== false
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    const msg = error.message || "";
    if (msg.includes("Duplicate NFC Tag ID") || msg.includes("Duplicate QR Code")) {
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: "Failed to create checkpoint", error: msg }, { status: 500 });
  }
}
