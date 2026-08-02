import { mockDb } from '../../packages/mock-data/src/index';

beforeAll(async () => {
  console.log("Global seeding check starting...");
  await mockDb.getCompanies();
  console.log("Global seeding check completed!");
}, 60000);
