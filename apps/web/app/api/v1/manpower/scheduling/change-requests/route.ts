import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { PrismaClient } from "@ahh-wfm/database";
import { logCentralAudit } from "../../../../../../lib/roster-publication-service";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "SCHEDULER", "PROJECT_COORDINATOR"], {
    requiredPermission: "manpower.roster.changeRequest.submit"
  });
  if (auth.error) return auth.error;

  const sessionUser = auth.session.user;
  const body = await req.json();
  const {
    basePublicationId,
    publicationSlotId,
    changeType,
    targetEmployeeId,
    proposedShiftName,
    proposedStartTime,
    proposedEndTime,
    reason
  } = body;

  if (!basePublicationId || !publicationSlotId || !changeType || !reason) {
    return NextResponse.json(
      { error: "Missing required fields: basePublicationId, publicationSlotId, changeType, reason" },
      { status: 400 }
    );
  }

  const validChangeTypes = [
    "EMPLOYEE_REPLACEMENT",
    "ASSIGNMENT_REMOVAL",
    "SHIFT_TIME_CHANGE",
    "SLOT_CANCELLATION",
    "SLOT_REACTIVATION"
  ];

  if (!validChangeTypes.includes(changeType)) {
    return NextResponse.json({ error: `Invalid changeType: ${changeType}` }, { status: 400 });
  }

  const pubSlot = await prisma.rosterPublicationSlot.findUnique({
    where: { id: publicationSlotId },
    include: {
      publication: true,
      slot: true
    }
  });

  if (!pubSlot) {
    return NextResponse.json({ error: "Target publication slot not found" }, { status: 404 });
  }

  const basePub = pubSlot.publication;
  if (basePub.id !== basePublicationId) {
    return NextResponse.json({ error: "Publication slot does not match basePublicationId" }, { status: 400 });
  }

  if (basePub.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Cannot submit change request against ${basePub.status} publication. Base publication must be ACTIVE.` },
      { status: 409 }
    );
  }

  const activeRequestKey = `REQ:${basePub.id}:${pubSlot.id}`;
  const existingPending = await prisma.rosterChangeRequest.findUnique({
    where: { activeRequestKey }
  });

  if (existingPending) {
    return NextResponse.json(
      { error: "A change request is already pending for this published slot", existingRequestId: existingPending.id },
      { status: 409 }
    );
  }

  const beforeSnapshot = {
    publicationSlotId: pubSlot.id,
    slotId: pubSlot.slotId,
    employeeId: pubSlot.employeeId,
    employeeCode: pubSlot.employeeCode,
    employeeName: pubSlot.employeeName,
    position: pubSlot.position,
    shiftName: pubSlot.shiftName,
    startTime: pubSlot.startTime,
    endTime: pubSlot.endTime,
    businessDate: pubSlot.businessDate,
    coverageType: pubSlot.coverageType,
    assignmentStatus: pubSlot.assignmentStatus
  };

  let proposedEmployeeName = pubSlot.employeeName;
  let proposedEmployeeCode = pubSlot.employeeCode;

  if (targetEmployeeId) {
    const targetEmp = await prisma.employee.findUnique({ where: { id: targetEmployeeId } });
    if (targetEmp) {
      proposedEmployeeName = targetEmp.name;
      proposedEmployeeCode = targetEmp.id;
    }
  }

  const proposedSnapshot = {
    publicationSlotId: pubSlot.id,
    slotId: pubSlot.slotId,
    employeeId: changeType === "ASSIGNMENT_REMOVAL" ? null : (targetEmployeeId || pubSlot.employeeId),
    employeeCode: changeType === "ASSIGNMENT_REMOVAL" ? null : (targetEmployeeId ? proposedEmployeeCode : pubSlot.employeeCode),
    employeeName: changeType === "ASSIGNMENT_REMOVAL" ? null : (targetEmployeeId ? proposedEmployeeName : pubSlot.employeeName),
    position: pubSlot.position,
    shiftName: proposedShiftName || pubSlot.shiftName,
    startTime: proposedStartTime || pubSlot.startTime,
    endTime: proposedEndTime || pubSlot.endTime,
    businessDate: pubSlot.businessDate,
    coverageType: changeType === "ASSIGNMENT_REMOVAL" ? "VACANT" : pubSlot.coverageType,
    assignmentStatus: changeType === "ASSIGNMENT_REMOVAL" ? "UNFILLED" : "ACTIVE"
  };

  const requesterId = (sessionUser as any)?.employeeId || sessionUser.id;

  const changeRequest = await prisma.rosterChangeRequest.create({
    data: {
      operationType: basePub.operationType,
      contractId: basePub.contractId,
      siteId: basePub.siteId,
      basePublicationId: basePub.id,
      basePublicationVersion: basePub.publicationVersion,
      publicationSlotId: pubSlot.id,
      slotId: pubSlot.slotId,
      primaryAssignmentId: pubSlot.sourceAssignmentId,
      activeRequestKey,
      changeType,
      targetEmployeeId: targetEmployeeId || null,
      proposedShiftName: proposedShiftName || null,
      proposedStartTime: proposedStartTime || null,
      proposedEndTime: proposedEndTime || null,
      beforeSnapshot,
      proposedSnapshot,
      reason,
      status: "PENDING",
      requestedById: requesterId
    }
  });

  await logCentralAudit({
    action: "SUBMIT_CHANGE_REQUEST",
    actorId: sessionUser.id,
    operationType: basePub.operationType,
    contractId: basePub.contractId,
    siteId: basePub.siteId || undefined,
    requestId: changeRequest.id,
    details: { changeType, slotId: pubSlot.slotId, baseVersion: basePub.publicationVersion }
  });

  return NextResponse.json({ success: true, changeRequest }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "SCHEDULER", "PROJECT_COORDINATOR"], {
    requiredPermission: "manpower.roster.changeRequest.review"
  });
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const operationType = url.searchParams.get("operationType");
  const contractId = url.searchParams.get("contractId");
  const siteId = url.searchParams.get("siteId");
  const status = url.searchParams.get("status");

  if (!operationType || !contractId) {
    return NextResponse.json({ error: "Missing required query params: operationType, contractId" }, { status: 400 });
  }

  try {
    const changeRequests = await prisma.rosterChangeRequest.findMany({
      where: {
        operationType,
        contractId,
        ...(siteId ? { siteId } : {}),
        ...(status ? { status } : {})
      },
      include: {
        requestedBy: {
          select: { id: true, name: true }
        },
        reviewedBy: {
          select: { id: true, name: true }
        },
        targetEmployee: {
          select: { id: true, name: true }
        },
        basePublication: {
          select: { id: true, publicationVersion: true, status: true }
        },
        publicationSlot: true
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ success: true, changeRequests });
  } catch (err: any) {
    console.error("[GET /change-requests Error]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
