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
    const requirements = await mockDb.getManpowerShiftRequirements("FACILITY_MANAGEMENT");
    return NextResponse.json(requirements);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch shift requirements" }, { status: 500 });
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
    if (!payload.siteId || !payload.categoryId || !payload.shiftCode || !payload.requiredCount) {
      return NextResponse.json({ error: "Site, Category, Shift Code, and Required Count are required" }, { status: 400 });
    }
    const requirement = await mockDb.createManpowerShiftRequirement({
      ...payload,
      operationType: "FACILITY_MANAGEMENT"
    });
    return NextResponse.json(requirement);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create requirement" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Requirement ID is required" }, { status: 400 });
    }
    await mockDb.deleteManpowerShiftRequirement(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete requirement" }, { status: 500 });
  }
}
