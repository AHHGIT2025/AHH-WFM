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
  const auth = await checkApiAuth(undefined, { requiredPermission: "secfac.checkpoints.delete" });
  if (auth.error) {
    const session = auth.session as any;
    if (session?.user?.id) {
      const { auditSecfacDeleteAction } = require("@/lib/secfac-delete-audit-service");
      await auditSecfacDeleteAction({
        entityType: "CHECKPOINT",
        entityId: params.checkpointId,
        actionType: "PERMISSION_DENIED",
        userId: session.user.id,
        userRole: session.user.role,
        userEmail: session.user.email,
        permission: "secfac.checkpoints.delete",
        operationType: "SECURITY_GUARDING",
        resultStatus: "DENIED",
        resultMessage: "Forbidden: User lacks secfac.checkpoints.delete permission"
      });
    }
    return auth.error;
  }

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const checkpointId = params.checkpointId;

  try {
    const checkpoint = await mockDb.getSecfacCheckpointById(checkpointId);
    if (!checkpoint) {
      return NextResponse.json({ success: false, error: "Checkpoint not found" }, { status: 404 });
    }

    const opType = checkpoint.operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";

    // Apply RBAC Scope Isolation (Guarding vs FM)
    if (!isAdmin) {
      if (opType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        const { auditSecfacDeleteAction } = require("@/lib/secfac-delete-audit-service");
        await auditSecfacDeleteAction({
          entityType: "CHECKPOINT",
          entityId: checkpointId,
          actionType: "PERMISSION_DENIED",
          userId: user.id,
          userRole: user.role,
          permission: "secfac.checkpoints.delete",
          operationType: opType,
          siteId: checkpoint.siteId,
          resultStatus: "DENIED",
          resultMessage: "Forbidden: User lacks access to Security Guarding scope"
        });
        return NextResponse.json({ success: false, error: "Forbidden: Scope access denied for Security Guarding" }, { status: 403 });
      }
      if (opType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        const { auditSecfacDeleteAction } = require("@/lib/secfac-delete-audit-service");
        await auditSecfacDeleteAction({
          entityType: "CHECKPOINT",
          entityId: checkpointId,
          actionType: "PERMISSION_DENIED",
          userId: user.id,
          userRole: user.role,
          permission: "secfac.checkpoints.delete",
          operationType: opType,
          siteId: checkpoint.siteId,
          resultStatus: "DENIED",
          resultMessage: "Forbidden: User lacks access to Facility Management scope"
        });
        return NextResponse.json({ success: false, error: "Forbidden: Scope access denied for Facility Management" }, { status: 403 });
      }
    }

    // Check all operational dependencies
    let dependencies = {
      routeLinks: 0,
      scanProofs: 0,
      evidenceAttachments: 0,
      checklistExecutions: 0,
      patrolExecutions: 0,
      checklistTemplates: 0,
      assignments: 0
    };

    const isDb = isDbConnected();
    if (isDb) {
      const routeLinks = await prisma.secfacPatrolRouteCheckpoint.count({ where: { checkpointId } });
      const scanProofs = await prisma.secfacScanProof.count({ where: { checkpointId } });
      const evidence = await prisma.secfacEvidenceAttachment.count({ where: { checkpointId } });
      const executions = await prisma.secfacChecklistExecution.count({ where: { checkpointId } });
      const patrolExecs = await prisma.secfacPatrolExecutionCheckpoint.count({ where: { checkpointId } });
      const templates = await prisma.secfacChecklistTemplate.count({ where: { checkpointId } });
      const assignments = await prisma.secfacAssignment.count({ where: { checkpointId } });

      dependencies = {
        routeLinks,
        scanProofs,
        evidenceAttachments: evidence,
        checklistExecutions: executions,
        patrolExecutions: patrolExecs,
        checklistTemplates: templates,
        assignments
      };
    } else {
      const db = readDb();
      dependencies.routeLinks = (db.secfacPatrolRouteCheckpoints || []).filter((x: any) => x.checkpointId === checkpointId).length;
      dependencies.scanProofs = (db.secfacScanProofs || []).filter((x: any) => x.checkpointId === checkpointId).length;
      dependencies.evidenceAttachments = (db.secfacEvidenceAttachments || []).filter((x: any) => x.checkpointId === checkpointId).length;
      dependencies.checklistExecutions = (db.secfacChecklistExecutions || []).filter((x: any) => x.checkpointId === checkpointId).length;
      dependencies.patrolExecutions = (db.secfacPatrolExecutionCheckpoints || []).filter((x: any) => x.checkpointId === checkpointId).length;
      dependencies.checklistTemplates = (db.secfacChecklistTemplates || []).filter((x: any) => x.checkpointId === checkpointId).length;
      dependencies.assignments = (db.secfacAssignments || []).filter((x: any) => x.checkpointId === checkpointId).length;
    }

    const totalDependencies = Object.values(dependencies).reduce((sum, n) => sum + n, 0);

    if (totalDependencies > 0) {
      const { auditSecfacDeleteAction } = require("@/lib/secfac-delete-audit-service");
      await auditSecfacDeleteAction({
        entityType: "CHECKPOINT",
        entityId: checkpointId,
        actionType: "DEPENDENCY_BLOCKED",
        userId: user.id,
        userRole: user.role,
        userEmail: user.email,
        permission: "secfac.checkpoints.delete",
        operationType: opType,
        siteId: checkpoint.siteId,
        resultStatus: "BLOCKED",
        resultMessage: `Deletion blocked due to ${totalDependencies} active operational dependency records`
      });

      return NextResponse.json({
        success: false,
        error: "DELETE_BLOCKED",
        message: `This checkpoint cannot be hard deleted because operational history exists (${totalDependencies} references).`,
        dependencies,
        allowedAction: "DEACTIVATE"
      }, { status: 409 });
    }

    // Hard delete when zero dependencies
    if (isDb) {
      await prisma.secfacCheckpoint.delete({ where: { id: checkpointId } });
    } else {
      await mockDb.deleteSecfacCheckpoint(checkpointId);
    }

    const { auditSecfacDeleteAction } = require("@/lib/secfac-delete-audit-service");
    await auditSecfacDeleteAction({
      entityType: "CHECKPOINT",
      entityId: checkpointId,
      actionType: "HARD_DELETE",
      userId: user.id,
      userRole: user.role,
      userEmail: user.email,
      permission: "secfac.checkpoints.delete",
      operationType: opType,
      siteId: checkpoint.siteId,
      resultStatus: "SUCCESS",
      resultMessage: "Checkpoint permanently deleted (zero operational dependencies)"
    });

    return NextResponse.json({ success: true, message: "Checkpoint deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to delete checkpoint", error: error.message }, { status: 500 });
  }
}
