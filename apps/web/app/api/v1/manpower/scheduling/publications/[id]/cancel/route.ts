import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { PrismaClient } from "@ahh-wfm/database";
import {
  acquireScopeLock,
  releaseScopeLock,
  checkPeriodLock,
  logCentralAudit
} from "../../../../../../../../lib/roster-publication-service";

const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"], {
    requiredPermission: "manpower.roster.cancel"
  });
  if (auth.error) return auth.error;

  const sessionUser = auth.session.user;
  const publicationId = params.id;
  const body = await req.json().catch(() => ({}));
  const { cancellationReason } = body;

  if (!cancellationReason || cancellationReason.trim().length < 5) {
    return NextResponse.json({ error: "Cancellation reason is required (min 5 chars)" }, { status: 400 });
  }

  const pub = await prisma.rosterPublication.findUnique({
    where: { id: publicationId }
  });

  if (!pub) {
    return NextResponse.json({ error: "Publication record not found" }, { status: 404 });
  }

  if (pub.status !== "ACTIVE") {
    return NextResponse.json({ error: `Cannot cancel publication in ${pub.status} status. Only ACTIVE publications can be cancelled.` }, { status: 400 });
  }

  const lockOwner = `cancel:${sessionUser.id}:${Date.now()}`;
  const lockKey = await acquireScopeLock(pub.operationType, pub.contractId, pub.siteId, lockOwner);

  try {
    // Period lock check
    const isLocked = await checkPeriodLock(pub.operationType, pub.startDate, pub.endDate);
    if (isLocked) {
      return NextResponse.json({ error: "Cannot cancel publication while period is locked" }, { status: 409 });
    }

    const cancelledPub = await prisma.rosterPublication.update({
      where: { id: publicationId },
      data: {
        status: "CANCELLED",
        activeSeriesKey: null,
        cancelledById: sessionUser.employeeId || sessionUser.id,
        cancelledAt: new Date(),
        cancellationReason
      }
    });

    await logCentralAudit({
      action: "CANCEL_PUBLICATION",
      actorId: sessionUser.id,
      operationType: pub.operationType,
      contractId: pub.contractId,
      siteId: pub.siteId || undefined,
      oldPublicationId: pub.id,
      details: { cancellationReason }
    });

    return NextResponse.json({ success: true, publication: cancelledPub });
  } catch (err: any) {
    console.error("[POST /cancel Error]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  } finally {
    await releaseScopeLock(lockKey, lockOwner);
  }
}
