import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { isDbConnected, readDb, writeDb, mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";

const entityMap: Record<string, keyof typeof prisma> = {
  companies: "company",
  departments: "department",
  designations: "designation",
  "trade-classifications": "tradeClassification",
  locations: "locationMaster",
  "cost-centers": "costCenter",
  projects: "project",
  "project-sites": "projectSite",
  "allowed-punch-locations": "allowedPunchLocation",
  "standby-rules": "relieverStandbyRule",
  "leave-types": "leaveType",
};

const memoryKeyMap: Record<string, string> = {
  companies: "companies",
  departments: "departments",
  designations: "designations",
  "trade-classifications": "tradeClassifications",
  locations: "locations",
  "cost-centers": "costCenters",
  projects: "projects",
  "project-sites": "projectSites",
  "allowed-punch-locations": "allowedPunchLocations",
  "standby-rules": "relieverStandbyRules",
  "leave-types": "leaveTypes",
};

const entityWhitelists: Record<string, string[]> = {
  companies: ["companyCode", "companyName", "isActive"],
  departments: ["name", "companyId"],
  designations: ["code", "name", "description", "employeeCategory", "isSupervisorPosition", "isRelieverEligible", "isActive"],
  "trade-classifications": ["code", "name", "description", "linkedDesignationId", "isActive"],
  locations: ["companyId", "locationCode", "locationName", "address", "latitude", "longitude", "defaultGeofenceRadiusMeters", "isActive"],
  "cost-centers": ["companyId", "costCenterCode", "costCenterName", "description", "sapCostCenterCode", "isActive"],
  projects: ["companyId", "projectCode", "projectName", "projectType", "locationId", "costCenter", "isOnCallProject", "clientName", "clientCode", "contractNumber", "sapProjectCode", "sapCostCenterCode", "startDate", "endDate", "status"],
  "project-sites": ["companyId", "projectId", "siteCode", "siteName", "address", "latitude", "longitude", "geofenceRadiusMeters", "sapSiteCode", "status", "locationId"],
  "allowed-punch-locations": ["companyId", "name", "locationType", "latitude", "longitude", "radiusMeters", "isActive"],
  "standby-rules": ["ruleName", "designationId", "tradeClassificationId", "standbyRequired", "relieverRequiredForLeave", "relieverRequiredForOff", "isActive"],
  "leave-types": ["code", "name", "description", "isPaid", "requiresDocument", "workflowCode", "defaultAnnualAllocation", "maxDaysPerRequest", "allowHalfDay", "allowCarryForward", "carryForwardLimit", "genderRestriction", "applicableAfterProbation", "isActive"]
};

function normalizeMasterPayload(entity: string, payload: any, isUpdate = false) {
  if (!payload) return payload;
  const copy = { ...payload };

  // 1. Convert empty relation IDs from "" to null
  const relationIdFields = [
    "companyId",
    "departmentId",
    "costCenterId",
    "projectId",
    "siteId",
    "locationId"
  ];
  for (const field of relationIdFields) {
    if (copy[field] === "") {
      copy[field] = null;
    }
  }

  // 2. Remove nested relation objects and arrays (any field that is an object/array except null)
  for (const key of Object.keys(copy)) {
    const val = copy[key];
    if (val !== null && typeof val === "object") {
      // For projects, costCenter is a required string, not an object relation.
      if (key === "costCenter" && entity === "projects") {
        continue;
      }
      delete copy[key];
    }
  }

  // 3. Map display fields (code/name/type) to DB specific fields only where needed
  if (entity === "companies") {
    if (copy.code !== undefined && copy.companyCode === undefined) copy.companyCode = copy.code;
    if (copy.name !== undefined && copy.companyName === undefined) copy.companyName = copy.name;
  }
  else if (entity === "locations") {
    if (copy.code !== undefined && copy.locationCode === undefined) copy.locationCode = copy.code;
    if (copy.name !== undefined && copy.locationName === undefined) copy.locationName = copy.name;
  }
  else if (entity === "cost-centers") {
    if (copy.code !== undefined && copy.costCenterCode === undefined) copy.costCenterCode = copy.code;
    if (copy.name !== undefined && copy.costCenterName === undefined) copy.costCenterName = copy.name;
  }
  else if (entity === "projects") {
    if (copy.code !== undefined && copy.projectCode === undefined) copy.projectCode = copy.code;
    if (copy.name !== undefined && copy.projectName === undefined) copy.projectName = copy.name;
    if (copy.type !== undefined && copy.projectType === undefined) copy.projectType = copy.type;

    if (copy.costCenter === undefined || copy.costCenter === null) {
      copy.costCenter = "";
    }
    // Map isActive to status for projects
    if (copy.isActive !== undefined) {
      copy.status = copy.isActive ? "ACTIVE" : "INACTIVE";
    }
    if (!copy.status) {
      copy.status = "ACTIVE";
    }
  }
  else if (entity === "project-sites") {
    if (copy.code !== undefined && copy.siteCode === undefined) copy.siteCode = copy.code;
    if (copy.name !== undefined && copy.siteName === undefined) copy.siteName = copy.name;

    // Map isActive to status for project-sites
    if (copy.isActive !== undefined) {
      copy.status = copy.isActive ? "ACTIVE" : "INACTIVE";
    }
    if (!copy.status) {
      copy.status = "ACTIVE";
    }
  }

  // 4. Filter copy payload using whitelist to prevent database unknown field errors
  const whitelist = entityWhitelists[entity];
  if (whitelist) {
    for (const key of Object.keys(copy)) {
      if (!whitelist.includes(key)) {
        console.log(`[normalizeMasterPayload] Stripping unsupported field "${key}" for entity "${entity}"`);
        delete copy[key];
      }
    }
  }

  // 5. Remove read-only fields
  if (isUpdate || copy.id === "") {
    delete copy.id;
  }
  delete copy.createdAt;
  delete copy.updatedAt;

  if (entity === "project-sites") {
    console.log(`[DEVELOPMENT] Normalized payload for project-sites:`, JSON.stringify(copy, null, 2));
  }

  return copy;
}

function normalizeRecord(entity: string, record: any) {
  if (!record) return record;
  const copy = { ...record };

  // Normalize Company
  if (entity === "companies") {
    copy.code = record.companyCode;
    copy.name = record.companyName;
  }
  // Normalize Department
  if (entity === "departments") {
    copy.code = "";
  }
  // Normalize Cost Center
  if (entity === "cost-centers") {
    copy.code = record.costCenterCode;
    copy.name = record.costCenterName;
  }
  // Normalize Location
  if (entity === "locations") {
    copy.code = record.locationCode;
    copy.name = record.locationName;
  }
  // Normalize Project
  if (entity === "projects") {
    copy.code = record.projectCode;
    copy.name = record.projectName;
  }
  // Normalize Project Site
  if (entity === "project-sites") {
    copy.code = record.siteCode;
    copy.name = record.siteName;
  }

  // Normalize nested company relation
  if (copy.company) {
    copy.company = {
      ...copy.company,
      code: copy.company.companyCode,
      name: copy.company.companyName
    };
  }
  // Normalize nested project relation
  if (copy.project) {
    copy.project = {
      ...copy.project,
      code: copy.project.projectCode,
      name: copy.project.projectName
    };
  }

  return copy;
}

export async function GET(request: Request, { params }: { params: { entity: string; id: string } }) {
  try {
    const { entity, id } = params;

    if (!isDbConnected()) {
      const memoryKey = memoryKeyMap[entity];
      if (!memoryKey) {
        return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
      }

      const db = readDb();
      const records = (db as any)[memoryKey] || [];
      const record = records.find((r: any) => r.id === id);

      if (!record) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      // Populate relations
      const populatedRecord = { ...record };
      if (populatedRecord.companyId && !populatedRecord.company) {
        populatedRecord.company = db.companies.find((c: any) => c.id === populatedRecord.companyId);
      }
      if (populatedRecord.projectId && !populatedRecord.project) {
        populatedRecord.project = db.projects.find((p: any) => p.id === populatedRecord.projectId);
      }

      return NextResponse.json(normalizeRecord(entity, populatedRecord));
    }

    const modelName = entityMap[entity];
    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    const dbModel: any = prisma[modelName];
    const record = await dbModel.findUnique({
      where: { id },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json(normalizeRecord(entity, record));
  } catch (error: any) {
    console.error(`Error fetching ${params.entity}:`, error);
    return NextResponse.json({ error: `Failed to fetch ${params.entity}` }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { entity: string; id: string } }) {
  let body: any = {};
  let normalizedBody: any = {};
  const { entity, id } = params;

  try {
    body = await request.json();

    if (entity === "projects" && body.costCenter === undefined) {
      body.costCenter = "";
    }

    // 1. Perform validation of required fields
    if (entity === "projects") {
      if (!body.companyId) {
        return NextResponse.json({ error: "Company is required" }, { status: 400 });
      }
      if (!body.projectCode || body.projectCode.trim() === "") {
        return NextResponse.json({ error: "Project Code is required" }, { status: 400 });
      }
      if (!body.projectName || body.projectName.trim() === "") {
        return NextResponse.json({ error: "Project Name is required" }, { status: 400 });
      }
      if (!body.locationId) {
        return NextResponse.json({ error: "Location is required" }, { status: 400 });
      }
    }
    else if (entity === "designations") {
      if (!body.code || body.code.trim() === "") {
        return NextResponse.json({ error: "Designation Code is required" }, { status: 400 });
      }
      if (!body.name || body.name.trim() === "") {
        return NextResponse.json({ error: "Designation Title is required" }, { status: 400 });
      }
    }
    else if (entity === "trade-classifications") {
      if (!body.code || body.code.trim() === "") {
        return NextResponse.json({ error: "Trade Code is required" }, { status: 400 });
      }
      if (!body.name || body.name.trim() === "") {
        return NextResponse.json({ error: "Trade Name is required" }, { status: 400 });
      }
    }
    else if (entity === "cost-centers") {
      if (!body.companyId) {
        return NextResponse.json({ error: "Company is required" }, { status: 400 });
      }
      if (!body.costCenterCode || body.costCenterCode.trim() === "") {
        return NextResponse.json({ error: "Cost Center Code is required" }, { status: 400 });
      }
      if (!body.costCenterName || body.costCenterName.trim() === "") {
        return NextResponse.json({ error: "Cost Center Name is required" }, { status: 400 });
      }
    }
    else if (entity === "leave-types") {
      if (!body.code || body.code.trim() === "") {
        return NextResponse.json({ error: "Leave type code is required" }, { status: 400 });
      }
      if (!body.name || body.name.trim() === "") {
        return NextResponse.json({ error: "Leave type name is required" }, { status: 400 });
      }
    }

    if (entity === "leave-types") {
      try {
        const updated = await mockDb.updateLeaveType(id, body);
        return NextResponse.json(normalizeRecord(entity, updated));
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to update leave type" }, { status: 400 });
      }
    }

    // Normalize payload
    normalizedBody = normalizeMasterPayload(entity, body, true);

    // Validate companyId requirements dynamically if needed
    const requiredCompanyEntities = ["allowed-punch-locations"];
    if (requiredCompanyEntities.includes(entity) && !normalizedBody.companyId) {
      return NextResponse.json({ error: "Company is required" }, { status: 400 });
    }

    // 2. Perform case-insensitive duplicate checks for code fields (excluding self)
    const codeFields: Record<string, string> = {
      companies: "companyCode",
      designations: "code",
      "trade-classifications": "code",
      locations: "locationCode",
      "cost-centers": "costCenterCode",
      projects: "projectCode",
      "project-sites": "siteCode",
      "leave-types": "code",
    };

    const codeField = codeFields[entity];
    const modelName = entityMap[entity];
    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    if (codeField && normalizedBody[codeField]) {
      const codeValue = normalizedBody[codeField];
      if (isDbConnected()) {
        const dbModel: any = prisma[modelName];
        const existing = await dbModel.findFirst({
          where: {
            [codeField]: codeValue,
            id: { not: id } // Exclude self
          }
        });
        if (existing) {
          return NextResponse.json({ error: `${entity.substring(0, entity.length - 1)} code already exists` }, { status: 409 });
        }
      } else {
        const db = readDb();
        const memoryKey = memoryKeyMap[entity];
        const records = (db as any)[memoryKey] || [];
        const existing = records.find((r: any) => r.id !== id && String(r[codeField]).toLowerCase() === String(codeValue).toLowerCase());
        if (existing) {
          return NextResponse.json({ error: `${entity.substring(0, entity.length - 1)} code already exists` }, { status: 409 });
        }
      }
    }

    if (!isDbConnected()) {
      const memoryKey = memoryKeyMap[entity];
      if (!memoryKey) {
        return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
      }

      const db = readDb();
      const records = (db as any)[memoryKey] || [];
      const index = records.findIndex((r: any) => r.id === id);

      if (index === -1) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      // Verify company exists if provided in mock mode
      if (normalizedBody.companyId) {
        const company = db.companies.find((c: any) => c.id === normalizedBody.companyId);
        if (!company) {
          return NextResponse.json({ error: "Invalid company selected" }, { status: 400 });
        }
      }

      const updatedRecord = {
        ...records[index],
        ...normalizedBody,
        updatedAt: new Date().toISOString(),
      };

      records[index] = updatedRecord;
      writeDb(db);

      // Populate relations
      const populatedRecord = { ...updatedRecord };
      if (populatedRecord.companyId) {
        populatedRecord.company = db.companies.find((c: any) => c.id === populatedRecord.companyId);
      }
      if (populatedRecord.projectId) {
        populatedRecord.project = db.projects.find((p: any) => p.id === populatedRecord.projectId);
      }

      return NextResponse.json(normalizeRecord(entity, populatedRecord));
    }

    // Verify company exists if provided in DB mode
    if (normalizedBody.companyId) {
      const company = await prisma.company.findUnique({ where: { id: normalizedBody.companyId } });
      if (!company) {
        return NextResponse.json({ error: "Invalid company selected" }, { status: 400 });
      }
    }

    const dbModel: any = prisma[modelName];
    const updatedRecord = await dbModel.update({
      where: { id },
      data: normalizedBody,
    });

    // Populate company/project relation if needed for UI list displays
    let populatedRecord = { ...updatedRecord };
    if (populatedRecord.companyId) {
      populatedRecord.company = await prisma.company.findUnique({ where: { id: populatedRecord.companyId } });
    }
    if (entity === "project-sites" && populatedRecord.projectId) {
      populatedRecord.project = await prisma.project.findUnique({ where: { id: populatedRecord.projectId } });
    }

    return NextResponse.json(normalizeRecord(entity, populatedRecord));
  } catch (error: any) {
    console.error(`[API ERROR] Failed to update ${entity}:`, {
      entity,
      action: "update",
      incomingPayload: body,
      normalizedPayload: normalizedBody,
      prismaData: normalizedBody,
      errorCode: error.code || undefined,
      errorMessage: error.message,
    });

    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: `${entity.substring(0, entity.length - 1)} code already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: `Failed to update ${entity}: ${error.message}` }, { status: 500 });
  }
}

async function isMasterRecordUsed(entity: string, id: string): Promise<boolean> {
  if (isDbConnected()) {
    try {
      if (entity === "companies") {
        const c1 = await prisma.employee.count({ where: { companyId: id } });
        const c2 = await prisma.department.count({ where: { companyId: id } });
        const c3 = await prisma.project.count({ where: { companyId: id } });
        const c4 = await prisma.locationMaster.count({ where: { companyId: id } });
        const c5 = await prisma.costCenter.count({ where: { companyId: id } });
        return c1 > 0 || c2 > 0 || c3 > 0 || c4 > 0 || c5 > 0;
      }
      if (entity === "departments") {
        const c1 = await prisma.employee.count({ where: { departmentId: id } });
        return c1 > 0;
      }
      if (entity === "designations") {
        const c1 = await prisma.employee.count({ where: { designationId: id } });
        const c2 = await prisma.relieverStandbyRule.count({ where: { designationId: id } });
        return c1 > 0 || c2 > 0;
      }
      if (entity === "trade-classifications") {
        const c1 = await prisma.employee.count({ where: { tradeClassificationId: id } });
        const c2 = await prisma.relieverStandbyRule.count({ where: { tradeClassificationId: id } });
        return c1 > 0 || c2 > 0;
      }
      if (entity === "locations") {
        const c1 = await prisma.employee.count({
          where: { OR: [{ defaultLocationId: id }, { officeLocationId: id }] }
        });
        const c2 = await prisma.project.count({ where: { locationId: id } });
        return c1 > 0 || c2 > 0;
      }
      if (entity === "cost-centers") {
        const c1 = await prisma.employee.count({ where: { costCenterId: id } });
        return c1 > 0;
      }
      if (entity === "projects") {
        const c1 = await prisma.employee.count({ where: { defaultProjectId: id } });
        const c2 = await prisma.projectSite.count({ where: { projectId: id } });
        return c1 > 0 || c2 > 0;
      }
      if (entity === "project-sites") {
        const c1 = await prisma.employee.count({ where: { defaultSiteId: id } });
        const c2 = await prisma.employeeDeployment.count({ where: { siteId: id } });
        const c3 = await prisma.shiftAssignment.count({ where: { siteId: id } });
        return c1 > 0 || c2 > 0 || c3 > 0;
      }
      if (entity === "allowed-punch-locations") {
        const c1 = await prisma.employee.count({ where: { defaultPunchLocationId: id } });
        const c2 = await prisma.employeeAllowedPunchLocation.count({ where: { allowedPunchLocationId: id } });
        return c1 > 0 || c2 > 0;
      }
      if (entity === "leave-types") {
        const c1 = await prisma.leaveRequest.count({ where: { leaveTypeId: id } });
        const c2 = await prisma.leaveBalance.count({ where: { leaveTypeId: id } });
        return c1 > 0 || c2 > 0;
      }
    } catch (err) {
      console.error("isMasterRecordUsed prisma error:", err);
      return true; // fail-safe to prevent delete
    }
  } else {
    const db = readDb();
    if (entity === "companies") {
      return (db.employees || []).some((e: any) => e.companyId === id) ||
             (db.departments || []).some((d: any) => d.companyId === id) ||
             (db.projects || []).some((p: any) => p.companyId === id) ||
             (db.locations || []).some((l: any) => l.companyId === id) ||
             (db.costCenters || []).some((c: any) => c.companyId === id);
    }
    if (entity === "departments") {
      return (db.employees || []).some((e: any) => e.departmentId === id || e.department === id);
    }
    if (entity === "designations") {
      return (db.employees || []).some((e: any) => e.designationId === id) ||
             (db.relieverStandbyRules || []).some((r: any) => r.designationId === id);
    }
    if (entity === "trade-classifications") {
      return (db.employees || []).some((e: any) => e.tradeClassificationId === id) ||
             (db.relieverStandbyRules || []).some((r: any) => r.tradeClassificationId === id);
    }
    if (entity === "locations") {
      return (db.employees || []).some((e: any) => e.defaultLocationId === id || e.officeLocationId === id) ||
             (db.projects || []).some((p: any) => p.locationId === id);
    }
    if (entity === "cost-centers") {
      return (db.employees || []).some((e: any) => e.costCenterId === id);
    }
    if (entity === "projects") {
      return (db.employees || []).some((e: any) => e.defaultProjectId === id) ||
             (db.projectSites || []).some((s: any) => s.projectId === id);
    }
    if (entity === "project-sites") {
      return (db.employees || []).some((e: any) => e.defaultSiteId === id) ||
             (db.deployments || []).some((d: any) => d.siteId === id) ||
             (db.shiftAssignments || []).some((s: any) => s.siteId === id);
    }
    if (entity === "allowed-punch-locations") {
      return (db.employees || []).some((e: any) => e.defaultPunchLocationId === id) ||
             (db.employeeAllowedPunchLocations || []).some((e: any) => e.allowedPunchLocationId === id);
    }
    if (entity === "leave-types") {
      return (db.leaves || []).some((l: any) => l.leaveTypeId === id) ||
             (db.leaveBalances || []).some((b: any) => b.leaveTypeId === id);
    }
  }
  return false;
}

export async function DELETE(request: Request, { params }: { params: { entity: string; id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  // Strict check: Only Admin & Super Admin are allowed to delete master records
  if (!isAdminUser(auth.session?.user)) {
    return NextResponse.json({ error: "Only Admin and Super Admin can delete master data." }, { status: 403 });
  }

  const deletedBy = (auth.session?.user as any)?.id || "admin-system";
  const { entity, id } = params;

  try {
    const inUse = await isMasterRecordUsed(entity, id);

    if (!isDbConnected()) {
      const memoryKey = memoryKeyMap[entity];
      if (!memoryKey) {
        return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
      }

      const db = readDb();
      const records = (db as any)[memoryKey] || [];
      const index = records.findIndex((r: any) => r.id === id);

      if (index === -1) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      if (inUse) {
        const record = records[index];
        if ("isActive" in record) {
          record.isActive = false;
        } else if ("status" in record) {
          record.status = "INACTIVE";
        }

        const newLog = {
          id: `LOG-${Date.now()}`,
          userId: deletedBy,
          action: "MASTER_DEACTIVATE",
          entityType: entity.toUpperCase(),
          entityId: id,
          afterJson: JSON.stringify({ entity, id, deletedBy, action: "DEACTIVATE", reason: "referenced in records" }),
          createdAt: new Date().toISOString(),
          ipAddress: "127.0.0.1",
          userAgent: "API Call"
        };
        db.userActivityLogs = db.userActivityLogs || [];
        db.userActivityLogs.push(newLog);

        writeDb(db);

        return NextResponse.json({
          success: true,
          deactivated: true,
          message: "This master is already used in records. It has been deactivated instead of permanently deleted."
        });
      }

      records.splice(index, 1);

      const newLog = {
        id: `LOG-${Date.now()}`,
        userId: deletedBy,
        action: "MASTER_DELETE",
        entityType: entity.toUpperCase(),
        entityId: id,
        afterJson: JSON.stringify({ entity, id, deletedBy, action: "DELETE" }),
        createdAt: new Date().toISOString(),
        ipAddress: "127.0.0.1",
        userAgent: "API Call"
      };
      db.userActivityLogs = db.userActivityLogs || [];
      db.userActivityLogs.push(newLog);

      writeDb(db);
      return NextResponse.json({ success: true });
    }

    const modelName = entityMap[entity];
    if (!modelName) {
      return NextResponse.json({ error: "Invalid master entity" }, { status: 400 });
    }

    const dbModel: any = (prisma as any)[modelName];

    if (inUse) {
      if (["company", "designation", "tradeClassification", "locationMaster", "costCenter", "allowedPunchLocation", "relieverStandbyRule", "leaveType"].includes(modelName as string)) {
        await dbModel.update({
          where: { id },
          data: { isActive: false }
        });
      } else if (["project", "projectSite"].includes(modelName as string)) {
        await dbModel.update({
          where: { id },
          data: { status: "INACTIVE" }
        });
      }

      await prisma.userActivityLog.create({
        data: {
          id: `LOG-${Date.now()}`,
          userId: deletedBy,
          action: "MASTER_DEACTIVATE",
          entityType: entity.toUpperCase(),
          entityId: id,
          afterJson: JSON.stringify({ entity, id, deletedBy, action: "DEACTIVATE", reason: "referenced in records" }),
          ipAddress: "127.0.0.1",
          userAgent: "API Call"
        }
      });

      return NextResponse.json({
        success: true,
        deactivated: true,
        message: "This master is already used in records. It has been deactivated instead of permanently deleted."
      });
    }

    await dbModel.delete({
      where: { id },
    });

    await prisma.userActivityLog.create({
      data: {
        id: `LOG-${Date.now()}`,
        userId: deletedBy,
        action: "MASTER_DELETE",
        entityType: entity.toUpperCase(),
        entityId: id,
        afterJson: JSON.stringify({ entity, id, deletedBy, action: "DELETE" }),
        ipAddress: "127.0.0.1",
        userAgent: "API Call"
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`Error deleting ${params.entity}:`, error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    if (error.code === "P2003") {
      return NextResponse.json({ error: "Cannot delete record because it is referenced by other records." }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to delete ${params.entity}` }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: { entity: string; id: string } }) {
  return PUT(request, context);
}
