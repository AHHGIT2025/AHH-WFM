import { PrismaClient } from "@ahh-wfm/database";

const prisma = new PrismaClient();

export function buildSeriesKey(
  operationType: string,
  contractId: string,
  siteId: string | null | undefined,
  startDate: Date | string,
  endDate: Date | string
): string {
  const siteKey = siteId ? `site:${siteId}` : "all_sites";
  const startStr = new Date(startDate).toISOString().slice(0, 10);
  const endStr = new Date(endDate).toISOString().slice(0, 10);
  return `${operationType}:${contractId}:${siteKey}:${startStr}:${endStr}`;
}

export async function acquireScopeLock(
  operationType: string,
  contractId: string,
  siteId: string | null | undefined,
  ownerId: string
): Promise<string> {
  const siteKey = siteId ? `site:${siteId}` : "all_sites";
  const lockKey = `publock:${operationType}:${contractId}:${siteKey}`;
  const expiresAt = new Date(Date.now() + 30000); // 30s lock

  await prisma.manpowerPublicationScopeLock.upsert({
    where: { lockKey },
    update: { ownerId, expiresAt, updatedAt: new Date() },
    create: { lockKey, ownerId, expiresAt }
  });

  return lockKey;
}

export async function releaseScopeLock(lockKey: string, ownerId: string): Promise<void> {
  try {
    await prisma.manpowerPublicationScopeLock.deleteMany({
      where: { lockKey, ownerId }
    });
  } catch (err) {
    // Ignore lock release errors
  }
}

export async function checkPeriodLock(operationType: string, startDate: Date | string, endDate: Date | string): Promise<boolean> {
  const startObj = new Date(startDate);
  const endObj = new Date(endDate);

  const startPeriod = `${startObj.getFullYear()}-${String(startObj.getMonth() + 1).padStart(2, "0")}`;
  const endPeriod = `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, "0")}`;

  const periodLocks = await prisma.manpowerSchedulingPeriodLock.findMany({
    where: {
      operationType,
      period: { in: [startPeriod, endPeriod] },
      locked: true
    }
  });

  return periodLocks.length > 0;
}

export async function checkOverlappingActivePublications(
  operationType: string,
  contractId: string,
  siteId: string | null | undefined,
  startDate: Date,
  endDate: Date,
  excludePublicationId?: string
) {
  const activePubs = await prisma.rosterPublication.findMany({
    where: {
      operationType,
      contractId,
      status: "ACTIVE",
      ...(excludePublicationId ? { id: { not: excludePublicationId } } : {})
    }
  });

  const conflicts = activePubs.filter(pub => {
    const siteMatches = !siteId || !pub.siteId || siteId === pub.siteId;
    if (!siteMatches) return false;

    const pubStart = new Date(pub.startDate);
    const pubEnd = new Date(pub.endDate);
    const targetStart = new Date(startDate);
    const targetEnd = new Date(endDate);

    return pubStart <= targetEnd && pubEnd >= targetStart;
  });

  return conflicts;
}

export async function logCentralAudit(data: {
  action: string;
  actorId: string;
  operationType: string;
  contractId?: string;
  siteId?: string;
  requestId?: string;
  oldPublicationId?: string;
  newPublicationId?: string;
  details?: any;
}) {
  try {
    await prisma.userActivityLog.create({
      data: {
        userId: data.actorId,
        action: data.action,
        entityType: "RosterPublication",
        entityId: data.newPublicationId || data.oldPublicationId || data.requestId || "SYSTEM",
        afterJson: JSON.stringify({
          operationType: data.operationType,
          contractId: data.contractId,
          siteId: data.siteId,
          requestId: data.requestId,
          oldPublicationId: data.oldPublicationId,
          newPublicationId: data.newPublicationId,
          ...data.details
        })
      }
    });
  } catch (err) {
    console.error("[Central Audit Error]", err);
  }
}
