import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { hasPermission, isAdminUser } from "../../../../../../../lib/permissions";
import { convertToContract } from "../../../../../../../lib/contract-conversion";

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
          take: 1
        }
      }
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const canCrossCompany = hasPermission(user, "precontract.proposal.crossCompany") || isAdminUser(user) || hasPermission(user, "manpower.admin.full_access");
    if (!canCrossCompany && proposal.companyId && user.companyId && proposal.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Access to this company proposal is restricted." }, { status: 403 });
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
