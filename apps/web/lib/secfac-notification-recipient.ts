import { OperationType } from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";

export interface ResolvedRecipientDetails {
  eligible: boolean;
  userId?: string | null;
  roleCode?: string | null;
  email?: string | null;
  phone?: string | null;
  pushTokens?: string[];
  ineligibilityReason?: string;
}

/**
 * Resolves trusted server-side recipient contact details and validates operational scope access.
 */
export async function resolveRecipientContactDetails(
  operationType: OperationType,
  recipientUserId?: string | null,
  recipientRole?: string | null
): Promise<ResolvedRecipientDetails> {
  if (!recipientUserId && !recipientRole) {
    return { eligible: false, ineligibilityReason: "No recipient user ID or role specified." };
  }

  if (recipientUserId) {
    const emp = await prisma.employee.findUnique({
      where: { id: recipientUserId }
    });

    if (!emp) {
      return { eligible: false, ineligibilityReason: `User '${recipientUserId}' not found in master.` };
    }

    if (!emp.isActive || emp.isLocked) {
      return { eligible: false, ineligibilityReason: `User '${emp.id}' is deactivated or locked.` };
    }

    // Check operational scope access on Employee
    const ops = ((emp as any).operationAccess as any) || {};
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(emp.role?.toUpperCase());

    if (!isAdmin) {
      if (operationType === "SECURITY_GUARDING" && ops.allowedSecurityGuarding !== true) {
        return { eligible: false, ineligibilityReason: `User '${emp.id}' lacks SECURITY_GUARDING operational scope access.` };
      }
      if (operationType === "FACILITY_MANAGEMENT" && ops.allowedFacilityManagement !== true) {
        return { eligible: false, ineligibilityReason: `User '${emp.id}' lacks FACILITY_MANAGEMENT operational scope access.` };
      }
    }

    const email = emp.email || null;
    const phone = emp.phone || ((emp as any).metadata as any)?.mobile || null;
    const pushTokens = ((emp as any).metadata as any)?.pushTokens || [];

    return {
      eligible: true,
      userId: emp.id,
      roleCode: emp.role,
      email,
      phone,
      pushTokens: Array.isArray(pushTokens) ? pushTokens : []
    };
  }

  // Role-based recipient queue fallback
  return {
    eligible: true,
    roleCode: recipientRole,
    ineligibilityReason: `Role-based fallback '${recipientRole}'`
  };
}
