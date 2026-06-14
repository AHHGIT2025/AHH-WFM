import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { currentPassword, newPassword } = payload;

    if (!newPassword || newPassword.trim().length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    const employees = await mockDb.getEmployees();
    const employee = employees.find(e => e.id === (session.user as any).id);

    if (!employee || !employee.passwordHash) {
      return NextResponse.json({ error: "User or password not found" }, { status: 404 });
    }

    // Verify current password
    const isPasswordValid = bcrypt.compareSync(currentPassword, employee.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }

    const newPasswordHash = bcrypt.hashSync(newPassword, 10);

    const updated = await mockDb.updateEmployee(employee.id, { 
      passwordHash: newPasswordHash,
      mustChangePassword: false,
      passwordUpdatedAt: new Date()
    } as any);

    if (!updated) return NextResponse.json({ error: "User update failed" }, { status: 500 });

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (e) {
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
