import { isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";
import { getActiveSiteShiftConfigs } from "./server-helpers";

export interface SiteDependencyReport {
  siteId: string;
  siteName: string;
  canHardDelete: boolean;
  canDeactivate: boolean;
  suggestedAction: "DEACTIVATE" | "REMOVE_CONFIG" | "HARD_DELETE_ALLOWED";
  dependencyCounts: {
    activeSiteShifts: number;
    inactiveSiteShifts: number;
    manpowerAllocations: number;
    activeAllowances: number;
    inactiveAllowances: number;
    activeInstructions: number;
    deploymentHistory: number;
    attendanceHistory: number;
    futureAssignments: number;
  };
  blockingReasons: string[];
  message: string;
}

export async function getSiteDependencies(siteId: string): Promise<SiteDependencyReport | null> {
  const isDb = isDbConnected();
  let siteName = "";
  let projectId = "";
  let db: any = null;
  if (!isDb) {
    db = readDb() as any;
  }

  // 1. Resolve site name and project
  if (isDb) {
    const site = await prisma.manpowerSite.findUnique({
      where: { id: siteId }
    });
    if (!site) return null;
    siteName = site.name;
    projectId = site.projectId;
  } else {
    const site = (db.manpowerSites || []).find((s: any) => s.id === siteId);
    if (!site) return null;
    siteName = site.name;
    projectId = site.projectId;
  }

  // 2. Shift counts (using the shared helper getActiveSiteShiftConfigs)
  const activeShifts = await getActiveSiteShiftConfigs(siteId);
  const activeShiftsCount = activeShifts.length;

  let allShiftsCount = 0;
  let allShiftIds: string[] = [];
  if (isDb) {
    const allShifts = await prisma.manpowerShiftRequirement.findMany({
      where: { siteId }
    });
    allShiftsCount = allShifts.length;
    allShiftIds = allShifts.map(s => s.id);
  } else {
    const allShifts = (db.shiftRequirements || []).filter((s: any) => s.siteId === siteId);
    allShiftsCount = allShifts.length;
    allShiftIds = allShifts.map((s: any) => s.id);
  }
  const inactiveShiftsCount = Math.max(0, allShiftsCount - activeShiftsCount);

  // 3. Allocations counts (quantity > 0)
  let manpowerAllocationsCount = 0;
  if (isDb) {
    manpowerAllocationsCount = await prisma.securitySiteManpowerAllocation.count({
      where: { siteId, quantity: { gt: 0 } }
    });
  } else {
    const siteAllocations = (db.siteManpowerAllocations || []).filter((sa: any) => sa.siteId === siteId && (sa.quantity || 0) > 0);
    manpowerAllocationsCount = siteAllocations.length;
  }

  // 4. Allowance counts (active vs inactive)
  let activeAllowancesCount = 0;
  let inactiveAllowancesCount = 0;

  if (isDb) {
    const dbAllowances = await prisma.securitySiteAllowance.findMany({
      where: { siteId }
    });
    dbAllowances.forEach((sa: any) => {
      let isActive = sa.isActive && sa.siteAllowanceEnabled;
      const now = new Date();
      if (sa.effectiveFrom && new Date(sa.effectiveFrom) > now) isActive = false;
      if (sa.effectiveTo && new Date(sa.effectiveTo) < now) isActive = false;

      if (isActive) {
        activeAllowancesCount++;
      } else {
        inactiveAllowancesCount++;
      }
    });
  } else {
    const siteAllowances = (db.siteAllowances || []).filter((sa: any) => sa.siteId === siteId);
    siteAllowances.forEach((sa: any) => {
      let isActive = true;
      if (sa.isActive === false) isActive = false;
      if (sa.active === false) isActive = false;
      if (sa.siteAllowanceEnabled === false) isActive = false;
      if (sa.status && ["INACTIVE", "CANCELLED", "DELETED"].includes(String(sa.status).toUpperCase())) {
        isActive = false;
      }
      const now = new Date();
      if (sa.effectiveFrom && new Date(sa.effectiveFrom) > now) isActive = false;
      if (sa.effectiveTo && new Date(sa.effectiveTo) < now) isActive = false;

      if (isActive) {
        activeAllowancesCount++;
      } else {
        inactiveAllowancesCount++;
      }
    });
  }

  // 5. Active instructions count (linked to project of this site)
  const fallbackDb = db || (readDb() as any);
  const activeInstructions = (fallbackDb.projectInstructions || []).filter(
    (pi: any) =>
      pi.projectId === projectId &&
      pi.isActive !== false &&
      (!pi.siteId || pi.siteId === siteId || pi.appliesToAllSites === true)
  );
  const activeInstructionsCount = activeInstructions.length;

  // 6. Deployments (historical deployment)
  let deploymentHistoryCount = 0;
  let attendanceHistoryCount = 0;
  let futureAssignmentsCount = 0;

  const today = new Date();
  today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split("T")[0];

  function parseDate(val: any): string {
    if (!val) return "";
    if (val instanceof Date) return val.toISOString().split("T")[0];
    return String(val).split("T")[0];
  }

  if (isDb) {
    if (allShiftIds.length > 0) {
      deploymentHistoryCount = await prisma.manpowerDeployment.count({
        where: {
          shiftRequirementId: { in: allShiftIds },
          date: { lt: today }
        }
      });
      futureAssignmentsCount = await prisma.manpowerDeploymentAssignment.count({
        where: {
          deployment: {
            shiftRequirementId: { in: allShiftIds },
            date: { gte: today }
          }
        }
      });
    }
    attendanceHistoryCount = await prisma.attendanceRecord.count({
      where: { siteId }
    });
  } else {
    if (allShiftIds.length > 0) {
      deploymentHistoryCount = (db.manpowerDeployments || []).filter((d: any) => 
        allShiftIds.includes(d.shiftRequirementId) && parseDate(d.date) < todayStr
      ).length;

      futureAssignmentsCount = (db.manpowerDeploymentAssignments || []).filter((a: any) => {
        const dep = (db.manpowerDeployments || []).find((d: any) => d.id === a.deploymentId);
        return dep && allShiftIds.includes(dep.shiftRequirementId) && parseDate(dep.date) >= todayStr;
      }).length;
    }
    attendanceHistoryCount = (db.attendance || []).filter((a: any) => a.siteId === siteId).length;
  }

  // 7. Calculate rules
  const blockingReasons: string[] = [];
  if (activeShiftsCount > 0) blockingReasons.push("activeSiteShifts");
  if (manpowerAllocationsCount > 0) blockingReasons.push("manpowerAllocations");
  if (activeAllowancesCount > 0) blockingReasons.push("activeAllowances");
  if (activeInstructionsCount > 0) blockingReasons.push("activeInstructions");
  if (futureAssignmentsCount > 0) blockingReasons.push("futureAssignments");
  if (deploymentHistoryCount > 0) blockingReasons.push("deploymentHistory");
  if (attendanceHistoryCount > 0) blockingReasons.push("attendanceHistory");

  const hasHistory = deploymentHistoryCount > 0 || attendanceHistoryCount > 0;
  const hasActiveConfig = activeShiftsCount > 0 || manpowerAllocationsCount > 0 || activeAllowancesCount > 0 || activeInstructionsCount > 0 || futureAssignmentsCount > 0;

  let canHardDelete = false;
  let suggestedAction: "DEACTIVATE" | "REMOVE_CONFIG" | "HARD_DELETE_ALLOWED" = "HARD_DELETE_ALLOWED";
  let message = "This site can be safely deleted.";

  if (hasHistory) {
    canHardDelete = false;
    suggestedAction = "DEACTIVATE";
    message = "This site has historical deployment or attendance records. It must be deactivated instead of permanently deleted.";
  } else if (hasActiveConfig) {
    canHardDelete = false;
    suggestedAction = "REMOVE_CONFIG";
    
    // Construct exact configuration message
    const configs: string[] = [];
    if (activeShiftsCount > 0) configs.push("active site shifts");
    if (manpowerAllocationsCount > 0) configs.push("manpower allocations");
    if (activeAllowancesCount > 0) configs.push("active allowances");
    if (activeInstructionsCount > 0) configs.push("active instructions");
    if (futureAssignmentsCount > 0) configs.push("future assignments");
    
    message = `Cannot delete because this site has active configuration or scheduled records: ${configs.join(", ")}. Please remove these or deactivate the site.`;
  } else {
    canHardDelete = true;
    suggestedAction = "HARD_DELETE_ALLOWED";
    if (inactiveShiftsCount > 0 || inactiveAllowancesCount > 0) {
      message = "Only inactive configuration found. Delete can proceed and will automatically clean up stale records.";
    }
  }

  // Determine if site can be deactivated (check if currently active)
  let canDeactivate = true;
  if (isDb) {
    const site = await prisma.manpowerSite.findUnique({ where: { id: siteId } });
    canDeactivate = site ? site.isActive : false;
  } else {
    const site = (db.manpowerSites || []).find((s: any) => s.id === siteId);
    canDeactivate = site ? site.isActive : false;
  }

  return {
    siteId,
    siteName,
    canHardDelete,
    canDeactivate,
    suggestedAction,
    dependencyCounts: {
      activeSiteShifts: activeShiftsCount,
      inactiveSiteShifts: inactiveShiftsCount,
      manpowerAllocations: manpowerAllocationsCount,
      activeAllowances: activeAllowancesCount,
      inactiveAllowances: inactiveAllowancesCount,
      activeInstructions: activeInstructionsCount,
      deploymentHistory: deploymentHistoryCount,
      attendanceHistory: attendanceHistoryCount,
      futureAssignments: futureAssignmentsCount
    },
    blockingReasons,
    message
  };
}
