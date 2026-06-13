import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const category = await mockDb.updateBlueCollarPositionCategory(params.id, payload);
    if (!category) return NextResponse.json({ error: "Position category not found" }, { status: 404 });
    return NextResponse.json(category);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update position category" }, { status: 500 });
  }
}
