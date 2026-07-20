import { prisma } from "@ahh-wfm/database";
import { AlertResponsibilityResolution, OperationType } from "@ahh-wfm/types";

export interface ResolveSupervisorParams {
  operationType: OperationType;
  siteId?: string | null;
  projectId?: string | null;
  employeeId?: string | null;
  targetRole?: string | null;
  fallbackRole?: string | null;
}

/**
 * Resolves the responsible supervisor for an operational alert following the mandatory hierarchy:
 * 1. Site-assigned supervisor
 * 2. Shift-assigned supervisor / employee's supervisor
 * 3. Project supervisor or project coordinator
 * 4. Operation-level coordinator
 * 5. Configured fallback role
 * 6. Controlled administrator queue (unassigned)
 */
export async function resolveAlertSupervisor(
  params: ResolveSupervisorParams
): Promise<AlertResponsibilityResolution> {
  const warnings: string[] = [];
  const { operationType, siteId, projectId, employeeId, targetRole, fallbackRole } = params;

  // Helper validator for candidate employee
  const isCandidateValid = (emp: any): boolean => {
    if (!emp) return false;
    if (emp.isActive === false || emp.isLocked === true) return false;
    if (emp.employmentStatus && emp.employmentStatus !== "ACTIVE") return false;

    // Check operation scope isolation
    if (emp.operationType && emp.operationType !== "WHITE_COLLAR" && emp.operationType !== operationType) {
      if (emp.userOperationAccess) {
        if (operationType === "SECURITY_GUARDING" && emp.userOperationAccess.allowedSecurityGuarding !== true) {
          return false;
        }
        if (operationType === "FACILITY_MANAGEMENT" && emp.userOperationAccess.allowedFacilityManagement !== true) {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  };

  try {
    // 1. Site-Assigned Supervisor
    if (siteId) {
      const secfacSiteAsg = await prisma.secfacAssignment.findFirst({
        where: { siteId, isActive: true, supervisorId: { not: null } },
        include: { supervisor: { include: { userOperationAccess: true } } }
      });
      if (secfacSiteAsg?.supervisor && isCandidateValid(secfacSiteAsg.supervisor)) {
        return {
          assignedUserId: secfacSiteAsg.supervisor.id,
          assignedRole: secfacSiteAsg.supervisor.role || "SUPERVISOR",
          source: "SITE_SUPERVISOR",
          warnings
        };
      }
    }

    // 2. Direct Employee Supervisor / Shift Supervisor
    if (employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          immediateSupervisor: { include: { userOperationAccess: true } },
          userOperationAccess: true
        }
      });
      if (emp) {
        if (emp.immediateSupervisor && isCandidateValid(emp.immediateSupervisor)) {
          return {
            assignedUserId: emp.immediateSupervisor.id,
            assignedRole: emp.immediateSupervisor.role || "SUPERVISOR",
            source: "SHIFT_SUPERVISOR",
            warnings
          };
        }
        if (emp.siteSupervisorId) {
          const siteSup = await prisma.employee.findUnique({
            where: { id: emp.siteSupervisorId },
            include: { userOperationAccess: true }
          });
          if (siteSup && isCandidateValid(siteSup)) {
            return {
              assignedUserId: siteSup.id,
              assignedRole: siteSup.role || "SUPERVISOR",
              source: "SITE_SUPERVISOR",
              warnings
            };
          }
        }
      }
    }

    // 3. Project Supervisor or Project Coordinator
    if (projectId) {
      if (operationType === "SECURITY_GUARDING") {
        const coordAsg = await prisma.securityProjectCoordinatorAssignment.findFirst({
          where: { projectId, isActive: true },
          include: { coordinator: { include: { userOperationAccess: true } } }
        });
        if (coordAsg?.coordinator && isCandidateValid(coordAsg.coordinator)) {
          return {
            assignedUserId: coordAsg.coordinator.id,
            assignedRole: coordAsg.coordinator.role || "PROJECT_COORDINATOR",
            source: "PROJECT_COORDINATOR",
            warnings
          };
        }
      }

      // Check for employee assigned as project supervisor
      const projSup = await prisma.employee.findFirst({
        where: { defaultProjectId: projectId, isSupervisor: true, isActive: true },
        include: { userOperationAccess: true }
      });
      if (projSup && isCandidateValid(projSup)) {
        return {
          assignedUserId: projSup.id,
          assignedRole: projSup.role || "PROJECT_COORDINATOR",
          source: "PROJECT_COORDINATOR",
          warnings
        };
      }
    }

    // 4. Target Role / Operation Coordinator
    const activeTargetRole = targetRole || (operationType === "SECURITY_GUARDING" ? "SECURITY_SUPERVISOR" : "FM_SUPERVISOR");
    const opCandidates = await prisma.employee.findMany({
      where: {
        isActive: true,
        isLocked: false,
        role: activeTargetRole
      },
      include: { userOperationAccess: true },
      take: 5
    });

    const validOpCand = opCandidates.find(c => isCandidateValid(c));
    if (validOpCand) {
      return {
        assignedUserId: validOpCand.id,
        assignedRole: validOpCand.role,
        source: "OPERATION_COORDINATOR",
        warnings
      };
    }

    // 5. Configured Fallback Role
    if (fallbackRole) {
      const fallbackCandidates = await prisma.employee.findMany({
        where: {
          isActive: true,
          isLocked: false,
          role: fallbackRole
        },
        include: { userOperationAccess: true },
        take: 5
      });
      const validFallback = fallbackCandidates.find(c => isCandidateValid(c));
      if (validFallback) {
        return {
          assignedUserId: validFallback.id,
          assignedRole: validFallback.role,
          source: "FALLBACK_ROLE",
          warnings
        };
      }
    }

    // 6. Controlled Administrator Queue
    warnings.push(`No active operational supervisor found for ${operationType} (siteId: ${siteId || "N/A"}, projectId: ${projectId || "N/A"}). Routed to Admin Queue.`);
    return {
      assignedUserId: null,
      assignedRole: "ADMIN",
      source: "ADMIN_QUEUE",
      warnings
    };

  } catch (e: any) {
    console.error("[secfac-alert-resolver] Error resolving supervisor:", e);
    warnings.push(`Database error during supervisor resolution: ${e?.message || e}`);
    return {
      assignedUserId: null,
      assignedRole: "ADMIN",
      source: "ADMIN_QUEUE",
      warnings
    };
  }
}
