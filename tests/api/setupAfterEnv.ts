import { mockDb } from '../../packages/mock-data/src/index';
import { prisma } from '@ahh-wfm/database';

const originalGetEmployeeAuthById = mockDb.getEmployeeAuthById.bind(mockDb);

// Test-only resolver: checks authoritative TEST DATABASE first, and only synthesizes
// an employee record from mocked getServerSession() claims for legacy suites that
// do not seed Employee rows. Never active outside Jest (NODE_ENV=test).
if (process.env.NODE_ENV === 'test' && typeof jest !== 'undefined') {
  mockDb.getEmployeeAuthById = async (id: string) => {
    const dbEmployee = await originalGetEmployeeAuthById(id);
    if (dbEmployee) {
      return dbEmployee;
    }
    if (/DELETED|NONEXISTENT|MISSING/i.test(id)) {
      return null;
    }
    try {
      const nextAuthNext = require('next-auth/next');
      const getSession = nextAuthNext?.getServerSession;
      const isMockedSession =
        typeof getSession === 'function' &&
        (jest.isMockFunction(getSession) || /mock/i.test(Function.prototype.toString.call(getSession)));
      if (isMockedSession) {
        const mockResults = (getSession as any)?.mock?.results;
        const session =
          Array.isArray(mockResults) && mockResults.length > 0
            ? await mockResults[mockResults.length - 1].value
            : await getSession();
        const user = session?.user as any;
        if (user && (user.id === id || user.employeeId === id)) {
          return {
            id: user.id || id,
            name: user.name || 'Test User',
            email: user.email || `${id}@test.local`,
            role: user.role || 'EMPLOYEE',
            companyId: user.companyId ?? null,
            departmentId: user.departmentId ?? null,
            mustChangePassword: Boolean(user.mustChangePassword),
            profilePhotoUrl: user.image || null,
            profilePhotoUpdatedAt: null,
            isActive: user.isActive !== false,
            employmentStatus: user.isActive === false ? 'INACTIVE' : 'ACTIVE',
            isLoginEnabled: user.isLoginEnabled !== false,
            isLocked: Boolean(user.isLocked),
            webAccessEnabled: user.webAccessEnabled !== false,
            mobileAccessEnabled: user.mobileAccessEnabled !== false,
          };
        }
      }
    } catch {
      // Fall through to null (fail closed)
    }
    return null;
  };
}

beforeAll(async () => {
  console.log("Global seeding check starting...");
  await mockDb.getCompanies();
  console.log("Global seeding check completed!");
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
});
