import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;
  const user = auth.session?.user as any;

  if (!isAdminUser(user) && !hasPermission(user, "settings.audit.view") && !hasPermission(user, "audit.view")) {
    return NextResponse.json({ error: "Forbidden: Audit log access denied" }, { status: 403 });
  }

  try {
    const logs = await mockDb.getUserActivityLogs();
    return NextResponse.json(logs);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch user activity logs" }, { status: 500 });
  }
}
