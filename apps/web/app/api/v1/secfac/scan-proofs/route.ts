import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};

  try {
    const body = await request.json();
    const {
      assignmentId,
      executionId,
      checkpointId,
      scanMode,
      scannedValue,
      exceptionReason,
      latitude,
      longitude,
      gpsAccuracyMeters,
      deviceInfo
    } = body;

    // 1. Core validations
    if (!assignmentId) {
      return NextResponse.json({ success: false, error: "assignmentId is required" }, { status: 400 });
    }
    if (!checkpointId) {
      return NextResponse.json({ success: false, error: "checkpointId is required" }, { status: 400 });
    }
    if (!scanMode || !["NFC", "QR", "MANUAL_ENTRY", "MANUAL_EXCEPTION"].includes(scanMode)) {
      return NextResponse.json({ success: false, error: "Invalid scanMode" }, { status: 400 });
    }

    // 2. Fetch assignment
    const assignment = await mockDb.getSecfacAssignmentById(assignmentId);
    if (!assignment || !assignment.isActive) {
      return NextResponse.json({ success: false, error: "Active assignment not found" }, { status: 404 });
    }

    // Enforce role/ownership check for standard employees
    const isStandardEmployee = !isAdmin && !["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));
    if (isStandardEmployee && assignment.employeeId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden: Cannot scan for another employee's assignment" }, { status: 403 });
    }

    // Permitted scope check for supervisor/admin
    let allowedOps: string[] = [];
    if (isAdmin) {
      allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
    } else {
      if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
      if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
    }
    if (!allowedOps.includes(assignment.operationType)) {
      return NextResponse.json({ success: false, error: "Forbidden: No access to this operation scope" }, { status: 403 });
    }

    // 3. Fetch checkpoint
    const checkpoint = await mockDb.getSecfacCheckpointById(checkpointId);
    if (!checkpoint || !checkpoint.isActive) {
      return NextResponse.json({ success: false, error: "Checkpoint not found" }, { status: 404 });
    }

    // Checkpoint validations
    if (assignment.checkpointId && assignment.checkpointId !== checkpointId) {
      return NextResponse.json({ success: false, error: "Checkpoint does not match assignment checkpoint" }, { status: 400 });
    }
    if (checkpoint.operationType !== assignment.operationType) {
      return NextResponse.json({ success: false, error: "Checkpoint operation type mismatch" }, { status: 400 });
    }
    if (checkpoint.siteId !== assignment.siteId) {
      return NextResponse.json({ success: false, error: "Checkpoint site mismatch" }, { status: 400 });
    }

    // 4. Validate scan value and geofence
    let validationStatus = "PENDING";
    let failureReason = null;
    let expectedValue = null;

    // Check code/tag matching if not exception
    if (scanMode === "NFC") {
      expectedValue = checkpoint.nfcTagId || null;
      if (!expectedValue || scannedValue !== expectedValue) {
        validationStatus = "INVALID";
        failureReason = "Incorrect NFC tag ID";
      } else {
        validationStatus = "VALID";
      }
    } else if (scanMode === "QR") {
      expectedValue = checkpoint.qrCode || null;
      if (!expectedValue || scannedValue !== expectedValue) {
        validationStatus = "INVALID";
        failureReason = "Incorrect QR code";
      } else {
        validationStatus = "VALID";
      }
    } else if (scanMode === "MANUAL_ENTRY") {
      const expectedNfc = checkpoint.nfcTagId || null;
      const expectedQr = checkpoint.qrCode || null;
      if ((expectedNfc && scannedValue === expectedNfc) || (expectedQr && scannedValue === expectedQr)) {
        validationStatus = "VALID";
        expectedValue = expectedNfc && scannedValue === expectedNfc ? expectedNfc : expectedQr;
      } else {
        validationStatus = "INVALID";
        failureReason = "Incorrect code";
      }
    } else if (scanMode === "MANUAL_EXCEPTION") {
      if (!exceptionReason || exceptionReason.trim() === "") {
        return NextResponse.json({ success: false, error: "exceptionReason is required for manual exceptions" }, { status: 400 });
      }
      validationStatus = "PENDING_REVIEW";
    }

    // Geofence validation
    if (assignment.templateId) {
      const template = await mockDb.getSecfacChecklistById(assignment.templateId);
      if (template?.requiresGeoFence === true && checkpoint.latitude !== null && checkpoint.longitude !== null && checkpoint.radiusMeters !== null) {
        if (latitude === undefined || longitude === undefined) {
          validationStatus = scanMode === "MANUAL_EXCEPTION" ? "PENDING_REVIEW" : "INVALID";
          failureReason = "GPS coordinates required but missing";
        } else {
          const distance = calculateDistance(
            Number(latitude),
            Number(longitude),
            Number(checkpoint.latitude),
            Number(checkpoint.longitude)
          );
          if (distance > Number(checkpoint.radiusMeters)) {
            validationStatus = scanMode === "MANUAL_EXCEPTION" ? "PENDING_REVIEW" : "INVALID";
            failureReason = `Out of geofence zone: distance is ${distance.toFixed(1)}m, limit is ${checkpoint.radiusMeters}m`;
          }
        }
      }
    }

    // 5. Create scan proof record
    const result = await mockDb.createSecfacScanProof({
      operationType: assignment.operationType,
      assignmentId,
      executionId: executionId || null,
      checkpointId,
      employeeId: assignment.employeeId,
      siteId: assignment.siteId,
      scanMode,
      scannedValue,
      expectedValue,
      validationStatus,
      failureReason,
      exceptionReason,
      latitude,
      longitude,
      gpsAccuracyMeters,
      deviceInfo
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};

  const { searchParams } = new URL(request.url);
  const filters: any = { isActive: true };
  if (searchParams.get("operationType")) filters.operationType = searchParams.get("operationType");
  if (searchParams.get("assignmentId")) filters.assignmentId = searchParams.get("assignmentId");
  if (searchParams.get("executionId")) filters.executionId = searchParams.get("executionId");
  if (searchParams.get("checkpointId")) filters.checkpointId = searchParams.get("checkpointId");
  if (searchParams.get("employeeId")) filters.employeeId = searchParams.get("employeeId");
  if (searchParams.get("siteId")) filters.siteId = searchParams.get("siteId");
  if (searchParams.get("scanMode")) filters.scanMode = searchParams.get("scanMode");
  if (searchParams.get("validationStatus")) filters.validationStatus = searchParams.get("validationStatus");

  try {
    // Ownership checks for standard employees
    const isStandardEmployee = !isAdmin && !["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));
    if (isStandardEmployee) {
      filters.employeeId = user.id;
    }

    // Permitted scope checks for supervisors
    let allowedOps: string[] = [];
    if (isAdmin) {
      allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
    } else {
      if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
      if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
    }

    if (filters.operationType && !allowedOps.includes(filters.operationType)) {
      return NextResponse.json({ success: false, error: "Forbidden: No access to this operation scope" }, { status: 403 });
    }

    const proofs = await mockDb.getSecfacScanProofs(filters);
    
    // Filter the final list to enforce permitted scope if filters.operationType was not provided
    const filteredProofs = proofs.filter((p: any) => allowedOps.includes(p.operationType));

    return NextResponse.json({ success: true, data: filteredProofs });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
