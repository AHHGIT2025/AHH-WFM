import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { PrismaClient } from "@ahh-wfm/database";
import { logCentralAudit } from "../../../../../../../../lib/roster-publication-service";

const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "SCHEDULER", "PROJECT_COORDINATOR"], {
    requiredPermission: "manpower.roster.changeRequest.withdraw"
  });
  if (auth.error) return auth.error;

  const sessionUser = auth.session.user;
  const requestId = params.id;
  const body = await req.json().catch(() => ({}));
  const { reason } = body;

  const changeRequest = await prisma.rosterChangeRequest.findUnique({
    where: { id: requestId }
  });

  if (!changeRequest) {
    return NextResponse.json({ error: "Change request not found" }, { status: 404 });
  }

  if (changeRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: `Cannot withdraw change request in ${changeRequest.status} status. Request must be PENDING.` },
      { status: 400 }
    );
  }

  const updated = await prisma.rosterChangeRequest.update({
    where: { id: requestId },
    data: {
      status: "WITHDRAWN",
      reviewNotes: reason || "Withdrawn by requester",
      activeRequestKey: null
    }
  });

  await logCentralAudit({
    action: "WITHDRAW_CHANGE_REQUEST",
    actorId: sessionUser.id,
    operationType: changeRequest.operationType,
    contractId: changeRequest.contractId,
    siteId: changeRequest.siteId || undefined,
    requestId: changeRequest.id,
    details: { reason }
  });

  return NextResponse.json({ success: true, changeRequest: updated });
}
