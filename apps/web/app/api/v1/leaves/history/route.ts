import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || url.searchParams.get("requestId");
  if (!id) {
    return NextResponse.json({ error: "Missing id or requestId parameter" }, { status: 400 });
  }

  try {
    const history = await mockDb.getLeaveApprovalHistory(id);
    return NextResponse.json(history);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch leave approval history" }, { status: 500 });
  }
}
