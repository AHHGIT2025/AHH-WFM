import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  const session = await getServerSession(authOptions);
  const reviewedBy = session?.user?.name || "System Admin";

  try {
    const payload = await request.json();
    if (!payload.status || (payload.status !== "Approved" && payload.status !== "Rejected")) {
      return NextResponse.json({ error: "Valid status ('Approved' or 'Rejected') is required" }, { status: 400 });
    }
    const updated = await mockDb.reviewCorrection(
      params.id,
      payload.status,
      reviewedBy,
      payload.reviewNotes || undefined
    );
    if (!updated) {
      return NextResponse.json({ error: "Correction request not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to review correction request" }, { status: 500 });
  }
}
