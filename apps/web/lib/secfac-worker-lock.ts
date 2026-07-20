import { prisma } from "@ahh-wfm/database";

/**
 * Typed error thrown when a database / runtime failure occurs inside a lock
 * function.  Callers MUST distinguish this from ordinary "lock already held"
 * (LockResult.acquired === false) situations — do not swallow this as
 * lock contention.
 */
export class WorkerDatabaseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "WorkerDatabaseError";
  }
}

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  ownerId?: string;
  /** Populated only when acquired === false and it is a normal contention case. */
  reason?: string;
}

/**
 * Acquires a distributed database lock using SecFacWorkerLock.
 * Safely recovers expired locks.
 *
 * @throws WorkerDatabaseError  when the database/runtime is unavailable or
 *   the operation fails for a reason that is NOT normal lock contention.
 */
export async function acquireWorkerLock(
  lockKey: string,
  ownerId: string,
  ttlSeconds: number = 300
): Promise<LockResult> {
  // Guard: verify the Prisma client is usable before attempting any DB call.
  if (!prisma || typeof prisma.$transaction !== "function") {
    throw new WorkerDatabaseError(
      `acquireWorkerLock: Prisma client is undefined or $transaction is not callable ` +
      `for lock '${lockKey}'. The database package may not have compiled correctly.`
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  try {
    return await prisma.$transaction(async (tx: any) => {
      const existing = await tx.secFacWorkerLock.findUnique({
        where: { lockKey }
      });

      if (existing) {
        // Expired lock or owned by this caller — recover / renew.
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
          // Lock is actively held by someone else.
          return {
            acquired: false,
            ownerId: existing.ownerId,
            reason: `Lock '${lockKey}' is held by worker '${existing.ownerId}' until ${existing.expiresAt.toISOString()}`
          };
        }
      }

      // Create a new lock record.
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
      // Unique-key race condition — another worker won; this is normal contention.
      return {
        acquired: false,
        reason: `Lock '${lockKey}' was acquired concurrently by another process.`
      };
    }
    // Any other error is a real database/runtime failure.
    console.error(`acquireWorkerLock DATABASE ERROR for '${lockKey}':`, e);
    throw new WorkerDatabaseError(
      `acquireWorkerLock failed for '${lockKey}': ${e?.message ?? String(e)}`,
      e
    );
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
 * Always call this inside a finally block.
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
