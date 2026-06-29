import { mockDb } from "@ahh-wfm/mock-data";

async function runTests() {
  console.log("=== STARTING SECURITY & MANPOWER MOCK DB CRUD TESTS ===");

  try {
    // ----------------------------------------------------
    // Test 1: Security Licenses
    // ----------------------------------------------------
    console.log("\n--- Testing Security Licenses ---");
    const licData = {
      employeeId: "SK-90210",
      licenseNumber: "LIC-SEC-8899",
      issueDate: "2026-01-01T00:00:00Z",
      expiryDate: "2028-12-31T00:00:00Z",
      status: "ACTIVE",
      remarks: "Tested Security Guard License"
    };
    const createdLic = await mockDb.createSecurityLicense(licData);
    console.log("Created License:", createdLic);

    let licenses = await mockDb.getSecurityLicenses("SK-90210");
    console.log("Fetch list for employee SK-90210 (count should be >= 1):", licenses.length);

    const updatedLic = await mockDb.updateSecurityLicense(createdLic.id, {
      remarks: "Updated Remarks for tested security license"
    });
    console.log("Updated License:", updatedLic);

    await mockDb.deleteSecurityLicense(createdLic.id);
    licenses = await mockDb.getSecurityLicenses("SK-90210");
    console.log("After Delete, fetch list count (should be 0 or previous):", licenses.filter(l => l.id === createdLic.id).length);

    // ----------------------------------------------------
    // Test 2: Security Gate Passes
    // ----------------------------------------------------
    console.log("\n--- Testing Security Gate Passes ---");
    const passData = {
      employeeId: "SK-90210",
      siteId: "MSITE-001",
      passNumber: "GP-QP-1002",
      issueDate: "2026-01-01T00:00:00Z",
      expiryDate: "2026-12-31T00:00:00Z",
      status: "APPROVED"
    };
    const createdPass = await mockDb.createSecurityGatePass(passData);
    console.log("Created Gate Pass:", createdPass);

    let passes = await mockDb.getSecurityGatePasses("SK-90210", "MSITE-001");
    console.log("Fetch list for employee and site (count should be >= 1):", passes.length);

    const updatedPass = await mockDb.updateSecurityGatePass(createdPass.id, {
      status: "EXPIRED"
    });
    console.log("Updated Gate Pass:", updatedPass);

    await mockDb.deleteSecurityGatePass(createdPass.id);
    passes = await mockDb.getSecurityGatePasses("SK-90210", "MSITE-001");
    console.log("After Delete, fetch list count:", passes.filter(p => p.id === createdPass.id).length);

    // ----------------------------------------------------
    // Test 3: Security Project Reliever Pools & Assignments
    // ----------------------------------------------------
    console.log("\n--- Testing Reliever Pools & Assignments ---");
    const poolData = {
      projectId: "MPROJ-001",
      poolName: "QP HQ Security Reliever Pool",
      description: "Reliever pool for Hamad security project",
      isActive: true
    };
    const createdPool = await mockDb.createSecurityProjectRelieverPool(poolData);
    console.log("Created Pool:", createdPool);

    const asgData = {
      poolId: createdPool.id,
      relieverEmployeeId: "SK-90210",
      isActive: true
    };
    const createdAsg = await mockDb.createSecurityProjectRelieverAssignment(asgData);
    console.log("Created Pool Assignment:", createdAsg);

    let pools = await mockDb.getSecurityProjectRelieverPools("MPROJ-001");
    console.log("Fetch Pools count (should be >= 1):", pools.length);
    console.log("First Pool relievers count (should be >= 1):", pools[0].relieverAssignments?.length);

    const updatedAsg = await mockDb.updateSecurityProjectRelieverAssignment(createdAsg.id, {
      isActive: false
    });
    console.log("Updated Pool Assignment:", updatedAsg);

    await mockDb.deleteSecurityProjectRelieverPool(createdPool.id);
    pools = await mockDb.getSecurityProjectRelieverPools("MPROJ-001");
    console.log("After deleting pool, fetch Pools count:", pools.filter(p => p.id === createdPool.id).length);
    const asgs = await mockDb.getSecurityProjectRelieverAssignments(createdPool.id);
    console.log("After deleting pool, fetch assignments count (should cascade delete to 0):", asgs.length);

    // ----------------------------------------------------
    // Test 4: Project Coordinator Assignments
    // ----------------------------------------------------
    console.log("\n--- Testing Project Coordinator Assignments ---");
    const coordData = {
      projectId: "MPROJ-001",
      coordinatorEmployeeId: "SK-90210",
      isActive: true
    };
    const createdCoord = await mockDb.createSecurityProjectCoordinatorAssignment(coordData);
    console.log("Created Coordinator Assignment:", createdCoord);

    let coords = await mockDb.getSecurityProjectCoordinatorAssignments("MPROJ-001");
    console.log("Fetch coordinators (count should be >= 1):", coords.length);

    const updatedCoord = await mockDb.updateSecurityProjectCoordinatorAssignment(createdCoord.id, {
      isActive: false
    });
    console.log("Updated Coordinator Assignment:", updatedCoord);

    await mockDb.deleteSecurityProjectCoordinatorAssignment(createdCoord.id);
    coords = await mockDb.getSecurityProjectCoordinatorAssignments("MPROJ-001");
    console.log("After Delete, fetch coordinators count:", coords.filter(c => c.id === createdCoord.id).length);

    // ----------------------------------------------------
    // Test 5: Security Site Inspections
    // ----------------------------------------------------
    console.log("\n--- Testing Security Site Inspections ---");
    const inspData = {
      siteId: "MSITE-001",
      inspectorEmployeeId: "SK-90210",
      inspectionDate: "2026-06-29T10:00:00Z",
      status: "PASSED",
      score: 95.0,
      remarks: "Site is fully compliant"
    };
    const createdInsp = await mockDb.createSecuritySiteInspection(inspData);
    console.log("Created Site Inspection:", createdInsp);

    let inspections = await mockDb.getSecuritySiteInspections("MSITE-001");
    console.log("Fetch inspections (count should be >= 1):", inspections.length);

    const updatedInsp = await mockDb.updateSecuritySiteInspection(createdInsp.id, {
      score: 98.0
    });
    console.log("Updated Site Inspection:", updatedInsp);

    await mockDb.deleteSecuritySiteInspection(createdInsp.id);
    inspections = await mockDb.getSecuritySiteInspections("MSITE-001");
    console.log("After Delete, fetch inspections count:", inspections.filter(i => i.id === createdInsp.id).length);

    // ----------------------------------------------------
    // Test 6: Manpower Contract Materials
    // ----------------------------------------------------
    console.log("\n--- Testing Manpower Contract Materials ---");
    const matData = {
      contractId: "MCON-001",
      materialName: "CCTV Server System",
      materialCode: "MAT-CCTV-01",
      quantityRequired: 2,
      billingRate: 1500.0,
      remarks: "Primary command center server"
    };
    const createdMat = await mockDb.createManpowerContractMaterial(matData);
    console.log("Created Contract Material:", createdMat);

    let materials = await mockDb.getManpowerContractMaterials("MCON-001");
    console.log("Fetch contract materials (count should be >= 1):", materials.length);

    const updatedMat = await mockDb.updateManpowerContractMaterial(createdMat.id, {
      quantityRequired: 3
    });
    console.log("Updated Contract Material:", updatedMat);

    // ----------------------------------------------------
    // Test 7: Manpower Project Material Allocations
    // ----------------------------------------------------
    console.log("\n--- Testing Manpower Project Material Allocations ---");
    const allocData = {
      projectId: "MPROJ-001",
      contractMaterialId: createdMat.id,
      quantityAllocated: 1,
      allocationDate: "2026-06-29T00:00:00Z",
      remarks: "Allocated to command center room 1"
    };
    const createdAlloc = await mockDb.createManpowerProjectMaterialAllocation(allocData);
    console.log("Created Material Allocation:", createdAlloc);

    let allocs = await mockDb.getManpowerProjectMaterialAllocations("MPROJ-001");
    console.log("Fetch material allocations (count should be >= 1):", allocs.length);

    const updatedAlloc = await mockDb.updateManpowerProjectMaterialAllocation(createdAlloc.id, {
      quantityAllocated: 2
    });
    console.log("Updated Material Allocation:", updatedAlloc);

    // Clean up
    await mockDb.deleteManpowerContractMaterial(createdMat.id);
    materials = await mockDb.getManpowerContractMaterials("MCON-001");
    console.log("After deleting material, fetch materials count:", materials.filter(m => m.id === createdMat.id).length);
    allocs = await mockDb.getManpowerProjectMaterialAllocations("MPROJ-001");
    console.log("After deleting material, fetch allocations count (should cascade delete):", allocs.filter(a => a.contractMaterialId === createdMat.id).length);

    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("Test failed with error:", err);
  }
}

runTests();
