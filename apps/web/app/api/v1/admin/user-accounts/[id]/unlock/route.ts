import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (!hasPermission(user, "users.manage")) {
    return NextResponse.json({ error: "Forbidden: Requires users.manage permission" }, { status: 403 });
  }

  try {
    const employees = await mockDb.getEmployees();
    const targetEmp = employees.find(e => e.id === params.id);
    if (!targetEmp) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const callerRole = (user.role || "").trim().toUpperCase().replace(/\s+/g, "_");
    const targetRole = (targetEmp.role || "").trim().toUpperCase().replace(/\s+/g, "_");

    if (targetRole === "SUPER_ADMIN" && callerRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only SUPER_ADMIN can unlock a SUPER_ADMIN account" },
        { status: 403 }
      );
    }

    if (targetRole === "ADMIN" && callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN or SUPER_ADMIN can unlock an ADMIN account" },
        { status: 403 }
      );
    }

    const updated = await mockDb.updateEmployee(params.id, { isLocked: false, failedLoginAttempts: 0 } as any);
    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

    try {
      await mockDb.createUserActivityLog({
        userId: user.id || "admin-system",
        action: "USER_ACCOUNT_UNLOCKED",
        entityType: "USER_ACCOUNT",
        entityId: params.id,
        afterJson: JSON.stringify({ targetUserId: params.id, isLocked: false, unlockedBy: user.id })
      });
    } catch {
      // Non-blocking audit log fallback
    }

    const { passwordHash, ...rest } = updated;
    return NextResponse.json({ message: "Account unlocked", user: rest });
  } catch (e) {
    return NextResponse.json({ error: "Failed to unlock account" }, { status: 500 });
  }
}
