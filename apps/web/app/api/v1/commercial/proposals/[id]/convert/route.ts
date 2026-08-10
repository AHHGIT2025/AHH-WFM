import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../lib/permissions";
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
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      }
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const canCrossCompany = hasPermission(user, "precontract.proposal.crossCompany") || user.role === "SUPER_ADMIN" || user.role === "ADMIN" || hasPermission(user, "manpower.admin.full_access");
    if (!canCrossCompany && proposal.companyId && user.companyId && proposal.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Access to this company proposal is restricted." }, { status: 403 });
    }

    const latestVersion = proposal.versions[0];
    if (!latestVersion) {
      return NextResponse.json({ error: "No version found for proposal." }, { status: 404 });
    }

    const body = await req.json();
    const { contractNumber, startDate, endDate, clientId, siteId, projectId, billingBasis, totalContractValue, manpowerItems, shiftItems, relieverItems, documentIds } = body;

    if (!contractNumber) {
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
    return NextResponse.json(
      { error: err.message || "Failed to convert proposal to contract." },
      { status: 400 }
    );
  }
}
