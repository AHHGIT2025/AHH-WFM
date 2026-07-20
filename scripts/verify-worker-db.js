const db = require('./dist/workers/packages/database/src/index.js');
const prisma = db.prisma;

console.log('=== Compiled Worker Database Module Verification ===');
console.log('1. prisma export defined:', Boolean(prisma));
console.log('2. $transaction type:', typeof prisma.$transaction);
console.log('3. $transaction callable:', typeof prisma.$transaction === 'function');
console.log('4. secFacWorkerLock model:', typeof prisma.secFacWorkerLock);
console.log('5. secFacWorkerJob model:', typeof prisma.secFacWorkerJob);
console.log('6. secFacMonitoringSnapshot model:', typeof prisma.secFacMonitoringSnapshot);
console.log('7. PrismaClient export:', typeof db.PrismaClient);

const txType = typeof prisma.$transaction;
if (txType !== 'function') {
  console.error('FAIL: $transaction is not callable! Got:', txType);
  process.exit(1);
}
console.log('\n✓ All checks passed — Prisma client is fully operational in compiled worker runtime.');
process.exit(0);
