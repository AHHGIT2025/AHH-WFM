import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import crypto from "crypto";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { 
  getQatarDateString, 
  checkEmployeeSchedulingEligibility, 
  syncAssignmentToLegacy 
} from "@/lib/roster-engine";

const PREVIEW_SECRET = process.env.MANPOWER_BULK_PREVIEW_SECRET || "ahh-wfm-bulk-deployment-preview-secret-key-2026";

function computeHmac(payload: string): string {
  return crypto.createHmac("sha256", PREVIEW_SECRET).update(payload).digest("hex");
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;
  const isSuperOrAdmin = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.assign")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to assign schedules." }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const { previewToken, idempotencyKey, allowPartial = true } = body;

  if (!previewToken || !idempotencyKey) {
    return NextResponse.json({ error: "previewToken and idempotencyKey are required" }, { status: 400 });
  }

  // 1. Check Idempotency Store first
  const existingIdemLog = await prisma.manpowerBulkOperationLog.findUnique({
    where: { idempotencyKey }
  });

  if (existingIdemLog) {
    if (existingIdemLog.status === "COMPLETED" && existingIdemLog.resultJson) {
      return NextResponse.json(existingIdemLog.resultJson);
    }
    if (existingIdemLog.status === "PROCESSING") {
      return NextResponse.json({ error: "Operation is currently in progress", code: "OPERATION_IN_PROGRESS" }, { status: 409 });
    }
  }

  // 2. Decode and Verify Cryptographic Preview Token
  let decodedToken: any;
  try {
    const rawStr = Buffer.from(previewToken, "base64url").toString("utf-8");
    decodedToken = JSON.parse(rawStr);
  } catch (err) {
    return NextResponse.json({ error: "Invalid previewToken format" }, { status: 400 });
  }

  const { previewId, actorId, requestHash, expiresAt, sig } = decodedToken;

  if (!previewId || !actorId || !requestHash || !expiresAt || !sig) {
    return NextResponse.json({ error: "Invalid previewToken payload structure" }, { status: 400 });
  }

  if (Date.now() > Number(expiresAt)) {
    return NextResponse.json({ error: "Preview token has expired. Please run a new preview.", code: "PREVIEW_EXPIRED" }, { status: 400 });
  }

  if (actorId !== user.id) {
    return NextResponse.json({ error: "Forbidden: Preview token belongs to a different actor." }, { status: 403 });
  }

  // Constant-time HMAC verification
  const tokenBody = `${previewId}:${actorId}:${requestHash}:${expiresAt}`;
  const expectedSig = computeHmac(tokenBody);
  const sigBuffer = Buffer.from(sig, "utf-8");
  const expectedBuffer = Buffer.from(expectedSig, "utf-8");

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return NextResponse.json({ error: "Invalid previewToken signature." }, { status: 400 });
  }

  // 3. Find server-side preview log
  const rawHash = crypto.createHash("sha256").update(previewId).digest("hex");
  const opLog = await prisma.manpowerBulkOperationLog.findUnique({
    where: { previewTokenHash: rawHash }
  });

  if (!opLog) {
    return NextResponse.json({ error: "Preview session not found or expired." }, { status: 404 });
  }

  if (opLog.idempotencyKey && opLog.idempotencyKey !== idempotencyKey) {
    if (opLog.requestHash !== requestHash) {
      return NextResponse.json({ error: "Idempotency key reused with a different request hash.", code: "IDEMPOTENCY_KEY_REUSED" }, { status: 409 });
    }
  }

  const previewPayload: any = opLog.previewJson;
  if (!previewPayload || !previewPayload.results) {
    return NextResponse.json({ error: "Corrupted preview data" }, { status: 500 });
  }

  // Mark log as PROCESSING
  await prisma.manpowerBulkOperationLog.update({
    where: { id: opLog.id },
    data: {
      idempotencyKey,
      status: "PROCESSING",
      startedAt: new Date()
    }
  });

  // 4. Re-query and Re-validate Candidate Slots
  const candidateResults: any[] = previewPayload.results;
  const slotIds = Array.from(new Set(candidateResults.map((r) => r.slotId).filter(Boolean))) as string[];

  const currentSlots = await prisma.rosterRequirementSlot.findMany({
    where: { id: { in: slotIds } },
    include: {
      site: true,
      assignments: { where: { historyStatus: "ACTIVE" } }
    }
  });
  const currentSlotMap = new Map(currentSlots.map((s) => [s.id, s]));

  const periodLocks = await prisma.manpowerSchedulingPeriodLock.findMany({
    where: { locked: true, operationType: opLog.operationType }
  });
  const isDateLocked = (d: Date) => {
    const yyyymm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return periodLocks.some((lock) => lock.period === yyyymm);
  };

  const revalidatedResults: any[] = [];
  let eligibleCount = 0;
  let skippedCount = 0;

  for (const item of candidateResults) {
    if (!item.slotId) {
      revalidatedResults.push({ ...item, status: "SKIPPED", reasonCode: "NO_MATCHING_SLOT" });
      skippedCount++;
      continue;
    }

    const currentSlot = currentSlotMap.get(item.slotId);
    if (!currentSlot || currentSlot.fulfillmentStatus === "CANCELLED") {
      revalidatedResults.push({ ...item, status: "SKIPPED", reasonCode: "SLOT_CANCELLED", message: "Slot was cancelled" });
      skippedCount++;
      continue;
    }

    // Recheck Period Lock
    if (isDateLocked(currentSlot.businessDate)) {
      revalidatedResults.push({ ...item, status: "SKIPPED", reasonCode: "PERIOD_LOCKED", message: "Period locked upon confirmation" });
      skippedCount++;
      continue;
    }

    // Recheck if filled concurrently by another planner
    const isFilledByOther = currentSlot.assignments.some((a: any) => a.historyStatus === "ACTIVE");
    if (isFilledByOther) {
      revalidatedResults.push({ ...item, status: "SKIPPED", reasonCode: "SLOT_ALREADY_FILLED", message: "Slot was filled by another planner" });
      skippedCount++;
      continue;
    }

    // Recheck Employee Eligibility
    const evalRes = await checkEmployeeSchedulingEligibility(item.employeeId, currentSlot.id);
    if (!evalRes.canDeploy) {
      revalidatedResults.push({ ...item, status: "SKIPPED", reasonCode: "ELIGIBILITY_FAILED", message: evalRes.errors[0] || "Eligibility revalidation failed" });
      skippedCount++;
    } else {
      revalidatedResults.push({ ...item, status: "ELIGIBLE", message: "Eligible for deployment" });
      eligibleCount++;
    }
  }

  // Handle STRICT policy check
  const isStrict = allowPartial === false || opLog.policy === "STRICT";
  if (isStrict && skippedCount > 0) {
    await prisma.manpowerBulkOperationLog.update({
      where: { id: opLog.id },
      data: { status: "FAILED", failedCount: skippedCount, errorJson: { error: `Strict policy requirement failed: ${skippedCount} combinations skipped` } }
    });
    return NextResponse.json({
      success: false,
      error: `Strict deployment policy requirement failed: ${skippedCount} of ${candidateResults.length} candidate assignments are ineligible.`,
      requestedCount: candidateResults.length,
      createdCount: 0,
      skippedCount,
      results: revalidatedResults
    }, { status: 400 });
  }

  // 5. Execute Atomic Prisma Transaction
  let createdCount = 0;
  const createdAssignments: any[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of revalidatedResults) {
        if (item.status !== "ELIGIBLE") continue;

        const slot = currentSlotMap.get(item.slotId);
        if (!slot) continue;

        // Deactivate existing primary active assignments
        await tx.rosterSlotAssignment.updateMany({
          where: { slotId: item.slotId, historyStatus: "ACTIVE" },
          data: { historyStatus: "ENDED" }
        });

        const fromDateStr = opLog.fromDate ? new Date(opLog.fromDate).toISOString().split("T")[0] : "";
        const toDateStr = opLog.toDate ? new Date(opLog.toDate).toISOString().split("T")[0] : "";
        const locationUnitId = slot.siteId || "none";
        const rawGroupStr = `${opLog.id}:${item.employeeId}:${slot.operationType}:${slot.contractId}:${slot.projectId}:${slot.siteId}:${locationUnitId}:${slot.shiftRequirementId}:${slot.slotIndex}:${fromDateStr}:${toDateStr}`;
        const groupHash = crypto.createHash("sha256").update(rawGroupStr).digest("hex").substring(0, 32);
        const assignmentGroupKey = `grp_${groupHash}`;

        // Create new primary RosterSlotAssignment with durable group linkage
        const newAsg = await tx.rosterSlotAssignment.create({
          data: {
            slotId: item.slotId,
            employeeId: item.employeeId,
            assignmentType: "PRIMARY",
            historyStatus: "ACTIVE",
            assignedById: user.id,
            bulkOperationId: opLog.id,
            assignmentGroupKey
          }
        });

        // Update RosterRequirementSlot status
        await tx.rosterRequirementSlot.update({
          where: { id: item.slotId },
          data: { fulfillmentStatus: "FILLED" }
        });

        // Mirror to legacy shift assignment table USING THE SAME TRANSACTION CLIENT `tx`!
        await syncAssignmentToLegacy(newAsg.id, tx);

        item.status = "ASSIGNED";
        item.assignmentId = newAsg.id;
        createdCount++;
        createdAssignments.push(item);
      }

      // Write UserActivityLog audit log entry
      await tx.userActivityLog.create({
        data: {
          userId: user.id,
          action: "SCHEDULING_BULK_DEPLOYMENT",
          entityType: "RosterSlotAssignment",
          entityId: idempotencyKey,
          afterJson: JSON.stringify({
            idempotencyKey,
            actorId: user.id,
            mode: opLog.mode,
            strategy: opLog.strategy,
            policy: opLog.policy,
            requestedCount: candidateResults.length,
            createdCount,
            skippedCount,
            timestamp: new Date().toISOString()
          })
        }
      });
    });

    const responsePayload = {
      success: true,
      mode: opLog.mode,
      requestedCount: candidateResults.length,
      createdCount,
      skippedCount,
      results: revalidatedResults
    };

    // Mark ManpowerBulkOperationLog as COMPLETED
    await prisma.manpowerBulkOperationLog.update({
      where: { id: opLog.id },
      data: {
        status: "COMPLETED",
        createdCount,
        skippedCount,
        completedAt: new Date(),
        resultJson: responsePayload
      }
    });

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    await prisma.manpowerBulkOperationLog.update({
      where: { id: opLog.id },
      data: { status: "FAILED", errorJson: { error: err?.message || String(err) } }
    });
    return NextResponse.json({ error: `Bulk deployment transaction failed: ${err?.message || "Internal error"}` }, { status: 500 });
  }
}
