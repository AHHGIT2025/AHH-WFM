import { mockDb } from '../../packages/mock-data/src/index';
import { prisma } from '@ahh-wfm/database';

beforeAll(async () => {
  console.log("Global seeding check starting...");
  await mockDb.getCompanies();
  console.log("Global seeding check completed!");
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
});
