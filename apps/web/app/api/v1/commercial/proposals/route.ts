import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../lib/api-guards";
import { hasPermission } from "../../../../../lib/permissions";
import { toClientSafeProposalDTO } from "../../../../../lib/precontract-proposal";

export async function GET(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.proposal.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const { searchParams } = new URL(req.url);
    const companyIdParam = searchParams.get("companyId");
    const operationTypeParam = searchParams.get("operationType");
    const statusParam = searchParams.get("status");
    const searchParam = searchParams.get("search");

    const where: any = {};

    const canCrossCompany = hasPermission(user, "precontract.proposal.crossCompany") || user.role === "SUPER_ADMIN" || user.role === "ADMIN" || hasPermission(user, "manpower.admin.full_access");
    if (!canCrossCompany) {
      if (user.allowedCompanyIds && user.allowedCompanyIds.length > 0) {
        where.companyId = { in: user.allowedCompanyIds };
      } else if (user.companyId) {
        where.companyId = user.companyId;
      }
    } else if (companyIdParam) {
      where.companyId = companyIdParam;
    }

    if (user.role !== "SUPER_ADMIN" && !hasPermission(user, "manpower.admin.full_access")) {
      const allowedScopes: string[] = [];
      if (user.allowedSecurityGuarding) allowedScopes.push("SECURITY_GUARDING");
      if (user.allowedFacilityManagement) allowedScopes.push("FACILITY_MANAGEMENT");
      if (allowedScopes.length > 0) {
        where.operationType = { in: allowedScopes };
      }
    }
    if (operationTypeParam) {
      where.operationType = operationTypeParam;
    }

    if (statusParam) {
      where.status = statusParam;
    }

    if (searchParam) {
      where.OR = [
        { proposalCode: { contains: searchParam } },
        { case: { title: { contains: searchParam } } },
        { case: { prospectClient: { name: { contains: searchParam } } } }
      ];
    }

    const proposals = await prisma.preContractProposal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        case: {
          include: { prospectClient: true }
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      }
    });

    const dtos = proposals.map((p) => toClientSafeProposalDTO(p));

    return NextResponse.json({ proposals: dtos, raw: proposals });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch pre-contract proposals." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.proposal.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const body = await req.json();
    const {
      caseId,
      costEstimateVersionId,
      proposalCode,
      title,
      validityDays,
      scopeSummary,
      assumptions,
      exclusions,
      termsAndConditions
    } = body;

    if (!caseId || !costEstimateVersionId) {
      return NextResponse.json(
        { error: "Missing Required Fields: caseId and costEstimateVersionId are required." },
        { status: 400 }
      );
    }

    const pcCase = await prisma.preContractCase.findUnique({
      where: { id: caseId }
    });

    if (!pcCase) {
      return NextResponse.json({ error: "Pre-contract case not found." }, { status: 404 });
    }

    const canCrossCompany = hasPermission(user, "precontract.proposal.crossCompany") || user.role === "SUPER_ADMIN" || user.role === "ADMIN" || hasPermission(user, "manpower.admin.full_access");
    if (!canCrossCompany && pcCase.companyId && user.companyId && pcCase.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: You are not authorized to create proposals for this company." }, { status: 403 });
    }

    const costingVersion = await prisma.preContractCostEstimateVersion.findUnique({
      where: { id: costEstimateVersionId },
      include: { estimate: true }
    });

    if (!costingVersion) {
      return NextResponse.json({ error: "Costing estimate version not found." }, { status: 404 });
    }

    if (costingVersion.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Invalid Costing Baseline: Proposals can only be created from an APPROVED costing version." },
        { status: 400 }
      );
    }

    let validUntil: Date | null = null;
    const vDays = validityDays !== undefined && validityDays !== null ? Number(validityDays) : null;
    if (vDays && vDays > 0) {
      validUntil = new Date(Date.now() + vDays * 24 * 60 * 60 * 1000);
    }

    const proposal = await prisma.preContractProposal.create({
      data: {
        proposalCode: proposalCode?.trim() || null,
        caseId: pcCase.id,
        companyId: pcCase.companyId,
        operationType: pcCase.operationType,
        status: "DRAFT",
        currentVersionNumber: 1,
        createdBy: user.name || user.email || user.id,
        versions: {
          create: [
            {
              versionNumber: 1,
              costEstimateId: costingVersion.estimateId,
              costEstimateVersionId: costingVersion.id,
              costEstimateChecksum: costingVersion.checksum || null,
              status: "DRAFT",
              title: title?.trim() || `Proposal for ${pcCase.title}`,
              sellingPrice: costingVersion.sellingPrice,
              currency: costingVersion.currency,
              validityDays: vDays,
              validUntil,
              scopeSummary: scopeSummary?.trim() || null,
              assumptions: assumptions?.trim() || null,
              exclusions: exclusions?.trim() || null,
              termsAndConditions: termsAndConditions?.trim() || null,
              createdBy: user.name || user.email || user.id
            }
          ]
        }
      },
      include: {
        case: { include: { prospectClient: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 }
      }
    });

    const dto = toClientSafeProposalDTO(proposal);

    return NextResponse.json({ proposal, dto }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create pre-contract proposal." },
      { status: 500 }
    );
  }
}
