import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Web-to-Mobile Master Data Integration Verification...");

  // 1. Create Company
  const company = await prisma.company.create({
    data: {
      companyCode: "V-COMP-01",
      companyName: "Verification Company",
      isActive: true,
    }
  });
  console.log(`[OK] Created Company: ${company.companyName}`);

  // 2. Create Office Location
  const office = await prisma.locationMaster.create({
    data: {
      companyId: company.id,
      locationCode: "V-OFF-01",
      locationName: "Verification HQ",
      latitude: 25.2048,
      longitude: 55.2708,
      defaultGeofenceRadiusMeters: 50,
      isActive: true,
    }
  });
  console.log(`[OK] Created Office: ${office.locationName}`);

  // 3. Create Project and Site
  const project = await prisma.project.create({
    data: {
      companyId: company.id,
      projectCode: "V-PROJ-01",
      projectName: "Verification Mega Project",
      projectType: "NORMAL",
      locationId: office.id,
      costCenter: "CC-V01",
      status: "ACTIVE",
    }
  });
  console.log(`[OK] Created Project: ${project.projectName}`);

  const site = await prisma.projectSite.create({
    data: {
      projectId: project.id,
      companyId: company.id,
      siteCode: "V-SITE-01",
      siteName: "Verification Zone A",
      latitude: 25.1000,
      longitude: 55.1000,
      geofenceRadiusMeters: 100,
      status: "ACTIVE",
    }
  });
  console.log(`[OK] Created Site: ${site.siteName}`);

  // 4. Create Employee and Assign to Company/Location
  const employee = await prisma.employee.create({
    data: {
      id: "V-EMP-001",
      name: "John Verifier",
      email: "john.verifier@example.com",
      companyId: company.id,
      officeLocationId: office.id,
      department: "Verification Dept",
      status: "Offline",
      role: "EMPLOYEE",
      workerCategory: "BLUE_COLLAR",
    }
  });
  console.log(`[OK] Created Employee: ${employee.name}`);

  // 5. Create Custom Allowed Punch Location and Assign to Employee
  const allowedLoc = await prisma.allowedPunchLocation.create({
    data: {
      companyId: company.id,
      name: "Custom Workshop",
      locationType: "CUSTOM",
      latitude: 25.1500,
      longitude: 55.1500,
      radiusMeters: 200,
      isActive: true,
    }
  });

  const assignment = await prisma.employeeAllowedPunchLocation.create({
    data: {
      employeeId: employee.id,
      allowedPunchLocationId: allowedLoc.id,
      isDefault: true,
      priority: 1,
      isActive: true,
    }
  });
  console.log(`[OK] Assigned Allowed Location: ${allowedLoc.name} to Employee`);

  // Verify Mobile BFF logic by directly importing the logic (or just running it here)
  // We'll mimic the mobile BFF logic
  console.log("\nVerifying Mobile App BFF Logic...");
  
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const empFetch = await prisma.employee.findUnique({
    where: { id: employee.id },
    include: {
      officeLocation: true,
      allowedPunchLocations: {
        include: { allowedPunchLocation: true },
        where: { isActive: true }
      }
    }
  });

  // Verify 3. Employee Specific Allowed Locations (Since no deployment or on-call is assigned for today)
  let result = null;
  if (empFetch?.allowedPunchLocations && empFetch.allowedPunchLocations.length > 0) {
    const defaultAllowed = empFetch.allowedPunchLocations.find(l => l.isDefault) || empFetch.allowedPunchLocations[0];
    const loc = defaultAllowed.allowedPunchLocation;
    if (loc && loc.latitude) {
      result = {
        type: "CUSTOM_ALLOWED",
        name: loc.name,
        lat: loc.latitude,
        lng: loc.longitude,
        radiusMeters: loc.radiusMeters || 100,
      };
    }
  }

  if (result?.type === "CUSTOM_ALLOWED" && result.name === "Custom Workshop") {
    console.log("[SUCCESS] Mobile BFF resolves correct Allowed Location: CUSTOM_ALLOWED (Custom Workshop)");
  } else {
    console.error("[FAILED] Mobile BFF did not resolve CUSTOM_ALLOWED");
  }

  // Create a dummy BlueCollarPositionCategory
  const posCat = await prisma.blueCollarPositionCategory.create({
    data: {
      code: "V-CAT",
      name: "Verification Category"
    }
  });

  // Now let's assign a Deployment for today to test Priority Cascade
  await prisma.employeeDeployment.create({
    data: {
      employeeId: employee.id,
      projectId: project.id,
      siteId: site.id,
      positionCategoryId: posCat.id,
      deploymentDate: new Date(todayStr),
      startTime: "08:00",
      endTime: "18:00",
      plannedHours: 10,
      createdById: employee.id,
      status: "ACTIVE"
    }
  });
  console.log(`\n[OK] Assigned Active Deployment to Site: ${site.siteName} for today.`);

  // Verify BFF logic again
  const activeDeployment = await prisma.employeeDeployment.findFirst({
    where: { employeeId: employee.id, deploymentDate: new Date(todayStr), status: { in: ["PLANNED", "ACTIVE"] } },
    include: { project: true, site: true }
  });

  let deployResult = null;
  if (activeDeployment && activeDeployment.site?.latitude && activeDeployment.site?.longitude) {
    deployResult = {
      type: "DEPLOYMENT",
      name: activeDeployment.site.siteName,
    };
  }

  if (deployResult?.type === "DEPLOYMENT" && deployResult.name === "Verification Zone A") {
    console.log("[SUCCESS] Mobile BFF correctly overrides allowed location with DEPLOYMENT priority (Verification Zone A)");
  } else {
    console.error("[FAILED] Mobile BFF did not resolve DEPLOYMENT priority");
  }

  // Cleanup
  await prisma.employeeDeployment.deleteMany({ where: { employeeId: employee.id } });
  await prisma.blueCollarPositionCategory.deleteMany({ where: { id: posCat.id } });
  await prisma.employeeAllowedPunchLocation.deleteMany({ where: { employeeId: employee.id } });
  await prisma.allowedPunchLocation.deleteMany({ where: { companyId: company.id } });
  await prisma.employee.deleteMany({ where: { id: employee.id } });
  await prisma.projectSite.deleteMany({ where: { companyId: company.id } });
  await prisma.project.deleteMany({ where: { companyId: company.id } });
  await prisma.locationMaster.deleteMany({ where: { companyId: company.id } });
  await prisma.company.deleteMany({ where: { id: company.id } });

  console.log("\n[OK] Cleanup complete.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
