import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb, writeDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";
import { getActiveSiteShiftConfigs } from "@/lib/server-helpers";
import { validateDeploymentEligibility, areShiftsOverlapping, SiteRequirements } from "@/lib/scheduling-validator";

function parseDate(val: any): string {
  if (!val) return new Date().toISOString().split("T")[0];
  if (val instanceof Date) return val.toISOString().split("T")[0];
  return String(val).split("T")[0];
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage") &&
      !hasPermission(auth.session?.user, "security.scheduling.assign")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const {
      employeeId,
      shiftRequirementId,
      siteId: payloadSiteId,
      projectId: payloadProjectId,
      date,
      startDate,
      endDate,
      assignmentType,
      deploymentMode,
      overrideReason,
      notes,
      actingPosition,
      validationStatus,
      validationIssues,
      payrollAdvisories
    } = payload;

    const isRangeMode = !!(startDate && endDate);

    if (!employeeId || !shiftRequirementId || (!date && !isRangeMode)) {
      return NextResponse.json({ error: "employeeId, shiftRequirementId, and date/startDate/endDate are required" }, { status: 400 });
    }

    const isDb = isDbConnected();
    const userEmail = auth.session?.user?.email || "system-scheduler";

    // 1. Resolve Employee and ShiftRequirement Details
    let employee: any = null;
    let shiftRequirement: any = null;
    let site: any = null;
    let project: any = null;
    let category: any = null;

    if (isDb) {
      employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { securityLicense: true, securityGatePasses: true, designation: true, tradeClassification: true, securityOperationalEmployee: true }
      });
      shiftRequirement = await prisma.manpowerShiftRequirement.findUnique({
        where: { id: shiftRequirementId },
        include: { site: { include: { project: true } }, category: true }
      });
      if (shiftRequirement) {
        site = shiftRequirement.site;
        project = site?.project;
        category = shiftRequirement.category;
      }
    } else {
      const db = readDb() as any;
      employee = (db.employees || []).find((e: any) => e.id === employeeId);
      if (employee) {
        const lic = (db.securityLicenses || []).find((l: any) => l.employeeId === employeeId);
        const gps = (db.securityGatePasses || []).filter((g: any) => g.employeeId === employeeId);
        const op = (db.securityOperationalEmployees || []).find((o: any) => o.sourceEmployeeId === employeeId);
        employee = {
          ...employee,
          securityLicense: lic || null,
          gatePasses: gps,
          securityOperationalEmployee: op || null
        };
      }
      shiftRequirement = (db.shiftRequirements || []).find((r: any) => r.id === shiftRequirementId);
      if (shiftRequirement) {
        site = (db.manpowerSites || []).find((s: any) => s.id === shiftRequirement.siteId);
        project = (db.manpowerProjects || []).find((p: any) => p.id === site?.projectId);
        category = (db.manpowerCategories || []).find((c: any) => c.id === shiftRequirement.categoryId);
      }
    }

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    if (!shiftRequirement) {
      return NextResponse.json({ error: "Shift requirement not found" }, { status: 404 });
    }

    const siteId = shiftRequirement.siteId;
    const projectId = site?.projectId;
    const categoryName = category?.name || "Security Guard";

    // 2. Fetch Allocation Limits
    let siteAllocationLimit = 0;
    let projectAllocationLimit = 0;

    if (isDb) {
      const siteAllocations = await prisma.securitySiteManpowerAllocation.findMany({
        where: { siteId, position: categoryName }
      });
      siteAllocationLimit = siteAllocations.reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

      const projectAllocations = await prisma.securityProjectManpowerAllocation.findMany({
        where: { projectId, position: categoryName }
      });
      projectAllocationLimit = projectAllocations.reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
    } else {
      const db = readDb() as any;
      const siteAllocations = (db.siteManpowerAllocations || []).filter((a: any) => a.siteId === siteId && a.position === categoryName);
      siteAllocationLimit = siteAllocations.reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

      const projectAllocations = (db.projectManpowerAllocations || []).filter((a: any) => a.projectId === projectId && a.position === categoryName);
      projectAllocationLimit = projectAllocations.reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
    }

    // 3. Resolve active shifts to block if none configured
    const activeShifts = await getActiveSiteShiftConfigs(siteId);
    if (activeShifts.length === 0) {
      return NextResponse.json({ error: "No site shifts configured. Configure site shifts before scheduling." }, { status: 400 });
    }

    // 4. Resolve deploymentMode and reliever metadata
    const finalAssignmentType = assignmentType || (deploymentMode === "RELIEVER" ? "RELIEVER" : "PERMANENT");
    const isReliever = finalAssignmentType === "RELIEVER" || deploymentMode === "RELIEVER";

    // 5. Gather project instructions and site allowance once
    const db = readDb() as any;
    const projectInstructions = (db.projectInstructions || []).filter(
      (pi: any) => pi.projectId === projectId && pi.isActive !== false
    );
    const siteAllowanceRecord = (db.siteAllowances || []).find(
      (sa: any) => sa.siteId === siteId && sa.isActive !== false && sa.siteAllowanceEnabled === true
    );
    const siteReqs: SiteRequirements = {
      requiresMoiLicense: category?.requiresMoiLicense || false,
      requiresGatePassCheck: category?.requiresGatePassCheck || site?.gatePassRequired || false,
      gatePassRequired: site?.gatePassRequired || false,
      gatePassValidationMode: site?.gatePassValidationMode || "WARNING",
      clientApprovalRequired: site?.clientApprovalRequired || false,
      strictDesignationMatch: false,
      requiredDesignation: category?.name,
      requiredGrade: "G1",
      siteAllowance: siteAllowanceRecord ? siteAllowanceRecord.siteAllowanceAmount : 0
    };

    const locks = await mockDb.getSecurityOperationsPeriodLocks("SECURITY_GUARDING");

    // ==========================================
    // DATE RANGE MODE
    // ==========================================
    if (isRangeMode) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json({ error: "Invalid start or end date" }, { status: 400 });
      }

      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays <= 0) {
        return NextResponse.json({ error: "Start date must be before or equal to End date" }, { status: 400 });
      }
      if (diffDays > 62) {
        return NextResponse.json({ error: "Date range cannot exceed 62 days" }, { status: 400 });
      }

      const datesList: string[] = [];
      const current = new Date(start);
      while (current <= end) {
        datesList.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }

      // Fetch leaves once
      let leaves: any[] = [];
      if (isDb) {
        leaves = await prisma.leaveRequest.findMany({
          where: { status: "Approved", employeeId }
        });
      } else {
        leaves = (db.leaves || db.leaveRequests || []).filter((l: any) => (l.status === "Approved" || l.status === "APPROVED") && l.employeeId === employeeId);
      }

      // Fetch all assignments spanned by range once
      const startRange = new Date(startDate);
      startRange.setHours(0,0,0,0);
      const endRange = new Date(endDate);
      endRange.setHours(23,59,59,999);

      let rawAssignments: any[] = [];
      if (isDb) {
        const deployments = await prisma.manpowerDeployment.findMany({
          where: {
            operationType: "SECURITY_GUARDING",
            date: { gte: startRange, lte: endRange }
          },
          include: {
            assignments: {
              include: {
                deployment: {
                  include: {
                    shiftRequirement: { include: { site: true } }
                  }
                }
              }
            }
          }
        });
        deployments.forEach(d => {
          (d.assignments || []).forEach((asg: any) => {
            rawAssignments.push({
              id: asg.id,
              employeeId: asg.employeeId,
              status: asg.status || "ASSIGNED",
              isReliever: asg.isReliever,
              deploymentType: asg.deploymentType,
              shiftRequirementId: asg.deployment?.shiftRequirementId,
              shiftStartTime: asg.deployment?.shiftRequirement?.shiftStartTime,
              shiftEndTime: asg.deployment?.shiftRequirement?.shiftEndTime,
              shiftCode: asg.deployment?.shiftRequirement?.shiftCode,
              siteId: asg.deployment?.shiftRequirement?.siteId,
              siteName: asg.deployment?.shiftRequirement?.site?.name,
              projectId: asg.deployment?.shiftRequirement?.site?.projectId,
              date: d.date.toISOString().split("T")[0]
            });
          });
        });
      } else {
        const rawDeps = (db.manpowerDeployments || []).filter((d: any) => {
          const dStr = parseDate(d.date);
          return dStr >= startDate && dStr <= endDate && d.operationType === "SECURITY_GUARDING";
        });
        const depIds = rawDeps.map((d: any) => d.id);
        const rawAsgs = db.manpowerDeploymentAssignments || [];
        const reqs = db.shiftRequirements || [];
        const sites = db.manpowerSites || [];

        rawAsgs.filter((a: any) => depIds.includes(a.deploymentId)).forEach((asg: any) => {
          const dep = rawDeps.find((d: any) => d.id === asg.deploymentId);
          const req = reqs.find((r: any) => r.id === dep?.shiftRequirementId);
          const s = sites.find((x: any) => x.id === req?.siteId);
          rawAssignments.push({
            id: asg.id,
            employeeId: asg.employeeId,
            status: asg.status || "ASSIGNED",
            isReliever: asg.isReliever,
            deploymentType: asg.deploymentType,
            shiftRequirementId: dep?.shiftRequirementId,
            shiftStartTime: req?.shiftStartTime,
            shiftEndTime: req?.shiftEndTime,
            shiftCode: req?.shiftCode,
            siteId: req?.siteId,
            siteName: s?.name,
            projectId: s?.projectId,
            date: parseDate(dep?.date)
          });
        });
      }

      const results: any[] = [];
      const summary = {
        requestedDates: datesList.length,
        created: 0,
        skipped: 0,
        failed: 0
      };

      for (const dStr of datesList) {
        // 1. Period lock check
        const period = dStr.substring(0, 7);
        const isLocked = locks.some(l => l.period === period && l.locked);
        if (isLocked) {
          summary.failed++;
          results.push({ date: dStr, status: "FAILED", reason: `Period ${period} is locked` });
          continue;
        }

        // 2. Duplicate assignment check
        const existingDuplicate = rawAssignments.find(a => a.employeeId === employeeId && a.shiftRequirementId === shiftRequirementId && a.date === dStr && a.status !== "CANCELLED");
        if (existingDuplicate) {
          summary.skipped++;
          results.push({ date: dStr, status: "SKIPPED", reason: "Employee already assigned to this shift" });
          continue;
        }

        // 3. Leave check
        const onLeave = leaves.some(l => {
          const lStart = parseDate(l.startDate);
          const lEnd = parseDate(l.endDate);
          return dStr >= lStart && dStr <= lEnd;
        });
        if (onLeave) {
          summary.failed++;
          results.push({ date: dStr, status: "FAILED", reason: "Employee is on leave" });
          continue;
        }

        // 4. Overlap check
        const dayAssignments = rawAssignments.filter(a => a.date === dStr && a.status !== "CANCELLED");
        const employeeDayAssignments = dayAssignments.filter(a => a.employeeId === employeeId);
        const overlap = employeeDayAssignments.find(a => 
          areShiftsOverlapping(a.shiftStartTime, a.shiftEndTime, shiftRequirement.shiftStartTime, shiftRequirement.shiftEndTime)
        );
        if (overlap) {
          summary.failed++;
          results.push({ date: dStr, status: "FAILED", reason: `Employee already assigned to overlapping shift: ${overlap.siteName} - ${overlap.shiftCode}` });
          continue;
        }

        // 5. Site Allocation Capacity Limit
        if (!isReliever) {
          const activeSiteCount = dayAssignments.filter(a => a.siteId === siteId && a.position === categoryName && !a.isReliever).length;
          if (siteAllocationLimit > 0 && activeSiteCount + 1 > siteAllocationLimit) {
            summary.failed++;
            results.push({ date: dStr, status: "FAILED", reason: "Site manpower allocation limit exceeded" });
            continue;
          }
        }

        // 6. Project Allocation Capacity Limit
        if (!isReliever) {
          const activeProjectCount = dayAssignments.filter(a => a.projectId === projectId && a.position === categoryName && !a.isReliever).length;
          if (projectAllocationLimit > 0 && activeProjectCount + 1 > projectAllocationLimit) {
            summary.failed++;
            results.push({ date: dStr, status: "FAILED", reason: "Project manpower allocation limit exceeded" });
            continue;
          }
        }

        // 7. validateDeploymentEligibility
        const slotInfo = {
          date: dStr,
          siteId,
          siteName: site?.name || "Unnamed Site",
          shiftStartTime: shiftRequirement.shiftStartTime,
          shiftEndTime: shiftRequirement.shiftEndTime,
          shiftCode: shiftRequirement.shiftCode,
          isReliever,
          deploymentMode: isReliever ? "RELIEVER" : "REGULAR"
        };
        const activeExisting = dayAssignments.map(asg => ({
          id: asg.id,
          employeeId: asg.employeeId,
          status: asg.status,
          shiftCode: asg.shiftCode,
          shiftStartTime: asg.shiftStartTime,
          shiftEndTime: asg.shiftEndTime,
          siteId: asg.siteId,
          siteName: asg.siteName
        }));
        const valResult = validateDeploymentEligibility(employee, slotInfo, siteReqs, activeExisting, leaves, projectInstructions);
        if (valResult.severity === "BLOCKED") {
          summary.failed++;
          results.push({ date: dStr, status: "FAILED", reason: valResult.blockingIssues.join(" | ") });
          continue;
        }
        if (valResult.severity === "WARNING" && !overrideReason) {
          summary.failed++;
          results.push({ date: dStr, status: "FAILED", reason: valResult.warnings.join(" | ") });
          continue;
        }

        // 8. Create assignment row
        const statusVal = valResult.severity === "WARNING" ? "WARNING_OVERRIDDEN" : "ASSIGNED";
        const dateObj = new Date(dStr);

        try {
          if (isDb) {
            const startOfDayVal = new Date(dStr);
            startOfDayVal.setHours(0,0,0,0);
            const endOfDayVal = new Date(dStr);
            endOfDayVal.setHours(23,59,59,999);

            let deployment = await prisma.manpowerDeployment.findFirst({
              where: {
                shiftRequirementId,
                date: { gte: startOfDayVal, lte: endOfDayVal },
                operationType: "SECURITY_GUARDING"
              }
            });

            if (!deployment) {
              deployment = await prisma.manpowerDeployment.create({
                data: {
                  date: dateObj,
                  shiftRequirementId,
                  operationType: "SECURITY_GUARDING",
                  approvalStatus: "DRAFT"
                }
              });
            }

            const createdAsg = await prisma.manpowerDeploymentAssignment.create({
              data: {
                deploymentId: deployment.id,
                employeeId,
                isReliever,
                deploymentType: finalAssignmentType,
                isOvertime: finalAssignmentType === "OVERTIME",
                overtimeReason: overrideReason || null,
                sourceType: "GENERAL_POOL",
                validationWarnings: {
                  status: statusVal,
                  validationStatus: valResult.severity,
                  validationIssues: valResult.warnings,
                  payrollAdvisories: valResult.payrollAdvisories,
                  overrideReason,
                  notes,
                  actingPosition,
                  overriddenBy: userEmail,
                  overriddenAt: new Date().toISOString()
                }
              }
            });
            summary.created++;
            results.push({ date: dStr, status: "CREATED", assignmentId: createdAsg.id });
            rawAssignments.push({
              id: createdAsg.id,
              employeeId,
              status: statusVal,
              isReliever,
              deploymentType: finalAssignmentType,
              shiftRequirementId,
              shiftStartTime: shiftRequirement.shiftStartTime,
              shiftEndTime: shiftRequirement.shiftEndTime,
              shiftCode: shiftRequirement.shiftCode,
              siteId,
              projectId,
              date: dStr
            });
          } else {
            const dbRef = readDb() as any;
            dbRef.manpowerDeployments = dbRef.manpowerDeployments || [];
            
            let deployment = dbRef.manpowerDeployments.find((d: any) => {
              return parseDate(d.date) === dStr && d.shiftRequirementId === shiftRequirementId && d.operationType === "SECURITY_GUARDING";
            });

            if (!deployment) {
              deployment = {
                id: `dep-${Date.now()}-${dStr}`,
                date: `${dStr}T00:00:00.000Z`,
                shiftRequirementId,
                operationType: "SECURITY_GUARDING",
                approvalStatus: "DRAFT",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              dbRef.manpowerDeployments.push(deployment);
            }

            const createdAsg = {
              id: `asg-${Date.now()}-${dStr}`,
              deploymentId: deployment.id,
              employeeId,
              isReliever,
              deploymentType: finalAssignmentType,
              isOvertime: finalAssignmentType === "OVERTIME",
              overtimeReason: overrideReason || null,
              sourceType: "GENERAL_POOL",
              validationStatus: valResult.severity,
              status: statusVal,
              validationWarnings: valResult.warnings,
              payrollAdvisory: valResult.payrollAdvisories,
              overrideReason,
              notes,
              actingPosition,
              overriddenBy: userEmail,
              overriddenAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            dbRef.manpowerDeploymentAssignments = dbRef.manpowerDeploymentAssignments || [];
            dbRef.manpowerDeploymentAssignments.push(createdAsg);
            writeDb(dbRef);

            summary.created++;
            results.push({ date: dStr, status: "CREATED", assignmentId: createdAsg.id });
            rawAssignments.push({
              id: createdAsg.id,
              employeeId,
              status: statusVal,
              isReliever,
              deploymentType: finalAssignmentType,
              shiftRequirementId,
              shiftStartTime: shiftRequirement.shiftStartTime,
              shiftEndTime: shiftRequirement.shiftEndTime,
              shiftCode: shiftRequirement.shiftCode,
              siteId,
              projectId,
              date: dStr
            });
          }
        } catch (dbErr: any) {
          summary.failed++;
          results.push({ date: dStr, status: "FAILED", reason: dbErr.message || String(dbErr) });
        }
      }

      await mockDb.createUserActivityLog({
        userId: (auth.session?.user as any)?.id || "system",
        action: "RANGE_ASSIGN_GUARD",
        entityType: "ManpowerDeploymentAssignment",
        entityId: employeeId,
        beforeJson: undefined,
        afterJson: JSON.stringify({ employeeId, shiftRequirementId, startDate, endDate, finalAssignmentType }),
        ipAddress: undefined,
        userAgent: undefined
      });

      if (summary.created === 0 && summary.skipped === 0) {
        return NextResponse.json({
          success: false,
          message: "All range assignments failed",
          summary,
          results
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "Roster assignment completed with results",
        summary,
        results
      });
    }

    // ==========================================
    // SINGLE DATE MODE (EXISTING BEHAVIOR)
    // ==========================================
    const period = date.substring(0, 7);
    const isLocked = locks.some(l => l.period === period && l.locked);
    if (isLocked) {
      return NextResponse.json({ error: `Security Guarding operations for period ${period} are locked. Modifications are blocked.` }, { status: 400 });
    }

    // Block single assignment if site has no allocation configured
    if (siteAllocationLimit === 0) {
      return NextResponse.json({ error: "No manpower allocated to this site. Allocate manpower before scheduling." }, { status: 400 });
    }

    let deployment: any = null;
    const dateObj = new Date(date);

    if (isDb) {
      const start = new Date(date);
      start.setHours(0,0,0,0);
      const end = new Date(date);
      end.setHours(23,59,59,999);

      deployment = await prisma.manpowerDeployment.findFirst({
        where: {
          shiftRequirementId,
          date: { gte: start, lte: end },
          operationType: "SECURITY_GUARDING"
        }
      });

      if (!deployment) {
        deployment = await prisma.manpowerDeployment.create({
          data: {
            date: dateObj,
            shiftRequirementId,
            operationType: "SECURITY_GUARDING",
            approvalStatus: "DRAFT"
          }
        });
      }
    } else {
      const dbRef = readDb() as any;
      dbRef.manpowerDeployments = dbRef.manpowerDeployments || [];
      
      deployment = dbRef.manpowerDeployments.find((d: any) => {
        return parseDate(d.date) === date && d.shiftRequirementId === shiftRequirementId && d.operationType === "SECURITY_GUARDING";
      });

      if (!deployment) {
        deployment = {
          id: `dep-${Date.now()}`,
          date: `${date}T00:00:00.000Z`,
          shiftRequirementId,
          operationType: "SECURITY_GUARDING",
          approvalStatus: "DRAFT",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        dbRef.manpowerDeployments.push(deployment);
        writeDb(dbRef);
      }
    }

    const statusVal = validationStatus === "WARNING" ? "WARNING_OVERRIDDEN" : "ASSIGNED";
    let assignment: any = null;

    if (isDb) {
      assignment = await prisma.manpowerDeploymentAssignment.create({
        data: {
          deploymentId: deployment.id,
          employeeId,
          isReliever,
          deploymentType: finalAssignmentType,
          isOvertime: finalAssignmentType === "OVERTIME",
          overtimeReason: overrideReason || null,
          sourceType: "GENERAL_POOL",
          validationWarnings: {
            status: statusVal,
            validationStatus,
            validationIssues,
            payrollAdvisories,
            overrideReason,
            notes,
            actingPosition,
            overriddenBy: userEmail,
            overriddenAt: new Date().toISOString()
          }
        }
      });
    } else {
      const dbRef = readDb() as any;
      dbRef.manpowerDeploymentAssignments = dbRef.manpowerDeploymentAssignments || [];
      dbRef.manpowerDeploymentAssignments = dbRef.manpowerDeploymentAssignments.filter((a: any) => !(a.deploymentId === deployment.id && a.employeeId === employeeId));

      assignment = {
        id: `asg-${Date.now()}`,
        deploymentId: deployment.id,
        employeeId,
        isReliever,
        deploymentType: finalAssignmentType,
        isOvertime: finalAssignmentType === "OVERTIME",
        overtimeReason: overrideReason || null,
        sourceType: "GENERAL_POOL",
        validationStatus,
        status: statusVal,
        validationWarnings: validationIssues,
        payrollAdvisory: payrollAdvisories,
        overrideReason,
        notes,
        actingPosition,
        overriddenBy: userEmail,
        overriddenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      dbRef.manpowerDeploymentAssignments.push(assignment);
      writeDb(dbRef);
    }

    await mockDb.createUserActivityLog({
      userId: (auth.session?.user as any)?.id || "system",
      action: "ASSIGN_GUARD",
      entityType: "ManpowerDeploymentAssignment",
      entityId: assignment?.id || employeeId,
      beforeJson: undefined,
      afterJson: JSON.stringify({ employeeId, shiftRequirementId, date, deploymentMode }),
      ipAddress: undefined,
      userAgent: undefined
    });

    return NextResponse.json({
      success: true,
      assignment
    });

  } catch (error: any) {
    console.error("Failed to assign scheduling deployment:", error);
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
