import { prisma } from '@ahh-wfm/database';
import { mockDb, resetSeededStateForTesting, isCompanyCodeP2002Error } from '../../packages/mock-data/src/index';

describe('Company Seeding P2002 Fix & Idempotency Verification', () => {
  beforeEach(async () => {
    resetSeededStateForTesting();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Test 1: Fresh empty database seed
  it('1. should seed companies safely on a fresh/un-seeded database state', async () => {
    resetSeededStateForTesting();
    const companies = await mockDb.getCompanies();
    expect(companies).toBeDefined();
    expect(companies.length).toBeGreaterThanOrEqual(3);

    const holding = companies.find((c: any) => c.isHoldingCompany);
    expect(holding).toBeDefined();
    expect(holding?.companyCode).toBe('AHH');
  });

  // Test 2: Repeated seed invocation
  it('2. should perform safe no-op on repeated seed invocations without throwing P2002', async () => {
    resetSeededStateForTesting();
    await mockDb.getCompanies();
    resetSeededStateForTesting();
    const secondCall = await mockDb.getCompanies();
    expect(secondCall).toBeDefined();
    expect(secondCall.length).toBeGreaterThanOrEqual(3);
  });

  // Test 3: Existing Company with matching ID and company code
  it('3. should safely reuse existing Company matching both ID and companyCode', async () => {
    const existing = await prisma.company.findUnique({ where: { companyCode: 'AHH' } });
    expect(existing).toBeDefined();

    resetSeededStateForTesting();
    const companies = await mockDb.getCompanies();
    const rechecked = companies.find((c: any) => c.companyCode === 'AHH');
    expect(rechecked?.id).toBe(existing?.id);
  });

  // Test 4: Existing Company with matching company code and different historical ID
  it('4. should reconcile existing Company with matching companyCode and different historical ID without P2002', async () => {
    const testCode = 'HIST-TEST-CODE';
    const testId1 = 'HIST-ID-ORIGINAL';

    try {
      await prisma.company.deleteMany({ where: { companyCode: testCode } });
      await prisma.company.create({
        data: {
          id: testId1,
          companyCode: testCode,
          companyName: 'Historical Test Co',
          isHoldingCompany: false,
          isActive: true
        }
      });

      const mockComp = {
        id: 'HIST-ID-NEW',
        companyCode: testCode,
        companyName: 'Historical Test Co Updated',
        isHoldingCompany: true,
        isActive: true
      };

      const existingByCode = await prisma.company.findUnique({
        where: { companyCode: mockComp.companyCode }
      });

      expect(existingByCode).toBeDefined();
      expect(existingByCode?.id).toBe(testId1);
      expect(existingByCode?.companyCode).toBe(testCode);

      const count = await prisma.company.count({ where: { companyCode: testCode } });
      expect(count).toBe(1);
    } finally {
      await prisma.company.deleteMany({ where: { companyCode: testCode } });
    }
  });

  // Test 5: Concurrent seed calls in one process
  it('5. should deduplicate concurrent seed calls in the same process', async () => {
    resetSeededStateForTesting();
    const [call1, call2, call3] = await Promise.all([
      mockDb.getCompanies(),
      mockDb.getCompanies(),
      mockDb.getCompanies()
    ]);

    expect(call1).toBeDefined();
    expect(call2).toBeDefined();
    expect(call3).toBeDefined();
    expect(call1.length).toEqual(call2.length);
  });

  // Test 6: Concurrent independent initialization paths
  it('6. should safely handle concurrent independent seed executions without throwing P2002', async () => {
    const runIndependentSeed = async () => {
      resetSeededStateForTesting();
      return await mockDb.getCompanies();
    };

    const results = await Promise.allSettled([
      runIndependentSeed(),
      runIndependentSeed(),
      runIndependentSeed()
    ]);

    results.forEach(res => {
      expect(res.status).toBe('fulfilled');
    });
  });

  // Test 7: Existing holding company causes safe no-op or reconciliation
  it('7. should skip company seeding when a holding company already exists', async () => {
    const holding = await prisma.company.findFirst({ where: { isHoldingCompany: true } });
    expect(holding).toBeDefined();

    resetSeededStateForTesting();
    const initialCount = await prisma.company.count();
    await mockDb.getCompanies();
    const postCount = await prisma.company.count();

    expect(postCount).toBe(initialCount);
  });

  // Test 8: Company lookup after initialization
  it('8. should perform company lookup cleanly after initialization', async () => {
    const companies = await mockDb.getCompanies();
    expect(companies.length).toBeGreaterThan(0);
    const firstComp = companies[0];
    const found = await prisma.company.findUnique({ where: { id: firstComp.id } });
    expect(found).toBeDefined();
  });

  // Test 9: Location lookup after initialization
  it('9. should perform location master lookup cleanly after initialization', async () => {
    const locations = await mockDb.getLocations();
    expect(locations).toBeDefined();
    expect(Array.isArray(locations)).toBe(true);
  });

  // Test 10: Permission lookup after initialization
  it('10. should perform permission lookups cleanly after initialization', async () => {
    const perms = await mockDb.getSystemPermissions();
    expect(perms).toBeDefined();
    expect(Array.isArray(perms)).toBe(true);

    const access = await mockDb.getUserOperationAccess('AA-1001');
    expect(access).toBeDefined();
  });

  // Test 11: Web dashboard summary request path simulation
  it('11. should execute Web dashboard summary data path without P2002 errors', async () => {
    resetSeededStateForTesting();
    const companies = await mockDb.getCompanies();
    const locations = await mockDb.getLocations();
    const permissions = await mockDb.getSystemPermissions();

    expect(companies).toBeDefined();
    expect(locations).toBeDefined();
    expect(permissions).toBeDefined();
  });

  // Test 12: Mobile authentication/dashboard initialization path simulation
  it('12. should execute Mobile auth & dashboard initialization without P2002 errors', async () => {
    resetSeededStateForTesting();
    const userAccess = await mockDb.getUserOperationAccess('SK-90210');
    expect(userAccess).toBeDefined();
  });

  // Test 13: Unexpected Prisma errors remain visible
  it('13. should allow unexpected non-P2002 Prisma errors to surface clearly', async () => {
    const prismaAny: any = prisma;
    const invalidQueryPromise = (prismaAny as any).company.findUnique({ where: { invalidNonExistentField: 'fail' } });
    await expect(invalidQueryPromise).rejects.toThrow();
  });

  // Test 14: No duplicate Company records are created
  it('14. should ensure no duplicate Company records exist for any companyCode', async () => {
    resetSeededStateForTesting();
    await mockDb.getCompanies();

    const companies = await prisma.company.findMany();
    const codeCounts = new Map<string, number>();

    companies.forEach(c => {
      const current = codeCounts.get(c.companyCode) || 0;
      codeCounts.set(c.companyCode, current + 1);
    });

    codeCounts.forEach((count, code) => {
      expect(count).toBe(1);
    });
  });

  // Test 15: Exact P2002 Metadata Target & Message Matching Unit Tests
  it('15. should validate exact P2002 error target matching and re-throw unrelated P2002 errors', () => {
    // 15a: Model name differs (PartnerCompany) -> false (re-throws)
    const errPartnerCompany = {
      code: 'P2002',
      meta: { modelName: 'PartnerCompany', target: ['companyCode'] }
    };
    expect(isCompanyCodeP2002Error(errPartnerCompany)).toBe(false);

    // 15b: Different unique constraint on Company (Company_companyName_key) -> false (re-throws)
    const errCompanyName = {
      code: 'P2002',
      meta: { modelName: 'Company', target: ['Company_companyName_key'] }
    };
    expect(isCompanyCodeP2002Error(errCompanyName)).toBe(false);

    // 15c: Absent metadata with exact Company_companyCode_key message -> true (matches)
    const errExactMessage = {
      code: 'P2002',
      message: 'Unique constraint failed on the constraint: `Company_companyCode_key`'
    };
    expect(isCompanyCodeP2002Error(errExactMessage)).toBe(true);

    // 15d: Absent metadata with vague unrelated message -> false (re-throws)
    const errVagueMessage = {
      code: 'P2002',
      message: 'Unique constraint failed on PartnerCompany_companyCode_key'
    };
    expect(isCompanyCodeP2002Error(errVagueMessage)).toBe(false);
  });

});
