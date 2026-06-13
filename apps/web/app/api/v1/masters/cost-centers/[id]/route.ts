import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const costCenters = await mockDb.getCostCenters();
    const costCenter = costCenters.find(cc => cc.id === params.id);
    if (!costCenter) {
      return NextResponse.json({ error: "Cost center not found" }, { status: 404 });
    }
    return NextResponse.json(costCenter);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch cost center" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const costCenter = await mockDb.updateCostCenter(params.id, payload);
    if (!costCenter) {
      return NextResponse.json({ error: "Cost center not found" }, { status: 404 });
    }
    return NextResponse.json(costCenter);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update cost center" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const success = await mockDb.deleteCostCenter(params.id);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete or cost center not found" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete cost center" }, { status: 500 });
  }
}
