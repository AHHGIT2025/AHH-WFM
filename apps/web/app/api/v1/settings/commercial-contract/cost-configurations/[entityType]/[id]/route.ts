// GET  /api/v1/settings/commercial-contract/cost-configurations/[entityType]/[id]  – master detail
// GET list of versions
import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth, getTable, safeError } from "@/lib/server/pc2a-shared";

export async function GET(
  req: Request,
  { params }: { params: { entityType: string; id: string } }
) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "precontract.costConfig.view" });
    if (auth.error) return auth.error;
    const user = auth.session!.user as any;

    let tbl: ReturnType<typeof getTable>;
    try { tbl = getTable(params.entityType); } catch (e) { return safeError(e) as any; }

    const record = await (prisma as any)[tbl.master].findUnique({
      where: { id: params.id },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });

    if (!record) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (record.companyId && user.companyId && record.companyId !== user.companyId) {
      return NextResponse.json({ success: false, error: "Forbidden: wrong company" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (err) {
    return safeError(err) as any;
  }
}
