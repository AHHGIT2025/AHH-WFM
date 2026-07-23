import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { PrismaClient } from "@ahh-wfm/database";
import { logCentralAudit } from "../../../../../../lib/roster-publication-service";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE", "GUARD", "SECURITY_OFFICER"], {
    requiredPermission: "manpower.roster.acknowledge"
  });
  if (auth.error) return auth.error;

  const sessionUser = auth.session.user;
  const body = await req.json();
  const { publicationSlotId, clientRequestId, deviceGeneratedAt, clientReportedOffline } = body;

  if (!publicationSlotId || !clientRequestId) {
    return NextResponse.json({ error: "Missing required fields: publicationSlotId, clientRequestId" }, { status: 400 });
  }

  const employeeId = sessionUser.employeeId || sessionUser.id;

  // Look up target publication slot & parent publication
  const pubSlot = await prisma.rosterPublicationSlot.findUnique({
    where: { id: publicationSlotId },
    include: {
      publication: true
    }
  });

  if (!pubSlot) {
    return NextResponse.json({ error: "Publication slot not found" }, { status: 404 });
  }

  const pub = pubSlot.publication;

  // Cross-employee validation: Operatives can only acknowledge their own assignment slots
  if (pubSlot.employeeId && pubSlot.employeeId !== employeeId) {
    return NextResponse.json({ error: "Forbidden: You can only acknowledge your own shift assignments" }, { status: 403 });
  }

  // Idempotency check: By clientRequestId
  const existingByClientReq = await prisma.rosterSlotAcknowledgment.findUnique({
    where: { clientRequestId }
  });

  if (existingByClientReq) {
    return NextResponse.json({ success: true, acknowledgment: existingByClientReq, idempotent: true });
  }

  // Idempotency check: By publicationSlotId + employeeId
  const existingSlotAck = await prisma.rosterSlotAcknowledgment.findUnique({
    where: {
      publicationSlotId_employeeId: {
        publicationSlotId,
        employeeId
      }
    }
  });

  if (existingSlotAck) {
    return NextResponse.json({ success: true, acknowledgment: existingSlotAck, idempotent: true });
  }

  const deviceDate = deviceGeneratedAt ? new Date(deviceGeneratedAt) : new Date();

  const ack = await prisma.rosterSlotAcknowledgment.create({
    data: {
      operationType: pub.operationType,
      publicationId: pub.id,
      publicationVersion: pub.publicationVersion,
      publicationSlotId: pubSlot.id,
      assignmentId: pubSlot.sourceAssignmentId,
      employeeId,
      deviceGeneratedAt: isNaN(deviceDate.getTime()) ? new Date() : deviceDate,
      receivedAt: new Date(),
      submittedOffline: Boolean(clientReportedOffline),
      clientRequestId
    }
  });

  await logCentralAudit({
    action: "MOBILE_ACKNOWLEDGEMENT",
    actorId: sessionUser.id,
    operationType: pub.operationType,
    contractId: pub.contractId,
    siteId: pub.siteId || undefined,
    oldPublicationId: pub.id,
    details: {
      publicationSlotId: pubSlot.id,
      publicationVersion: pub.publicationVersion,
      clientRequestId
    }
  });

  return NextResponse.json({ success: true, acknowledgment: ack }, { status: 201 });
}
