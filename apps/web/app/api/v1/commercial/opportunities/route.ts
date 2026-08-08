import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.case.view") ||
    hasPermission(user, "commercial.opportunities.view") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view commercial opportunity cases." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const lifecycle = searchParams.get("lifecycle") || "ALL";
  const businessOutcome = searchParams.get("businessOutcome") || "ALL";
  const prospectClientId = searchParams.get("prospectClientId") || undefined;
  let companyId = searchParams.get("companyId") || undefined;
  let operationType = searchParams.get("operationType") || undefined;

  // Company Isolation
  if (user?.companyId && !isAdminUser(user) && !hasPermission(user, "commercial.commandCenter.crossCompany")) {
    companyId = user.companyId;
  }

  // SG / FM Scope Isolation
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
    const where: any = {};

    if (companyId) where.companyId = companyId;
    if (operationType && operationType !== "ALL") where.operationType = operationType;
    if (lifecycle && lifecycle !== "ALL") where.lifecycle = lifecycle;
    if (businessOutcome && businessOutcome !== "ALL") where.businessOutcome = businessOutcome;
    if (prospectClientId) where.prospectClientId = prospectClientId;

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { prospectClient: { name: { contains: search } } }
      ];
    }

    const cases = await prisma.preContractCase.findMany({
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
            siteConditions: { select: { id: true, definitionCode: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

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

    const newCase = await prisma.preContractCase.create({
      data: {
        title: title.trim(),
        prospectClientId: prospectClientId || null,
        existingClientId: existingClientId || null,
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

    return NextResponse.json({ case: newCase }, { status: 201 });
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
    const { id, title, businessOutcome, lifecycle, prospectClientId } = body;

    if (!id) {
      return NextResponse.json({ error: "Opportunity Case ID is required." }, { status: 400 });
    }

    const existing = await prisma.preContractCase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Commercial opportunity case not found." }, { status: 404 });
    }

    // Company boundary check
    if (user?.companyId && !isAdminUser(user) && existing.companyId && existing.companyId !== user.companyId) {
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

    const updated = await prisma.preContractCase.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(businessOutcome && { businessOutcome }),
        ...(lifecycle && { lifecycle }),
        ...(prospectClientId !== undefined && { prospectClientId: prospectClientId || null })
      },
      include: {
        prospectClient: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({ case: updated });
  } catch (error: any) {
    console.error("COMMERCIAL OPPORTUNITIES PATCH ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update commercial opportunity case." },
      { status: 500 }
    );
  }
}
