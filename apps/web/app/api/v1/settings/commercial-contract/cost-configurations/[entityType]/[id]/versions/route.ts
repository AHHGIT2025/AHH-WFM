// GET  /api/v1/.../[entityType]/[id]/versions         – list versions
// POST /api/v1/.../[entityType]/[id]/versions         – create draft version
import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import {
  checkApiAuth, getTable, parseBody, writeAudit, safeError,
  CategoryVersionSchema, ElementVersionSchema, DriverVersionSchema,
  RateCardVersionSchema, FormulaVersionSchema, PackageVersionSchema,
} from "@/lib/server/pc2a-shared";

const VERSION_SCHEMAS: Record<string, any> = {
  categories:   CategoryVersionSchema,
  elements:     ElementVersionSchema,
  drivers:      DriverVersionSchema,
  "rate-cards": RateCardVersionSchema,
  formulas:     FormulaVersionSchema,
  packages:     PackageVersionSchema,
};

export async function GET(
  req: Request,
  { params }: { params: { entityType: string; id: string } }
) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "precontract.costConfig.view" });
    if (auth.error) return auth.error;

    let tbl: ReturnType<typeof getTable>;
    try { tbl = getTable(params.entityType); } catch (e) { return safeError(e) as any; }

    const versions = await (prisma as any)[tbl.version].findMany({
      where: { masterId: params.id },
      orderBy: { versionNumber: "desc" },
    });

    return NextResponse.json({ success: true, data: versions });
  } catch (err) {
    return safeError(err) as any;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { entityType: string; id: string } }
) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "precontract.costConfig.manage" });
    if (auth.error) return auth.error;
    const user = auth.session!.user as any;

    let tbl: ReturnType<typeof getTable>;
    try { tbl = getTable(params.entityType); } catch (e) { return safeError(e) as any; }

    // Ensure master exists
    const master = await (prisma as any)[tbl.master].findUnique({ where: { id: params.id } });
    if (!master) return NextResponse.json({ success: false, error: "Master record not found" }, { status: 404 });

    // Enforce company isolation
    if (master.companyId && user.companyId && master.companyId !== user.companyId) {
      return NextResponse.json({ success: false, error: "Forbidden: wrong company" }, { status: 403 });
    }

    // Enforce SG/FM scope isolation
    if (master.operationType) {
      const opAccess = (user as any).operationAccess || {};
      const sg = opAccess.allowedSecurityGuarding;
      const fm = opAccess.allowedFacilityManagement;
      if (master.operationType === "SECURITY_GUARDING" && !sg) {
        return NextResponse.json({ success: false, error: "Forbidden: no Security Guarding access" }, { status: 403 });
      }
      if (master.operationType === "FACILITY_MANAGEMENT" && !fm) {
        return NextResponse.json({ success: false, error: "Forbidden: no Facility Management access" }, { status: 403 });
      }
    }

    // Check no existing DRAFT or UNDER_REVIEW
    const existingOpen = await (prisma as any)[tbl.version].findFirst({
      where: { masterId: params.id, status: { in: ["DRAFT", "UNDER_REVIEW"] } },
    });
    if (existingOpen) {
      return NextResponse.json(
        { success: false, error: "Cannot create draft while a DRAFT or UNDER_REVIEW version already exists" },
        { status: 409 }
      );
    }

    const schema = VERSION_SCHEMAS[params.entityType];
    if (!schema) return NextResponse.json({ success: false, error: "Invalid entity type" }, { status: 400 });

    const body = await req.json();
    // Remove masterId from body – take from route param
    const { masterId: _ignored, ...rest } = body;
    const parsed = parseBody(schema.omit ? schema : schema, { ...rest, masterId: params.id });
    if ("error" in parsed) return parsed.error as any;

    const lastVersion = await (prisma as any)[tbl.version].findFirst({
      where: { masterId: params.id },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    // Extract package items separately
    const { items, ...versionData } = parsed.data as any;

    const newVersion = await (prisma as any)[tbl.version].create({
      data: {
        ...versionData,
        masterId: params.id,
        versionNumber,
        status: "DRAFT",
        createdBy: user.id,
      },
    });

    // Package items
    if (params.entityType === "packages" && Array.isArray(items)) {
      if (items.length > 200) {
        // rollback version then return 409
        await (prisma as any)[tbl.version].delete({ where: { id: newVersion.id } });
        return NextResponse.json({ success: false, error: "Package cannot exceed 200 items" }, { status: 409 });
      }
      await prisma.costPackageItem.createMany({
        data: items.map((it: any) => ({ ...it, packageVersionId: newVersion.id })),
      });
    }

    await writeAudit(user.id, `DRAFT_CREATED`, tbl.entityLabel, newVersion.id, {
      masterId: params.id, versionNumber,
    });

    return NextResponse.json({ success: true, data: newVersion }, { status: 201 });
  } catch (err) {
    return safeError(err) as any;
  }
}
