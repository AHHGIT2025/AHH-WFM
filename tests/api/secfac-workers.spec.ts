import { acquireWorkerLock, renewWorkerLock, releaseWorkerLock, cleanStaleWorkerLocks } from "../../apps/web/lib/secfac-worker-lock";
import { prisma } from "@ahh-wfm/database";

describe("SECFAC Phase 5C — Distributed Worker Locking Engine", () => {
  const testLockKey = "test:worker:lock-1";
  const worker1 = "worker-process-1";
  const worker2 = "worker-process-2";

  beforeAll(async () => {
    await prisma.secFacWorkerLock.deleteMany({
      where: { lockKey: { startsWith: "test:worker" } }
    });
  });

  afterEach(async () => {
    await prisma.secFacWorkerLock.deleteMany({
      where: { lockKey: { startsWith: "test:worker" } }
    });
  });

  it("allows a worker to acquire an unheld database lock", async () => {
    const res = await acquireWorkerLock(testLockKey, worker1, 60);
    expect(res.acquired).toBe(true);
    expect(res.ownerId).toBe(worker1);

    const lockInDb = await prisma.secFacWorkerLock.findUnique({ where: { lockKey: testLockKey } });
    expect(lockInDb?.ownerId).toBe(worker1);
  });

  it("prevents another worker from acquiring an active unexpired lock", async () => {
    await acquireWorkerLock(testLockKey, worker1, 60);
    const res2 = await acquireWorkerLock(testLockKey, worker2, 60);

    expect(res2.acquired).toBe(false);
    expect(res2.ownerId).toBe(worker1);
  });

  it("allows lock owner to renew heartbeat and extend expiration TTL", async () => {
    await acquireWorkerLock(testLockKey, worker1, 60);
    const renewed = await renewWorkerLock(testLockKey, worker1, 120);

    expect(renewed).toBe(true);
  });

  it("recovers an expired stale lock automatically when requested by another worker", async () => {
    // Acquire lock with 0 TTL (expired immediately)
    const now = new Date();
    await prisma.secFacWorkerLock.create({
      data: {
        lockKey: testLockKey,
        ownerId: worker1,
        acquiredAt: new Date(now.getTime() - 120000),
        expiresAt: new Date(now.getTime() - 60000) // Expired 1 minute ago!
      }
    });

    const res2 = await acquireWorkerLock(testLockKey, worker2, 60);
    expect(res2.acquired).toBe(true);
    expect(res2.ownerId).toBe(worker2);
  });

  it("safely releases worker lock when requested by lock owner", async () => {
    await acquireWorkerLock(testLockKey, worker1, 60);
    const released = await releaseWorkerLock(testLockKey, worker1);

    expect(released).toBe(true);

    const check = await prisma.secFacWorkerLock.findUnique({ where: { lockKey: testLockKey } });
    expect(check).toBeNull();
  });

  it("cleans stale worker locks older than expiration timestamp", async () => {
    const now = new Date();
    await prisma.secFacWorkerLock.create({
      data: {
        lockKey: "test:worker:stale-lock",
        ownerId: "dead-worker",
        acquiredAt: new Date(now.getTime() - 300000),
        expiresAt: new Date(now.getTime() - 60000)
      }
    });

    const cleaned = await cleanStaleWorkerLocks();
    expect(cleaned).toBeGreaterThan(0);
  });
});
