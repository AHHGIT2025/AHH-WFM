import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { hasPermission, isAdminUser } from "../../../../../../../lib/permissions";
import { getConversionReadiness, linkClientMasterToCase } from "../../../../../../../lib/contract-conversion";

function hasCompanyAccess(user: any, companyId?: string | null): boolean {
  const canCrossCompany =
    hasPermission(user, "precontract.proposal.crossCompany") ||
    isAdminUser(user) ||
    hasPermission(user, "manpower.admin.full_access");
  if (canCrossCompany || !companyId) return true;
  if (Array.isArray(user?.allowedCompanyIds) && user.allowedCompanyIds.length > 0) {
    return user.allowedCompanyIds.includes(companyId);
  }
  if (user?.companyId) {
    return user.companyId === companyId;
  }
  return true;
}

function hasProposalScopeAccess(user: any, operationType?: string | null): boolean {
  if (isAdminUser(user) || hasPermission(user, "manpower.admin.full_access")) {
    return true;
  }
  const allowedSG = user?.operationAccess?.allowedSecurityGuarding ?? user?.allowedSecurityGuarding ?? true;
  const allowedFM = user?.operationAccess?.allowedFacilityManagement ?? user?.allowedFacilityManagement ?? true;
  if (operationType === "SECURITY_GUARDING") return Boolean(allowedSG);
  if (operationType === "FACILITY_MANAGEMENT") return Boolean(allowedFM);
  return Boolean(allowedSG || allowedFM);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.proposal.view"
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

    if (!hasCompanyAccess(user, proposal.companyId)) {
      return NextResponse.json({ error: "Forbidden: Access to this company proposal is restricted." }, { status: 403 });
    }

    const opType = proposal.operationType || proposal.case?.operationType || null;
    if (!hasProposalScopeAccess(user, opType)) {
      return NextResponse.json({ error: `Forbidden: You do not have access to ${opType || "this operational scope"} proposals.` }, { status: 403 });
    }

    const latestVersion = proposal.versions[0];
    if (!latestVersion) {
      return NextResponse.json({ error: "No version found for proposal." }, { status: 404 });
    }

    const readiness = await getConversionReadiness(latestVersion.id);
    const eligibleClients = await prisma.manpowerClient.findMany({
      where: {
        isActive: true,
        ...(opType ? { operationType: opType } : {})
      },
      select: {
        id: true,
        code: true,
        name: true,
        operationType: true,
        isActive: true
      },
      orderBy: { name: "asc" }
    });

    const canLinkClient =
      isAdminUser(user) ||
      hasPermission(user, "manpower.admin.full_access") ||
      hasPermission(user, "precontract.contractConversion.execute") ||
      hasPermission(user, "precontract.case.manage");

    return NextResponse.json({
      success: true,
      ...readiness,
      eligibleClients,
      canLinkClient
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch conversion readiness." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await checkApiAuth();

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "manpower.admin.full_access") ||
    hasPermission(user, "precontract.contractConversion.execute") ||
    hasPermission(user, "precontract.case.manage");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to link a Client Master for conversion." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { clientId } = body || {};
    if (!clientId || !String(clientId).trim()) {
      return NextResponse.json({ error: "clientId is required." }, { status: 400 });
    }

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

    if (!hasCompanyAccess(user, proposal.companyId)) {
      return NextResponse.json({ error: "Forbidden: Access to this company proposal is restricted." }, { status: 403 });
    }

    const opType = proposal.operationType || proposal.case?.operationType || null;
    if (!hasProposalScopeAccess(user, opType)) {
      return NextResponse.json({ error: `Forbidden: You do not have access to ${opType || "this operational scope"} proposals.` }, { status: 403 });
    }

    const latestVersion = proposal.versions[0];
    if (!latestVersion) {
      return NextResponse.json({ error: "No version found for proposal." }, { status: 404 });
    }

    const currentReadiness = await getConversionReadiness(latestVersion.id);
    if (currentReadiness.existingContract) {
      return NextResponse.json(
        { error: "Cannot change linked Client Master after contract conversion has completed." },
        { status: 400 }
      );
    }

    await linkClientMasterToCase({
      caseId: proposal.caseId,
      clientId: String(clientId),
      expectedOperationType: opType
    });

    const updatedReadiness = await getConversionReadiness(latestVersion.id);
    const eligibleClients = await prisma.manpowerClient.findMany({
      where: {
        isActive: true,
        ...(opType ? { operationType: opType } : {})
      },
      select: {
        id: true,
        code: true,
        name: true,
        operationType: true,
        isActive: true
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({
      success: true,
      ...updatedReadiness,
      eligibleClients,
      canLinkClient: true
    });
  } catch (err: any) {
    const msg = err.message || "Failed to link Client Master.";
    const status = msg.includes("Scope Mismatch") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
