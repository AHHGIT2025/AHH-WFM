import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const departments = await mockDb.getDepartments();
    return NextResponse.json(departments);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { name } = await request.json();
    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 });
    }

    const depts = await mockDb.getDepartments();
    if (depts.some(d => d.name.toLowerCase() === name.trim().toLowerCase())) {
      return NextResponse.json({ error: "Department name already exists" }, { status: 400 });
    }

    const newDept = await mockDb.createDepartment(name.trim());
    return NextResponse.json(newDept);
  } catch (e) {
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
  }
}
