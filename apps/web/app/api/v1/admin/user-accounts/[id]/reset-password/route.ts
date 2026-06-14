import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import * as bcrypt from "bcryptjs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { newPassword } = payload;

    if (!newPassword || newPassword.trim().length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);

    const updated = await mockDb.updateEmployee(params.id, { 
      passwordHash: passwordHash,
      mustChangePassword: true, // Force the user to change this temporary password on next login
      passwordUpdatedAt: new Date()
    } as any);

    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { passwordHash: _, ...rest } = updated;
    return NextResponse.json({ message: "Password reset successfully", user: rest });
  } catch (e) {
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
