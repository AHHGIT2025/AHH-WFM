import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || new Date().toISOString().substring(0, 7); // YYYY-MM

  try {
    const isDb = isDbConnected();
    const db = readDb() as any;

    let deployments: any[] = [];
    let attendanceRecords: any[] = [];
    let sites: any[] = [];
    let shiftRequirements: any[] = [];
    let employees: any[] = [];

    const startStr = `${period}-01T00:00:00.000Z`;
    // End date calculation (simply search dates starting with period)
    if (isDb) {
      const year = parseInt(period.split("-")[0]);
      const month = parseInt(period.split("-")[1]);
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const end = new Date(year, month, 0, 23, 59, 59, 999);

      deployments = await prisma.manpowerDeployment.findMany({
        where: {
          date: { gte: start, lte: end },
          operationType: "SECURITY_GUARDING"
        },
        include: {
          assignments: {
            include: {
              employee: true
            }
          },
          shiftRequirement: {
            include: {
              category: true
            }
          }
        }
      });

      attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          checkIn: { gte: start, lte: end },
          employee: {
            operationType: "SECURITY_GUARDING"
          }
        },
        include: {
          employee: true
        }
      });

      sites = await prisma.manpowerSite.findMany({
        where: { operationType: "SECURITY_GUARDING" }
      });
    } else {
      employees = db.employees || [];
      const securityLicenses = db.securityLicenses || [];
      const rawShifts = db.shiftRequirements || [];
      const rawSites = db.manpowerSites || [];
      const rawCats = db.manpowerCategories || [];

      sites = rawSites.filter((s: any) => s.operationType === "SECURITY_GUARDING");
      shiftRequirements = rawShifts.filter((r: any) => r.operationType === "SECURITY_GUARDING").map((r: any) => ({
        ...r,
        site: sites.find((s: any) => s.id === r.siteId) || null,
        category: rawCats.find((c: any) => c.id === r.categoryId) || null
      }));

      deployments = (db.manpowerDeployments || []).filter((d: any) => {
        const dStr = String(d.date).substring(0, 7);
        return dStr === period && d.operationType === "SECURITY_GUARDING";
      }).map((d: any) => {
        const req = shiftRequirements.find((r: any) => r.id === d.shiftRequirementId);
        const asgs = (db.manpowerDeploymentAssignments || []).filter((a: any) => a.deploymentId === d.id).map((a: any) => {
          const emp = employees.find((e: any) => e.id === a.employeeId);
          return {
            ...a,
            employee: emp || null
          };
        });
        return {
          ...d,
          shiftRequirement: req,
          assignments: asgs
        };
      });

      attendanceRecords = (db.attendance || []).filter((a: any) => {
        const aDate = String(a.checkIn || "").substring(0, 7);
        if (aDate !== period) return false;
        const emp = employees.find((e: any) => e.id === a.employeeId);
        return emp && emp.operationType === "SECURITY_GUARDING";
      }).map((a: any) => {
        const emp = employees.find((e: any) => e.id === a.employeeId);
        return {
          ...a,
          employee: emp || null
        };
      });
    }

    const locks = await mockDb.getSecurityOperationsPeriodLocks("SECURITY_GUARDING");
    const isLocked = locks.some(l => l.period === period && l.locked);

    // Build payroll advisory records
    const advisories: any[] = [];

    deployments.forEach(dep => {
      const dateStr = String(dep.date).split("T")[0];
      const req = dep.shiftRequirement;
      if (!req) return;

      const site = sites.find(s => s.id === req.siteId);
      const siteAllowance = (db.siteAllowances || []).find((sa: any) => sa.siteId === req.siteId && sa.isActive !== false && sa.siteAllowanceEnabled === true);

      (dep.assignments || []).forEach((asg: any) => {
        const emp = asg.employee;
        if (!emp) return;

        const att = attendanceRecords.find(a => a.employeeId === emp.id && String(a.checkIn).split("T")[0] === dateStr);

        // 1. Acting Duty check
        const reqDesig = req.category?.name || req.categoryId;
        const empDesig = emp.designationName || emp.designationId;
        const isActingDuty = reqDesig && empDesig && reqDesig !== empDesig;

        // 2. Allowance Advisory check
        let allowanceAdvisory = null;
        if (siteAllowance && att) {
          allowanceAdvisory = {
            allowanceId: siteAllowance.id,
            description: siteAllowance.allowanceDescription || "Site Duty Allowance",
            frequency: siteAllowance.siteAllowanceFrequency || "MONTHLY",
            amountAdvisory: siteAllowance.siteAllowanceAmount || 0
          };
        }

        // 3. Exception Check (unresolved warnings/blocks)
        const warningsObj = typeof asg.validationWarnings === "object" && asg.validationWarnings ? (asg.validationWarnings as any) : {};
        const overrides = warningsObj.exceptionOverrides || [];
        const isOverridden = overrides.length > 0;

        advisories.push({
          id: `adv-${asg.id}`,
          date: dateStr,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeCode: emp.employeeCode || emp.id,
          designation: empDesig,
          siteId: req.siteId,
          siteName: site?.name || "Unnamed Site",
          shiftCode: req.shiftCode,
          hoursWorked: att && att.checkIn && att.checkOut 
            ? Math.round((new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()) / (1000 * 60 * 60) * 10) / 10
            : att ? 12 : 0, // Fallback to 12 hours if clocked-in but no check-out, or 0 if no show
          attendanceStatus: att ? "Present" : "No Show",
          checkIn: att?.checkIn || null,
          checkOut: att?.checkOut || null,
          attendanceRemarks: att?.device || "",
          actingDuty: isActingDuty ? {
            scheduledDesignation: reqDesig,
            actualDesignation: empDesig,
            advisory: "Acting duty rate adjustment recommended."
          } : null,
          allowance: allowanceAdvisory,
          unresolvedExceptionsCount: att ? 0 : 1, // Simple metric
          isOverridden,
          overrides
        });
      });
    });

    return NextResponse.json({
      success: true,
      period,
      isLocked,
      advisories
    });

  } catch (error: any) {
    console.error("Failed to fetch payroll advisory list:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
