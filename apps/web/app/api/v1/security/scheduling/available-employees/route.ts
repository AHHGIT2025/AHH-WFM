import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
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
  const licenseValid = searchParams.get("licenseValid"); // "true" | "false"
  const gatePassValid = searchParams.get("gatePassValid"); // "true" | "false"
  const siteId = searchParams.get("siteId") || "";

  try {
    const isDb = isDbConnected();
    let employees: any[] = [];
    let deployments: any[] = [];
    let assignments: any[] = [];
    let leaves: any[] = [];
    let securityLicenses: any[] = [];
    let securityGatePasses: any[] = [];

    if (isDb) {
      employees = await prisma.employee.findMany({
        where: {
          isActive: true,
          employmentStatus: "ACTIVE",
          operationType: "SECURITY_GUARDING"
        },
        include: {
          securityLicense: true,
          securityGatePasses: true
        }
      });

      const start = new Date(dateStr);
      start.setHours(0,0,0,0);
      const end = new Date(dateStr);
      end.setHours(23,59,59,999);

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
    } else {
      const db = readDb() as any;
      employees = (db.employees || []).filter((e: any) => e.isActive !== false && e.employmentStatus === "ACTIVE" && e.operationType === "SECURITY_GUARDING");
      deployments = (db.manpowerDeployments || []).filter((d: any) => {
        const dStr = String(d.date).split("T")[0];
        return dStr === dateStr && d.operationType === "SECURITY_GUARDING";
      });
      assignments = db.manpowerDeploymentAssignments || [];
      leaves = (db.leaves || db.leaveRequests || []).filter((l: any) => l.status === "Approved" || l.status === "APPROVED");
      securityLicenses = db.securityLicenses || [];
      securityGatePasses = db.securityGatePasses || [];

      // Map sub-relations to employees
      employees = employees.map((e: any) => {
        const lic = securityLicenses.find((l: any) => l.employeeId === e.id);
        const gps = securityGatePasses.filter((g: any) => g.employeeId === e.id);
        return {
          ...e,
          securityLicense: lic || null,
          gatePasses: gps
        };
      });
    }

    // Filter by search text (ID or Name)
    let pool = employees.filter(e => {
      const nameMatch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase());
      const desigMatch = !designation || designation === "all" || (e.designationId === designation || e.designationName === designation);
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
      const lStart = String(l.startDate || l.from || "").split("T")[0];
      const lEnd = String(l.endDate || l.to || "").split("T")[0];
      return dateStr >= lStart && dateStr <= lEnd;
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

    const availablePool = pool.map(e => {
      const lic = e.securityLicense;
      const gps = e.securityGatePasses || e.gatePasses || [];
      const gp = siteId ? gps.find((g: any) => g.siteId === siteId) : gps[0];

      const onLeave = leaveEmployeeIds.has(e.id);
      const isAssigned = assignedEmployeeIds.has(e.id);

      let availabilityStatus = "Available";
      if (onLeave) availabilityStatus = "On Leave";
      else if (isAssigned) availabilityStatus = "Assigned";

      return {
        id: e.id,
        employeeCode: e.employeeCode || e.id,
        name: e.name,
        designation: e.designationId || e.designationName || "Security Guard",
        grade: e.salaryGrade || e.grade || "G1",
        defaultSiteId: e.defaultLocationId,
        securityLicenseExpiry: lic?.expiryDate || null,
        siteGatePassExpiry: gp?.expiryDate || null,
        availabilityStatus,
        isLicenseExpired: lic ? lic.expiryDate < todayStr : true,
        isGatePassExpired: gp ? gp.expiryDate < todayStr : true,
        skills: e.skills || ["General Security"]
      };
    });

    return NextResponse.json(availablePool);

  } catch (error: any) {
    console.error("Failed to load available employees API:", error);
    return NextResponse.json({
      error: error.message || String(error)
    }, { status: 500 });
  }
}
