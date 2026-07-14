import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

const APPROVED_CATEGORIES = [
  "GENERAL", "SECURITY_PATROL", "FACILITY_INSPECTION", "FIRE_SAFETY",
  "CLEANING", "MAINTENANCE", "EQUIPMENT_ROOM", "CLIENT_SPECIFIC", "OTHER"
];

const APPROVED_TYPES = [
  "STANDARD", "PATROL", "INSPECTION", "SAFETY",
  "CLEANING", "MAINTENANCE", "HANDOVER", "OTHER"
];

const APPROVED_ITEM_TYPES = [
  "YES_NO", "PASS_FAIL", "TEXT", "NUMBER", "PHOTO",
  "COMMENT", "SELECT", "MULTI_SELECT", "DATE_TIME", "SIGNATURE"
];

export async function GET(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const templateId = params.templateId;

  try {
    const template = await mockDb.getSecfacChecklistById(templateId);
    if (!template) {
      return NextResponse.json({ success: false, error: "Checklist template not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions
    if (!isAdmin) {
      if (template.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to security templates" }, { status: 403 });
      }
      if (template.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to facility templates" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve template", error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const templateId = params.templateId;

  try {
    const template = await mockDb.getSecfacChecklistById(templateId);
    if (!template) {
      return NextResponse.json({ success: false, error: "Checklist template not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions on existing template
    if (!isAdmin) {
      if (template.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to modify security templates" }, { status: 403 });
      }
      if (template.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to modify facility templates" }, { status: 403 });
      }
    }

    const payload = await request.json();
    const {
      operationType,
      clientId,
      projectId,
      siteId,
      locationUnitId,
      checkpointId,
      templateName,
      templateCode,
      category,
      description,
      checklistType,
      version,
      requiresNfcScan,
      requiresPhoto,
      requiresGeoFence,
      isActive,
      items
    } = payload;

    const finalOp = operationType || template.operationType;

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

    // Validate Category and ChecklistType Lists
    if (category && !APPROVED_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: "Invalid category value" }, { status: 400 });
    }
    if (checklistType && !APPROVED_TYPES.includes(checklistType)) {
      return NextResponse.json({ success: false, error: "Invalid checklistType value" }, { status: 400 });
    }

    // Validate Checklist Items Fields
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item.itemText) {
          return NextResponse.json({ success: false, error: "itemText is required for each checklist item" }, { status: 400 });
        }
        if (item.itemType && !APPROVED_ITEM_TYPES.includes(item.itemType)) {
          return NextResponse.json({ success: false, error: `Invalid itemType value: ${item.itemType}` }, { status: 400 });
        }
      }
    }

    // Validate Site Existence & Operation Type Match
    const targetSiteId = siteId !== undefined ? siteId : template.siteId;
    if (targetSiteId) {
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
        return NextResponse.json({ success: false, error: "Operation type mismatch between checklist template and site" }, { status: 400 });
      }
    }

    // Validate Location Unit (if provided) belongs to the Site
    const targetLocUnitId = locationUnitId !== undefined ? locationUnitId : template.locationUnitId;
    if (targetLocUnitId && targetSiteId) {
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

    // Validate Checkpoint Existence & Operation Type Match
    const targetCheckpointId = checkpointId !== undefined ? checkpointId : template.checkpointId;
    if (targetCheckpointId) {
      let cp: any = null;
      if (isDbConnected()) {
        cp = await prisma.secfacCheckpoint.findUnique({
          where: { id: targetCheckpointId }
        });
      } else {
        const db = readDb();
        cp = (db.secfacCheckpoints || []).find((c: any) => c.id === targetCheckpointId);
      }

      if (!cp) {
        return NextResponse.json({ success: false, error: "Checkpoint not found" }, { status: 400 });
      }
      if (cp.operationType !== finalOp) {
        return NextResponse.json({ success: false, error: "Operation type mismatch between checklist template and checkpoint" }, { status: 400 });
      }
    }

    // Perform Update
    const result = await mockDb.updateSecfacChecklist(templateId, {
      operationType: finalOp,
      clientId: clientId !== undefined ? clientId : template.clientId,
      projectId: projectId !== undefined ? projectId : template.projectId,
      siteId: targetSiteId,
      locationUnitId: targetLocUnitId,
      checkpointId: targetCheckpointId,
      templateName: templateName !== undefined ? templateName : template.templateName,
      templateCode: templateCode !== undefined ? templateCode : template.templateCode,
      category: category !== undefined ? category : template.category,
      description: description !== undefined ? description : template.description,
      checklistType: checklistType !== undefined ? checklistType : template.checklistType,
      version: version !== undefined ? Number(version) : template.version,
      requiresNfcScan: requiresNfcScan !== undefined ? !!requiresNfcScan : template.requiresNfcScan,
      requiresPhoto: requiresPhoto !== undefined ? !!requiresPhoto : template.requiresPhoto,
      requiresGeoFence: requiresGeoFence !== undefined ? !!requiresGeoFence : template.requiresGeoFence,
      isActive: isActive !== undefined ? !!isActive : template.isActive,
      items: items !== undefined ? items : undefined
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to update checklist template", error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const templateId = params.templateId;

  try {
    const template = await mockDb.getSecfacChecklistById(templateId);
    if (!template) {
      return NextResponse.json({ success: false, error: "Checklist template not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions
    if (!isAdmin) {
      if (template.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to delete security templates" }, { status: 403 });
      }
      if (template.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to delete facility templates" }, { status: 403 });
      }
    }

    // Soft delete
    await mockDb.deleteSecfacChecklist(templateId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to delete checklist template", error: error.message }, { status: 500 });
  }
}
