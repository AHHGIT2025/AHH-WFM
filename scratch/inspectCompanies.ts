import { prisma } from "../packages/database/src/index";
import { isDbConnected } from "../packages/mock-data/src/index";

async function main() {
  console.log("DB Connected:", isDbConnected());
  try {
    const companies = await prisma.company.findMany();
    console.log("Prisma Companies:", companies);
  } catch (e: any) {
    console.error("Error querying Prisma:", e.message);
  }
}

main().catch(console.error).finally(() => process.exit(0));
