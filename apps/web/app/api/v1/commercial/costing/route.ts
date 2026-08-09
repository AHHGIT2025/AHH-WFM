import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { calculateCostingEstimate } from "@/lib/precontract-costing";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  // 1. Permission Check
  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.costing.view") ||
    hasPermission(user, "precontract.costing.manage") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view commercial costing estimates." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "ALL";
  const operationTypeFilter = searchParams.get("operationType") || "ALL";

  try {
    const whereClause: any = {};

    // Company isolation
    if (user?.companyId && !isAdminUser(user) && !hasPermission(user, "precontract.costing.crossCompany")) {
      whereClause.companyId = user.companyId;
    }

    // Operation scope isolation
    if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
      const allowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
      const allowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

      if (!allowedSG && !allowedFM) {
        return NextResponse.json({ estimates: [] });
      }
      if (allowedSG && !allowedFM) {
        whereClause.operationType = "SECURITY_GUARDING";
      } else if (!allowedSG && allowedFM) {
        whereClause.operationType = "FACILITY_MANAGEMENT";
      }
    }

    if (operationTypeFilter !== "ALL") {
      whereClause.operationType = operationTypeFilter;
    }

    if (statusFilter !== "ALL") {
      whereClause.status = statusFilter;
    }

    if (search) {
      whereClause.OR = [
        { estimateNumber: { contains: search } },
        { case: { title: { contains: search } } },
        { case: { prospectClient: { name: { contains: search } } } }
      ];
    }

    const estimates = await prisma.preContractCostEstimate.findMany({
      where: whereClause,
      include: {
        case: {
          include: {
            prospectClient: true
          }
        },
        survey: {
          include: {
            prospectiveSite: true
          }
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json({ estimates });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch pre-contract costing estimates." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  // 1. Permission Check
  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.costing.manage") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to create commercial costing estimates." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { caseId, surveyId, pricingBasis = "MARGIN", targetMarginPercentage = 15.0, targetMarkupPercentage = null, manualSellingPrice = null } = body;

    if (!caseId || !surveyId) {
      return NextResponse.json(
        { error: "caseId and surveyId are required to create a costing estimate." },
        { status: 400 }
      );
    }

    // Validate Case
    const opCase = await prisma.preContractCase.findUnique({
      where: { id: caseId }
    });
    if (!opCase) {
      return NextResponse.json({ error: "Opportunity case not found." }, { status: 404 });
    }

    // Case lifecycle guard — only active cases may be costed
    const DISALLOWED_CASE_LIFECYCLES = ["CANCELLED", "SUPERSEDED"];
    if (DISALLOWED_CASE_LIFECYCLES.includes(opCase.lifecycle as string)) {
      return NextResponse.json(
        { error: `Costing estimates cannot be created for a case in ${opCase.lifecycle} state. Only active cases (DRAFT, IN_WORKFLOW, COMPLETED) are eligible.` },
        { status: 400 }
      );
    }

    // Company boundary check
    if (user?.companyId && !isAdminUser(user) && !hasPermission(user, "precontract.costing.crossCompany") && opCase.companyId && opCase.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation." }, { status: 403 });
    }

    // Validate Survey
    const survey = await prisma.preContractSurvey.findUnique({
      where: { id: surveyId }
    });
    if (!survey) {
      return NextResponse.json({ error: "Site survey not found." }, { status: 404 });
    }
    if (survey.caseId !== caseId) {
      return NextResponse.json({ error: "Selected site survey does not belong to the specified opportunity case." }, { status: 400 });
    }
    if (survey.lifecycle !== "COMPLETED") {
      return NextResponse.json({ error: "Selected site survey is not COMPLETED. Only COMPLETED surveys can be costed." }, { status: 400 });
    }

    // Calculate initial costing breakdown using domain service
    const calculation = await calculateCostingEstimate({
      caseId,
      surveyId,
      companyId: opCase.companyId,
      operationType: opCase.operationType,
      pricingBasis,
      targetMarginPercentage,
      targetMarkupPercentage,
      manualSellingPrice
    });

    // Create Estimate Header & Version 1 in single database transaction
    const estimate = await prisma.preContractCostEstimate.create({
      data: {
        caseId,
        surveyId,
        companyId: opCase.companyId,
        operationType: opCase.operationType,
        currentVersionNumber: 1,
        status: "DRAFT",
        createdBy: user?.name || user?.email || user?.id || "USER",
        versions: {
          create: {
            versionNumber: 1,
            status: "DRAFT",
            pricingBasis: calculation.pricingBasis,
            currency: calculation.currency,
            costConfigVersionId: calculation.costConfigVersionId,
            totalDirectCost: calculation.totalDirectCost,
            totalIndirectCost: calculation.totalIndirectCost,
            totalCost: calculation.totalCost,
            targetMarginPercentage: calculation.targetMarginPercentage,
            targetMarkupPercentage: calculation.targetMarkupPercentage,
            sellingPrice: calculation.sellingPrice,
            createdBy: user?.name || user?.email || user?.id || "USER",
            items: {
              create: calculation.items.map((item) => ({
                elementCode: item.elementCode,
                elementName: item.elementName,
                categoryCode: item.categoryCode,
                isDirect: item.isDirect,
                unitOfMeasure: item.unitOfMeasure,
                quantity: item.quantity,
                unitRate: item.unitRate,
                totalAmount: item.totalAmount,
                calculationBasis: item.calculationBasis,
                overrideReason: item.overrideReason
              }))
            }
          }
        }
      },
      include: {
        case: { include: { prospectClient: true } },
        survey: { include: { prospectiveSite: true } },
        versions: { include: { items: true, overrides: true } }
      }
    });

    return NextResponse.json({ estimate }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create pre-contract costing estimate." },
      { status: 500 }
    );
  }
}
