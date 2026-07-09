import { isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function getActiveSiteShiftConfigs(siteId: string, db?: any) {
  const isDb = isDbConnected();
  let shifts: any[] = [];

  if (isDb) {
    shifts = await prisma.manpowerShiftRequirement.findMany({
      where: { siteId }
    });
  } else {
    const activeDb = db || readDb();
    shifts = (activeDb.shiftRequirements || []).filter((s: any) => s.siteId === siteId);
  }

  return shifts.filter((sr: any) => {
    if (sr.isActive === false) return false;
    if (sr.active === false) return false;
    
    if (sr.status && ["INACTIVE", "CANCELLED", "DELETED", "inactive", "cancelled", "deleted"].includes(String(sr.status).toUpperCase())) {
      return false;
    }
    
    const now = new Date();
    if (sr.effectiveFrom) {
      const fromDate = new Date(sr.effectiveFrom);
      if (fromDate > now) return false;
    }
    if (sr.effectiveTo) {
      const toDate = new Date(sr.effectiveTo);
      if (toDate < now) return false;
    }
    
    return true;
  });
}
