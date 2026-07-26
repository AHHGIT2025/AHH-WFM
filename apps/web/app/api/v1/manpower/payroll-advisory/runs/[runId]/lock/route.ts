import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(req: NextRequest, { params }: { params: { runId: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.advisory.lock" });
  if (auth.error) return auth.error;
  const user = auth.session.user;

  const run = await prisma.manpowerPayrollAdvisoryRun.findUnique({
    where: { id: params.runId }
  });

  if (!run) {
    return NextResponse.json({ error: "Payroll advisory run not found" }, { status: 404 });
  }

  if (run.status === "LOCKED" || run.status === "EXPORTED") {
    return NextResponse.json({ error: "Run is already locked or exported" }, { status: 400 });
  }

  const updated = await prisma.manpowerPayrollAdvisoryRun.update({
    where: { id: params.runId },
    data: {
      status: "LOCKED",
      lockedBy: user.id,
      lockedAt: new Date()
    }
  });

  try {
    await prisma.userActivityLog.create({
      data: {
        userId: user.id,
        action: "LOCK_PAYROLL_ADVISORY_RUN",
        entityType: "ManpowerPayrollAdvisoryRun",
        entityId: run.id,
        afterJson: JSON.stringify({ runCode: run.runCode, status: "LOCKED" })
      }
    });
  } catch (e) {}

  return NextResponse.json({ success: true, run: updated });
}
