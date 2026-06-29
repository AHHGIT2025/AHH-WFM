import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const categories = await mockDb.getManpowerCategories("FACILITY_MANAGEMENT");
    return NextResponse.json(categories);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.name || !payload.code) {
      return NextResponse.json({ error: "Name and Code are required" }, { status: 400 });
    }
    const category = await mockDb.createManpowerCategory({
      ...payload,
      operationType: "FACILITY_MANAGEMENT"
    });
    return NextResponse.json(category);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create category" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }
    const { id, ...updates } = payload;
    const category = await mockDb.updateManpowerCategory(id, updates);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json(category);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update category" }, { status: 500 });
  }
}
