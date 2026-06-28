import { prisma } from "../packages/database/src/index.ts";

async function main() {
  console.log("--- Projects ---");
  const projects = await prisma.project.findMany({ take: 5 });
  console.log(projects);

  console.log("\n--- Designations ---");
  const designations = await prisma.designation.findMany({ take: 5 });
  console.log(designations);

  console.log("\n--- Trade Classifications ---");
  const trades = await prisma.tradeClassification.findMany({ take: 5 });
  console.log(trades);

  console.log("\n--- Cost Centers ---");
  const costCenters = await prisma.costCenter.findMany({ take: 5 });
  console.log(costCenters);
}

main();
