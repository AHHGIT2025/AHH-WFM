import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { PrismaClient } from "@ahh-wfm/database";
import {
  buildSeriesKey,
  acquireScopeLock,
  releaseScopeLock,
  checkPeriodLock,
  checkOverlappingActivePublications,
  logCentralAudit
} from "../../../../../../lib/roster-publication-service";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "SCHEDULER"], {
    requiredPermission: "manpower.roster.publish"
  });
  if (auth.error) return auth.error;

  const sessionUser = auth.session.user;
  const body = await req.json();
  const { operationType, contractId, siteId, startDate, endDate, revisionReason } = body;

  if (!operationType || !contractId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields: operationType, contractId, startDate, endDate" }, { status: 400 });
  }

  if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationType)) {
    return NextResponse.json({ error: "Invalid operationType" }, { status: 400 });
  }

  const startObj = new Date(startDate);
  const endObj = new Date(endDate);
  if (isNaN(startObj.getTime()) || isNaN(endObj.getTime()) || startObj > endObj) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const lockOwner = `publish:${sessionUser.id}:${Date.now()}`;
  const lockKey = await acquireScopeLock(operationType, contractId, siteId, lockOwner);

  try {
    const isLocked = await checkPeriodLock(operationType, startObj, endObj);
    if (isLocked) {
      return NextResponse.json({ error: "Period is locked for scheduling" }, { status: 409 });
    }

    const seriesKey = buildSeriesKey(operationType, contractId, siteId, startObj, endObj);
    const existingActive = await prisma.rosterRequirementSlot ? await prisma.rosterPublication.findUnique({
      where: { activeSeriesKey: seriesKey }
    }) : null;

    if (existingActive) {
      return NextResponse.json(
        {
          error: "Active publication version already exists for this series. Post-publication changes require an approved RosterChangeRequest.",
          existingPublicationId: existingActive.id,
          activeVersion: existingActive.publicationVersion
        },
        { status: 409 }
      );
    }

    const overlappingConflicting = await checkOverlappingActivePublications(operationType, contractId, siteId, startObj, endObj);
    if (overlappingConflicting.length > 0) {
      return NextResponse.json(
        {
          error: "Overlapping active publication range detected for contract/site",
          conflicts: overlappingConflicting.map((c: any) => ({ id: c.id, version: c.publicationVersion, startDate: c.startDate, endDate: c.endDate }))
        },
        { status: 409 }
      );
    }

    const requirementSlots = await prisma.rosterRequirementSlot.findMany({
      where: {
        operationType,
        contractId,
        ...(siteId ? { siteId } : {}),
        businessDate: { gte: startObj, lte: endObj },
        fulfillmentStatus: { not: "CANCELLED" }
      },
      include: {
        assignments: {
          include: {
            employee: true
          }
        },
        planningExceptions: {
          include: {
            employee: true
          }
        }
      }
    });

    const newPublication = await prisma.$transaction(async (tx) => {
      const pub = await tx.rosterPublication.create({
        data: {
          operationType,
          contractId,
          siteId: siteId || null,
          startDate: startObj,
          endDate: endObj,
          seriesKey,
          activeSeriesKey: seriesKey,
          publicationVersion: 1,
          status: "ACTIVE",
          revisionReason: revisionReason || "Initial publication",
          publishedById: sessionUser.employeeId || sessionUser.id
        }
      });

      for (const slot of requirementSlots) {
        const slotAssignments = (slot as any).assignments?.filter((a: any) => a.historyStatus === "ACTIVE" || a.status === "ACTIVE") || [];
        const slotExceptions = (slot as any).planningExceptions?.filter((e: any) => e.status !== "CANCELLED") || [];

        if (slotAssignments.length === 0 && slotExceptions.length === 0) {
          await tx.rosterPublicationSlot.create({
            data: {
              publicationId: pub.id,
              slotId: slot.id,
              snapshotKey: `PUB_SLOT:${pub.id}:${slot.id}:VACANT`,
              sourceAssignmentRole: "UNFILLED",
              coverageType: "VACANT",
              position: slot.snapshotPosition,
              shiftName: slot.snapshotShiftName,
              startTime: slot.snapshotStartTime,
              endTime: slot.snapshotEndTime,
              businessDate: slot.businessDate,
              assignmentStatus: "UNFILLED"
            }
          });
        } else {
          for (const asg of slotAssignments) {
            const role = asg.assignmentRole === "RELIEVER" ? "RELIEVER" : "PRIMARY";
            const cov = asg.assignmentRole === "RELIEVER" ? "RELIEVER_DUTY" : "PRIMARY_DUTY";
            await tx.rosterPublicationSlot.create({
              data: {
                publicationId: pub.id,
                slotId: slot.id,
                snapshotKey: `PUB_SLOT:${pub.id}:${slot.id}:${asg.id}`,
                sourceAssignmentId: asg.id,
                sourceAssignmentRole: role,
                coverageType: cov,
                employeeId: asg.employeeId,
                employeeCode: asg.employee?.id || null,
                employeeName: asg.employee?.name || null,
                position: slot.snapshotPosition,
                shiftName: slot.snapshotShiftName,
                startTime: slot.snapshotStartTime,
                endTime: slot.snapshotEndTime,
                businessDate: slot.businessDate,
                assignmentStatus: asg.historyStatus || "ACTIVE"
              }
            });
          }

          for (const exc of slotExceptions) {
            await tx.rosterPublicationSlot.create({
              data: {
                publicationId: pub.id,
                slotId: slot.id,
                snapshotKey: `PUB_SLOT:${pub.id}:${slot.id}:${exc.id}`,
                sourcePlanningExceptionId: exc.id,
                sourceAssignmentRole: "EXCEPTION",
                coverageType: exc.exceptionType,
                employeeId: exc.employeeId,
                employeeCode: exc.employee?.id || null,
                employeeName: exc.employee?.name || null,
                position: slot.snapshotPosition,
                shiftName: slot.snapshotShiftName,
                startTime: slot.snapshotStartTime,
                endTime: slot.snapshotEndTime,
                businessDate: slot.businessDate,
                assignmentStatus: exc.status || "ACTIVE"
              }
            });
          }
        }
      }

      return pub;
    });

    await logCentralAudit({
      action: "INITIAL_PUBLICATION",
      actorId: sessionUser.id,
      operationType,
      contractId,
      siteId,
      newPublicationId: newPublication.id,
      details: { seriesKey, publicationVersion: 1 }
    });

    return NextResponse.json({ success: true, publication: newPublication }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /publish Error]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  } finally {
    await releaseScopeLock(lockKey, lockOwner);
  }
}
