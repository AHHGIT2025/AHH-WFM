import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const { requestId, remarks } = await request.json();
    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    const approverEmail = auth.session?.user?.email || "system@ahh.com";
    const result = await mockDb.rejectLeaveRequest(requestId, remarks || "", approverEmail);
    if (!result) {
      return NextResponse.json({ error: "Leave request not found or failed to reject" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to reject leave request" }, { status: 500 });
  }
}
