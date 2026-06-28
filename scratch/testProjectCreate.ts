import { prisma } from "../packages/database/src/index.ts";

async function test() {
  console.log("Testing Project creation with Company and Location...");
  try {
    const company = await prisma.company.findFirst();
    const location = await prisma.locationMaster.findFirst();

    console.log("Found Company:", company?.id);
    console.log("Found Location:", location?.id);

    const res = await prisma.project.create({
      data: {
        projectCode: "TEST-PROJ-888",
        projectName: "Test Project 888",
        projectType: "NORMAL",
        costCenter: "",
        companyId: company?.id || null,
        locationId: location?.id || null,
      }
    });
    console.log("Success! Project created:", res);
    // Cleanup
    await prisma.project.delete({ where: { id: res.id } });
  } catch (err: any) {
    console.error("Prisma error:", err);
  }
}

test();
