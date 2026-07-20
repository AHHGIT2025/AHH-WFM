import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { listOperationalAlerts } from "@/lib/secfac-alert-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operationTypeParam = searchParams.get("operationType");

  if (!operationTypeParam || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationTypeParam)) {
    return NextResponse.json(
      { error: "Explicit valid operationType parameter ('SECURITY_GUARDING' or 'FACILITY_MANAGEMENT') is required." },
      { status: 400 }
    );
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationTypeParam as any,
    requiredPermission: "secfac.alerts.view"
  });
  if (auth.error) return auth.error;

  try {
    const status = searchParams.getAll("status");
    const severity = searchParams.getAll("severity");
    const alertCode = searchParams.get("alertCode") || undefined;
    const siteId = searchParams.get("siteId") || undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const assignedUserId = searchParams.get("assignedUserId") || undefined;
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;
    const escalatedOnly = searchParams.get("escalatedOnly") === "true";
    const unassignedOnly = searchParams.get("unassignedOnly") === "true";
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const sortBy = searchParams.get("sortBy") || "firstDetectedAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

    const result = await listOperationalAlerts({
      operationType: operationTypeParam as any,
      status: status.length > 0 ? (status.length === 1 ? status[0] : status) : undefined,
      severity: severity.length > 0 ? (severity.length === 1 ? severity[0] : severity) : undefined,
      alertCode,
      siteId,
      projectId,
      assignedUserId,
      fromDate,
      toDate,
      escalatedOnly,
      unassignedOnly,
      search,
      page,
      pageSize,
      sortBy,
      sortOrder
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("GET /api/v1/secfac/alerts error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
