import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  // Pre-Contract / Commercial Permission Model Authorization
  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "precontract.prospectClient.view") ||
    hasPermission(user, "commercial.crm.view") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view prospective client CRM records." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const duplicateStatus = searchParams.get("duplicateStatus") || "ALL";
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
    const where: any = { isActive: true };

    if (companyId) where.companyId = companyId;
    if (operationType && operationType !== "ALL") where.operationType = operationType;
    if (duplicateStatus && duplicateStatus !== "ALL") where.duplicateCheckStatus = duplicateStatus;

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactPersonName: { contains: search } },
        { contactPersonEmail: { contains: search } },
        { crNumber: { contains: search } }
      ];
    }

    const prospects = await prisma.preContractProspectClient.findMany({
      where,
      include: {
        cases: {
          select: {
            id: true,
            title: true,
            businessOutcome: true,
            lifecycle: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      prospects,
      totalCount: prospects.length
    });
  } catch (error: any) {
    console.error("COMMERCIAL CRM GET ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch prospective client CRM records." },
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
    hasPermission(user, "precontract.prospectClient.manage") ||
    hasPermission(user, "commercial.crm.manage") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to create prospective client CRM records." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      contactPersonName,
      contactPersonEmail,
      contactPersonPhone,
      crNumber,
      address,
      companyId,
      operationType
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Client company name is required." },
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

    // Automatic Duplicate Prospect / Master Client Checking Trigger
    let duplicateCheckStatus = "CLEARED";
    let matchedClientMasterId: string | null = null;

    if (crNumber && crNumber.trim().length > 0) {
      const trimmedCr = crNumber.trim();

      // 1. Check against authoritative ManpowerClient master records
      const existingClientMaster = await prisma.manpowerClient.findFirst({
        where: { code: trimmedCr }
      });

      if (existingClientMaster) {
        duplicateCheckStatus = "MATCH_FOUND";
        matchedClientMasterId = existingClientMaster.id;
      } else {
        // 2. Check against existing PreContractProspectClient records
        const existingProspect = await prisma.preContractProspectClient.findFirst({
          where: { crNumber: trimmedCr, isActive: true }
        });
        if (existingProspect) {
          duplicateCheckStatus = "MATCH_FOUND";
        }
      }
    }

    if (duplicateCheckStatus === "CLEARED") {
      // Name duplicate match check
      const existingByName = await prisma.manpowerClient.findFirst({
        where: { name: { equals: name.trim() } }
      });
      if (existingByName) {
        duplicateCheckStatus = "MATCH_FOUND";
        matchedClientMasterId = existingByName.id;
      } else {
        const existingProspectByName = await prisma.preContractProspectClient.findFirst({
          where: { name: { equals: name.trim() }, isActive: true }
        });
        if (existingProspectByName) {
          duplicateCheckStatus = "MATCH_FOUND";
        }
      }
    }

    const newProspect = await prisma.preContractProspectClient.create({
      data: {
        name: name.trim(),
        contactPersonName: contactPersonName?.trim() || null,
        contactPersonEmail: contactPersonEmail?.trim() || null,
        contactPersonPhone: contactPersonPhone?.trim() || null,
        crNumber: crNumber?.trim() || null,
        address: address?.trim() || null,
        companyId: effectiveCompanyId,
        operationType: effectiveOpType,
        duplicateCheckStatus,
        matchedClientMasterId,
        isActive: true
      }
    });

    return NextResponse.json({
      prospect: newProspect,
      duplicateCheckAlert: duplicateCheckStatus === "MATCH_FOUND"
        ? "Potential duplicate client detected in database!"
        : "No duplicates found. Client record cleared."
    }, { status: 201 });
  } catch (error: any) {
    console.error("COMMERCIAL CRM POST ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create prospective client record." },
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
    hasPermission(user, "precontract.prospectClient.manage") ||
    hasPermission(user, "commercial.crm.manage") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to update prospective client CRM records." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { id, name, contactPersonName, contactPersonEmail, contactPersonPhone, crNumber, address, duplicateCheckStatus } = body;

    if (!id) {
      return NextResponse.json({ error: "Prospect Client ID is required." }, { status: 400 });
    }

    const existing = await prisma.preContractProspectClient.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Prospect Client record not found." }, { status: 404 });
    }

    // Company scope check
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

    const updated = await prisma.preContractProspectClient.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(contactPersonName !== undefined && { contactPersonName: contactPersonName?.trim() || null }),
        ...(contactPersonEmail !== undefined && { contactPersonEmail: contactPersonEmail?.trim() || null }),
        ...(contactPersonPhone !== undefined && { contactPersonPhone: contactPersonPhone?.trim() || null }),
        ...(crNumber !== undefined && { crNumber: crNumber?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(duplicateCheckStatus && { duplicateCheckStatus })
      }
    });

    return NextResponse.json({ prospect: updated });
  } catch (error: any) {
    console.error("COMMERCIAL CRM PATCH ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update prospective client record." },
      { status: 500 }
    );
  }
}
