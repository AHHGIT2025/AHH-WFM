import { prisma } from "@ahh-wfm/database";

export const UNLINKED_CLIENT_LABEL = "Client not linked";

export interface ResolvedCommercialClient {
  id: string | null;
  name: string | null;
  type: "PROSPECT" | "EXISTING" | "UNLINKED";
  isLinked: boolean;
}

export function resolveCommercialClientFields(
  caseRecord: {
    prospectClientId?: string | null;
    prospectClient?: { id?: string; name?: string | null } | null;
    existingClientId?: string | null;
    existingClient?: { id?: string; name?: string | null; operationType?: string | null; isActive?: boolean } | null;
  } | null | undefined
): {
  resolvedClient: ResolvedCommercialClient;
  clientDisplayName: string;
} {
  if (!caseRecord) {
    return {
      resolvedClient: { id: null, name: null, type: "UNLINKED", isLinked: false },
      clientDisplayName: UNLINKED_CLIENT_LABEL,
    };
  }

  if (caseRecord.prospectClient?.name) {
    return {
      resolvedClient: {
        id: caseRecord.prospectClient.id || caseRecord.prospectClientId || null,
        name: caseRecord.prospectClient.name,
        type: "PROSPECT",
        isLinked: true,
      },
      clientDisplayName: caseRecord.prospectClient.name,
    };
  }

  if (caseRecord.existingClient?.name) {
    return {
      resolvedClient: {
        id: caseRecord.existingClient.id || caseRecord.existingClientId || null,
        name: caseRecord.existingClient.name,
        type: "EXISTING",
        isLinked: true,
      },
      clientDisplayName: caseRecord.existingClient.name,
    };
  }

  return {
    resolvedClient: { id: null, name: null, type: "UNLINKED", isLinked: false },
    clientDisplayName: UNLINKED_CLIENT_LABEL,
  };
}

/**
 * Batch-resolves ManpowerClient records for PreContractCase.existingClientId (zero N+1 queries)
 * and attaches `existingClient`, `resolvedClient`, and `clientDisplayName`.
 */
export async function enrichCasesWithClientInfo<T extends Record<string, any>>(
  cases: T[]
): Promise<Array<T & { existingClient: any; resolvedClient: ResolvedCommercialClient; clientDisplayName: string }>> {
  if (!Array.isArray(cases) || cases.length === 0) return [];

  const existingIds = Array.from(
    new Set(
      cases
        .map((c) => c?.existingClientId)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    )
  );

  const clientById = new Map<string, { id: string; name: string; operationType: string; isActive: boolean }>();
  if (existingIds.length > 0) {
    const clients = await prisma.manpowerClient.findMany({
      where: { id: { in: existingIds } },
      select: { id: true, name: true, operationType: true, isActive: true },
    });
    for (const c of clients) {
      clientById.set(c.id, c);
    }
  }

  return cases.map((c) => {
    const existingClient = c?.existingClientId ? clientById.get(c.existingClientId) || null : null;
    const { resolvedClient, clientDisplayName } = resolveCommercialClientFields({
      ...c,
      existingClient,
    });
    return {
      ...c,
      existingClient,
      resolvedClient,
      clientDisplayName,
    };
  });
}

export async function enrichCaseWithClientInfo<T extends Record<string, any> | null | undefined>(
  caseRecord: T
): Promise<any> {
  if (!caseRecord) return caseRecord;
  const [enriched] = await enrichCasesWithClientInfo([caseRecord]);
  return enriched;
}
