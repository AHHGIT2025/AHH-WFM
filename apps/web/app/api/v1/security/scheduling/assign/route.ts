import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb, writeDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";
import { getActiveSiteShiftConfigs } from "@/lib/server-helpers";

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
    const { employeeId, shiftRequirementId, date, deploymentMode, overrideReason, payrollAdvisories, validationIssues, validationStatus, status: requestedStatus } = payload;

    if (!employeeId || !shiftRequirementId || !date) {
      return NextResponse.json({ error: "employeeId, shiftRequirementId, and date are required" }, { status: 400 });
    }

    // Check generic Security Guarding period lock
    const period = date.substring(0, 7); // "YYYY-MM"
    const locks = await mockDb.getSecurityOperationsPeriodLocks("SECURITY_GUARDING");
    const isLocked = locks.some(l => l.period === period && l.locked);
    if (isLocked) {
      return NextResponse.json({ error: `Security Guarding operations for period ${period} are locked. Modifications are blocked.` }, { status: 400 });
    }

    const isDb = isDbConnected();
    const userEmail = auth.session?.user?.email || "system-scheduler";

    // 1. Resolve Employee details
    let employee: any = null;
    let shiftRequirement: any = null;
    let site: any = null;
    let project: any = null;

    if (isDb) {
      employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      shiftRequirement = await prisma.manpowerShiftRequirement.findUnique({
        where: { id: shiftRequirementId },
        include: { site: { include: { project: true } } }
      });
      if (shiftRequirement) {
        site = shiftRequirement.site;
        project = site?.project;
      }
    } else {
      const db = readDb() as any;
      employee = (db.employees || []).find((e: any) => e.id === employeeId);
      shiftRequirement = (db.shiftRequirements || []).find((r: any) => r.id === shiftRequirementId);
      if (shiftRequirement) {
        site = (db.manpowerSites || []).find((s: any) => s.id === shiftRequirement.siteId);
        project = (db.manpowerProjects || []).find((p: any) => p.id === site?.projectId);
      }
    }

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    if (!shiftRequirement) {
      return NextResponse.json({ error: "Shift requirement not found" }, { status: 404 });
    }

    // Block assignment if site has no manpower allocation
    const siteId = shiftRequirement.siteId;
    let totalAllocated = 0;
    if (isDb) {
      const siteAllocations = await prisma.securitySiteManpowerAllocation.findMany({
        where: { siteId }
      });
      totalAllocated = siteAllocations.reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
    } else {
      const db = readDb() as any;
      const siteAllocations = (db.siteManpowerAllocations || []).filter((a: any) => a.siteId === siteId);
      totalAllocated = siteAllocations.reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
    }
    if (totalAllocated === 0) {
      return NextResponse.json({
        error: "No manpower allocated to this site. Allocate manpower before scheduling."
      }, { status: 400 });
    }

    // Check configured shifts using getActiveSiteShiftConfigs
    const activeShifts = await getActiveSiteShiftConfigs(siteId);
    const shiftCount = activeShifts.length;
    if (shiftCount === 0) {
      return NextResponse.json({
        error: "No site shifts configured. Configure site shifts before scheduling."
      }, { status: 400 });
    }

    // 2. Resolve or Create Deployment Slot
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
      const db = readDb() as any;
      db.manpowerDeployments = db.manpowerDeployments || [];
      
      deployment = db.manpowerDeployments.find((d: any) => {
        const dStr = String(d.date).split("T")[0];
        return dStr === date && d.shiftRequirementId === shiftRequirementId && d.operationType === "SECURITY_GUARDING";
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
        db.manpowerDeployments.push(deployment);
        writeDb(db);
      }
    }

    // 3. Resolve status
    const statusVal = validationStatus === "WARNING" ? "WARNING_APPROVED" : "ASSIGNED";

    // 4. Create or update assignment
    let assignment: any = null;

    if (isDb) {
      assignment = await prisma.manpowerDeploymentAssignment.create({
        data: {
          deploymentId: deployment.id,
          employeeId,
          isReliever: deploymentMode === "RELIEVER",
          deploymentType: deploymentMode || "PERMANENT",
          isOvertime: deploymentMode === "OVERTIME",
          overtimeReason: overrideReason || null,
          sourceType: "GENERAL_POOL",
          // Since schema.prisma doesn't have overrideReason directly on ManpowerDeploymentAssignment,
          // we can store validationStatus, validationIssues, overrideReason, payrollAdvisories inside the validationWarnings field or custom JSON field.
          // Let's store a complete payload in validationWarnings so we don't break database migrations!
          // This is extremely safe, and allows carrying all required fields.
          validationWarnings: {
            status: statusVal,
            validationStatus,
            validationIssues,
            payrollAdvisories,
            overrideReason,
            overriddenBy: userEmail,
            overriddenAt: new Date().toISOString()
          }
        }
      });
    } else {
      const db = readDb() as any;
      db.manpowerDeploymentAssignments = db.manpowerDeploymentAssignments || [];
      
      // Cancel previous assignment if any exists
      db.manpowerDeploymentAssignments = db.manpowerDeploymentAssignments.filter((a: any) => !(a.deploymentId === deployment.id && a.employeeId === employeeId));

      assignment = {
        id: `asg-${Date.now()}`,
        deploymentId: deployment.id,
        employeeId,
        isReliever: deploymentMode === "RELIEVER",
        deploymentType: deploymentMode || "PERMANENT",
        isOvertime: deploymentMode === "OVERTIME",
        overtimeReason: overrideReason || null,
        sourceType: "GENERAL_POOL",
        validationStatus,
        status: statusVal,
        validationWarnings: validationIssues,
        payrollAdvisory: payrollAdvisories,
        overrideReason,
        overriddenBy: userEmail,
        overriddenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      db.manpowerDeploymentAssignments.push(assignment);
      writeDb(db);
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
