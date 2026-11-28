import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { findActiveProposalsByCostingVersionIds } from "@/lib/precontract-proposal";
import { enrichCasesWithClientInfo, enrichCaseWithClientInfo } from "@/lib/commercial-client-resolution";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const { searchParams } = new URL(request.url);
  const forProposal = searchParams.get("forProposal") === "true";

  if (forProposal) {
    const canManageProposal =
      isAdminUser(user) ||
      hasPermission(user, "precontract.proposal.manage") ||
      hasPermission(user, "manpower.admin.full_access");

    if (!canManageProposal) {
      return NextResponse.json(
        { error: "Forbidden: Commercial proposal creation permission (precontract.proposal.manage) is required." },
        { status: 403 }
      );
    }
  } else {
    const isAuthorized =
      isAdminUser(user) ||
      hasPermission(user, "precontract.case.view") ||
      hasPermission(user, "commercial.opportunities.view") ||
      hasPermission(user, "precontract.proposal.view") ||
      hasPermission(user, "precontract.proposal.manage") ||
      hasPermission(user, "manpower.admin.full_access");

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to view commercial opportunity cases." },
        { status: 403 }
      );
    }
  }

  const search = searchParams.get("search")?.trim() || "";
  const lifecycle = searchParams.get("lifecycle") || "ALL";
  const businessOutcome = searchParams.get("businessOutcome") || "ALL";
  const prospectClientId = searchParams.get("prospectClientId") || undefined;
  let companyId = searchParams.get("companyId") || undefined;
  let operationType = searchParams.get("operationType") || undefined;

  // Company Isolation
  const canCrossCompany =
    isAdminUser(user) ||
    hasPermission(user, "manpower.admin.full_access") ||
    hasPermission(user, "commercial.commandCenter.crossCompany") ||
    (forProposal && hasPermission(user, "precontract.proposal.crossCompany"));

  const allowedCompanyIds = Array.isArray(user?.allowedCompanyIds)
    ? user.allowedCompanyIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const sessionCompanyId =
    typeof user?.companyId === "string" && user.companyId.trim().length > 0 ? user.companyId.trim() : null;

  if (!canCrossCompany) {
    if (sessionCompanyId) {
      companyId = sessionCompanyId;
    } else if (allowedCompanyIds.length > 0) {
      if (companyId && !allowedCompanyIds.includes(companyId)) {
        return NextResponse.json(
          { error: "Forbidden: Company boundary violation." },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Forbidden: Company identity is required to access commercial opportunity cases." },
        { status: 403 }
      );
    }
  }

  // SG / FM Scope Isolation
  if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
    const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? user?.allowedSecurityGuarding ?? true;
    const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? user?.allowedFacilityManagement ?? true;

    if (!userAllowedSG && !userAllowedFM) {
      return NextResponse.json({
        cases: [],
        pipeline: { DRAFT: [], IN_WORKFLOW: [], COMPLETED: [], CANCELLED: [] },
        totalCount: 0
      });
    }

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
    const where: any = {};

    if (!canCrossCompany && !sessionCompanyId && allowedCompanyIds.length > 0 && !companyId) {
      where.companyId = { in: allowedCompanyIds };
    } else if (companyId) {
      where.companyId = companyId;
    }
    if (operationType && operationType !== "ALL") where.operationType = operationType;
    if (lifecycle && lifecycle !== "ALL") {
      where.lifecycle = lifecycle;
    } else if (forProposal) {
      where.lifecycle = { notIn: ["CANCELLED", "SUPERSEDED"] };
    }
    if (businessOutcome && businessOutcome !== "ALL") {
      where.businessOutcome = businessOutcome;
    } else if (forProposal) {
      where.AND = [
        ...(where.AND || []),
        { OR: [{ businessOutcome: null }, { businessOutcome: { not: "LOST" } }] }
      ];
    }
    if (prospectClientId) where.prospectClientId = prospectClientId;

    if (forProposal) {
      where.costEstimates = {
        some: {
          versions: {
            some: { status: "APPROVED" }
          }
        }
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { prospectClient: { name: { contains: search } } }
      ];
    }

    const rawCases = await prisma.preContractCase.findMany({
      where,
      include: {
        prospectClient: {
          select: {
            id: true,
            name: true,
            crNumber: true,
            duplicateCheckStatus: true,
            contactPersonName: true,
            contactPersonEmail: true
          }
        },
        surveys: {
          select: {
            id: true,
            lifecycle: true,
            conductedBy: true,
            conductedAt: true,
            prospectiveSite: {
              select: { id: true, name: true, address: true }
            },
            siteConditions: { select: { id: true, definitionCode: true } }
          }
        },
        costEstimates: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            estimateNumber: true,
            status: true,
            currentVersionNumber: true,
            survey: {
              select: {
                id: true,
                prospectiveSite: { select: { id: true, name: true, address: true } }
              }
            },
            versions: {
              where: { status: "APPROVED" },
              orderBy: { versionNumber: "desc" },
              select: {
                id: true,
                versionNumber: true,
                status: true,
                currency: true,
                sellingPrice: true,
                totalCost: true,
                targetMarginPercentage: true,
                checksum: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const approvedVersionIds: string[] = [];
    if (forProposal) {
      rawCases.forEach((c: any) => {
        (c.costEstimates || []).forEach((est: any) => {
          (est.versions || []).forEach((v: any) => {
            if (v?.id) approvedVersionIds.push(v.id);
          });
        });
      });
    }

    const activeProposalByVersionId = forProposal
      ? await findActiveProposalsByCostingVersionIds(prisma, approvedVersionIds)
      : new Map();

    const enrichedRawCases = await enrichCasesWithClientInfo(rawCases);
    const cases = enrichedRawCases.map((c: any) => ({
      ...c,
      costEstimates: (c.costEstimates || []).map((est: any) => ({
        ...est,
        versions: (est.versions || []).map((v: any) => ({
          ...v,
          sellingPrice: Number(v.sellingPrice ?? 0),
          totalCost: Number(v.totalCost ?? 0),
          targetMarginPercentage: v.targetMarginPercentage !== null && v.targetMarginPercentage !== undefined ? Number(v.targetMarginPercentage) : null,
          ...(forProposal ? { activeProposal: activeProposalByVersionId.get(v.id) || null } : {})
        }))
      }))
    }));

    // Group by pipeline lifecycle stage for Kanban view
    const pipeline = {
      DRAFT: cases.filter((c) => c.lifecycle === "DRAFT"),
      IN_WORKFLOW: cases.filter((c) => c.lifecycle === "IN_WORKFLOW"),
      COMPLETED: cases.filter((c) => c.lifecycle === "COMPLETED"),
      CANCELLED: cases.filter((c) => c.lifecycle === "CANCELLED")
    };

    return NextResponse.json({
      cases,
      pipeline,
      totalCount: cases.length
    });
  } catch (error: any) {
    console.error("COMMERCIAL OPPORTUNITIES GET ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch commercial opportunity cases." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.case.manage") ||
    hasPermission(user, "commercial.opportunities.manage") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to create commercial opportunity cases." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { title, prospectClientId, existingClientId, companyId, operationType } = body;

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Opportunity title is required." },
        { status: 400 }
      );
    }

    const effectiveCompanyId = user?.companyId && !isAdminUser(user) ? user.companyId : companyId || null;
    const effectiveOpType = operationType || "SECURITY_GUARDING";

    // SG / FM Scope Isolation Check
    if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
      const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
      const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

      if (effectiveOpType === "SECURITY_GUARDING" && !userAllowedSG) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Security Guarding operational data." },
          { status: 403 }
        );
      }
      if (effectiveOpType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Facility Management operational data." },
          { status: 403 }
        );
      }
    }

    const cleanProspectId = typeof prospectClientId === "string" && prospectClientId.trim() ? prospectClientId.trim() : null;
    const cleanExistingClientId = typeof existingClientId === "string" && existingClientId.trim() ? existingClientId.trim() : null;

    if (cleanProspectId && cleanExistingClientId) {
      return NextResponse.json(
        { error: "Provide either a Prospect Client or an Existing Client Master, not both." },
        { status: 400 }
      );
    }

    if (cleanProspectId) {
      const prospect = await prisma.preContractProspectClient.findUnique({
        where: { id: cleanProspectId },
        select: { id: true, name: true, companyId: true }
      });
      if (!prospect) {
        return NextResponse.json({ error: "Selected Prospect Client does not exist." }, { status: 400 });
      }
      if (effectiveCompanyId && prospect.companyId && prospect.companyId !== effectiveCompanyId) {
        return NextResponse.json(
          { error: "Forbidden: Selected Prospect Client belongs to a different company." },
          { status: 403 }
        );
      }
    }

    if (cleanExistingClientId) {
      const client = await prisma.manpowerClient.findUnique({
        where: { id: cleanExistingClientId },
        select: { id: true, name: true, operationType: true, isActive: true }
      });
      if (!client) {
        return NextResponse.json({ error: "Selected Client Master does not exist." }, { status: 400 });
      }
      if (!client.isActive) {
        return NextResponse.json({ error: `Client Master '${client.name}' is inactive.` }, { status: 400 });
      }
      if (client.operationType !== effectiveOpType) {
        return NextResponse.json(
          { error: `Forbidden: Client Master '${client.name}' belongs to ${client.operationType}, expected ${effectiveOpType}.` },
          { status: 403 }
        );
      }
    }

    const newCase = await prisma.preContractCase.create({
      data: {
        title: title.trim(),
        prospectClientId: cleanProspectId,
        existingClientId: cleanExistingClientId,
        companyId: effectiveCompanyId,
        operationType: effectiveOpType,
        lifecycle: "DRAFT",
        businessOutcome: "IN_PROGRESS",
        createdBy: user?.id || user?.email || "SYSTEM"
      },
      include: {
        prospectClient: {
          select: { id: true, name: true, crNumber: true }
        }
      }
    });

    const enrichedNewCase = await enrichCaseWithClientInfo(newCase);
    return NextResponse.json({ case: enrichedNewCase }, { status: 201 });
  } catch (error: any) {
    console.error("COMMERCIAL OPPORTUNITIES POST ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create commercial opportunity case." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.case.manage") ||
    hasPermission(user, "commercial.opportunities.manage") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to update commercial opportunity cases." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { id, title, businessOutcome, lifecycle, prospectClientId, existingClientId } = body;

    if (!id) {
      return NextResponse.json({ error: "Opportunity Case ID is required." }, { status: 400 });
    }

    const existing = await prisma.preContractCase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Commercial opportunity case not found." }, { status: 404 });
    }

    // Company boundary check (fail closed when companyId is missing for non-cross-company actors)
    const canCrossCompanyDelete =
      isAdminUser(user) ||
      hasPermission(user, "manpower.admin.full_access") ||
      hasPermission(user, "commercial.commandCenter.crossCompany");
    const deleteSessionCompanyId =
      typeof user?.companyId === "string" && user.companyId.trim().length > 0 ? user.companyId.trim() : null;
    if (!canCrossCompanyDelete && (!deleteSessionCompanyId || (existing.companyId && existing.companyId !== deleteSessionCompanyId))) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation." }, { status: 403 });
    }

    // SG / FM Scope Isolation Check
    if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
      const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
      const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

      if (existing.operationType === "SECURITY_GUARDING" && !userAllowedSG) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Security Guarding operational data." },
          { status: 403 }
        );
      }
      if (existing.operationType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Facility Management operational data." },
          { status: 403 }
        );
      }
    }

    const nextProspectId =
      prospectClientId !== undefined
        ? (typeof prospectClientId === "string" && prospectClientId.trim() ? prospectClientId.trim() : null)
        : existing.prospectClientId;
    const nextExistingClientId =
      existingClientId !== undefined
        ? (typeof existingClientId === "string" && existingClientId.trim() ? existingClientId.trim() : null)
        : existing.existingClientId;

    if (nextProspectId && nextExistingClientId) {
      return NextResponse.json(
        { error: "An opportunity cannot be linked to both a Prospect Client and an Existing Client Master simultaneously." },
        { status: 400 }
      );
    }

    if (prospectClientId !== undefined && nextProspectId) {
      const prospect = await prisma.preContractProspectClient.findUnique({
        where: { id: nextProspectId },
        select: { id: true, name: true, companyId: true }
      });
      if (!prospect) {
        return NextResponse.json({ error: "Selected Prospect Client does not exist." }, { status: 400 });
      }
      if (existing.companyId && prospect.companyId && prospect.companyId !== existing.companyId) {
        return NextResponse.json(
          { error: "Forbidden: Selected Prospect Client belongs to a different company." },
          { status: 403 }
        );
      }
    }

    if (existingClientId !== undefined && nextExistingClientId) {
      const client = await prisma.manpowerClient.findUnique({
        where: { id: nextExistingClientId },
        select: { id: true, name: true, operationType: true, isActive: true }
      });
      if (!client) {
        return NextResponse.json({ error: "Selected Client Master does not exist." }, { status: 400 });
      }
      if (!client.isActive) {
        return NextResponse.json({ error: `Client Master '${client.name}' is inactive.` }, { status: 400 });
      }
      if (client.operationType !== existing.operationType) {
        return NextResponse.json(
          { error: `Forbidden: Client Master '${client.name}' belongs to ${client.operationType}, expected ${existing.operationType}.` },
          { status: 403 }
        );
      }
    }

    const clientLinkChanged =
      (prospectClientId !== undefined && nextProspectId !== existing.prospectClientId) ||
      (existingClientId !== undefined && nextExistingClientId !== existing.existingClientId);

    const updated = await prisma.preContractCase.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(businessOutcome && { businessOutcome }),
        ...(lifecycle && { lifecycle }),
        ...(prospectClientId !== undefined && { prospectClientId: nextProspectId }),
        ...(existingClientId !== undefined && { existingClientId: nextExistingClientId })
      },
      include: {
        prospectClient: {
          select: { id: true, name: true }
        }
      }
    });

    if (clientLinkChanged) {
      await prisma.userActivityLog.create({
        data: {
          userId: user?.id || "system",
          action: "OPPORTUNITY_CLIENT_LINKED",
          entityType: "PreContractCase",
          entityId: updated.id,
          beforeJson: JSON.stringify({
            prospectClientId: existing.prospectClientId,
            existingClientId: existing.existingClientId
          }),
          afterJson: JSON.stringify({
            prospectClientId: updated.prospectClientId,
            existingClientId: updated.existingClientId
          })
        }
      });
    }

    const enrichedUpdated = await enrichCaseWithClientInfo(updated);
    return NextResponse.json({ case: enrichedUpdated });
  } catch (error: any) {
    console.error("COMMERCIAL OPPORTUNITIES PATCH ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update commercial opportunity case." },
      { status: 500 }
    );
  }
}
