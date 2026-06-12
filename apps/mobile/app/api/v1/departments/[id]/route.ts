import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { name } = await request.json();
    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 });
    }

    const depts = await mockDb.getDepartments();
    if (depts.some(d => d.id !== params.id && d.name.toLowerCase() === name.trim().toLowerCase())) {
      return NextResponse.json({ error: "Department name already exists" }, { status: 400 });
    }

    const updatedDept = await mockDb.updateDepartment(params.id, name.trim());
    if (!updatedDept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    return NextResponse.json(updatedDept);
  } catch (e) {
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 });
  }
}
