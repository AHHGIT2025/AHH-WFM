export interface OpportunityEligibilityLike {
  lifecycle: string;
  businessOutcome?: string | null;
}

export interface OpportunityEligibilityResult {
  eligible: boolean;
  errorMessage: string;
}

/**
 * Authoritative Issue #6 eligibility check:
 * Only approved (COMPLETED) commercial opportunities that are not LOST
 * are eligible for Site Survey creation, submission, or approval.
 */
export function checkOpportunityEligibilityForSurvey(
  opportunityCase?: OpportunityEligibilityLike | null
): OpportunityEligibilityResult {
  if (!opportunityCase) {
    return {
      eligible: false,
      errorMessage: "Ineligible Opportunity: Commercial opportunity case not found."
    };
  }

  if (opportunityCase.lifecycle !== "COMPLETED") {
    return {
      eligible: false,
      errorMessage: `Ineligible Opportunity: Only approved (COMPLETED) opportunities are eligible for Site Survey. Current opportunity status is ${opportunityCase.lifecycle}.`
    };
  }

  if (opportunityCase.businessOutcome === "LOST") {
    return {
      eligible: false,
      errorMessage: "Ineligible Opportunity: Cannot create or submit a Site Survey for a LOST opportunity."
    };
  }

  return { eligible: true, errorMessage: "" };
}
