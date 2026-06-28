import { prisma } from "../packages/database/src/index.ts";

async function main() {
  console.log("--- Testing Designation Update ---");
  try {
    const des = await prisma.designation.findFirst();
    if (des) {
      console.log("Updating designation:", des.id);
      const res = await prisma.designation.update({
        where: { id: des.id },
        data: {
          code: des.code,
          name: des.name + " (Updated)",
          employeeCategory: des.employeeCategory,
          isSupervisorPosition: des.isSupervisorPosition,
          isRelieverEligible: des.isRelieverEligible,
        }
      });
      console.log("Designation updated successfully:", res.name);
    } else {
      console.log("No designation found to test.");
    }
  } catch (err: any) {
    console.error("Designation update failed:", err);
  }

  console.log("\n--- Testing Trade Classification Update ---");
  try {
    const trade = await prisma.tradeClassification.findFirst();
    if (trade) {
      console.log("Updating trade:", trade.id);
      const res = await prisma.tradeClassification.update({
        where: { id: trade.id },
        data: {
          code: trade.code,
          name: trade.name + " (Updated)",
          description: trade.description,
        }
      });
      console.log("Trade updated successfully:", res.name);
    } else {
      console.log("No trade found to test.");
    }
  } catch (err: any) {
    console.error("Trade update failed:", err);
  }

  console.log("\n--- Testing Cost Center Update ---");
  try {
    const cc = await prisma.costCenter.findFirst();
    if (cc) {
      console.log("Updating cost center:", cc.id);
      const res = await prisma.costCenter.update({
        where: { id: cc.id },
        data: {
          costCenterCode: cc.costCenterCode,
          costCenterName: cc.costCenterName + " (Updated)",
          sapCostCenterCode: cc.sapCostCenterCode,
        }
      });
      console.log("Cost center updated successfully:", res.costCenterName);
    } else {
      console.log("No cost center found to test.");
    }
  } catch (err: any) {
    console.error("Cost center update failed:", err);
  }
}

main();
