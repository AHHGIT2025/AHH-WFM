import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import crypto from "crypto";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { getQatarDateString, syncAssignmentToLegacy } from "@/lib/roster-engine";

const PREVIEW_SECRET = process.env.MANPOWER_BULK_PREVIEW_SECRET || "ahh_wfm_bulk_deployment_preview_secret_2026_key_super_secure";

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;

  // Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.unassign") &&
      user?.role !== "ADMIN" &&
      user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden: You do not have permission to unassign schedules." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { previewToken, idempotencyKey, allowPartial } = body;

  if (!previewToken) {
    return NextResponse.json({ error: "Missing required parameter: previewToken" }, { status: 400 });
  }

  if (!idempotencyKey) {
    return NextResponse.json({ error: "Missing required parameter: idempotencyKey" }, { status: 400 });
  }

  // 1. Verify Preview Token Signature
  let tokenParts: string[];
  try {
    const decoded = Buffer.from(previewToken, "base64url").toString("utf8");
    tokenParts = decoded.split(":");
    if (tokenParts.length !== 5) {
      throw new Error("Invalid token structure");
    }
  } catch (e) {
    return NextResponse.json({ error: "Invalid preview token format", code: "INVALID_PREVIEW_TOKEN" }, { status: 401 });
  }

  const [previewId, actorId, requestHash, expiresAtMsStr, signature] = tokenParts;
  const expiresAtMs = parseInt(expiresAtMsStr, 10);

  const expectedPayload = `${previewId}:${actorId}:${requestHash}:${expiresAtMsStr}`;
  const expectedSig = crypto.createHmac("sha256", PREVIEW_SECRET).update(expectedPayload).digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return NextResponse.json({ error: "Preview token signature verification failed", code: "TAMPERED_PREVIEW_TOKEN" }, { status: 401 });
  }

  // Actor verification
  if (actorId !== user.id) {
    return NextResponse.json({ error: "Forbidden: Preview token actor mismatch", code: "PREVIEW_ACTOR_MISMATCH" }, { status: 403 });
  }

  // Expiry check
  if (Date.now() > expiresAtMs) {
    return NextResponse.json({ error: "Preview token has expired. Please regenerate preview.", code: "PREVIEW_EXPIRED" }, { status: 410 });
  }

  const previewTokenHash = crypto.createHash("sha256").update(previewToken).digest("hex");

  // 2. Fetch Bulk Operation Record
  const opLog = await prisma.manpowerBulkOperationLog.findUnique({
    where: { previewTokenHash }
  });

  if (!opLog) {
    return NextResponse.json({ error: "Bulk operation preview record not found", code: "PREVIEW_NOT_FOUND" }, { status: 404 });
  }

  // 3. Idempotency Verification
  const existingIdem = await prisma.manpowerBulkOperationLog.findUnique({
    where: { idempotencyKey }
  });

  if (existingIdem) {
    if (existingIdem.requestHash !== opLog.requestHash) {
      return NextResponse.json({
        error: "Idempotency key reused with different request payload",
        code: "IDEMPOTENCY_KEY_REUSED"
      }, { status: 409 });
    }

    if (existingIdem.status === "COMPLETED") {
      return NextResponse.json(existingIdem.resultJson);
    }

    if (existingIdem.status === "PROCESSING") {
      return NextResponse.json({ error: "Operation is currently processing. Please wait.", code: "OPERATION_PROCESSING" }, { status: 409 });
    }
  }

  // Claim Idempotency Key & set status to PROCESSING
  await prisma.manpowerBulkOperationLog.update({
    where: { id: opLog.id },
    data: {
      idempotencyKey,
      status: "PROCESSING",
      startedAt: new Date()
    }
  });

  const requestJson = (opLog.requestJson as any) || {};
  const previewJson = (opLog.previewJson as any) || {};
  const targetAssignmentIds: string[] = requestJson.targetAssignmentIds || [];
  const reasonCode = requestJson.reasonCode || "MANUAL_UNASSIGNMENT";
  const reasonNotes = requestJson.reasonNotes || "";
  const reasonText = reasonCode === "OTHER" ? `Other: ${reasonNotes}` : `Reason: ${reasonCode}${reasonNotes ? ` - ${reasonNotes}` : ""}`;

  // 4. Revalidate all target assignments for concurrency changes
  const targetAssignments = await prisma.rosterSlotAssignment.findMany({
    where: { id: { in: targetAssignmentIds } },
    include: { slot: true }
  });

  const targetAsgMap = new Map(targetAssignments.map((a) => [a.id, a]));

  const periodLocks = await prisma.manpowerSchedulingPeriodLock.findMany({
    where: { locked: true, operationType: opLog.operationType }
  });
  const isDateLocked = (d: Date) => {
    const yyyymm = getQatarDateString(d).substring(0, 7);
    return periodLocks.some((lock) => lock.period === yyyymm);
  };

  const pubSlots = await prisma.rosterPublicationSlot.findMany({
    where: {
      slotId: { in: targetAssignments.map((a) => a.slotId) },
      publication: { status: "PUBLISHED" }
    }
  });
  const publishedSlotIds = new Set(pubSlots.map((ps) => ps.slotId));

  const minDate = new Date(targetAssignments[0].slot.businessDate);
  const maxDate = new Date(targetAssignments[targetAssignments.length - 1].slot.businessDate);
  maxDate.setHours(23, 59, 59, 999);

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: requestJson.employeeId,
      checkIn: { gte: minDate, lte: maxDate }
    }
  });
  const attendanceMap = new Map(attendanceRecords.map((ar: any) => [getQatarDateString(ar.checkIn), ar]));

  const revalidatedResults: any[] = [];
  let eligibleCount = 0;
  let blockedCount = 0;

  for (const asgId of targetAssignmentIds) {
    const asg = targetAsgMap.get(asgId);
    if (!asg) {
      revalidatedResults.push({ assignmentId: asgId, status: "BLOCKED", reasonCode: "ASSIGNMENT_NOT_FOUND", message: "Assignment no longer exists" });
      blockedCount++;
      continue;
    }

    const dateStr = getQatarDateString(asg.slot.businessDate);

    if (asg.historyStatus !== "ACTIVE") {
      revalidatedResults.push({ assignmentId: asg.id, slotId: asg.slotId, businessDate: dateStr, status: "BLOCKED", reasonCode: "ALREADY_UNASSIGNED", message: "Assignment was unassigned concurrently" });
      blockedCount++;
      continue;
    }

    if (asg.assignmentType === "RELIEVER" || asg.assignmentType === "TEMPORARY_COVER" || asg.planningExceptionId) {
      revalidatedResults.push({ assignmentId: asg.id, slotId: asg.slotId, businessDate: dateStr, status: "BLOCKED", reasonCode: "MP3A_EXCEPTION_CONTROLLED", message: "Managed via MP-3A workflow" });
      blockedCount++;
      continue;
    }

    if (isDateLocked(asg.slot.businessDate)) {
      revalidatedResults.push({ assignmentId: asg.id, slotId: asg.slotId, businessDate: dateStr, status: "BLOCKED", reasonCode: "PERIOD_LOCKED", message: "Period locked upon confirmation" });
      blockedCount++;
      continue;
    }

    if (publishedSlotIds.has(asg.slotId)) {
      revalidatedResults.push({ assignmentId: asg.id, slotId: asg.slotId, businessDate: dateStr, status: "BLOCKED", reasonCode: "PUBLISHED_CHANGE_REQUIRED", message: "Active published roster snapshot exists" });
      blockedCount++;
      continue;
    }

    const att: any = attendanceMap.get(dateStr);
    if (att) {
      const attReason = att.checkOut === null ? "ACTIVE_ATTENDANCE_EXISTS" : "COMPLETED_ATTENDANCE_EXISTS";
      revalidatedResults.push({ assignmentId: asg.id, slotId: asg.slotId, businessDate: dateStr, status: "BLOCKED", reasonCode: attReason, message: "Attendance record exists" });
      blockedCount++;
      continue;
    }

    revalidatedResults.push({ assignmentId: asg.id, slotId: asg.slotId, businessDate: dateStr, status: "ELIGIBLE", message: "Eligible for unassignment" });
    eligibleCount++;
  }

  // Handle STRICT policy check
  const isStrict = allowPartial === false || opLog.policy === "STRICT";
  if (isStrict && blockedCount > 0) {
    await prisma.manpowerBulkOperationLog.update({
      where: { id: opLog.id },
      data: {
        status: "FAILED",
        failedCount: blockedCount,
        errorJson: { error: `Strict policy failure: ${blockedCount} assignments blocked.` }
      }
    });

    return NextResponse.json({
      success: false,
      error: `Strict unassignment policy failure: ${blockedCount} of ${targetAssignmentIds.length} candidate assignments are blocked.`,
      requestedCount: targetAssignmentIds.length,
      unassignedCount: 0,
      blockedCount,
      results: revalidatedResults
    }, { status: 400 });
  }

  // 5. Execute Atomic Prisma Transaction
  let unassignedCount = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of revalidatedResults) {
        if (item.status !== "ELIGIBLE") continue;

        const asg = targetAsgMap.get(item.assignmentId);
        if (!asg) continue;

        // Deactivate RosterSlotAssignment
        await tx.rosterSlotAssignment.update({
          where: { id: asg.id },
          data: {
            historyStatus: "CANCELLED",
            unassignedById: user.id,
            unassignedAt: new Date(),
            unassignmentReason: reasonText,
            syncStatus: "PENDING"
          }
        });

        // Update RosterRequirementSlot status to VACANT
        await tx.rosterRequirementSlot.update({
          where: { id: asg.slotId },
          data: { fulfillmentStatus: "VACANT" }
        });

        // Mirror deactivation to legacy projections USING THE SAME TRANSACTION CLIENT `tx`!
        await syncAssignmentToLegacy(asg.id, tx);

        // Audit log
        await tx.userActivityLog.create({
          data: {
            userId: user.id,
            action: "SCHEDULING_BULK_UNASSIGNMENT",
            entityType: "RosterSlotAssignment",
            entityId: asg.id,
            afterJson: JSON.stringify({
              mode: opLog.mode,
              reasonCode,
              reasonNotes,
              slotId: asg.slotId
            })
          }
        });

        unassignedCount++;
      }

      // Mark operation as COMPLETED
      await tx.manpowerBulkOperationLog.update({
        where: { id: opLog.id },
        data: {
          status: "COMPLETED",
          createdCount: unassignedCount,
          skippedCount: blockedCount,
          completedAt: new Date(),
          resultJson: {
            success: true,
            requestedCount: targetAssignmentIds.length,
            unassignedCount,
            blockedCount,
            results: revalidatedResults
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      requestedCount: targetAssignmentIds.length,
      unassignedCount,
      blockedCount,
      results: revalidatedResults
    });
  } catch (error: any) {
    console.error("BULK UNASSIGNMENT TRANSACTION ERROR:", error);
    await prisma.manpowerBulkOperationLog.update({
      where: { id: opLog.id },
      data: { status: "FAILED", errorJson: { error: error.message } }
    });

    return NextResponse.json({ error: error.message || "Failed to execute bulk unassignment transaction" }, { status: 500 });
  }
}
