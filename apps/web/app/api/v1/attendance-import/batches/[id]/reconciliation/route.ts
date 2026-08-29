import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { isAttendanceReconciliationEnabled } from "@/lib/attendance-reconciliation-engine";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAttendanceReconciliationEnabled()) {
    return NextResponse.json({ error: "Attendance Reconciliation module is disabled by feature flag." }, { status: 403 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  const { id: importBatchId } = await params;
  const url = new URL(request.url);
  const matchClass = url.searchParams.get("classification");
  const employeeId = url.searchParams.get("employeeId");
  const isResolvedParam = url.searchParams.get("isResolved");

  try {
    const importBatch = await prisma.attendanceImportBatch.findUnique({
      where: { id: importBatchId },
      include: { company: true }
    });

    if (!importBatch) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }

    const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
      where: { importBatchId },
      include: {
        company: true,
        snapshots: {
          orderBy: { approvalVersion: "desc" },
          take: 5
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 10
        }
      }
    });

    if (!recBatch) {
      return NextResponse.json({
        importBatch,
        reconciliationBatch: null,
        status: "NOT_STARTED"
      });
    }

    const whereClause: any = {
      reconciliationBatchId: recBatch.id
    };

    if (matchClass && matchClass !== "ALL") {
      whereClause.matchClassification = matchClass;
    }
    if (employeeId) {
      whereClause.employeeId = employeeId;
    }
    if (isResolvedParam !== null && isResolvedParam !== undefined && isResolvedParam !== "") {
      whereClause.isResolved = isResolvedParam === "true";
    }

    const candidates = await prisma.attendanceReconciliationCandidate.findMany({
      where: whereClause,
      include: {
        employee: true,
        site: true,
        contract: true,
        sources: {
          include: {
            importRow: true
          },
          orderBy: { sourceRowNumber: "asc" }
        },
        currentDecision: true
      },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({
      importBatch,
      reconciliationBatch: recBatch,
      candidates,
      snapshots: recBatch.snapshots,
      events: recBatch.events
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to retrieve reconciliation data." }, { status: 500 });
  }
}