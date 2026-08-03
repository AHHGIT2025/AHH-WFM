// GET   /api/v1/.../[entityType]/[id]/versions/[versionId]   – version detail
// PATCH /api/v1/.../[entityType]/[id]/versions/[versionId]   – update DRAFT
import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import {
  checkApiAuth, getTable, parseBody, writeAudit, safeError,
  CategoryVersionSchema, ElementVersionSchema, DriverVersionSchema,
  RateCardVersionSchema, FormulaVersionSchema, PackageVersionSchema,
} from "@/lib/server/pc2a-shared";

const VERSION_SCHEMAS: Record<string, any> = {
  categories:   CategoryVersionSchema.partial(),
  elements:     ElementVersionSchema.partial(),
  drivers:      DriverVersionSchema.partial(),
  "rate-cards": RateCardVersionSchema.partial(),
  formulas:     FormulaVersionSchema.partial(),
  packages:     PackageVersionSchema.partial(),
};

export async function GET(
  req: Request,
  { params }: { params: { entityType: string; id: string; versionId: string } }
) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "precontract.costConfig.view" });
    if (auth.error) return auth.error;

    let tbl: ReturnType<typeof getTable>;
    try { tbl = getTable(params.entityType); } catch (e) { return safeError(e) as any; }

    const version = await (prisma as any)[tbl.version].findUnique({
      where: { id: params.versionId },
    });
    if (!version || version.masterId !== params.id) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // Include package items if relevant
    let data: any = version;
    if (params.entityType === "packages") {
      const items = await prisma.costPackageItem.findMany({
        where: { packageVersionId: params.versionId },
      });
      data = { ...version, items };
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return safeError(err) as any;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { entityType: string; id: string; versionId: string } }
) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "precontract.costConfig.manage" });
    if (auth.error) return auth.error;
    const user = auth.session!.user as any;

    let tbl: ReturnType<typeof getTable>;
    try { tbl = getTable(params.entityType); } catch (e) { return safeError(e) as any; }

    const version = await (prisma as any)[tbl.version].findUnique({ where: { id: params.versionId } });
    if (!version || version.masterId !== params.id) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (version.status !== "DRAFT") {
      return NextResponse.json({ success: false, error: "Only DRAFT versions can be updated" }, { status: 409 });
    }

    const schema = VERSION_SCHEMAS[params.entityType];
    if (!schema) return NextResponse.json({ success: false, error: "Invalid entity type" }, { status: 400 });

    const body = await req.json();
    const parsed = parseBody(schema, body);
    if ("error" in parsed) return parsed.error as any;

    const { masterId: _m, versionNumber: _v, status: _s, createdBy: _c, ...safeUpdate } = parsed.data as any;

    const updated = await (prisma as any)[tbl.version].update({
      where: { id: params.versionId },
      data: safeUpdate,
    });

    await writeAudit(user.id, "DRAFT_UPDATED", tbl.entityLabel, params.versionId, { fields: Object.keys(safeUpdate) });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return safeError(err) as any;
  }
}
