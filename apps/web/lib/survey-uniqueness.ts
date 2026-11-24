import { PreContractLifecycle } from "@ahh-wfm/database";

export const ACTIVE_SURVEY_LIFECYCLES: PreContractLifecycle[] = [
  "DRAFT",
  "IN_WORKFLOW",
  "COMPLETED"
];

export interface SurveyUniquenessQuery {
  caseId: string;
  prospectiveSiteId: string | null | undefined;
  excludeSurveyId?: string;
}

export interface ConflictingSurveySummary {
  id: string;
  lifecycle: PreContractLifecycle;
  prospectiveSiteId: string | null;
}

/**
 * Checks whether an active or approved (DRAFT, IN_WORKFLOW, COMPLETED) site survey
 * already exists for the same (caseId, prospectiveSiteId), handling both populated
 * and null prospectiveSiteId values.
 */
export async function findConflictingActiveSurvey(
  db: { preContractSurvey: { findFirst: (args: any) => Promise<any> } },
  query: SurveyUniquenessQuery
): Promise<ConflictingSurveySummary | null> {
  const existing = await db.preContractSurvey.findFirst({
    where: {
      caseId: query.caseId,
      prospectiveSiteId: query.prospectiveSiteId ?? null,
      lifecycle: { in: ACTIVE_SURVEY_LIFECYCLES },
      ...(query.excludeSurveyId ? { id: { not: query.excludeSurveyId } } : {})
    },
    select: {
      id: true,
      lifecycle: true,
      prospectiveSiteId: true
    }
  });

  return existing || null;
}

export function formatDuplicateSurveyMessage(lifecycle: string): string {
  const statusLabel = lifecycle === "COMPLETED" ? "COMPLETED (Approved)" : lifecycle;
  return `Duplicate Survey Blocked: A ${statusLabel} site survey already exists for this opportunity case and prospective site.`;
}
