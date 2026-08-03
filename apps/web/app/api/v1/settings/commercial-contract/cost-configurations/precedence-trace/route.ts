// POST /api/v1/settings/commercial-contract/cost-configurations/precedence-trace
// Resolves ACTIVE Rate Card versions by dimension specificity. Returns trace with candidates.
import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth, parseBody, safeError, PrecedenceTraceSchema } from "@/lib/server/pc2a-shared";

interface Candidate {
  version: any;
  specificity: number;
  matchedDimensions: string[];
  unmatchedDimensions: string[];
  rejectionReason: string | null;
}

export async function POST(req: Request) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "precontract.costConfig.view" });
    if (auth.error) return auth.error;
    const user = auth.session!.user as any;

    const body = await req.json();
    const parsed = parseBody(PrecedenceTraceSchema, body);
    if ("error" in parsed) return parsed.error as any;

    const { companyId, operationType, effectiveDate, currency } = parsed.data;

    // Company isolation – requester must belong to this company or be admin
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes((user.role ?? "").toUpperCase());
    if (!isAdmin && user.companyId && user.companyId !== companyId) {
      return NextResponse.json({ success: false, error: "Forbidden: wrong company" }, { status: 403 });
    }

    // SG/FM isolation
    const opAccess = user.operationAccess || {};
    if (!isAdmin) {
      if (operationType === "SECURITY_GUARDING" && !opAccess.allowedSecurityGuarding) {
        return NextResponse.json({ success: false, error: "Forbidden: no Security Guarding access" }, { status: 403 });
      }
      if (operationType === "FACILITY_MANAGEMENT" && !opAccess.allowedFacilityManagement) {
        return NextResponse.json({ success: false, error: "Forbidden: no Facility Management access" }, { status: 403 });
      }
    }

    const date = new Date(effectiveDate).getTime();

    // Pull all ACTIVE Rate Card versions for this company scope
    const masters = await (prisma as any).costRateCardMaster.findMany({
      where: { companyId },
      include: {
        versions: {
          where: { status: "ACTIVE" },
        },
      },
    });

    const candidates: Candidate[] = [];

    for (const master of masters) {
      for (const version of master.versions) {
        const from = version.effectiveFrom.getTime();
        const to   = version.effectiveTo ? version.effectiveTo.getTime() : Infinity;

        if (from > date || date >= to) {
          candidates.push({
            version: { id: version.id, masterId: master.id, versionNumber: version.versionNumber },
            specificity: 0,
            matchedDimensions: [],
            unmatchedDimensions: ["effectiveDate"],
            rejectionReason: "Effective date outside version range",
          });
          continue;
        }

        const matched: string[] = ["effectiveDate"];
        const unmatched: string[] = [];
        let specificity = 1;

        // Currency dimension
        if (currency) {
          if (master.currency === currency) {
            matched.push("currency");
            specificity += 2;
          } else {
            unmatched.push("currency");
          }
        }

        // OperationType dimension – stored on master for Rate Cards via company scope
        // (Rate Card master does not store operationType directly in this schema)
        matched.push("companyId");
        specificity += 4;

        candidates.push({
          version: { id: version.id, masterId: master.id, versionNumber: version.versionNumber, currency: master.currency },
          specificity,
          matchedDimensions: matched,
          unmatchedDimensions: unmatched,
          rejectionReason: null,
        });
      }
    }

    const eligible = candidates.filter(c => c.rejectionReason === null);
    const maxSpec  = eligible.reduce((m, c) => Math.max(m, c.specificity), 0);
    const top      = eligible.filter(c => c.specificity === maxSpec);

    if (top.length === 0) {
      return NextResponse.json({
        success: true,
        data: { selected: null, ambiguous: false, candidates, message: "No matching ACTIVE Rate Card found" },
      });
    }

    if (top.length > 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Ambiguous: multiple Rate Card versions share equal highest specificity",
          data: { selected: null, ambiguous: true, candidates, topCandidates: top },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { selected: top[0].version, ambiguous: false, candidates, specificityScore: top[0].specificity },
    });
  } catch (err) {
    return safeError(err) as any;
  }
}
