// POST /api/v1/settings/commercial-contract/cost-configurations/effective-resolution
// Resolves the ACTIVE version for a given master + effective date
import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth, getTable, parseBody, safeError, EffectiveResolutionSchema, ENTITY_TYPE_MAP } from "@/lib/server/pc2a-shared";

// Map entityType string (CATEGORY etc.) back to slug (categories etc.)
const TYPE_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(ENTITY_TYPE_MAP).map(([slug, type]) => [type, slug])
);

export async function POST(req: Request) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "precontract.costConfig.view" });
    if (auth.error) return auth.error;
    const user = auth.session!.user as any;

    const body = await req.json();
    const parsed = parseBody(EffectiveResolutionSchema, body);
    if ("error" in parsed) return parsed.error as any;

    const { entityType, masterId, effectiveDate } = parsed.data;
    const slug = TYPE_TO_SLUG[entityType];
    if (!slug) return NextResponse.json({ success: false, error: "Invalid entity type" }, { status: 400 });

    let tbl: ReturnType<typeof getTable>;
    try { tbl = getTable(slug); } catch (e) { return safeError(e) as any; }

    // Verify master exists and company isolation
    const master = await (prisma as any)[tbl.master].findUnique({ where: { id: masterId } });
    if (!master) return NextResponse.json({ success: false, error: "Master record not found" }, { status: 404 });
    if (master.companyId && user.companyId && master.companyId !== user.companyId) {
      return NextResponse.json({ success: false, error: "Forbidden: wrong company" }, { status: 403 });
    }

    // Find ACTIVE version where effectiveFrom <= effectiveDate < effectiveTo (null = open-ended)
    const allActives = await (prisma as any)[tbl.version].findMany({
      where: { masterId, status: "ACTIVE" },
    });

    const date = new Date(effectiveDate).getTime();
    const matches = allActives.filter((v: any) => {
      const from = v.effectiveFrom.getTime();
      const to   = v.effectiveTo ? v.effectiveTo.getTime() : Infinity;
      return from <= date && date < to;
    });

    if (matches.length === 0) {
      return NextResponse.json(
        { success: false, error: "No ACTIVE version found for the given effective date" },
        { status: 404 }
      );
    }

    if (matches.length > 1) {
      return NextResponse.json(
        { success: false, error: "Ambiguous: multiple ACTIVE versions match the given effective date" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, data: matches[0] });
  } catch (err) {
    return safeError(err) as any;
  }
}
