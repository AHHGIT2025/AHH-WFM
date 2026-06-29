import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import * as bcrypt from "bcryptjs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (!hasPermission(user, "users.manage")) {
    return NextResponse.json({ error: "Forbidden: Requires users.manage permission" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { tempPassword, forceChange } = payload;

    if (!tempPassword || tempPassword.trim().length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    const passwordHash = bcrypt.hashSync(tempPassword, 10);

    const updated = await mockDb.updateEmployee(params.id, { 
      passwordHash: passwordHash,
      mustChangePassword: forceChange !== undefined ? forceChange : true,
      passwordUpdatedAt: new Date()
    } as any);

    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { passwordHash: _, ...rest } = updated;
    return NextResponse.json({ message: "Password reset successfully", user: rest, tempPassword });
  } catch (e) {
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
