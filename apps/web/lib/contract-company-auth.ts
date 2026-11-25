import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { resolveCompanyScope } from "@/lib/api-guards";

const CROSS_COMPANY_CONTRACT_PERMS = ["commercial.commandCenter.crossCompany"];

export interface ContractListFilterResult {
  error: NextResponse | null;
  canCrossCompany: boolean;
  companyId: string | null;
  allowedCompanyIds: string[];
}

/**
 * Resolves database-level company filter for SG/FM contract list queries.
 * Non-cross-company users are strictly restricted to their authorized companyId(s)
 * and never see unowned (companyId = null) contracts.
 */
export function resolveContractListCompanyFilter(
  user: any,
  requestedCompanyId?: string | null
): ContractListFilterResult {
  const scope = resolveCompanyScope(user, {
    crossCompanyPermissions: CROSS_COMPANY_CONTRACT_PERMS,
    requestedCompanyId,
  });

  if (scope.error) {
    return {
      error: scope.error,
      canCrossCompany: false,
      companyId: null,
      allowedCompanyIds: [],
    };
  }

  return {
    error: null,
    canCrossCompany: scope.canCrossCompany,
    companyId: scope.companyId,
    allowedCompanyIds: scope.allowedCompanyIds,
  };
}

/**
 * Verifies authoritative contract company access.
 * Fails closed when contract.companyId is missing for non-cross-company users,
 * or for any sensitive lifecycle/workflow operation when requireVerifiedOwnership is true.
 */
export function checkContractCompanyAccess(
  user: any,
  contract: { companyId?: string | null } | null | undefined,
  options?: { requireVerifiedOwnership?: boolean }
): NextResponse | null {
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const scope = resolveCompanyScope(user, {
    crossCompanyPermissions: CROSS_COMPANY_CONTRACT_PERMS,
  });
  if (scope.error) return scope.error;

  const contractCompanyId =
    typeof contract.companyId === "string" && contract.companyId.trim().length > 0
      ? contract.companyId.trim()
      : null;

  if (!contractCompanyId) {
    if (scope.canCrossCompany && options?.requireVerifiedOwnership === false) {
      return null;
    }
    return NextResponse.json(
      {
        error:
          "Forbidden: Contract company ownership is unverified and requires business ownership confirmation.",
      },
      { status: 403 }
    );
  }

  if (scope.canCrossCompany) {
    return null;
  }

  if (scope.companyId) {
    if (contractCompanyId !== scope.companyId) {
      return NextResponse.json(
        { error: "Forbidden: Company boundary violation." },
        { status: 403 }
      );
    }
    return null;
  }

  if (scope.allowedCompanyIds.length > 0) {
    if (!scope.allowedCompanyIds.includes(contractCompanyId)) {
      return NextResponse.json(
        { error: "Forbidden: Company boundary violation." },
        { status: 403 }
      );
    }
    return null;
  }

  return NextResponse.json(
    { error: "Forbidden: Company identity is required." },
    { status: 403 }
  );
}

/**
 * Resolves and validates authoritative companyId for creating or re-linking a ManpowerContract.
 * Rejects forged cross-company assignments, nonexistent companies, and client/project company conflicts.
 */
export async function resolveAndValidateContractCompany(
  user: any,
  payload: { companyId?: string | null; clientId?: string | null; projectId?: string | null }
): Promise<{ companyId?: string; error?: NextResponse }> {
  const requestedCompanyId =
    typeof payload.companyId === "string" && payload.companyId.trim().length > 0
      ? payload.companyId.trim()
      : null;

  const scope = resolveCompanyScope(user, {
    crossCompanyPermissions: CROSS_COMPANY_CONTRACT_PERMS,
    requestedCompanyId,
  });
  if (scope.error) return { error: scope.error };

  // Non-cross-company user attempting to specify another company
  if (!scope.canCrossCompany && requestedCompanyId) {
    if (scope.companyId && requestedCompanyId !== scope.companyId) {
      return {
        error: NextResponse.json(
          { error: "Forbidden: Cannot assign contract to another company." },
          { status: 403 }
        ),
      };
    }
    if (!scope.companyId && scope.allowedCompanyIds.length > 0 && !scope.allowedCompanyIds.includes(requestedCompanyId)) {
      return {
        error: NextResponse.json(
          { error: "Forbidden: Cannot assign contract to another company." },
          { status: 403 }
        ),
      };
    }
  }

  // Load client & optional project to validate consistency
  let client: { id: string; companyId: string | null; isSharedClient: boolean } | null = null;
  if (payload.clientId) {
    client = await prisma.manpowerClient.findUnique({
      where: { id: payload.clientId },
      select: { id: true, companyId: true, isSharedClient: true },
    });
    if (!client) {
      return {
        error: NextResponse.json({ error: "Client not found" }, { status: 404 }),
      };
    }
  }

  let project: { id: string; companyId: string | null } | null = null;
  if (payload.projectId) {
    project = await prisma.manpowerProject.findUnique({
      where: { id: payload.projectId },
      select: { id: true, companyId: true },
    });
    if (!project) {
      return {
        error: NextResponse.json({ error: "Project not found" }, { status: 404 }),
      };
    }
  }

  const clientOwnedCompanyId =
    client && !client.isSharedClient && client.companyId ? client.companyId : null;

  // Determine effective companyId without inferring solely from user when cross-company admin
  let effectiveCompanyId = requestedCompanyId;
  if (!effectiveCompanyId) {
    if (!scope.canCrossCompany) {
      effectiveCompanyId =
        scope.companyId ||
        (scope.allowedCompanyIds.length === 1 ? scope.allowedCompanyIds[0] : clientOwnedCompanyId);
    } else {
      effectiveCompanyId = clientOwnedCompanyId || project?.companyId || scope.companyId || null;
    }
  }

  if (!effectiveCompanyId) {
    return {
      error: NextResponse.json(
        { error: "Authoritative companyId is required to create a contract." },
        { status: 400 }
      ),
    };
  }

  // Validate Company exists
  const companyExists = await prisma.company.findUnique({
    where: { id: effectiveCompanyId },
    select: { id: true },
  });
  if (!companyExists) {
    return {
      error: NextResponse.json(
        { error: "Invalid companyId: Company does not exist." },
        { status: 400 }
      ),
    };
  }

  // Validate client consistency for non-shared clients
  if (clientOwnedCompanyId && clientOwnedCompanyId !== effectiveCompanyId) {
    return {
      error: NextResponse.json(
        {
          error:
            "Forbidden: Selected subsidiary client belongs to a different company than the contract.",
        },
        { status: 403 }
      ),
    };
  }

  // Validate project consistency
  if (project?.companyId && project.companyId !== effectiveCompanyId) {
    return {
      error: NextResponse.json(
        {
          error:
            "Forbidden: Selected project belongs to a different company than the contract.",
        },
        { status: 403 }
      ),
    };
  }

  return { companyId: effectiveCompanyId };
}
