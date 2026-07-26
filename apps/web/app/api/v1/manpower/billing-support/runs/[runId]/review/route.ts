import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(req: NextRequest, { params }: { params: { runId: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.advisory.review" });
  if (auth.error) return auth.error;
  const user = auth.session.user;

  const run = await prisma.manpowerBillingSupportRun.findUnique({
    where: { id: params.runId }
  });

  if (!run) {
    return NextResponse.json({ error: "Billing support run not found" }, { status: 404 });
  }

  if (run.status === "LOCKED" || run.status === "EXPORTED") {
    return NextResponse.json({ error: "Cannot review a locked or exported run" }, { status: 400 });
  }

  const updated = await prisma.manpowerBillingSupportRun.update({
    where: { id: params.runId },
    data: {
      status: "REVIEWED",
      reviewedBy: user.id,
      reviewedAt: new Date()
    }
  });

  try {
    await prisma.userActivityLog.create({
      data: {
        userId: user.id,
        action: "REVIEW_BILLING_SUPPORT_RUN",
        entityType: "ManpowerBillingSupportRun",
        entityId: run.id,
        afterJson: JSON.stringify({ runCode: run.runCode, status: "REVIEWED" })
      }
    });
  } catch (e) {}

  return NextResponse.json({ success: true, run: updated });
}
