export type CommercialWorkflowKey =
  | "OPPORTUNITY"
  | "SITE_SURVEY"
  | "COSTING"
  | "PROPOSAL";

interface CommercialWorkflowConfig {
  label: string;
  moduleTypes: string[];
}

export const COMMERCIAL_WORKFLOW_MODULES: Record<CommercialWorkflowKey, CommercialWorkflowConfig> = {
  OPPORTUNITY: {
    label: "commercial opportunity cases",
    moduleTypes: ["PRE_CONTRACT_CASE", "COMMERCIAL_OPPORTUNITY"]
  },
  SITE_SURVEY: {
    label: "commercial site surveys",
    moduleTypes: ["SITE_SURVEY", "PRE_CONTRACT_SURVEY"]
  },
  COSTING: {
    label: "commercial costing",
    moduleTypes: ["PRE_CONTRACT_COSTING", "COMMERCIAL_COSTING", "COSTING"]
  },
  PROPOSAL: {
    label: "commercial proposals",
    moduleTypes: ["PRE_CONTRACT_PROPOSAL", "COMMERCIAL_PROPOSAL"]
  }
};

export type WorkflowTemplateResolutionResult =
  | { ok: true; template: any }
  | { ok: false; error: string };

/**
 * Deterministically resolves the active workflow template for a specific commercial module
 * without cross-module fallback, failing closed on missing or ambiguous configurations.
 */
export async function resolveCommercialWorkflowTemplate(
  db: { workflowTemplate: { findMany: (args: any) => Promise<any[]> } },
  workflowKey: CommercialWorkflowKey
): Promise<WorkflowTemplateResolutionResult> {
  const config = COMMERCIAL_WORKFLOW_MODULES[workflowKey];

  const candidates = await db.workflowTemplate.findMany({
    where: {
      isActive: true,
      moduleType: { in: config.moduleTypes },
      levels: { some: {} }
    },
    include: {
      levels: {
        orderBy: { levelNumber: "asc" },
        include: { approvers: true }
      }
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
  });

  if (!candidates || candidates.length === 0) {
    return {
      ok: false,
      error: `Missing Workflow Configuration: No active workflow template configured under Settings > Workflow Setup for ${config.label}.`
    };
  }

  const defaults = candidates.filter((t) => Boolean(t.isDefault));
  if (defaults.length > 1) {
    return {
      ok: false,
      error: `Ambiguous Workflow Configuration: Multiple active default workflow templates (${defaults.length}) exist for ${config.label} under Settings > Workflow Setup. Keep only one default active template.`
    };
  }

  if (defaults.length === 1) {
    return { ok: true, template: defaults[0] };
  }

  if (candidates.length > 1) {
    return {
      ok: false,
      error: `Ambiguous Workflow Configuration: Multiple active workflow templates (${candidates.length}) exist for ${config.label} with no default selected under Settings > Workflow Setup. Mark one template as Default.`
    };
  }

  return { ok: true, template: candidates[0] };
}
