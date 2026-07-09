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

  // 1. Resolve site name and project
  if (isDb) {
    const site = await prisma.manpowerSite.findUnique({
      where: { id: siteId }
    });
    if (!site) return null;
    siteName = site.name;
    projectId = site.projectId;
  } else {
    const db = readDb() as any;
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
    const db = readDb() as any;
    const allShifts = (db.shiftRequirements || []).filter((s: any) => s.siteId === siteId);
    allShiftsCount = allShifts.length;
    allShiftIds = allShifts.map((s: any) => s.id);
  }
  const inactiveShiftsCount = Math.max(0, allShiftsCount - activeShiftsCount);

  // 3. Allocations counts (quantity > 0)
  const db = readDb() as any;
  const siteAllocations = (db.siteManpowerAllocations || []).filter((sa: any) => sa.siteId === siteId && (sa.quantity || 0) > 0);
  const manpowerAllocationsCount = siteAllocations.length;

  // 4. Allowance counts (active vs inactive)
  const siteAllowances = (db.siteAllowances || []).filter((sa: any) => sa.siteId === siteId);
  let activeAllowancesCount = 0;
  let inactiveAllowancesCount = 0;

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

  // 5. Active instructions count (linked to project of this site)
  const activeInstructions = (db.projectInstructions || []).filter(
    (pi: any) => pi.projectId === projectId && pi.isActive !== false
  );
  const activeInstructionsCount = activeInstructions.length;

  // 6. Deployments (historical deployment)
  let deploymentHistoryCount = 0;
  let attendanceHistoryCount = 0;
  let futureAssignmentsCount = 0;

  if (isDb) {
    if (allShiftIds.length > 0) {
      deploymentHistoryCount = await prisma.manpowerDeployment.count({
        where: { shiftRequirementId: { in: allShiftIds } }
      });
      futureAssignmentsCount = await prisma.manpowerDeploymentAssignment.count({
        where: {
          deployment: {
            shiftRequirementId: { in: allShiftIds },
            date: { gte: new Date() }
          }
        }
      });
    }
    attendanceHistoryCount = await prisma.attendanceRecord.count({
      where: { siteId }
    });
  } else {
    if (allShiftIds.length > 0) {
      deploymentHistoryCount = (db.manpowerDeployments || []).filter((d: any) => allShiftIds.includes(d.shiftRequirementId)).length;
      futureAssignmentsCount = (db.manpowerDeploymentAssignments || []).filter((a: any) => {
        const dep = (db.manpowerDeployments || []).find((d: any) => d.id === a.deploymentId);
        return dep && allShiftIds.includes(dep.shiftRequirementId) && new Date(dep.date) >= new Date();
      }).length;
    }
    attendanceHistoryCount = (db.attendance || []).filter((a: any) => a.siteId === siteId).length;
  }

  // 7. Calculate rules
  const blockingReasons: string[] = [];
  if (activeShiftsCount > 0) {
    blockingReasons.push(`Active shift configurations exist (${activeShiftsCount} shifts).`);
  }
  if (manpowerAllocationsCount > 0) {
    blockingReasons.push(`Manpower allocations exist (${manpowerAllocationsCount} positions allocated).`);
  }
  if (activeAllowancesCount > 0) {
    blockingReasons.push(`Active allowance configurations exist (${activeAllowancesCount} allowances active).`);
  }

  const hasHistory = deploymentHistoryCount > 0 || attendanceHistoryCount > 0 || futureAssignmentsCount > 0;
  const hasActiveConfig = activeShiftsCount > 0 || manpowerAllocationsCount > 0 || activeAllowancesCount > 0;

  let canHardDelete = false;
  let suggestedAction: "DEACTIVATE" | "REMOVE_CONFIG" | "HARD_DELETE_ALLOWED" = "HARD_DELETE_ALLOWED";
  let message = "This site can be safely deleted.";

  if (hasHistory) {
    canHardDelete = false;
    suggestedAction = "DEACTIVATE";
    message = "This site is already used in deployment records. It must be deactivated instead of permanently deleted.";
  } else if (hasActiveConfig) {
    canHardDelete = false;
    suggestedAction = "REMOVE_CONFIG";
    
    // Construct exact configuration message
    const configs: string[] = [];
    if (activeShiftsCount > 0) configs.push("active shift configuration");
    if (manpowerAllocationsCount > 0) configs.push("manpower allocation");
    if (activeAllowancesCount > 0) configs.push("allowance configuration");
    
    message = `Cannot delete because this site has ${configs.join(" and ")}. Please remove these configurations or deactivate the site.`;
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
