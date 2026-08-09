import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { getQatarDate, getQatarDateString } from "@/lib/roster-engine";
import { getEffectiveContractManpower, getRelieverEligibilityWhere } from "@/lib/contract-helpers";
import { getCommercialHealthAggregations } from "@/lib/commercial-health-helpers";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  // Permission Check
  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "commercial.commandCenter.view") ||
    hasPermission(user, "manpower.admin.full_access") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.fm.view") ||
    hasPermission(user, "reports.executive.view");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view Commercial Health analytics." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);

  // Parse & Validate Date Parameters
  const dateParam = searchParams.get("businessDate");
  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");

  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam.trim())) {
    return NextResponse.json(
      { error: "Invalid businessDate filter format. Expected format: YYYY-MM-DD." },
      { status: 400 }
    );
  }
  if (dateFromParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateFromParam.trim())) {
    return NextResponse.json(
      { error: "Invalid dateFrom filter format. Expected format: YYYY-MM-DD." },
      { status: 400 }
    );
  }
  if (dateToParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateToParam.trim())) {
    return NextResponse.json(
      { error: "Invalid dateTo filter format. Expected format: YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const businessDateStr = dateParam ? dateParam.trim() : getQatarDateString(new Date());
  const dateFromStr = dateFromParam ? dateFromParam.trim() : businessDateStr;
  const dateToStr = dateToParam ? dateToParam.trim() : businessDateStr;

  const dateFromObj = getQatarDate(dateFromStr);
  const dateToObj = getQatarDate(dateToStr);

  if (dateFromObj.getTime() > dateToObj.getTime()) {
    return NextResponse.json(
      { error: "Invalid date range: dateFrom cannot be after dateTo." },
      { status: 400 }
    );
  }

  const diffMs = dateToObj.getTime() - dateFromObj.getTime();
  const rangeLengthDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

  // Maximum supported date range is 31 days
  if (rangeLengthDays > 31) {
    return NextResponse.json(
      { error: "Date range exceeds maximum supported limit of 31 days." },
      { status: 400 }
    );
  }

  const targetDateStart = new Date(dateFromObj.getFullYear(), dateFromObj.getMonth(), dateFromObj.getDate(), 0, 0, 0);
  const targetDateEnd = new Date(dateToObj.getFullYear(), dateToObj.getMonth(), dateToObj.getDate(), 23, 59, 59);

  let companyId = searchParams.get("companyId") || undefined;
  let operationType = searchParams.get("operationType") || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const contractId = searchParams.get("contractId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const healthStatusFilter = searchParams.get("healthStatus") || "ALL";
  const slaRiskFilter = searchParams.get("slaRisk") || "ALL";
  const expiryStatusFilter = searchParams.get("expiryStatus") || "ALL";

  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const rawLimit = parseInt(searchParams.get("limit") || "50", 10);

  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 100);

  // Validate operationType
  if (
    operationType &&
    !["ALL", "SECURITY_GUARDING", "FACILITY_MANAGEMENT", "WHITE_COLLAR"].includes(operationType)
  ) {
    return NextResponse.json(
      { error: "Invalid operationType filter. Expected SECURITY_GUARDING, FACILITY_MANAGEMENT, or WHITE_COLLAR." },
      { status: 400 }
    );
  }

  // Company Isolation
  if (user?.companyId && !isAdminUser(user) && !hasPermission(user, "commercial.commandCenter.crossCompany")) {
    companyId = user.companyId;
  }

  // SG / FM Scope Isolation Check
  if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
    const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
    const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

    if (operationType === "SECURITY_GUARDING" && !userAllowedSG) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to Security Guarding operational data." },
        { status: 403 }
      );
    }
    if (operationType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to Facility Management operational data." },
        { status: 403 }
      );
    }

    if (!operationType || operationType === "ALL") {
      if (userAllowedSG && !userAllowedFM) {
        operationType = "SECURITY_GUARDING";
      } else if (!userAllowedSG && userAllowedFM) {
        operationType = "FACILITY_MANAGEMENT";
      }
    }
  }

  try {
    // Single Contract Direct Access Protection Check
    if (contractId) {
      const existingContract = await prisma.manpowerContract.findUnique({
        where: { id: contractId },
        select: { id: true, operationType: true, clientId: true }
      });

      if (existingContract) {
        if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
          const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
          const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

          if (existingContract.operationType === "SECURITY_GUARDING" && !userAllowedSG) {
            return NextResponse.json(
              { error: "Forbidden: Direct access denied. You lack access to this contract's operation scope." },
              { status: 403 }
            );
          }
          if (existingContract.operationType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
            return NextResponse.json(
              { error: "Forbidden: Direct access denied. You lack access to this contract's operation scope." },
              { status: 403 }
            );
          }
        }
      }
    }

    const result = await getCommercialHealthAggregations({
      companyId,
      operationType,
      businessDateStr,
      dateFromStr,
      dateToStr,
      clientId,
      contractId,
      siteId,
      projectId,
      healthStatusFilter,
      slaRiskFilter,
      expiryStatusFilter,
      page,
      limit,
      user
    });

    return NextResponse.json({
      context: {
        businessDate: result.businessDate,
        dateFrom: result.dateFrom,
        dateTo: result.dateTo,
        rangeLengthDays: result.rangeLengthDays,
        operationType: operationType || "ALL",
        companyId: companyId || null,
        clientId: clientId || null,
        contractId: contractId || null,
        siteId: siteId || null,
        scopeIsolation: {
          userRole: user?.role || "USER",
          companyBound: Boolean(user?.companyId),
          allowedSecurityGuarding: user?.operationAccess?.allowedSecurityGuarding ?? true,
          allowedFacilityManagement: user?.operationAccess?.allowedFacilityManagement ?? true
        },
        trends: "DEFERRED_NO_EFFICIENT_AUTHORITATIVE_SOURCE"
      },
      portfolioMetrics: result.portfolioMetrics,
      pagination: result.pagination,
      contracts: result.contracts,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("COMMERCIAL HEALTH ANALYTICS API ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to aggregate Commercial Health & SLA Analytics data." },
      { status: 500 }
    );
  }
}
