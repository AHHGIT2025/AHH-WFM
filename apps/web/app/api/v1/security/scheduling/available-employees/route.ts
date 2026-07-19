import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";
import { validateDeploymentEligibility, computeDisplayDesignation } from "@/lib/scheduling-validator";
import { getActiveSiteShiftConfigs } from "@/lib/server-helpers";

function formatDateToYYYYMMDD(d: any): string {
  if (!d) return "";
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return "";
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view") &&
      !hasPermission(auth.session?.user, "security.scheduling.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const search = searchParams.get("search") || "";
  const designation = searchParams.get("designation") || "";
  const grade = searchParams.get("grade") || "";
  const licenseValid = searchParams.get("licenseValid") || "all";
  const gatePassValid = searchParams.get("gatePassValid") || "all";
  const siteId = searchParams.get("siteId") || "";

  const shiftId = searchParams.get("shiftId") || "";
  const shiftStart = searchParams.get("shiftStart") || "";
  const shiftEnd = searchParams.get("shiftEnd") || "";

  try {
    const isDb = isDbConnected();
    let employees: any[] = [];
    let deployments: any[] = [];
    let assignments: any[] = [];
    let leaves: any[] = [];
    let securityLicenses: any[] = [];
    let securityGatePasses: any[] = [];
    let site: any = null;
    let projectInstructions: any[] = [];

    // Compute inactive count from all security guards
    let allSecurityGuards: any[] = [];

    const db = readDb() as any;

    if (isDb) {
      allSecurityGuards = await prisma.securityOperationalEmployee.findMany({
        where: { 
          operationType: "SECURITY_GUARDING",
          employeeCategory: "BLUE_COLLAR"
        }
      });
      const operationalGuards = await prisma.securityOperationalEmployee.findMany({
        where: {
          isActive: true,
          operationType: "SECURITY_GUARDING",
          employeeCategory: "BLUE_COLLAR",
          NOT: {
            employmentStatus: { in: ["INACTIVE", "DELETED"] }
          }
        },
        include: {
          sourceEmployee: {
            include: {
              securityLicense: true,
              securityGatePasses: true,
              designation: true,
              tradeClassification: true
            }
          }
        }
      });

      employees = operationalGuards.map((op: any) => {
        const displayDesig = computeDisplayDesignation(op, op.sourceEmployee);
        return {
          id: op.sourceEmployeeId,
          sourceEmployeeId: op.sourceEmployeeId,
          operationalEmployeeId: op.id,
          employeeCode: op.employeeCode || op.sourceEmployeeId,
          name: op.fullName,
          fullName: op.fullName,
          email: op.email,
          phone: op.mobile,
          companyId: op.companyId,
          companyCode: op.companyCode,
          employeeCategory: op.employeeCategory,
          operationType: op.operationType,
          isActive: op.isActive,
          employmentStatus: op.employmentStatus,
          syncStatus: op.syncStatus,
          lastSyncedAt: op.lastSyncedAt,
          designation: { name: displayDesig },
          displayDesignation: displayDesig,
          position: displayDesig,
          sourceEmployee: op.sourceEmployee,
          securityLicense: op.sourceEmployee?.securityLicense || null,
          gatePasses: op.sourceEmployee?.securityGatePasses || [],
          dutyStatus: op.sourceEmployee?.dutyStatus || "OFF_DUTY"
        };
      });

      const [year, month, day] = dateStr.split("-").map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);

      deployments = await prisma.manpowerDeployment.findMany({
        where: {
          operationType: "SECURITY_GUARDING",
          date: { gte: start, lte: end }
        },
        include: {
          assignments: true
        }
      });

      leaves = await prisma.leaveRequest.findMany({
        where: { status: "Approved" }
      });

      if (siteId) {
        site = await prisma.manpowerSite.findUnique({
          where: { id: siteId }
        });
      }
    } else {
      allSecurityGuards = (db.securityOperationalEmployees || []).filter((op: any) => op.operationType === "SECURITY_GUARDING" && op.employeeCategory === "BLUE_COLLAR");
      const opGuards = allSecurityGuards.filter((op: any) => op.isActive !== false && op.employmentStatus !== "INACTIVE" && op.employmentStatus !== "DELETED");
      
      deployments = (db.manpowerDeployments || []).filter((d: any) => {
        const dStr = String(d.date).split("T")[0];
        return dStr === dateStr && d.operationType === "SECURITY_GUARDING";
      });
      assignments = db.manpowerDeploymentAssignments || [];
      leaves = (db.leaves || db.leaveRequests || []).filter((l: any) => l.status === "Approved" || l.status === "APPROVED");
      securityLicenses = db.securityLicenses || [];
      securityGatePasses = db.securityGatePasses || [];

      employees = opGuards.map((op: any) => {
        const lic = securityLicenses.find((l: any) => l.employeeId === op.sourceEmployeeId);
        const gps = securityGatePasses.filter((g: any) => g.employeeId === op.sourceEmployeeId);
        const sourceEmp = (db.employees || []).find((e: any) => e.id === op.sourceEmployeeId);
        const displayDesig = computeDisplayDesignation(op, sourceEmp);

        return {
          id: op.sourceEmployeeId,
          sourceEmployeeId: op.sourceEmployeeId,
          operationalEmployeeId: op.id,
          employeeCode: op.employeeCode || op.sourceEmployeeId,
          name: op.fullName,
          fullName: op.fullName,
          email: op.email,
          phone: op.mobile,
          companyId: op.companyId,
          companyCode: op.companyCode,
          employeeCategory: op.employeeCategory,
          operationType: op.operationType,
          isActive: op.isActive,
          employmentStatus: op.employmentStatus,
          syncStatus: op.syncStatus,
          lastSyncedAt: op.lastSyncedAt,
          designation: { name: displayDesig },
          displayDesignation: displayDesig,
          position: displayDesig,
          sourceEmployee: sourceEmp,
          securityLicense: lic || null,
          gatePasses: gps,
          dutyStatus: sourceEmp?.dutyStatus || "OFF_DUTY"
        };
      });

      if (siteId) {
        site = (db.manpowerSites || []).find((s: any) => s.id === siteId);
      }
    }

    if (site) {
      projectInstructions = (db.projectInstructions || []).filter(
        (pi: any) => pi.projectId === site.projectId && pi.isActive !== false
      );
    }

    const inactiveExcluded = allSecurityGuards.filter(e => e.isActive === false || e.employmentStatus === "INACTIVE" || e.employmentStatus === "DELETED").length;

    // Filter by search text (ID or Name)
    let pool = employees.filter(e => {
      const nameMatch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase());
      const desigMatch = !designation || designation === "all" || (
        e.designationId === designation ||
        e.designationName === designation ||
        e.displayDesignation === designation ||
        (typeof e.designation === 'object' && e.designation?.name === designation)
      );
      const gradeMatch = !grade || grade === "all" || (e.salaryGrade === grade || e.grade === grade);
      return nameMatch && desigMatch && gradeMatch;
    });

    const todayStr = new Date().toISOString().split("T")[0];

    // Filter by License and Gate Pass status
    pool = pool.filter(e => {
      const lic = e.securityLicense;
      const hasLicValid = lic && lic.expiryDate && lic.expiryDate >= todayStr && lic.status === "VALID";
      if (licenseValid === "true" && !hasLicValid) return false;
      if (licenseValid === "false" && hasLicValid) return false;

      const gps = e.securityGatePasses || e.gatePasses || [];
      const hasGpValid = gps.some((gp: any) => gp.expiryDate && gp.expiryDate >= todayStr && gp.status === "VALID" && (!siteId || gp.siteId === siteId));
      if (gatePassValid === "true" && !hasGpValid) return false;
      if (gatePassValid === "false" && hasGpValid) return false;

      return true;
    });

    // Remove employees who have overlapping assignments on this date or are on approved leave
    const leaveEmployeeIds = new Set(leaves.filter(l => {
      const lStart = formatDateToYYYYMMDD(l.startDate || l.from || "");
      const lEnd = formatDateToYYYYMMDD(l.endDate || l.to || "");
      return lStart && lEnd && dateStr >= lStart && dateStr <= lEnd;
    }).map(l => l.employeeId));

    const assignedEmployeeIds = new Set();
    if (isDb) {
      deployments.forEach(d => {
        (d.assignments || []).forEach((asg: any) => {
          assignedEmployeeIds.add(asg.employeeId);
        });
      });
    } else {
      const depIds = deployments.map(d => d.id);
      assignments.filter(a => depIds.includes(a.deploymentId)).forEach(asg => {
        assignedEmployeeIds.add(asg.employeeId);
      });
    }

    const leaveExcluded = pool.filter(e => leaveEmployeeIds.has(e.id)).length;
    const conflictExcluded = pool.filter(e => assignedEmployeeIds.has(e.id)).length;

    // Filter pool to only show active, unassigned and not on leave guards
    let eligiblePool = pool.filter(e => !leaveEmployeeIds.has(e.id) && !assignedEmployeeIds.has(e.id));

    // Validate eligibility strictly ONLY when enough shift/slot context is available
    const hasShiftContext = !!(shiftId || shiftStart || shiftEnd);
    if (siteId && site && hasShiftContext) {
      const activeShifts = await getActiveSiteShiftConfigs(siteId, db);
      const categories = db.manpowerCategories || [];
      
      if (activeShifts.length > 0) {
        eligiblePool = eligiblePool.filter(e => {
          // Check if employee is eligible for at least one active shift config of this site
          return activeShifts.some((req: any) => {
            const category = categories.find((c: any) => c.id === req.categoryId) || req.category;
            const slotInfo = {
              date: dateStr,
              siteId,
              siteName: site.name,
              shiftStartTime: shiftStart || req.shiftStartTime,
              shiftEndTime: shiftEnd || req.shiftEndTime,
              shiftCode: req.shiftCode,
              isReliever: false
            };
            const siteReqs = {
              requiresMoiLicense: category?.requiresMoiLicense || false,
              requiresGatePassCheck: category?.requiresGatePassCheck || site.gatePassRequired || false,
              gatePassRequired: site.gatePassRequired || false,
              gatePassValidationMode: site.gatePassValidationMode || "WARNING",
              clientApprovalRequired: site.clientApprovalRequired || false,
              strictDesignationMatch: false
            };
            
            const validation = validateDeploymentEligibility(
              e,
              slotInfo,
              siteReqs,
              [], // already filtered assigned employees
              [], // already filtered leave employees
              projectInstructions
            );
            
            return validation.severity !== "BLOCKED";
          });
        });
      }
    }

    const availablePool = eligiblePool.map(e => {
      const lic = e.securityLicense;
      const gps = e.securityGatePasses || e.gatePasses || [];
      const gp = siteId ? gps.find((g: any) => g.siteId === siteId) : gps[0];
      const displayDesig = e.displayDesignation || computeDisplayDesignation(e, e.sourceEmployee);

      return {
        id: e.sourceEmployeeId,
        sourceEmployeeId: e.sourceEmployeeId,
        operationalEmployeeId: e.operationalEmployeeId,
        employeeCode: e.employeeCode || e.sourceEmployeeId,
        name: e.name,
        fullName: e.name,
        companyCode: e.companyCode,
        employeeCategory: e.employeeCategory,
        operationType: e.operationType,
        designation: displayDesig,
        displayDesignation: displayDesig,
        position: displayDesig,
        tradePosition: displayDesig,
        isActive: e.isActive,
        employmentStatus: e.employmentStatus,
        syncStatus: e.syncStatus,
        lastSyncedAt: e.lastSyncedAt,

        grade: e.grade || "G1",
        defaultSiteId: e.defaultSiteId || null,
        securityLicenseExpiry: lic?.expiryDate || null,
        siteGatePassExpiry: gp?.expiryDate || null,
        availabilityStatus: "Available",
        isLicenseExpired: lic ? lic.expiryDate < todayStr : true,
        isGatePassExpired: gp ? gp.expiryDate < todayStr : true,
        skills: ["General Security"]
      };
    });

    return NextResponse.json({
      success: true,
      pool: availablePool,
      debugCounts: {
        totalSecurityEmployees: allSecurityGuards.length,
        inactiveExcluded,
        leaveExcluded,
        conflictExcluded,
        eligibleCount: availablePool.length
      }
    });

  } catch (error: any) {
    console.error("Failed to load available employees API:", error);
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
