import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { runPilotStage1, runPilotStage2, runPilotStage3 } from "@/lib/secfac-pilot-runner";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { operationType, stage, pilotProjectCode, approvedRecipientEmail } = body;

  const op = operationType || "SECURITY_GUARDING";
  if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(op)) {
    return NextResponse.json({ error: "Explicit valid operationType parameter is required." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: op as any,
    requiredPermission: "secfac.workers.manage"
  });
  if (auth.error) return auth.error;

  try {
    const stage1 = await runPilotStage1(op as any, pilotProjectCode || "PROJ-SEC-01");
    const stage2 = await runPilotStage2(op as any);
    const stage3 = await runPilotStage3(op as any, approvedRecipientEmail || "pilot.supervisor@alhattab.com.qa");

    return NextResponse.json({
      operationType: op,
      executedAt: new Date().toISOString(),
      stage1,
      stage2,
      stage3,
      flags: {
        SECFAC_EVALUATION_WORKER_ENABLED: process.env.SECFAC_EVALUATION_WORKER_ENABLED || "false",
        SECFAC_NOTIFICATION_WORKER_ENABLED: process.env.SECFAC_NOTIFICATION_WORKER_ENABLED || "false",
        SECFAC_EMAIL_ENABLED: process.env.SECFAC_EMAIL_ENABLED || "false",
        SECFAC_PUSH_ENABLED: process.env.SECFAC_PUSH_ENABLED || "false",
        SECFAC_WHATSAPP_ENABLED: process.env.SECFAC_WHATSAPP_ENABLED || "false",
        SECFAC_SMS_ENABLED: process.env.SECFAC_SMS_ENABLED || "false"
      }
    });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/pilot/run error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
