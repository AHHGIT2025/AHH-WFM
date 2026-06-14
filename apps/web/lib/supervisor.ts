import { mockDb } from "@ahh-wfm/mock-data";

export async function getSupervisorTeam(supervisorId: string) {
  const employees = await mockDb.getEmployees();
  const supervisor = employees.find(e => e.id === supervisorId);
  
  if (!supervisor) return [];
  if (!supervisor.isSupervisor) return [];

  const scopeType = (supervisor as any).supervisorScopeType || "DIRECT_REPORTS";

  if (scopeType === "DIRECT_REPORTS") {
    // 1. Direct reports (Immediate or Reporting Manager)
    return employees.filter(e => 
      (e as any).immediateSupervisorId === supervisorId || 
      (e as any).reportingManagerId === supervisorId
    );
  }

  if (scopeType === "PROJECT") {
    // 2. Project scope: employees whose defaultProject or deployed project is managed by this supervisor
    // Also include those who explicitly have projectSupervisorId = supervisorId
    const targetProjectIds = employees.filter(e => (e as any).projectSupervisorId === supervisorId).map(e => (e as any).defaultProjectId).filter(Boolean);
    
    // Fallback: assume the supervisor's default project is the one they manage if they don't have explicit projectSupervisorId mapping
    if (targetProjectIds.length === 0 && (supervisor as any).defaultProjectId) {
      targetProjectIds.push((supervisor as any).defaultProjectId);
    }

    return employees.filter(e => 
      (e as any).projectSupervisorId === supervisorId ||
      targetProjectIds.includes((e as any).defaultProjectId)
    );
  }

  if (scopeType === "SITE") {
    // 3. Site scope: employees whose defaultSite is managed by this supervisor
    const targetSiteIds = employees.filter(e => (e as any).siteSupervisorId === supervisorId).map(e => (e as any).defaultSiteId).filter(Boolean);
    
    if (targetSiteIds.length === 0 && (supervisor as any).defaultSiteId) {
      targetSiteIds.push((supervisor as any).defaultSiteId);
    }

    return employees.filter(e => 
      (e as any).siteSupervisorId === supervisorId ||
      targetSiteIds.includes((e as any).defaultSiteId)
    );
  }

  if (scopeType === "DEPARTMENT") {
    // 4. Department scope
    return employees.filter(e => e.departmentId === supervisor.departmentId);
  }

  return [];
}

export async function canApproveLeave(supervisorId: string, leaveRequestId: string) {
  const leaves = await mockDb.getLeaves();
  const leave = leaves.find(l => l.id === leaveRequestId);
  if (!leave) return false;

  // Rule: Supervisor cannot approve their own leave
  if (leave.employeeId === supervisorId) return false;

  const team = await getSupervisorTeam(supervisorId);
  return team.some(e => e.id === leave.employeeId);
}
