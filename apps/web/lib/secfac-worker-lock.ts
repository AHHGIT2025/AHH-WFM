import { prisma } from "@ahh-wfm/database";

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  ownerId?: string;
  reason?: string;
}

/**
 * Acquires a distributed database lock using SecFacWorkerLock.
 * Safely recovers expired locks.
 */
export async function acquireWorkerLock(
  lockKey: string,
  ownerId: string,
  ttlSeconds: number = 300
): Promise<LockResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.secFacWorkerLock.findUnique({
        where: { lockKey }
      });

      if (existing) {
        // Check if existing lock is expired or owned by caller
        if (existing.expiresAt.getTime() <= now.getTime() || existing.ownerId === ownerId) {
          const updated = await tx.secFacWorkerLock.update({
            where: { lockKey },
            data: {
              ownerId,
              acquiredAt: now,
              expiresAt,
              heartbeatAt: now
            }
          });
          return { acquired: true, lockId: updated.id, ownerId };
        } else {
          return {
            acquired: false,
            ownerId: existing.ownerId,
            reason: `Lock '${lockKey}' is held by worker '${existing.ownerId}' until ${existing.expiresAt.toISOString()}`
          };
        }
      }

      // Create new lock
      const created = await tx.secFacWorkerLock.create({
        data: {
          lockKey,
          ownerId,
          acquiredAt: now,
          expiresAt,
          heartbeatAt: now
        }
      });

      return { acquired: true, lockId: created.id, ownerId };
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      // Race condition handled safely
      return { acquired: false, reason: `Lock '${lockKey}' was acquired concurrently by another process.` };
    }
    console.error(`acquireWorkerLock error for '${lockKey}':`, e);
    return { acquired: false, reason: e?.message || "Lock acquisition database error" };
  }
}

/**
 * Renews heartbeat and extends TTL for an existing lock.
 */
export async function renewWorkerLock(
  lockKey: string,
  ownerId: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  try {
    const updated = await prisma.secFacWorkerLock.updateMany({
      where: {
        lockKey,
        ownerId
      },
      data: {
        heartbeatAt: now,
        expiresAt
      }
    });

    return updated.count > 0;
  } catch (e: any) {
    console.error(`renewWorkerLock error for '${lockKey}':`, e);
    return false;
  }
}

/**
 * Releases worker lock safely if owned by ownerId.
 */
export async function releaseWorkerLock(
  lockKey: string,
  ownerId: string
): Promise<boolean> {
  try {
    const deleted = await prisma.secFacWorkerLock.deleteMany({
      where: {
        lockKey,
        ownerId
      }
    });

    return deleted.count > 0;
  } catch (e: any) {
    console.error(`releaseWorkerLock error for '${lockKey}':`, e);
    return false;
  }
}

/**
 * Cleans up stale worker locks older than their expiration.
 */
export async function cleanStaleWorkerLocks(): Promise<number> {
  const now = new Date();
  try {
    const deleted = await prisma.secFacWorkerLock.deleteMany({
      where: {
        expiresAt: { lte: now }
      }
    });

    return deleted.count;
  } catch (e: any) {
    console.error("cleanStaleWorkerLocks error:", e);
    return 0;
  }
}
