import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import * as bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Invalid username or password." });
    }

    const employees = await mockDb.getEmployees();
    const employee = employees.find(
      (e: any) => e.email.toLowerCase() === email.toLowerCase() || 
             (e.username && e.username.toLowerCase() === email.toLowerCase())
    );

    if (!employee) {
      return NextResponse.json({ success: false, error: "Invalid username or password." });
    }

    if (employee.isActive === false) {
      return NextResponse.json({ success: false, error: "Your account is inactive. Please contact administrator." });
    }

    if (employee.isLoginEnabled === false) {
      return NextResponse.json({ success: false, error: "Account is disabled. Contact administrator." });
    }

    if (employee.webAccessEnabled === false) {
      return NextResponse.json({ success: false, error: "Web access is not enabled for this user." });
    }

    if (employee.isLocked) {
      return NextResponse.json({ success: false, error: "Account is locked due to too many failed attempts." });
    }

    if (employee.passwordHash) {
      const isPasswordValid = bcrypt.compareSync(password, employee.passwordHash);
      if (!isPasswordValid) {
        return NextResponse.json({ success: false, error: "Invalid username or password." });
      }
    } else {
      return NextResponse.json({ success: false, error: "Invalid username or password." });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Authentication error" });
  }
}
