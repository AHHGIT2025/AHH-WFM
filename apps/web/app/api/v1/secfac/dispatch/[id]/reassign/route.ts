import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { createDispatchAssignment } from "@/lib/secfac-sos-dispatch-service";
import { prisma } from "@ahh-wfm/database";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const previousDispatchId = params.id;
    const body = await req.json();
    const { operationType = "SECURITY_GUARDING", newResponderId, reassignmentReason } = body;

    if (!newResponderId) {
      return NextResponse.json({ error: "Missing mandatory newResponderId." }, { status: 400 });
    }

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType as any,
      requiredPermission: "secfac.dispatch.reassign"
    });
    if (auth.error) return auth.error;

    const user = auth.session.user;

    const prevDispatch = await prisma.secFacDispatchAssignment.findUnique({
      where: { id: previousDispatchId }
    });

    if (!prevDispatch) {
      return NextResponse.json({ error: "Previous dispatch assignment not found." }, { status: 404 });
    }

    // Update previous dispatch to CANCELLED with reassignment note
    await prisma.secFacDispatchAssignment.update({
      where: { id: previousDispatchId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: `Reassigned to new responder. ${reassignmentReason || ""}`.trim()
      }
    });

    // Create new dispatch assignment linked to previous
    const newDispatch = await createDispatchAssignment({
      operationType: operationType as any,
      alertId: prevDispatch.alertId,
      responderId: newResponderId,
      dispatchedById: user.id,
      siteId: prevDispatch.siteId
    });

    return NextResponse.json({ success: true, dispatch: newDispatch }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/dispatch/[id]/reassign error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
