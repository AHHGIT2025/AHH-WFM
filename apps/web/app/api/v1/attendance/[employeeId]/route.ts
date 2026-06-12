import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

interface RouteParams {
  params: {
    employeeId: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const allRecords = await mockDb.getAttendance();
    const records = allRecords.filter((r) => r.employeeId === params.employeeId);
    return NextResponse.json(records);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 });
  }
}
