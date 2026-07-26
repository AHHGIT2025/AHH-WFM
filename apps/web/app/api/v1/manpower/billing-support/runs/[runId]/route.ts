import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  const run = await prisma.manpowerBillingSupportRun.findUnique({
    where: { id: params.runId },
    include: { lines: true }
  });

  if (!run) {
    return NextResponse.json({ success: false, error: "Billing run not found" }, { status: 404 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: run.operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT"
  });
  if (auth.error) return auth.error;

  return NextResponse.json({
    success: true,
    run
  });
}
