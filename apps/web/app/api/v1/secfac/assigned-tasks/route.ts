import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const employeeId = user.id;

  if (!employeeId) {
    return NextResponse.json({ success: false, error: "Employee ID not found in session" }, { status: 400 });
  }

  try {
    const tasks = await mockDb.getSecfacAssignedTasks(employeeId);
    return NextResponse.json({ success: true, data: tasks });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to load assigned tasks", error: error.message }, { status: 500 });
  }
}
