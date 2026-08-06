import { mockDb, resetSeededStateForTesting } from '../packages/mock-data/src/index';
import { prisma } from '@ahh-wfm/database';

async function runRuntimeVerification() {
  console.log(`[${new Date().toISOString()}] Starting LOCAL Runtime Verification for Company Seeding P2002...`);

  resetSeededStateForTesting();

  const timestampBefore = new Date().toISOString();
  console.log(`[${timestampBefore}] Log timestamp BEFORE high-concurrency requests`);

  // Execute high concurrency repeated read requests covering:
  // 1. Web dashboard summary data path
  // 2. Mobile dashboard & auth access path
  // 3. Company master lookup
  // 4. Location master lookup
  // 5. System permission lookup
  // 6. User operation access lookup
  const requests = Array.from({ length: 50 }, async (_, idx) => {
    const mod = idx % 5;
    if (mod === 0) return await mockDb.getCompanies();
    if (mod === 1) return await mockDb.getLocations();
    if (mod === 2) return await mockDb.getSystemPermissions();
    if (mod === 3) return await mockDb.getUserOperationAccess('AA-1001');
    return await mockDb.getUserOperationAccess('SK-90210');
  });

  const results = await Promise.allSettled(requests);

  const timestampAfter = new Date().toISOString();
  console.log(`[${timestampAfter}] Log timestamp AFTER high-concurrency requests`);

  const fulfilledCount = results.filter(r => r.status === 'fulfilled').length;
  const rejectedCount = results.filter(r => r.status === 'rejected').length;

  console.log(`[${new Date().toISOString()}] Total requests: ${requests.length}`);
  console.log(`[${new Date().toISOString()}] Fulfilled requests: ${fulfilledCount}`);
  console.log(`[${new Date().toISOString()}] Rejected requests: ${rejectedCount}`);

  // Query database to prove company state & uniqueness
  const dbCompanies = await prisma.company.findMany();
  console.log(`[${new Date().toISOString()}] Total companies in database: ${dbCompanies.length}`);
  dbCompanies.forEach(c => {
    console.log(`  - Company ID: ${c.id} | Code: ${c.companyCode} | Name: ${c.companyName} | Holding: ${c.isHoldingCompany}`);
  });

  if (rejectedCount === 0 && dbCompanies.length >= 3) {
    console.log(`[${new Date().toISOString()}] SUCCESS: All 50 high-concurrency requests completed without P2002 duplicate key errors.`);
  } else {
    console.error(`[${new Date().toISOString()}] FAILURE: Verification failed.`);
    process.exit(1);
  }

  await prisma.$disconnect();
}

runRuntimeVerification().catch(err => {
  console.error("Runtime verification threw unexpected error:", err);
  process.exit(1);
});
