import "server-only";
import { prisma } from "@ahh-wfm/database";

export interface UserAuthContext {
  userId?: string;
  role?: string;
  companyId?: string | null;
  allowedCompanyIds?: string[];
  operationAccess?: {
    allowedSecurityGuarding?: boolean;
    allowedFacilityManagement?: boolean;
  };
}

/**
 * Returns all active companies authorized for the current user.
 */
export async function getActiveCompanies(userContext?: UserAuthContext) {
  const where: any = { isActive: true };

  if (userContext && userContext.role !== "SUPER_ADMIN" && userContext.role !== "ADMIN") {
    if (userContext.allowedCompanyIds && userContext.allowedCompanyIds.length > 0) {
      where.id = { in: userContext.allowedCompanyIds };
    } else if (userContext.companyId) {
      where.id = userContext.companyId;
    }
  }

  return await prisma.company.findMany({
    where,
    orderBy: { companyName: "asc" }
  });
}

/**
 * Transactionally resolves and verifies the singleton Holding Company.
 * Throws HOLDING_COMPANY_REQUIRED if zero active holding companies exist.
 * Throws MULTIPLE_HOLDING_COMPANIES_ERROR if more than one active holding company exists.
 */
export async function getHoldingCompany() {
  const holdingCompanies = await prisma.company.findMany({
    where: { isHoldingCompany: true, isActive: true }
  });

  if (holdingCompanies.length === 0) {
    throw new Error("HOLDING_COMPANY_REQUIRED: No active singleton Holding Company configured in Company Master");
  }

  if (holdingCompanies.length > 1) {
    throw new Error("MULTIPLE_HOLDING_COMPANIES_ERROR: Multiple active Holding Companies detected in Company Master");
  }

  return holdingCompanies[0];
}

/**
 * Transactionally sets the target company as the active singleton Holding Company.
 * Audits previous and new Holding Company IDs in UserActionAudit.
 */
export async function setHoldingCompanyTransactional(targetCompanyId: string, userId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify target company exists and is active
    const target = await tx.company.findUnique({ where: { id: targetCompanyId } });
    if (!target || !target.isActive) {
      throw new Error("INVALID_TARGET_COMPANY: Target company does not exist or is inactive");
    }

    // 2. Identify previous holding company
    const previous = await tx.company.findFirst({ where: { isHoldingCompany: true, isActive: true } });

    // 3. Reset all isHoldingCompany flags
    await tx.company.updateMany({ data: { isHoldingCompany: false } });

    // 4. Set target company as holding company
    const updated = await tx.company.update({
      where: { id: targetCompanyId },
      data: { isHoldingCompany: true }
    });

    // 5. Audit action
    await (tx as any).userActionAudit.create({
      data: {
        userId,
        action: "SET_HOLDING_COMPANY",
        targetEntity: "Company",
        targetId: targetCompanyId,
        details: {
          previousHoldingCompanyId: previous?.id || null,
          previousHoldingCompanyName: previous?.companyName || null,
          newHoldingCompanyId: updated.id,
          newHoldingCompanyName: updated.companyName,
          companyCode: updated.companyCode
        }
      }
    });

    // 6. Verify singleton invariant
    const count = await tx.company.count({ where: { isHoldingCompany: true, isActive: true } });
    if (count !== 1) {
      throw new Error(`HOLDING_SINGLETON_INVARIANT_VIOLATION: Expected 1 active holding company, found ${count}`);
    }

    return updated;
  });
}

/**
 * Returns active departments for a given company.
 */
export async function getDepartmentsByCompany(companyId: string) {
  return await prisma.department.findMany({
    where: { companyId },
    orderBy: { name: "asc" }
  });
}

/**
 * Returns White Collar Designations Master list.
 */
export async function getWhiteCollarDesignations() {
  return await prisma.designation.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" }
  });
}

/**
 * Returns Blue Collar Position Categories Master list.
 */
export async function getBlueCollarPositionCategories() {
  return await prisma.blueCollarPositionCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" }
  });
}

/**
 * Resolves allowed Operation Scopes for a given company and optional department.
 * Applies Company scope base authority, Department restriction, and user context intersection.
 */
export async function getAllowedOperationTypes(params: {
  companyId: string;
  departmentId?: string | null;
  userContext?: UserAuthContext;
}) {
  // 1. Fetch Company Mappings (base authority)
  const companyScopes = await (prisma as any).manpowerCompanyOperationScope.findMany({
    where: { companyId: params.companyId, isActive: true }
  });

  let allowed: string[] = companyScopes.map((s: any) => s.operationType);

  // 2. Restrict by Department Mappings where present
  if (params.departmentId) {
    const deptScopes = await (prisma as any).manpowerDepartmentOperationScope.findMany({
      where: { departmentId: params.departmentId, isActive: true }
    });

    if (deptScopes.length > 0) {
      const deptAllowed = deptScopes.map((s: any) => s.operationType);
      allowed = allowed.filter(op => deptAllowed.includes(op));
    }
  }

  // 3. Intersect with User Authorized Scope
  if (params.userContext && params.userContext.role !== "SUPER_ADMIN" && params.userContext.role !== "ADMIN") {
    const access = params.userContext.operationAccess || {};
    allowed = allowed.filter(op => {
      if (op === "SECURITY_GUARDING") return access.allowedSecurityGuarding !== false;
      if (op === "FACILITY_MANAGEMENT") return access.allowedFacilityManagement !== false;
      return true;
    });
  }

  return allowed; // Empty array if non-SecFac
}

/**
 * Returns Company Operation Scope Mappings.
 */
export async function getCompanyOperationScopes(companyId: string) {
  return await (prisma as any).manpowerCompanyOperationScope.findMany({
    where: { companyId, isActive: true }
  });
}

/**
 * Returns Department Operation Scope Mappings.
 */
export async function getDepartmentOperationScopes(departmentId: string) {
  return await (prisma as any).manpowerDepartmentOperationScope.findMany({
    where: { departmentId, isActive: true }
  });
}
