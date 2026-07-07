import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const todayStr = new Date().toISOString().split("T")[0];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  try {
    let employees: any[] = [];
    let attendance: any[] = [];
    let leaves: any[] = [];
    let contracts: any[] = [];
    let addendums: any[] = [];
    let projects: any[] = [];
    let projectSites: any[] = [];
    let deployments: any[] = [];
    let deploymentAssignments: any[] = [];
    let relieverAssignments: any[] = [];
    let securityLicenses: any[] = [];
    let securityGatePasses: any[] = [];
    let coordinatorAssignments: any[] = [];
    let siteInspections: any[] = [];
    let userActivityLogs: any[] = [];

    if (isDbConnected()) {
      employees = await prisma.employee.findMany();
      attendance = await prisma.attendanceRecord.findMany();
      leaves = await prisma.leaveRequest.findMany();
      contracts = await prisma.manpowerContract.findMany();
      addendums = await prisma.manpowerContractAddendum.findMany();
      projects = await prisma.project.findMany();
      projectSites = await prisma.projectSite.findMany();
      deployments = await prisma.manpowerDeployment.findMany();
      deploymentAssignments = await prisma.manpowerDeploymentAssignment.findMany();
      relieverAssignments = await prisma.manpowerRelieverAssignment.findMany();
      securityLicenses = await prisma.securityLicense.findMany();
      securityGatePasses = await prisma.securityGatePass.findMany();
      coordinatorAssignments = await prisma.securityProjectCoordinatorAssignment.findMany();
      siteInspections = await prisma.securitySiteInspection.findMany();
      userActivityLogs = await prisma.userActivityLog.findMany({ take: 50, orderBy: { createdAt: "desc" } });
    } else {
      const db = readDb() as any;
      employees = db.employees || [];
      attendance = db.attendance || db.attendanceRecords || [];
      leaves = db.leaves || db.leaveRequests || [];
      contracts = db.manpowerContracts || [];
      addendums = db.manpowerContractAddendums || [];
      projects = db.projects || db.manpowerProjects || [];
      projectSites = db.projectSites || db.manpowerSites || [];
      deployments = db.manpowerDeployments || [];
      deploymentAssignments = db.manpowerDeploymentAssignments || [];
      relieverAssignments = db.manpowerRelieverAssignments || [];
      securityLicenses = db.securityLicenses || [];
      securityGatePasses = db.securityGatePasses || [];
      coordinatorAssignments = db.securityProjectCoordinatorAssignments || [];
      siteInspections = db.securitySiteInspections || [];
      userActivityLogs = db.userActivityLogs || [];
    }

    const companies = await mockDb.getCompanies();
    const locations = await mockDb.getLocations();

    const activeEmployees = employees.filter(e => e.isActive !== false && e.employmentStatus === "ACTIVE");
    const totalActiveCount = activeEmployees.length;

    // 1. Attendance Today (dynamic check)
    // Map checkIn dates
    const parseDateOnly = (dStr: string) => dStr.split("T")[0];
    
    const todayAttendance = attendance.filter(a => {
      if (!a.checkIn) return false;
      return parseDateOnly(a.checkIn) === todayStr;
    });

    const presentTodayCount = new Set(todayAttendance.map(a => a.employeeId)).size;
    const onDutyNowCount = todayAttendance.filter(a => !a.checkOut).length;
    const lateTodayCount = todayAttendance.filter(a => a.status === "Late").length;
    const earlyCheckoutCount = todayAttendance.filter(a => a.checkoutStatus?.toLowerCase().includes("early")).length;
    const missingCheckoutCount = todayAttendance.filter(a => {
      if (a.checkOut) return false;
      // If checked in before today or hours ago and still not checked out, mark missing
      const hoursSinceCheckIn = (Date.now() - new Date(a.checkIn).getTime()) / (1000 * 60 * 60);
      return hoursSinceCheckIn > 12;
    }).length;

    // 2. Leaves Today
    const onLeaveToday = leaves.filter(l => {
      if (l.status !== "Approved") return false;
      const start = new Date(l.startDate || l.from || "");
      const end = new Date(l.endDate || l.to || "");
      const today = new Date(todayStr);
      return today >= start && today <= end;
    });
    const onLeaveTodayCount = onLeaveToday.length;

    const pendingLeaves = leaves.filter(l => l.status === "Pending Approval");
    const pendingLeavesCount = pendingLeaves.length;

    const upcomingLeaves = leaves.filter(l => {
      if (l.status !== "Approved") return false;
      const start = new Date(l.startDate || l.from || "");
      const diffTime = start.getTime() - todayStart.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 7;
    }).length;

    const absentTodayCount = Math.max(0, totalActiveCount - presentTodayCount - onLeaveTodayCount);

    // 3. Workforce Clusters
    const clusters = {
      WHITE_COLLAR: activeEmployees.filter(e => e.operationType === "WHITE_COLLAR"),
      SECURITY_GUARDING: activeEmployees.filter(e => e.operationType === "SECURITY_GUARDING"),
      FACILITY_MANAGEMENT: activeEmployees.filter(e => e.operationType === "FACILITY_MANAGEMENT"),
    };

    const getClusterStats = (clusterEmps: any[]) => {
      const ids = clusterEmps.map(e => e.id);
      const clusterPresent = todayAttendance.filter(a => ids.includes(a.employeeId));
      const presentCount = new Set(clusterPresent.map(a => a.employeeId)).size;
      const onDutyCount = clusterPresent.filter(a => !a.checkOut).length;
      
      const clusterLeaves = onLeaveToday.filter(l => ids.includes(l.employeeId));
      const leaveCount = clusterLeaves.length;

      const absentCount = Math.max(0, clusterEmps.length - presentCount - leaveCount);
      const total = clusterEmps.length;
      const utilization = total > 0 ? Math.round(((onDutyCount + presentCount) / (total * 2)) * 100) : 0; // expected duty proxy

      return {
        total,
        active: clusterEmps.filter(e => e.isActive !== false).length,
        onDutyNow: onDutyCount,
        presentToday: presentCount,
        absentToday: absentCount,
        onLeave: leaveCount,
        pendingDeployment: 0, // calculated from shift planner
        utilization
      };
    };

    const workforceOverview = {
      whiteCollar: getClusterStats(clusters.WHITE_COLLAR),
      securityGuarding: getClusterStats(clusters.SECURITY_GUARDING),
      facilityManagement: getClusterStats(clusters.FACILITY_MANAGEMENT),
    };

    // 4. Shift & Deployments Today
    const todayDeployments = deployments.filter(d => parseDateOnly(d.date) === todayStr);
    const todayDepIds = todayDeployments.map(d => d.id);
    const todayAssignments = deploymentAssignments.filter(a => todayDepIds.includes(a.deploymentId));
    
    const staffDeployedCount = new Set(todayAssignments.map(a => a.employeeId)).size;
    const relieversDeployedCount = relieverAssignments.filter(r => {
      const orig = deploymentAssignments.find(a => a.id === r.originalAssignmentId);
      return orig && todayDepIds.includes(orig.deploymentId);
    }).length;

    // Calculate unassigned blue-collar count
    const blueCollarActiveIds = activeEmployees
      .filter(e => e.employeeCategory === "BLUE_COLLAR")
      .map(e => e.id);
    const deployedIds = new Set(todayAssignments.map(a => a.employeeId));
    const unassignedManpowerCount = blueCollarActiveIds.filter(id => !deployedIds.has(id)).length;

    // Update clusters pending deployment count
    workforceOverview.securityGuarding.pendingDeployment = activeEmployees
      .filter(e => e.operationType === "SECURITY_GUARDING" && e.employeeCategory === "BLUE_COLLAR" && !deployedIds.has(e.id)).length;
    workforceOverview.facilityManagement.pendingDeployment = activeEmployees
      .filter(e => e.operationType === "FACILITY_MANAGEMENT" && e.employeeCategory === "BLUE_COLLAR" && !deployedIds.has(e.id)).length;

    // 5. Contracts & Projects
    const activeContracts = contracts.filter(c => c.status === "ACTIVE" || c.statusCode === "ACTIVE");
    const activeContractsCount = activeContracts.length;
    const draftContractsCount = contracts.filter(c => c.status === "DRAFT" || c.statusCode === "DRAFT").length;
    const pendingContractsCount = contracts.filter(c => c.status === "PENDING_APPROVAL" || c.statusCode === "PENDING_APPROVAL").length;
    
    // Contracts expiring in 30 days
    const expiringContractsCount = activeContracts.filter(c => {
      if (!c.endDate) return false;
      const end = new Date(c.endDate);
      const diff = end.getTime() - todayStart.getTime();
      const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 30;
    }).length;

    // 6. Security Guarding Ops
    const activeSites = projectSites.filter(s => s.status === "ACTIVE" || s.isActive !== false);
    const openIncidentsCount = 0; // fallback (no data)
    
    const securitySummary = {
      activeContracts: contracts.filter(c => (c.status === "ACTIVE" || c.statusCode === "ACTIVE") && c.contractType === "SECURITY_GUARDING").length,
      activeSites: activeSites.length,
      guardsDeployed: workforceOverview.securityGuarding.presentToday,
      vacantPosts: 0, // fallback
      patrolsToday: siteInspections.filter(i => parseDateOnly(i.inspectionDate || i.createdAt) === todayStr).length,
      openIncidents: openIncidentsCount,
      feedbackPending: 0
    };

    // 7. Facility Management Ops
    const facilitySummary = {
      activeProjects: projects.filter(p => (p.status === "ACTIVE" || p.status === "Active") && p.projectType === "FACILITY_MANAGEMENT").length,
      staffDeployed: workforceOverview.facilityManagement.presentToday,
      openWorkReports: 0,
      feedbackPending: 0,
      openIncidents: 0,
      relieverRequests: relieverAssignments.length
    };

    // 8. Corporate / White Collar Ops
    const corporateSummary = {
      activeStaff: workforceOverview.whiteCollar.total,
      presentToday: workforceOverview.whiteCollar.presentToday,
      onLeave: workforceOverview.whiteCollar.onLeave,
      lateToday: todayAttendance.filter(a => {
        const emp = activeEmployees.find(e => e.id === a.employeeId);
        return emp && emp.operationType === "WHITE_COLLAR" && a.status === "Late";
      }).length,
      pendingLeaveApprovals: pendingLeavesCount,
      pendingClearances: 0 // fallback
    };

    // 9. Risk & Exceptions
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

    const checkExpiring = (dateStr: string | null | undefined, limitDate: Date) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d > todayStart && d <= limitDate;
    };

    const exceptions = {
      noDefaultLocation: activeEmployees.filter(e => !e.defaultLocationId).length,
      noActiveDeployment: unassignedManpowerCount,
      expiringQid30: activeEmployees.filter(e => checkExpiring(e.qidExpiryDate, thirtyDaysFromNow)).length,
      expiringQid60: activeEmployees.filter(e => checkExpiring(e.qidExpiryDate, sixtyDaysFromNow)).length,
      expiringPassport30: activeEmployees.filter(e => checkExpiring(e.passportExpiryDate, thirtyDaysFromNow)).length,
      expiringPassport60: activeEmployees.filter(e => checkExpiring(e.passportExpiryDate, sixtyDaysFromNow)).length,
      expiringVisa30: activeEmployees.filter(e => checkExpiring(e.visaExpiryDate, thirtyDaysFromNow)).length,
      expiringMoiLicense30: securityLicenses.filter(l => checkExpiring(l.expiryDate, thirtyDaysFromNow)).length,
      expiringGatePass30: securityGatePasses.filter(g => checkExpiring(g.expiryDate, thirtyDaysFromNow)).length,
      expiringHealthCard30: activeEmployees.filter(e => checkExpiring(e.healthCardExpiryDate, thirtyDaysFromNow)).length,
      missingCheckout: missingCheckoutCount,
      activeWithDisabledLogin: activeEmployees.filter(e => e.isLoginEnabled === false).length,
    };

    // 10. Approvals Summary
    const approvalsSummary = {
      leaveApprovals: pendingLeavesCount,
      attendanceCorrections: 0,
      overtime: 0,
      deployments: deployments.filter(d => d.approvalStatus === "DRAFT" || d.approvalStatus === "SUBMITTED").length,
      contracts: pendingContractsCount,
      addendums: addendums.filter(a => a.status === "PENDING" || a.status === "PENDING_APPROVAL").length,
      clearances: 0
    };

    // 11. Regional Activity
    // Count active operatives by default location
    const locationCounts: Record<string, { name: string; count: number }> = {};
    activeEmployees.forEach(e => {
      // Find default location name
      const loc = locations.find((l: any) => l.id === e.defaultLocationId || l.locationCode === e.defaultLocationId);
      const locName = loc ? (loc.locationName || (loc as any).name) : "Office HQ";
      
      const att = todayAttendance.find(a => a.employeeId === e.id && !a.checkOut);
      if (att) {
        if (!locationCounts[locName]) {
          locationCounts[locName] = { name: locName, count: 0 };
        }
        locationCounts[locName].count++;
      }
    });

    const regionalActivity = Object.values(locationCounts);

    const dashboardSummary = {
      workforceSummary: {
        totalActive: totalActiveCount,
        presentToday: presentTodayCount,
        absentToday: absentTodayCount,
        onDutyNow: onDutyNowCount,
        lateToday: lateTodayCount,
        onLeaveToday: onLeaveTodayCount,
        openIncidents: openIncidentsCount,
        pendingApprovals: pendingLeavesCount + pendingContractsCount,
        activeContracts: activeContractsCount,
        activeDeployments: todayDeployments.length
      },
      workforceOverview,
      securitySummary,
      facilitySummary,
      corporateSummary,
      attendanceSummary: {
        present: presentTodayCount,
        absent: absentTodayCount,
        late: lateTodayCount,
        earlyCheckout: earlyCheckoutCount,
        missingCheckout: missingCheckoutCount,
        overtimePending: 0
      },
      leaveSummary: {
        pendingApproval: pendingLeavesCount,
        approvedToday: onLeaveTodayCount,
        onLeaveToday: onLeaveTodayCount,
        upcomingNext7Days: upcomingLeaves
      },
      shiftDeploymentSummary: {
        activeShiftsToday: todayDeployments.length,
        deployedToday: staffDeployedCount,
        openGaps: 0,
        relieverAssignments: relieversDeployedCount,
        unassignedManpower: unassignedManpowerCount
      },
      contractSummary: {
        active: activeContractsCount,
        draft: draftContractsCount,
        pendingApproval: pendingContractsCount,
        expiring30Days: expiringContractsCount,
        activeProjects: projects.length,
        pendingAddendums: addendums.filter(a => a.status === "PENDING").length
      },
      approvalSummary: approvalsSummary,
      exceptionSummary: exceptions,
      reportSnapshot: {
        attendanceReport: "GENERATED",
        leaveReport: "UP-TO-DATE",
        deploymentReport: "SYNCED",
        securityReport: "HEALTHY",
        facilityReport: "HEALTHY",
        auditActivityToday: userActivityLogs.filter(log => parseDateOnly(log.timestamp || log.createdAt) === todayStr).length,
        backupReady: "SUCCESS"
      },
      regionalActivity,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(dashboardSummary);
  } catch (error: any) {
    console.error("Dashboard summary API error:", error);
    return NextResponse.json({ error: "Failed to generate dashboard summary: " + error.message }, { status: 500 });
  }
}
