import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";
import * as bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required",
          error: "Authentication required"
        },
        { status: 401 }
      );
    }

    const payload = await request.json();
    const { currentPassword, newPassword, confirmPassword } = payload;

    // Body validation
    if (!currentPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Current password is required",
          error: "Current password is required"
        },
        { status: 400 }
      );
    }

    if (!newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "New password is required",
          error: "New password is required"
        },
        { status: 400 }
      );
    }

    // confirmPassword validation if provided
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "New password and confirm password do not match",
          error: "New password and confirm password do not match"
        },
        { status: 400 }
      );
    }

    // Password policy check
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (newPassword.length < 8 || !hasLetter || !hasNumber) {
      return NextResponse.json(
        {
          success: false,
          message: "New password must be at least 8 characters and include at least one letter and one number",
          error: "New password must be at least 8 characters and include at least one letter and one number"
        },
        { status: 400 }
      );
    }

    const employees = await mockDb.getEmployees();
    const employeeId = (session.user as any).id;
    const employee = employees.find((e) => e.id === employeeId);

    if (!employee || !employee.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to change password. Please try again later.",
          error: "User or password not found"
        },
        { status: 404 }
      );
    }

    // Verify current password
    const isPasswordValid = bcrypt.compareSync(currentPassword, employee.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Current password is incorrect",
          error: "Current password is incorrect"
        },
        { status: 400 }
      );
    }

    // Securely hash and update
    const hashed = bcrypt.hashSync(newPassword, 10);
    const updated = await mockDb.updateEmployee(employee.id, {
      passwordHash: hashed,
      mustChangePassword: false,
      passwordUpdatedAt: new Date().toISOString()
    } as any);

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to change password. Please try again later.",
          error: "User update failed"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Unable to change password. Please try again later.",
        error: e.message || "Internal server error"
      },
      { status: 500 }
    );
  }
}
