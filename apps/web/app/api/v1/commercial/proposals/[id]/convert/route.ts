import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { hasPermission, isAdminUser } from "../../../../../../../lib/permissions";
import { convertToContract } from "../../../../../../../lib/contract-conversion";
import { assessCostingValidation, formatCostingValidationBlockError } from "../../../../../../../lib/precontract-costing";
import { isAllowlistedUatCostingRecord, UAT_UNVALIDATED_COSTING_BANNER } from "../../../../../../../lib/uat-costing-exception";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.contractConversion.execute"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const proposal = await prisma.preContractProposal.findUnique({
      where: { id: params.id },
      include: {
        case: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: {
            costEstimate: { include: { survey: { include: { responses: true } } } },
            costEstimateVersion: { include: { items: true, overrides: true } }
          }
        }
      }
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const canCrossCompany = hasPermission(user, "precontract.proposal.crossCompany") || isAdminUser(user) || hasPermission(user, "manpower.admin.full_access");
    if (!canCrossCompany && proposal.companyId) {
      if (Array.isArray(user.allowedCompanyIds) && user.allowedCompanyIds.length > 0 && !user.allowedCompanyIds.includes(proposal.companyId)) {
        return NextResponse.json({ error: "Forbidden: Access to this company proposal is restricted." }, { status: 403 });
      }
      if (user.companyId && proposal.companyId !== user.companyId) {
        return NextResponse.json({ error: "Forbidden: Access to this company proposal is restricted." }, { status: 403 });
      }
    }

    if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
      const opType = proposal.operationType || proposal.case?.operationType;
      const allowedSG = user?.operationAccess?.allowedSecurityGuarding ?? user?.allowedSecurityGuarding ?? true;
      const allowedFM = user?.operationAccess?.allowedFacilityManagement ?? user?.allowedFacilityManagement ?? true;
      if ((opType === "SECURITY_GUARDING" && !allowedSG) || (opType === "FACILITY_MANAGEMENT" && !allowedFM)) {
        return NextResponse.json({ error: `Forbidden: You do not have access to ${opType} proposals.` }, { status: 403 });
      }
    }

    const latestVersion = proposal.versions[0];
    if (!latestVersion) {
      return NextResponse.json({ error: "No version found for proposal." }, { status: 404 });
    }

    // Hard block contract conversion (and downstream billing/payroll/SAP) on unvalidated or UAT-excepted costing
    if (latestVersion.costEstimateVersion) {
      const validationSummary = assessCostingValidation(
        latestVersion.costEstimate?.survey?.responses,
        latestVersion.costEstimateVersion
      );
      if (validationSummary.blocksCommercialSubmission) {
        const isUat = latestVersion.costEstimate
          ? isAllowlistedUatCostingRecord({
              id: latestVersion.costEstimate.id,
              caseId: latestVersion.costEstimate.caseId,
              estimateCode: `COST-${latestVersion.costEstimate.id.slice(0, 8).toUpperCase()}`,
            })
          : false;
        const baseError = formatCostingValidationBlockError(validationSummary, "converting proposal to contract", "DEF-104 Conversion Guard");
        return NextResponse.json(
          {
            error: isUat
              ? `${UAT_UNVALIDATED_COSTING_BANNER}: Contract conversion, billing, payroll, and SAP posting are blocked for UAT-excepted unvalidated costing. ${baseError}`
              : baseError,
            uatBanner: isUat ? UAT_UNVALIDATED_COSTING_BANNER : undefined,
            validationSummary
          },
          { status: 400 }
        );
      }
    }

    const body = await req.json();
    const { contractNumber, startDate, endDate, noticePeriodDays, clientId, siteId, projectId, billingBasis, totalContractValue, manpowerItems, shiftItems, relieverItems, documentIds } = body;

    if (!contractNumber || !String(contractNumber).trim()) {
      return NextResponse.json({ error: "contractNumber is required." }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required." }, { status: 400 });
    }

    const result = await convertToContract({
      proposalVersionId: latestVersion.id,
      contractNumber,
      startDate,
      endDate,
      noticePeriodDays,
      clientId,
      siteId,
      projectId,
      billingBasis,
      totalContractValue,
      manpowerItems,
      shiftItems,
      relieverItems,
      documentIds,
      userId: user.id || "system"
    });

    return NextResponse.json({
      success: true,
      alreadyConverted: result.alreadyConverted || false,
      contract: result.contract
    });
  } catch (err: any) {
    const msg = err.message || "Failed to convert proposal to contract.";
    const status = msg.includes("Forbidden Scope Mismatch") ? 403 : 400;
    return NextResponse.json(
      { error: msg },
      { status }
    );
  }
}
