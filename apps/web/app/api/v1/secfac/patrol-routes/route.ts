import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));

  const { searchParams } = new URL(request.url);
  const operationTypeFilter = searchParams.get("operationType");
  const siteId = searchParams.get("siteId");
  const isActive = searchParams.get("isActive");

  // Determine allowed scopes
  let allowedOps: string[] = [];
  if (isAdmin) {
    allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
  } else {
    if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
    if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
  }

  // Field Employee Security check
  if (!isAdmin && !isSupervisor) {
    // Field employee can only read routes linked to their active assignments.
    // They are not allowed to list all route masters.
    return NextResponse.json({ success: false, error: "Forbidden: Field employees cannot list route masters" }, { status: 403 });
  }

  if (allowedOps.length === 0) {
    return NextResponse.json({ success: false, error: "Forbidden: No operations access allowed" }, { status: 403 });
  }

  let targetOp = operationTypeFilter;
  if (targetOp) {
    if (!allowedOps.includes(targetOp)) {
      return NextResponse.json({ success: false, error: `Forbidden: No access to operation type ${targetOp}` }, { status: 403 });
    }
  }

  try {
    const routes = await mockDb.getSecfacPatrolRoutes({
      operationType: targetOp || undefined,
      siteId: siteId || undefined,
      isActive: isActive !== null ? isActive : undefined
    });

    let filtered = routes;
    if (!isAdmin) {
      filtered = routes.filter(x => allowedOps.includes(x.operationType));
    }

    return NextResponse.json({ success: true, data: filtered });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve patrol routes", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));

  if (!isAdmin && !isSupervisor) {
    return NextResponse.json({ success: false, error: "Forbidden: Field employees cannot create route masters" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const {
      operationType,
      routeName,
      routeCode,
      description,
      siteId,
      checkpoints
    } = payload;

    // 1. Mandatory Fields
    if (!routeName) {
      return NextResponse.json({ success: false, error: "routeName is required" }, { status: 400 });
    }
    if (!siteId) {
      return NextResponse.json({ success: false, error: "siteId is required" }, { status: 400 });
    }
    if (!operationType) {
      return NextResponse.json({ success: false, error: "operationType is required" }, { status: 400 });
    }

    // 2. Validate Operation Type Value
    if (operationType !== "SECURITY_GUARDING" && operationType !== "FACILITY_MANAGEMENT") {
      return NextResponse.json({ success: false, error: "Invalid operationType value" }, { status: 400 });
    }

    // 3. User Scope Restrictions
    if (!isAdmin) {
      if (operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No security operations access allowed" }, { status: 403 });
      }
      if (operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No facility operations access allowed" }, { status: 403 });
      }
    }

    // 4. Validate Checkpoints presence
    if (!checkpoints || !Array.isArray(checkpoints) || checkpoints.length === 0) {
      return NextResponse.json({ success: false, error: "At least one checkpoint is required for a patrol route" }, { status: 400 });
    }

    // 5. Validate Sequence uniqueness
    const seqs = checkpoints.map((c: any) => Number(c.sequenceNo));
    const uniqueSeqs = new Set(seqs);
    if (seqs.some(isNaN)) {
      return NextResponse.json({ success: false, error: "checkpoint sequenceNo must be numeric" }, { status: 400 });
    }
    if (uniqueSeqs.size !== seqs.length) {
      return NextResponse.json({ success: false, error: "Duplicate sequenceNo within route" }, { status: 400 });
    }

    // 6. Validate each checkpoint exists, is active, matches siteId and operationType
    for (const item of checkpoints) {
      const cp = await mockDb.getSecfacCheckpointById(item.checkpointId);
      if (!cp || !cp.isActive) {
        return NextResponse.json({ success: false, error: `Checkpoint with ID ${item.checkpointId} not found or inactive` }, { status: 400 });
      }
      if (cp.siteId !== siteId) {
        return NextResponse.json({ success: false, error: `Checkpoint ${cp.checkpointName} belongs to a different site` }, { status: 400 });
      }
      if (cp.operationType !== operationType) {
        return NextResponse.json({ success: false, error: `Checkpoint ${cp.checkpointName} operation type mismatch` }, { status: 400 });
      }
    }

    // 7. Create
    const newRoute = await mockDb.createSecfacPatrolRoute({
      operationType,
      routeName,
      routeCode: routeCode || null,
      description: description || null,
      siteId,
      checkpoints: checkpoints.map((c: any) => ({
        checkpointId: c.checkpointId,
        sequenceNo: Number(c.sequenceNo),
        required: c.required !== undefined ? !!c.required : true
      })),
      isActive: true
    });

    return NextResponse.json({ success: true, data: newRoute });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to create patrol route", error: error.message }, { status: 500 });
  }
}
