export interface WorkflowBusinessSummary {
  reference: string;
  title: string;
  subtitle?: string;
  requesterName: string;
  requesterCode?: string;
  companyId?: string | null;
  companyName?: string;
  createdAt: string;
  keyFields: Array<{ label: string; value: string | number; badge?: string; badgeVariant?: "success" | "warning" | "error" | "neutral" }>;
  rawDetails?: Record<string, any>;
}

export interface WorkflowSourceAdapter {
  moduleType: string;
  getBusinessSummary(referenceId: string, companyId?: string | null): Promise<WorkflowBusinessSummary | null>;
  getSourceDeepLink(referenceId: string): string;
  onWorkflowStatusChange?(
    referenceId: string,
    action: "APPROVE" | "RETURN" | "REJECT",
    newStatus: string,
    remarks?: string,
    tx?: any
  ): Promise<void>;
}
