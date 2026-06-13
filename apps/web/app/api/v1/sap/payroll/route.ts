import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const stages = await mockDb.getSapPayrollStages();
    const locks = await mockDb.getSapPayrollPeriodLocks();
    return NextResponse.json({ stages, locks });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch payroll data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.action || !body.period) {
      return NextResponse.json({ error: "Missing required parameters: action and period" }, { status: 400 });
    }

    if (body.action === "stage") {
      const stages = await mockDb.stageSapPayrollPeriod(body.period);
      return NextResponse.json({ success: true, data: stages });
    }

    if (body.action === "lock") {
      if (body.locked === undefined) {
        return NextResponse.json({ error: "Missing parameter: locked" }, { status: 400 });
      }
      const lock = await mockDb.lockSapPayrollPeriod(body.period, body.locked, (auth.session?.user as any)?.id || "ADMIN");
      return NextResponse.json({ success: true, data: lock });
    }

    if (body.action === "export") {
      if (!body.connectionId) {
        return NextResponse.json({ error: "Missing parameter: connectionId" }, { status: 400 });
      }
      const stages = await mockDb.exportSapPayrollPeriod(body.period, body.connectionId);
      return NextResponse.json({ success: true, count: stages.length, data: stages });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to execute payroll action" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.id || body.isApproved === undefined) {
      return NextResponse.json({ error: "Missing parameters: id and isApproved" }, { status: 400 });
    }

    const updated = await mockDb.approveSapPayrollStage(body.id, body.isApproved);
    if (!updated) {
      return NextResponse.json({ error: "Payroll staging record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update payroll stage item" }, { status: 500 });
  }
}
