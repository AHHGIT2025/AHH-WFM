import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { exportPayrollAdvisoryRunCsv } from "@/lib/manpower-advisory-export";

export async function POST(
  request: Request,
  { params }: { params: { runId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const userId = auth.session?.user?.id || "AD-0001";
  const userEmail = auth.session?.user?.email || "user@alhattab.qa";

  try {
    const { csv, run } = await exportPayrollAdvisoryRunCsv({
      runId: params.runId,
      actorId: userId,
      actorEmail: userEmail
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll_advisory_${run.operationType}_${run.period}_v${run.version}.csv"`
      }
    });
  } catch (error: any) {
    console.error("Failed to export payroll advisory run:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
