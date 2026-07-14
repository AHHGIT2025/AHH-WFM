import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

export async function GET(
  request: Request,
  { params }: { params: { checkpointId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const checkpointId = params.checkpointId;

  try {
    const checkpoint = await mockDb.getSecfacCheckpointById(checkpointId);
    if (!checkpoint) {
      return NextResponse.json({ success: false, error: "Checkpoint not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions
    if (!isAdmin) {
      if (checkpoint.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to security checkpoints" }, { status: 403 });
      }
      if (checkpoint.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to facility checkpoints" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: checkpoint });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve checkpoint", error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { checkpointId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const checkpointId = params.checkpointId;

  try {
    const checkpoint = await mockDb.getSecfacCheckpointById(checkpointId);
    if (!checkpoint) {
      return NextResponse.json({ success: false, error: "Checkpoint not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions on existing checkpoint
    if (!isAdmin) {
      if (checkpoint.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to modify security checkpoints" }, { status: 403 });
      }
      if (checkpoint.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to modify facility checkpoints" }, { status: 403 });
      }
    }

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

    const finalOp = operationType || checkpoint.operationType;

    // Apply RBAC Operation Restrictions on requested new operationType
    if (operationType && !isAdmin) {
      if (operationType !== "SECURITY_GUARDING" && operationType !== "FACILITY_MANAGEMENT") {
        return NextResponse.json({ success: false, error: "Invalid operationType value" }, { status: 400 });
      }
      if (operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: Cannot set operation type to security" }, { status: 403 });
      }
      if (operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: Cannot set operation type to facility" }, { status: 403 });
      }
    }

    // Validate Site Existence & Operation Type Match
    const targetSiteId = siteId || checkpoint.siteId;
    let site: any = null;
    if (isDbConnected()) {
      site = await prisma.manpowerSite.findUnique({
        where: { id: targetSiteId }
      });
    } else {
      const db = readDb();
      site = (db.manpowerSites || []).find((s: any) => s.id === targetSiteId);
    }

    if (!site) {
      return NextResponse.json({ success: false, error: "Site not found" }, { status: 400 });
    }
    if (site.operationType !== finalOp) {
      return NextResponse.json({ success: false, error: "Operation type mismatch between checkpoint and site" }, { status: 400 });
    }

    // Validate Location Unit
    const targetLocUnitId = locationUnitId !== undefined ? locationUnitId : checkpoint.locationUnitId;
    if (targetLocUnitId) {
      let locUnit: any = null;
      if (isDbConnected()) {
        locUnit = await prisma.manpowerLocationUnit.findUnique({
          where: { id: targetLocUnitId }
        });
      } else {
        const db = readDb();
        locUnit = (db.manpowerLocationUnits || []).find((l: any) => l.id === targetLocUnitId);
      }

      if (!locUnit) {
        return NextResponse.json({ success: false, error: "Location unit not found" }, { status: 400 });
      }
      if (locUnit.siteId !== targetSiteId) {
        return NextResponse.json({ success: false, error: "Location unit belongs to a different site" }, { status: 400 });
      }
    }

    // Validate Latitude / Longitude / Radius Values
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

    // Check unique rules in MySQL
    if (isDbConnected()) {
      if (nfcTagId && nfcTagId !== checkpoint.nfcTagId) {
        const exists = await prisma.secfacCheckpoint.findUnique({ where: { nfcTagId } });
        if (exists) return NextResponse.json({ success: false, error: "Duplicate NFC Tag ID" }, { status: 400 });
      }
      if (qrCode && qrCode !== checkpoint.qrCode) {
        const exists = await prisma.secfacCheckpoint.findUnique({ where: { qrCode } });
        if (exists) return NextResponse.json({ success: false, error: "Duplicate QR Code" }, { status: 400 });
      }
    }

    // Perform Update
    const result = await mockDb.updateSecfacCheckpoint(checkpointId, {
      operationType: finalOp,
      clientId: clientId !== undefined ? clientId : checkpoint.clientId,
      projectId: projectId !== undefined ? projectId : checkpoint.projectId,
      siteId: targetSiteId,
      locationUnitId: targetLocUnitId,
      checkpointName: checkpointName !== undefined ? checkpointName : checkpoint.checkpointName,
      checkpointCode: checkpointCode !== undefined ? checkpointCode : checkpoint.checkpointCode,
      nfcTagId: nfcTagId !== undefined ? nfcTagId : checkpoint.nfcTagId,
      qrCode: qrCode !== undefined ? qrCode : checkpoint.qrCode,
      checkpointType: checkpointType !== undefined ? checkpointType : checkpoint.checkpointType,
      description: description !== undefined ? description : checkpoint.description,
      latitude: latitude !== undefined ? (latitude !== null ? Number(latitude) : null) : checkpoint.latitude,
      longitude: longitude !== undefined ? (longitude !== null ? Number(longitude) : null) : checkpoint.longitude,
      radiusMeters: radiusMeters !== undefined ? (radiusMeters !== null ? Number(radiusMeters) : null) : checkpoint.radiusMeters,
      scanRequired: scanRequired !== undefined ? !!scanRequired : checkpoint.scanRequired,
      photoRequired: photoRequired !== undefined ? !!photoRequired : checkpoint.photoRequired,
      checklistRequired: checklistRequired !== undefined ? !!checklistRequired : checkpoint.checklistRequired,
      isActive: isActive !== undefined ? !!isActive : checkpoint.isActive
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const msg = error.message || "";
    if (msg.includes("Duplicate NFC Tag ID") || msg.includes("Duplicate QR Code")) {
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: "Failed to update checkpoint", error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { checkpointId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const checkpointId = params.checkpointId;

  try {
    const checkpoint = await mockDb.getSecfacCheckpointById(checkpointId);
    if (!checkpoint) {
      return NextResponse.json({ success: false, error: "Checkpoint not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions
    if (!isAdmin) {
      if (checkpoint.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to delete security checkpoints" }, { status: 403 });
      }
      if (checkpoint.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to delete facility checkpoints" }, { status: 403 });
      }
    }

    // Soft delete
    await mockDb.deleteSecfacCheckpoint(checkpointId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to delete checkpoint", error: error.message }, { status: 500 });
  }
}
