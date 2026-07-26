import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import crypto from "crypto";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { getQatarDateString } from "@/lib/roster-engine";

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

  const {
    assignmentId,
    mode = "SINGLE_DAY", // "SINGLE_DAY" | "ENTIRE_ASSIGNMENT_PERIOD"
    reasonCode,
    reasonNotes,
    policy = "STRICT" // "STRICT" | "PARTIAL"
  } = body;

  if (!assignmentId) {
    return NextResponse.json({ error: "Missing required parameter: assignmentId" }, { status: 400 });
  }

  if (!reasonCode) {
    return NextResponse.json({ error: "Missing required parameter: reasonCode" }, { status: 400 });
  }

  if (reasonCode === "OTHER" && (!reasonNotes || !reasonNotes.trim())) {
    return NextResponse.json({ error: "Reason notes are required when 'Other' is selected." }, { status: 400 });
  }

  try {
    // 1. Fetch anchor assignment
    const anchorAsg: any = await prisma.rosterSlotAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        slot: {
          include: {
            contract: { include: { client: true } },
            project: true,
            site: true
          }
        },
        employee: true,
        bulkOperation: true
      }
    });

    if (!anchorAsg) {
      return NextResponse.json({ error: "Anchor assignment not found." }, { status: 404 });
    }

    const { slot } = anchorAsg;

    // Scope check
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      if (user?.operationType && user.operationType !== slot.operationType) {
        return NextResponse.json({ error: "Forbidden: Operation scope mismatch." }, { status: 403 });
      }
    }

    // 2. Resolve Candidate Assignments for Unassignment
    let candidateAssignments: any[] = [];

    if (mode === "SINGLE_DAY") {
      candidateAssignments = [anchorAsg];
    } else if (mode === "ENTIRE_ASSIGNMENT_PERIOD") {
      const groupKey = anchorAsg.assignmentGroupKey;
      const bulkOpId = anchorAsg.bulkOperationId;

      if (groupKey) {
        candidateAssignments = await prisma.rosterSlotAssignment.findMany({
          where: { assignmentGroupKey: groupKey },
          include: { slot: true, employee: true }
        });
      } else if (bulkOpId) {
        candidateAssignments = await prisma.rosterSlotAssignment.findMany({
          where: {
            bulkOperationId: bulkOpId,
            employeeId: anchorAsg.employeeId
          },
          include: { slot: true, employee: true }
        });
      } else {
        // Deterministic recovery by exact employeeId + slot relational identity
        candidateAssignments = await prisma.rosterSlotAssignment.findMany({
          where: {
            employeeId: anchorAsg.employeeId,
            slot: {
              contractId: slot.contractId,
              siteId: slot.siteId,
              shiftRequirementId: slot.shiftRequirementId,
              slotIndex: slot.slotIndex
            }
          },
          include: { slot: true, employee: true }
        });
      }
    }

    if (candidateAssignments.length === 0) {
      return NextResponse.json({ error: "No target assignments found for unassignment." }, { status: 404 });
    }

    // 3. Pre-evaluate eligibility for each candidate assignment
    const periodLocks = await prisma.manpowerSchedulingPeriodLock.findMany({
      where: { locked: true, operationType: slot.operationType }
    });
    const isDateLocked = (d: Date) => {
      const yyyymm = getQatarDateString(d).substring(0, 7);
      return periodLocks.some((lock) => lock.period === yyyymm);
    };

    const pubSlots = await prisma.rosterPublicationSlot.findMany({
      where: {
        slotId: { in: candidateAssignments.map((a: any) => a.slotId) },
        publication: { status: "PUBLISHED" }
      }
    });
    const publishedSlotIds = new Set(pubSlots.map((ps: any) => ps.slotId));

    const minDate = new Date(candidateAssignments[0].slot.businessDate);
    const maxDate = new Date(candidateAssignments[candidateAssignments.length - 1].slot.businessDate);
    maxDate.setHours(23, 59, 59, 999);

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: anchorAsg.employeeId,
        checkIn: { gte: minDate, lte: maxDate }
      }
    });
    const attendanceMap = new Map(attendanceRecords.map((ar: any) => [getQatarDateString(ar.checkIn), ar]));

    const evaluatedResults: any[] = [];
    let eligibleCount = 0;
    let blockedCount = 0;

    for (const asg of candidateAssignments) {
      const dateStr = getQatarDateString(asg.slot.businessDate);

      // Check 1: Already unassigned
      if (asg.historyStatus !== "ACTIVE") {
        evaluatedResults.push({
          assignmentId: asg.id,
          slotId: asg.slotId,
          businessDate: dateStr,
          status: "BLOCKED",
          reasonCode: "ALREADY_UNASSIGNED",
          message: "Assignment is already unassigned or cancelled."
        });
        blockedCount++;
        continue;
      }

      // Check 2: MP-3A Exception / Reliever
      if (asg.assignmentType === "RELIEVER" || asg.assignmentType === "TEMPORARY_COVER" || asg.planningExceptionId) {
        evaluatedResults.push({
          assignmentId: asg.id,
          slotId: asg.slotId,
          businessDate: dateStr,
          status: "BLOCKED",
          reasonCode: "MP3A_EXCEPTION_CONTROLLED",
          message: "Reliever/Exception assignments must be managed via MP-3A workflow."
        });
        blockedCount++;
        continue;
      }

      // Check 3: Period Lock
      if (isDateLocked(asg.slot.businessDate)) {
        evaluatedResults.push({
          assignmentId: asg.id,
          slotId: asg.slotId,
          businessDate: dateStr,
          status: "BLOCKED",
          reasonCode: "PERIOD_LOCKED",
          message: "Scheduling period is locked."
        });
        blockedCount++;
        continue;
      }

      // Check 4: Published Roster
      if (publishedSlotIds.has(asg.slotId)) {
        evaluatedResults.push({
          assignmentId: asg.id,
          slotId: asg.slotId,
          businessDate: dateStr,
          status: "BLOCKED",
          reasonCode: "PUBLISHED_CHANGE_REQUIRED",
          message: "Date is covered by an active published roster snapshot."
        });
        blockedCount++;
        continue;
      }

      // Check 5: Attendance / Check-in
      const att = attendanceMap.get(dateStr);
      if (att) {
        const attReason = att.checkOutTime === null ? "ACTIVE_ATTENDANCE_EXISTS" : "COMPLETED_ATTENDANCE_EXISTS";
        evaluatedResults.push({
          assignmentId: asg.id,
          slotId: asg.slotId,
          businessDate: dateStr,
          status: "BLOCKED",
          reasonCode: attReason,
          message: "Attendance / check-in record exists for this shift date."
        });
        blockedCount++;
        continue;
      }

      // Eligible
      evaluatedResults.push({
        assignmentId: asg.id,
        slotId: asg.slotId,
        businessDate: dateStr,
        status: "ELIGIBLE",
        message: "Eligible for unassignment"
      });
      eligibleCount++;
    }

    // Sort by date
    evaluatedResults.sort((a, b) => a.businessDate.localeCompare(b.businessDate));

    const minDateStr = evaluatedResults[0]?.businessDate || getQatarDateString(slot.businessDate);
    const maxDateStr = evaluatedResults[evaluatedResults.length - 1]?.businessDate || minDateStr;

    const requestPayload = {
      actionType: "UNASSIGNMENT",
      operationType: slot.operationType,
      contractId: slot.contractId,
      anchorAssignmentId: assignmentId,
      employeeId: anchorAsg.employeeId,
      mode,
      policy,
      reasonCode,
      reasonNotes: reasonNotes || "",
      targetAssignmentIds: candidateAssignments.map((a: any) => a.id)
    };

    const requestHash = crypto.createHash("sha256").update(JSON.stringify(requestPayload)).digest("hex");

    // 4. Create Preview Record in ManpowerBulkOperationLog
    const previewId = `unasg-prev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    const tokenPayload = `${previewId}:${user.id}:${requestHash}:${expiresAt.getTime()}`;
    const signature = crypto.createHmac("sha256", PREVIEW_SECRET).update(tokenPayload).digest("hex");
    const previewToken = Buffer.from(`${tokenPayload}:${signature}`).toString("base64url");
    const previewTokenHash = crypto.createHash("sha256").update(previewToken).digest("hex");

    const opLog = await prisma.manpowerBulkOperationLog.create({
      data: {
        previewTokenHash,
        requestHash,
        actorId: user.id,
        actionType: "UNASSIGNMENT",
        operationType: slot.operationType,
        mode,
        strategy: "MANUAL_MAPPING",
        policy,
        status: "PREVIEWED",
        period: minDateStr.substring(0, 7),
        fromDate: new Date(`${minDateStr}T00:00:00.000Z`),
        toDate: new Date(`${maxDateStr}T00:00:00.000Z`),
        requestedCount: candidateAssignments.length,
        createdCount: 0,
        skippedCount: blockedCount,
        failedCount: 0,
        unfilledSeriesCount: 0,
        unusedEmployeeCount: 0,
        requestJson: requestPayload,
        previewJson: {
          candidateCount: candidateAssignments.length,
          eligibleCount,
          blockedCount,
          results: evaluatedResults
        },
        expiresAt
      }
    });

    return NextResponse.json({
      previewToken,
      expiresAt: expiresAt.toISOString(),
      mode,
      policy,
      employee: {
        id: anchorAsg.employee.id,
        name: anchorAsg.employee.name,
        email: anchorAsg.employee.email,
        phone: anchorAsg.employee.phone
      },
      requirementSeries: {
        siteName: slot.site?.name || "Site",
        postName: slot.shiftRequirement?.locationUnit?.name || "Post",
        position: slot.snapshotPosition,
        shiftName: slot.snapshotShiftName,
        slotIndex: slot.slotIndex
      },
      fromDate: minDateStr,
      toDate: maxDateStr,
      activeAssignmentsFound: candidateAssignments.length,
      eligibleCount,
      blockedCount,
      results: evaluatedResults
    });
  } catch (error: any) {
    console.error("BULK UNASSIGNMENT PREVIEW ERROR:", error);
    return NextResponse.json({ error: error.message || "Failed to generate unassignment preview" }, { status: 500 });
  }
}
