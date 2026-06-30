require('ts-node').register({ transpileOnly: true });
const { mockDb, isDbConnected } = require('d:/AI Projects/AHH WFM/app/packages/mock-data/src/index.ts');

async function main() {
  console.log("DB Connected:", isDbConnected());
  try {
    const companies = await mockDb.getCompanies();
    console.log("mockDb Companies:", companies);
  } catch (e) {
    console.error("ERROR:", e);
  }
}

main().catch(console.error).finally(() => process.exit(0));
