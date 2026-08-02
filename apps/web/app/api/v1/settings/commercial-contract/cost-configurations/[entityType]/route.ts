// GET  /api/v1/settings/commercial-contract/cost-configurations/[entityType]
// POST /api/v1/settings/commercial-contract/cost-configurations/[entityType]
import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import {
  checkApiAuth, getTable, parseBody, writeAudit, safeError, PaginationSchema,
  CategoryMasterSchema, ElementMasterSchema, DriverMasterSchema,
  RateCardMasterSchema, FormulaMasterSchema, PackageMasterSchema,
} from "@/lib/server/pc2a-shared";

const MASTER_SCHEMAS: Record<string, any> = {
  categories: CategoryMasterSchema,
  elements:   ElementMasterSchema,
  drivers:    DriverMasterSchema,
  "rate-cards": RateCardMasterSchema,
  formulas:   FormulaMasterSchema,
  packages:   PackageMasterSchema,
};

export async function GET(
  req: Request,
  { params }: { params: { entityType: string } }
) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "settings.view" });
    if (auth.error) return auth.error;
    const user = auth.session!.user as any;

    let tbl: ReturnType<typeof getTable>;
    try { tbl = getTable(params.entityType); } catch (e) { return safeError(e) as any; }

    const { searchParams } = new URL(req.url);
    const { data: q } = PaginationSchema.safeParse(Object.fromEntries(searchParams)) as any;
    const page  = q?.page  ?? 1;
    const limit = q?.limit ?? 20;

    const where: any = {};
    if (user.companyId) where.companyId = user.companyId;

    const [total, records] = await Promise.all([
      (prisma as any)[tbl.master].count({ where }),
      (prisma as any)[tbl.master].findMany({
        where,
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ success: true, data: records, meta: { total, page, limit } });
  } catch (err) {
    return safeError(err) as any;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { entityType: string } }
) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "settings.manage" });
    if (auth.error) return auth.error;
    const user = auth.session!.user as any;

    let tbl: ReturnType<typeof getTable>;
    try { tbl = getTable(params.entityType); } catch (e) { return safeError(e) as any; }

    const schema = MASTER_SCHEMAS[params.entityType];
    if (!schema) return NextResponse.json({ success: false, error: "Invalid entity type" }, { status: 400 });

    const body = await req.json();
    const parsed = parseBody(schema, body);
    if ("error" in parsed) return parsed.error as any;

    const bodyData = parsed.data as any;
    const data = { ...bodyData, createdBy: user.id, companyId: user.companyId ?? bodyData.companyId };

    const record = await (prisma as any)[tbl.master].create({ data });
    await writeAudit(user.id, `CREATE_${tbl.entityLabel.toUpperCase()}`, tbl.entityLabel, record.id, { code: data.code });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ success: false, error: "A record with this code already exists" }, { status: 409 });
    }
    return safeError(err) as any;
  }
}
