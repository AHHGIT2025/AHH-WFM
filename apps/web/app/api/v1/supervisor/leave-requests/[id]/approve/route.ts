import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { canApproveLeave } from "@/lib/supervisor";
import { mockDb } from "@ahh-wfm/mock-data";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["SUPERVISOR", "ADMIN"]);
  if (auth.error) return auth.error;

  try {
    if (!auth.session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supervisorId = (auth.session.user as any).id;
    const isAuthorized = await canApproveLeave(supervisorId, params.id);
    
    if (!isAuthorized && (auth.session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized to approve this leave request" }, { status: 403 });
    }

    const updated = await mockDb.updateLeaveStatus(params.id, "Approved");
    if (!updated) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Leave approved successfully", leave: updated });
  } catch (e) {
    return NextResponse.json({ error: "Failed to approve leave request" }, { status: 500 });
  }
}
