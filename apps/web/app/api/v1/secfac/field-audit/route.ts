import { NextResponse } from "next/server";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
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

  // 1. Enforce RBAC: only admins and supervisors allowed
  if (!isAdmin && !isSupervisor) {
    return NextResponse.json({ success: false, error: "Forbidden: Access denied to field audit logs" }, { status: 403 });
  }

  // 2. Parse query parameters
  const { searchParams } = new URL(request.url);
  const operationTypeFilter = searchParams.get("operationType") || undefined;
  const employeeId = searchParams.get("employeeId") || undefined;
  const actionType = searchParams.get("actionType") || undefined;
  const resultStatus = searchParams.get("resultStatus") || undefined;
  const syncMode = searchParams.get("syncMode") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const search = searchParams.get("search") || undefined;

  // 3. Determine allowed operation scopes
  let allowedOps: string[] = [];
  if (isAdmin) {
    allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
  } else {
    if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
    if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
  }

  if (allowedOps.length === 0) {
    return NextResponse.json({ success: false, error: "Forbidden: No operations access allowed" }, { status: 403 });
  }

  // 4. Resolve operationType filter vs allowedOps
  let targetOp: string | undefined = operationTypeFilter;
  if (targetOp) {
    if (!allowedOps.includes(targetOp)) {
      return NextResponse.json({ success: false, error: `Forbidden: No access to operation type ${targetOp}` }, { status: 403 });
    }
  }

  try {
    let audits: any[] = [];
    const dbConnected = isDbConnected();

    if (dbConnected) {
      // Build Prisma where clause
      const where: any = {
        operationType: targetOp ? targetOp : { in: allowedOps }
      };

      if (employeeId) {
        where.employeeId = employeeId;
      }
      if (actionType) {
        where.actionType = actionType;
      }
      if (resultStatus) {
        where.resultStatus = resultStatus;
      }
      if (syncMode) {
        where.syncMode = syncMode;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      if (search) {
        where.OR = [
          { employeeName: { contains: search } },
          { employeeCode: { contains: search } },
          { resultMessage: { contains: search } },
          { actionType: { contains: search } }
        ];
      }

      audits = await prisma.secfacFieldExecutionAudit.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: {
              name: true,
              id: true,
              role: true
            }
          }
        }
      });
    } else {
      // Fetch using mock-data helper
      audits = await mockDb.getSecfacFieldExecutionAudits({
        operationType: targetOp,
        employeeId,
        actionType,
        resultStatus,
        syncMode,
        startDate,
        endDate,
        search
      });

      // Filter by allowedOps manually for memory mockDb fallback
      audits = audits.filter(a => allowedOps.includes(a.operationType));
    }

    return NextResponse.json({ success: true, data: audits });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve field audit trail", error: error.message }, { status: 500 });
  }
}
