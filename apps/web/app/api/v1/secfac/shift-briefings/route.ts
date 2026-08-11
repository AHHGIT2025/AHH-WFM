import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import {
  createOrUpdateBriefing,
  manageBriefingParticipants,
  completeBriefingStage,
  getBriefingDetails
} from "@/lib/secfac-shift-briefing-service";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const details = await getBriefingDetails(id);
    if (!details) {
      return NextResponse.json({ success: false, error: `Shift Briefing '${id}' not found` }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: details });
  }

  const companyId = searchParams.get("companyId") || user.companyId || "COMP001";
  const siteId = searchParams.get("siteId");

  const whereClause: any = { companyId, operationType: "SECURITY_GUARDING" };
  if (siteId) whereClause.siteId = siteId;

  const briefings = await prisma.secfacShiftBriefing.findMany({
    where: whereClause,
    include: {
      site: { select: { id: true, name: true, code: true } },
      supervisor: { select: { id: true, name: true, email: true } },
      participants: { select: { id: true, attendanceStatus: true, employeeId: true } },
      carriedIncidents: { select: { id: true, incidentId: true } }
    },
    orderBy: { briefingDate: "desc" }
  });


  return NextResponse.json({ success: true, data: briefings });
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const body = await request.json();
    const briefing = await createOrUpdateBriefing({
      companyId: body.companyId || user.companyId || "COMP001",
      siteId: body.siteId,
      shiftId: body.shiftId,
      briefingDate: body.briefingDate,
      supervisorId: user.employeeId || user.id,
      postAssignments: body.postAssignments,
      safetyNotes: body.safetyNotes,
      knownRisks: body.knownRisks,
      temporaryInstructions: body.temporaryInstructions,
      briefingNotes: body.briefingNotes
    });

    if (body.participants && Array.isArray(body.participants)) {
      await manageBriefingParticipants(briefing.id, body.participants);
    }

    return NextResponse.json({ success: true, data: briefing }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const body = await request.json();
    const action = body.action || "complete_stage";

    if (action === "manage_participants") {
      if (!body.briefingId || !Array.isArray(body.participants)) {
        return NextResponse.json({ success: false, error: "briefingId and participants array are required" }, { status: 400 });
      }
      const participants = await manageBriefingParticipants(body.briefingId, body.participants);
      return NextResponse.json({ success: true, data: participants });
    }

    if (action === "complete_stage") {
      if (!body.briefingId || !body.targetStage) {
        return NextResponse.json({ success: false, error: "briefingId and targetStage are required" }, { status: 400 });
      }
      const updated = await completeBriefingStage({
        briefingId: body.briefingId,
        targetStage: body.targetStage,
        notes: body.notes,
        supervisorId: user.employeeId || user.id,
        carriedIncidentIds: body.carriedIncidentIds
      });
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: `Invalid action '${action}'` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 400 });
  }
}
