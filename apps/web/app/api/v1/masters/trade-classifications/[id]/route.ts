import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const classifications = await mockDb.getTradeClassifications();
    const classification = classifications.find(tc => tc.id === params.id);
    if (!classification) {
      return NextResponse.json({ error: "Trade classification not found" }, { status: 404 });
    }
    return NextResponse.json(classification);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch trade classification" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const classification = await mockDb.updateTradeClassification(params.id, payload);
    if (!classification) {
      return NextResponse.json({ error: "Trade classification not found" }, { status: 404 });
    }
    return NextResponse.json(classification);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update trade classification" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const success = await mockDb.deleteTradeClassification(params.id);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete or trade classification not found" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete trade classification" }, { status: 500 });
  }
}
