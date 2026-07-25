import { NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.reconciliation.view" });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const business = searchParams.get("business");
  const scopeType = searchParams.get("scopeType");

  let operationType = "SECURITY_GUARDING";
  if (business === "facility-management" || business === "FACILITY_MANAGEMENT") {
    operationType = "FACILITY_MANAGEMENT";
  }

  try {
    const whereClause: any = {
      operationType,
      status: "ACTIVE"
    };

    if (scopeType) whereClause.scopeType = scopeType;

    const configs = await prisma.reconciliationGracePeriodConfig.findMany({
      where: whereClause,
      include: {
        contract: { select: { id: true, title: true, contractNumber: true } },
        site: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      success: true,
      configs
    });
  } catch (error: any) {
    console.error("GET /api/v1/manpower/scheduling/reconciliation/config Error:", error);
    return NextResponse.json({ error: "Failed to fetch reconciliation configurations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.reconciliation.manageConfig" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const body = await request.json();
    const {
      operationType,
      scopeType,
      contractId,
      projectId,
      siteId,
      shiftKey,
      gracePeriodMinutes = 15,
      noCheckInThresholdMinutes = 30,
      earlyCheckInAllowanceMinutes = 60,
      syncDelayThresholdMinutes = 30,
      attendanceExempt = false,
      effectiveFrom,
      effectiveTo
    } = body;

    if (!operationType || !scopeType) {
      return NextResponse.json({ error: "operationType and scopeType are required." }, { status: 400 });
    }

    const validScopeTypes = ["OPERATION", "CONTRACT", "PROJECT", "SITE", "SHIFT"];
    if (!validScopeTypes.includes(scopeType)) {
      return NextResponse.json({ error: `Invalid scopeType: ${scopeType}` }, { status: 400 });
    }

    // Build deterministic scopeKey
    let scopeKey = `SCOPE:${scopeType}:${operationType}`;
    if (scopeType === "CONTRACT" && contractId) scopeKey = `SCOPE:CONTRACT:${contractId}`;
    if (scopeType === "PROJECT" && projectId) scopeKey = `SCOPE:PROJECT:${projectId}`;
    if (scopeType === "SITE" && siteId) scopeKey = `SCOPE:SITE:${siteId}`;
    if (scopeType === "SHIFT" && shiftKey) scopeKey = `SCOPE:SHIFT:${siteId || contractId || "ANY"}:${shiftKey}`;

    // Find existing active config to version it
    const existing = await prisma.reconciliationGracePeriodConfig.findFirst({
      where: { scopeKey, status: "ACTIVE" }
    });

    const now = new Date();
    const newVersion = existing ? existing.configVersion + 1 : 1;

    let newConfig: any;

    await prisma.$transaction(async (tx) => {
      if (existing) {
        // Supersede previous active config and release activeScopeKey
        await tx.reconciliationGracePeriodConfig.update({
          where: { id: existing.id },
          data: {
            status: "SUPERSEDED",
            activeScopeKey: null,
            supersededAt: now,
            updatedById: user.id
          }
        });
      }

      newConfig = await tx.reconciliationGracePeriodConfig.create({
        data: {
          scopeType,
          scopeKey,
          configVersion: newVersion,
          activeScopeKey: scopeKey, // Active version carries activeScopeKey (@unique)
          status: "ACTIVE",
          operationType,
          contractId: contractId || null,
          projectId: projectId || null,
          siteId: siteId || null,
          shiftKey: shiftKey || null,
          gracePeriodMinutes,
          noCheckInThresholdMinutes,
          earlyCheckInAllowanceMinutes,
          syncDelayThresholdMinutes,
          attendanceExempt: !!attendanceExempt,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          createdById: user.id
        }
      });
    });

    return NextResponse.json({
      success: true,
      config: newConfig
    }, { status: 201 });

  } catch (error: any) {
    console.error("POST /api/v1/manpower/scheduling/reconciliation/config Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create configuration." }, { status: 500 });
  }
}
