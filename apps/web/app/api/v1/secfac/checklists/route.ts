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
  const checkpointId = searchParams.get("checkpointId");
  const category = searchParams.get("category");
  const checklistType = searchParams.get("checklistType");
  const isActive = searchParams.get("isActive");
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

  let targetOp = operationTypeFilter;
  if (targetOp) {
    if (!allowedOps.includes(targetOp)) {
      return NextResponse.json({ success: false, error: `Forbidden: No access to operation type ${targetOp}` }, { status: 403 });
    }
  } else {
    if (allowedOps.length === 1) {
      targetOp = allowedOps[0];
    }
  }

  try {
    const templates = await mockDb.getSecfacChecklists({
      operationType: targetOp || undefined,
      clientId: clientId || undefined,
      projectId: projectId || undefined,
      siteId: siteId || undefined,
      locationUnitId: locationUnitId || undefined,
      checkpointId: checkpointId || undefined,
      category: category || undefined,
      checklistType: checklistType || undefined,
      isActive: isActive !== null ? isActive : undefined,
      search: search || undefined
    });

    let filteredTemplates = templates;
    if (!isAdmin) {
      filteredTemplates = templates.filter(x => allowedOps.includes(x.operationType));
    }

    return NextResponse.json({ success: true, data: filteredTemplates });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve checklists", error: error.message }, { status: 500 });
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

    // 1. Mandatory Fields Validation
    if (!templateName) {
      return NextResponse.json({ success: false, error: "templateName is required" }, { status: 400 });
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

    // 4. Validate Category and ChecklistType Lists
    if (category && !APPROVED_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: "Invalid category value" }, { status: 400 });
    }
    if (checklistType && !APPROVED_TYPES.includes(checklistType)) {
      return NextResponse.json({ success: false, error: "Invalid checklistType value" }, { status: 400 });
    }

    // 5. Validate Checklist Items Fields
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

    // 6. Validate Site Existence & Operation Type Match
    if (siteId) {
      let site: any = null;
      if (isDbConnected()) {
        site = await prisma.manpowerSite.findUnique({
          where: { id: siteId }
        });
      } else {
        const db = readDb();
        site = (db.manpowerSites || []).find((s: any) => s.id === siteId);
      }

      if (!site) {
        return NextResponse.json({ success: false, error: "Site not found" }, { status: 400 });
      }
      if (site.operationType !== operationType) {
        return NextResponse.json({ success: false, error: "Operation type mismatch between checklist template and site" }, { status: 400 });
      }
    }

    // 7. Validate Location Unit (if provided) belongs to the Site
    if (locationUnitId && siteId) {
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

    // 8. Validate Checkpoint Existence & Operation Type Match
    if (checkpointId) {
      let cp: any = null;
      if (isDbConnected()) {
        cp = await prisma.secfacCheckpoint.findUnique({
          where: { id: checkpointId }
        });
      } else {
        const db = readDb();
        cp = (db.secfacCheckpoints || []).find((c: any) => c.id === checkpointId);
      }

      if (!cp) {
        return NextResponse.json({ success: false, error: "Checkpoint not found" }, { status: 400 });
      }
      if (cp.operationType !== operationType) {
        return NextResponse.json({ success: false, error: "Operation type mismatch between checklist template and checkpoint" }, { status: 400 });
      }
    }

    // 9. Save Template record
    const result = await mockDb.createSecfacChecklist({
      operationType,
      clientId: clientId || null,
      projectId: projectId || null,
      siteId: siteId || null,
      locationUnitId: locationUnitId || null,
      checkpointId: checkpointId || null,
      templateName,
      templateCode: templateCode || null,
      category: category || "GENERAL",
      description: description || null,
      checklistType: checklistType || "STANDARD",
      version: version !== undefined ? Number(version) : 1,
      requiresNfcScan: !!requiresNfcScan,
      requiresPhoto: !!requiresPhoto,
      requiresGeoFence: !!requiresGeoFence,
      isActive: isActive !== false,
      items: items || []
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to create checklist template", error: error.message }, { status: 500 });
  }
}
