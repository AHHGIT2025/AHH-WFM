import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET() {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  try {
    const locks = await mockDb.getSecurityOperationsPeriodLocks("SECURITY_GUARDING");
    return NextResponse.json({ success: true, locks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden: Management rights required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { period, locked } = body;

    if (!period || locked === undefined) {
      return NextResponse.json({ error: "Missing period or locked parameter" }, { status: 400 });
    }

    const lockedBy = (auth.session?.user as any)?.id || "admin";
    const lock = await mockDb.lockSecurityOperationsPeriod(period, locked, "SECURITY_GUARDING", lockedBy);

    // Audit log this change
    await mockDb.createUserActivityLog({
      userId: lockedBy,
      action: locked ? "LOCK_PERIOD" : "UNLOCK_PERIOD",
      entityType: "SecurityOperationsPeriodLock",
      entityId: lock?.id || period,
      beforeJson: undefined,
      afterJson: JSON.stringify({ period, locked, operationType: "SECURITY_GUARDING" }),
      ipAddress: undefined,
      userAgent: undefined
    });

    return NextResponse.json({ success: true, lock });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
