import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;
  
  const userId = (auth.session?.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employees = await mockDb.getEmployees();
  const employee = employees.find((e) => e.id === userId);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: employee.id,
    employeeId: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    profilePhotoUrl: employee.profilePhotoUrl,
    profilePhotoUpdatedAt: employee.profilePhotoUpdatedAt
  });
}
