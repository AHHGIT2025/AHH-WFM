import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { calculateCostingEstimate } from "@/lib/precontract-costing";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const estimateId = params.id;

  try {
    const estimate = await prisma.preContractCostEstimate.findUnique({
      where: { id: estimateId },
      include: {
        case: { include: { prospectClient: true } },
        survey: { include: { prospectiveSite: true, responses: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            items: true,
            overrides: { orderBy: { overriddenAt: "desc" } }
          }
        }
      }
    });

    if (!estimate) {
      return NextResponse.json({ error: "Costing estimate not found." }, { status: 404 });
    }

    // Permission & Boundary checks
    const isAuthorized =
      isAdminUser(user) ||
      hasPermission(user, "precontract.costing.view") ||
      hasPermission(user, "precontract.costing.manage") ||
      hasPermission(user, "manpower.admin.full_access");

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to view this costing estimate." },
        { status: 403 }
      );
    }

    if (user?.companyId && !isAdminUser(user) && !hasPermission(user, "precontract.costing.crossCompany") && estimate.companyId && estimate.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation." }, { status: 403 });
    }

    return NextResponse.json({ estimate });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch costing estimate detail." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const estimateId = params.id;

  try {
    const body = await request.json();
    const {
      pricingBasis,
      targetMarginPercentage,
      targetMarkupPercentage,
      manualSellingPrice,
      overrides = [],
      createRevision = false,
      revisionReason
    } = body;

    const estimate = await prisma.preContractCostEstimate.findUnique({
      where: { id: estimateId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { items: true, overrides: true }
        }
      }
    });

    if (!estimate) {
      return NextResponse.json({ error: "Costing estimate not found." }, { status: 404 });
    }

    const currentVersion = estimate.versions[0];
    if (!currentVersion) {
      return NextResponse.json({ error: "No version found for this costing estimate." }, { status: 404 });
    }

    // Permission checks
    const hasManage = isAdminUser(user) || hasPermission(user, "precontract.costing.manage") || hasPermission(user, "manpower.admin.full_access");
    const hasOverride = isAdminUser(user) || hasPermission(user, "precontract.costing.override") || hasPermission(user, "manpower.admin.full_access");

    if (!hasManage) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to edit costing estimates." }, { status: 403 });
    }

    if (overrides.length > 0 && !hasOverride) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to override rate or cost line items." }, { status: 403 });
    }

    // If current version is APPROVED or in workflow, editing requires creating a new revision
    if (currentVersion.status === "APPROVED" && !createRevision) {
      return NextResponse.json(
        { error: "Invalid Action: Current costing version is APPROVED. You must specify createRevision: true to revise an approved costing estimate." },
        { status: 400 }
      );
    }

    // Calculate updated figures
    const calculation = await calculateCostingEstimate({
      caseId: estimate.caseId,
      surveyId: estimate.surveyId,
      companyId: estimate.companyId,
      operationType: estimate.operationType,
      pricingBasis: pricingBasis || (currentVersion.pricingBasis as any),
      targetMarginPercentage: targetMarginPercentage !== undefined ? targetMarginPercentage : (currentVersion.targetMarginPercentage ? Number(currentVersion.targetMarginPercentage) : 15.0),
      targetMarkupPercentage: targetMarkupPercentage !== undefined ? targetMarkupPercentage : (currentVersion.targetMarkupPercentage ? Number(currentVersion.targetMarkupPercentage) : null),
      manualSellingPrice: manualSellingPrice !== undefined ? manualSellingPrice : (currentVersion.sellingPrice ? Number(currentVersion.sellingPrice) : null),
      overrides
    });

    if (createRevision || currentVersion.status === "APPROVED") {
      // Create new revision
      const newVersionNumber = estimate.currentVersionNumber + 1;

      const newVersion = await prisma.preContractCostEstimateVersion.create({
        data: {
          estimateId,
          versionNumber: newVersionNumber,
          clonedFromVersionId: currentVersion.id,
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
          },
          overrides: {
            create: overrides.map((o: any) => ({
              fieldPath: `items[${o.elementCode}]`,
              priorValue: "CONFIGURED",
              newValue: `${o.unitRate || o.quantity}`,
              reason: o.reason || revisionReason || "Manual revision override",
              overriddenBy: user?.name || user?.email || user?.id || "USER"
            }))
          }
        }
      });

      // Update Header current version number and status
      const updatedEstimate = await prisma.preContractCostEstimate.update({
        where: { id: estimateId },
        data: {
          currentVersionNumber: newVersionNumber,
          status: "DRAFT",
          updatedAt: new Date()
        },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            include: { items: true, overrides: true }
          }
        }
      });

      return NextResponse.json({ estimate: updatedEstimate, version: newVersion });
    } else {
      // Update existing DRAFT version
      await prisma.preContractCostEstimateItem.deleteMany({
        where: { estimateVersionId: currentVersion.id }
      });

      const updatedVersion = await prisma.preContractCostEstimateVersion.update({
        where: { id: currentVersion.id },
        data: {
          pricingBasis: calculation.pricingBasis,
          currency: calculation.currency,
          costConfigVersionId: calculation.costConfigVersionId,
          totalDirectCost: calculation.totalDirectCost,
          totalIndirectCost: calculation.totalIndirectCost,
          totalCost: calculation.totalCost,
          targetMarginPercentage: calculation.targetMarginPercentage,
          targetMarkupPercentage: calculation.targetMarkupPercentage,
          sellingPrice: calculation.sellingPrice,
          updatedAt: new Date(),
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
      });

      // Create override log entries if overrides were applied
      if (overrides.length > 0) {
        await prisma.preContractCostOverrideLog.createMany({
          data: overrides.map((o: any) => ({
            estimateVersionId: currentVersion.id,
            fieldPath: `items[${o.elementCode}]`,
            priorValue: "CONFIGURED",
            newValue: `${o.unitRate || o.quantity}`,
            reason: o.reason || "Manual line override",
            overriddenBy: user?.name || user?.email || user?.id || "USER"
          }))
        });
      }

      const updatedEstimate = await prisma.preContractCostEstimate.findUnique({
        where: { id: estimateId },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            include: { items: true, overrides: true }
          }
        }
      });

      return NextResponse.json({ estimate: updatedEstimate, version: updatedVersion });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update costing estimate." },
      { status: 500 }
    );
  }
}
