import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";
import { validateDeploymentEligibility, SiteRequirements } from "@/lib/scheduling-validator";

function parseDate(val: any): string {
  if (!val) return new Date().toISOString().split("T")[0];
  if (val instanceof Date) return val.toISOString().split("T")[0];
  return String(val).split("T")[0];
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
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
    const { employeeId, shiftRequirementId, date, deploymentMode } = payload;

    if (!employeeId || !shiftRequirementId || !date) {
      return NextResponse.json({ error: "employeeId, shiftRequirementId, and date are required" }, { status: 400 });
    }

    const isDb = isDbConnected();
    let employee: any = null;
    let shiftRequirement: any = null;
    let site: any = null;
    let category: any = null;
    let existingAssignments: any[] = [];
    let leaves: any[] = [];

    if (isDb) {
      employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          securityLicense: true,
          securityGatePasses: true
        }
      });

      shiftRequirement = await prisma.manpowerShiftRequirement.findUnique({
        where: { id: shiftRequirementId },
        include: {
          site: true,
          category: true
        }
      });

      if (shiftRequirement) {
        site = shiftRequirement.site;
        category = shiftRequirement.category;
      }

      const start = new Date(date);
      start.setHours(0,0,0,0);
      const end = new Date(date);
      end.setHours(23,59,59,999);

      const deployments = await prisma.manpowerDeployment.findMany({
        where: {
          operationType: "SECURITY_GUARDING",
          date: { gte: start, lte: end }
        },
        include: {
          assignments: {
            include: {
              deployment: {
                include: {
                  shiftRequirement: {
                    include: {
                      site: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      deployments.forEach(d => {
        (d.assignments || []).forEach((asg: any) => {
          existingAssignments.push({
            id: asg.id,
            employeeId: asg.employeeId,
            status: asg.status || "ASSIGNED",
            shiftCode: asg.deployment?.shiftRequirement?.shiftCode,
            shiftStartTime: asg.deployment?.shiftRequirement?.shiftStartTime,
            shiftEndTime: asg.deployment?.shiftRequirement?.shiftEndTime,
            siteId: asg.deployment?.shiftRequirement?.siteId,
            siteName: asg.deployment?.shiftRequirement?.site?.name
          });
        });
      });

      leaves = await prisma.leaveRequest.findMany({
        where: { status: "Approved" }
      });

    } else {
      const db = readDb() as any;
      const employees = db.employees || [];
      const emp = employees.find((e: any) => e.id === employeeId);
      if (emp) {
        const lic = (db.securityLicenses || []).find((l: any) => l.employeeId === employeeId);
        const gps = (db.securityGatePasses || []).filter((g: any) => g.employeeId === employeeId);
        employee = {
          ...emp,
          securityLicense: lic || null,
          gatePasses: gps
        };
      }

      shiftRequirement = (db.shiftRequirements || []).find((r: any) => r.id === shiftRequirementId);
      if (shiftRequirement) {
        site = (db.manpowerSites || []).find((s: any) => s.id === shiftRequirement.siteId);
        category = (db.manpowerCategories || []).find((c: any) => c.id === shiftRequirement.categoryId);
      }

      const rawDeps = (db.manpowerDeployments || []).filter((d: any) => {
        return parseDate(d.date) === date && d.operationType === "SECURITY_GUARDING";
      });
      const depIds = rawDeps.map((d: any) => d.id);
      
      const rawAsgs = db.manpowerDeploymentAssignments || [];
      const reqs = db.shiftRequirements || [];
      const sites = db.manpowerSites || [];

      rawAsgs.filter((a: any) => depIds.includes(a.deploymentId)).forEach((asg: any) => {
        const dep = rawDeps.find((d: any) => d.id === asg.deploymentId);
        const req = reqs.find((r: any) => r.id === dep?.shiftRequirementId);
        const s = sites.find((x: any) => x.id === req?.siteId);
        existingAssignments.push({
          id: asg.id,
          employeeId: asg.employeeId,
          status: asg.status || "ASSIGNED",
          shiftCode: req?.shiftCode,
          shiftStartTime: req?.shiftStartTime,
          shiftEndTime: req?.shiftEndTime,
          siteId: req?.siteId,
          siteName: s?.name
        });
      });

      leaves = (db.leaves || db.leaveRequests || []).filter((l: any) => l.status === "Approved" || l.status === "APPROVED");
    }

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (!shiftRequirement) {
      return NextResponse.json({ error: "Shift requirement not found" }, { status: 404 });
    }

    const db = readDb() as any;
    const projectInstructions = (db.projectInstructions || []).filter(
      (pi: any) => pi.projectId === site?.projectId && pi.isActive !== false
    );
    const siteAllowanceRecord = (db.siteAllowances || []).find(
      (sa: any) => sa.siteId === site?.id && sa.isActive !== false && sa.siteAllowanceEnabled === true
    );

    // Build siteRequirements configuration dynamically
    const siteReqs: SiteRequirements = {
      requiresMoiLicense: category?.requiresMoiLicense || false,
      requiresGatePassCheck: category?.requiresGatePassCheck || site?.gatePassRequired || false,
      gatePassRequired: site?.gatePassRequired || false,
      gatePassValidationMode: site?.gatePassValidationMode || "WARNING",
      clientApprovalRequired: site?.clientApprovalRequired || false,
      strictDesignationMatch: false,
      requiredDesignation: category?.name,
      requiredGrade: "G1", // Mock salary grade requirement
      siteAllowance: siteAllowanceRecord ? siteAllowanceRecord.siteAllowanceAmount : 0
    };

    const slotInfo = {
      date,
      siteId: site?.id,
      siteName: site?.name || "Unnamed Site",
      shiftStartTime: shiftRequirement.shiftStartTime,
      shiftEndTime: shiftRequirement.shiftEndTime,
      shiftCode: shiftRequirement.shiftCode,
      isReliever: deploymentMode === "RELIEVER" || deploymentMode === "reliever",
      deploymentMode
    };

    const validationResult = validateDeploymentEligibility(employee, slotInfo, siteReqs, existingAssignments, leaves, projectInstructions);

    return NextResponse.json(validationResult);

  } catch (error: any) {
    console.error("Failed to run validate-deployment API:", error);
    return NextResponse.json({
      error: error.message || String(error)
    }, { status: 500 });
  }
}
