import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { calculateBillingSupportData, createDurableBillingRun } from "@/lib/manpower-billing-support-engine";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const operationType = searchParams.get("operationType") || "SECURITY_GUARDING";

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT"
  });
  if (auth.error) return auth.error;

  const period = searchParams.get("period") || new Date().toISOString().substring(0, 7);
  const clientId = searchParams.get("clientId") || undefined;
  const contractId = searchParams.get("contractId") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  const userId = auth.session?.user?.id || "AD-0001";

  try {
    const { lines, summary } = await calculateBillingSupportData({
      operationType: operationType as any,
      period,
      clientId: clientId === "all" ? undefined : clientId,
      contractId,
      projectId,
      siteId,
      calculatedBy: userId
    });

    return NextResponse.json({
      success: true,
      period,
      operationType,
      summary,
      billingLines: lines
    });
  } catch (error: any) {
    console.error("Failed to generate billing support preview:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;
  
  if (auth.session?.user?.role !== "ADMIN" && auth.session?.user?.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { operationType, period, action, runId } = body;

    if (!operationType || !period) {
      return NextResponse.json({ error: "operationType and period are required" }, { status: 400 });
    }

    if (action === "GENERATE") {
      const run = await createDurableBillingRun({
        operationType,
        period,
        calculatedBy: auth.session.user.id
      });
      return NextResponse.json({ success: true, run });
    }
    
    if (action === "REVIEW" || action === "LOCK") {
      if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
      const run = await prisma.manpowerBillingSupportRun.update({
        where: { id: runId },
        data: {
          status: action === "REVIEW" ? "REVIEWED" : "LOCKED",
          reviewedAt: action === "REVIEW" ? new Date() : undefined,
          reviewedBy: action === "REVIEW" ? auth.session.user.id : undefined,
          lockedAt: action === "LOCK" ? new Date() : undefined,
          lockedBy: action === "LOCK" ? auth.session.user.id : undefined
        }
      });
      return NextResponse.json({ success: true, run });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to execute MP-4 billing action:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
