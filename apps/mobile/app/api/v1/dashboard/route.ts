import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as any)?.id;
    console.log("[DASHBOARD] session.user.id:", sessionUserId);
    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Get employee details — include BOTH defaultLocation and officeLocation
    const employee = await prisma.employee.findUnique({
      where: { id: sessionUserId },
      include: {
        company: true,
        defaultProject: true,
        defaultSite: true,
        defaultLocation: true,
        officeLocation: true,
        designation: true,
        tradeClassification: true
      }
    });

    console.log("[DASHBOARD] employee found:", !!employee, "| id:", employee?.id, "| category:", employee?.employeeCategory, "| defaultLocationId:", (employee as any)?.defaultLocationId, "| defaultLocation:", (employee as any)?.defaultLocation?.locationName);


    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const isSecurityGuard = employee.employeeCategory === "BLUE_COLLAR" && employee.operationType === "SECURITY_GUARDING";

    // 1. Get Active Deployment (for Blue Collar)
    const activeDeployment = !isSecurityGuard ? await prisma.employeeDeployment.findFirst({
      where: {
        employeeId: employee.id,
        deploymentDate: { gte: startOfDay, lte: endOfDay },
        status: { in: ["PLANNED", "ACTIVE"] }
      },
      include: {
        project: true,
        site: true
      }
    }) : null;

    // 2. Get Active Shift Assignment
    const activeShift = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId: employee.id,
        assignmentStatus: "ACTIVE"
      },
      orderBy: { createdAt: "desc" },
      include: {
        shiftTemplate: true
      }
    });

    // 3. Get Active On-Call Assignment (for Blue Collar)
    const activeOnCall = !isSecurityGuard ? await prisma.onCallAssignment.findFirst({
      where: {
        employeeId: employee.id,
        assignmentDate: { gte: startOfDay, lte: endOfDay },
        status: "ACTIVE"
      },
      include: {
        project: true,
        site: true,
        allowedPunchLocation: true
      }
    }) : null;

    // 4. Get Today's Attendance Record
    const todaysAttendance = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: employee.id,
        checkIn: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: { checkIn: "desc" }
    });

    // ─────────────────────────────────────────────────────
    // CURRENT DUTY LOGIC — differentiated by employee category
    // ─────────────────────────────────────────────────────
    const isWhiteCollar = employee.employeeCategory === "WHITE_COLLAR";
    const isFMBlueCollar = employee.employeeCategory === "BLUE_COLLAR" && employee.operationType === "FACILITY_MANAGEMENT";

    let dutySource: "EMPLOYEE_DEFAULT_LOCATION" | "SHIFT_PLANNER" | "EMPLOYEE_DEPLOYMENT" | "NONE" = "NONE";
    let currentDutyStr = "Not Assigned";
    let currentLocationVal: any = null;
    let reason: string | null = null;
    let activeAssignmentObj: any = null;
    let siteObj: any = null;

    let currentDutyObj: any = {
      source: "NONE",
      locationId: null,
      locationCode: null,
      locationName: null,
      worksiteName: null,
      siteName: null,
      displayName: "Not Assigned"
    };

    // Legacy fields kept for backward compatibility with existing UI
    let currentAssignment: { name: string; site: string | null | undefined; type: string } | null = null;
    let assignmentType = "OFFICE";

    if (isWhiteCollar) {
      dutySource = "EMPLOYEE_DEFAULT_LOCATION";
      let loc = employee.defaultLocation;
      if (!loc && employee.defaultLocationId) {
        console.log("[DASHBOARD] defaultLocation relation not loaded — querying by ID:", employee.defaultLocationId);
        loc = await prisma.locationMaster.findUnique({
          where: { id: employee.defaultLocationId }
        });
      }

      if (loc) {
        currentDutyStr = loc.locationName;
        currentLocationVal = {
          id: loc.id,
          name: loc.locationName,
          locationName: loc.locationName,
          lat: loc.latitude,
          lng: loc.longitude,
          radiusMeters: loc.defaultGeofenceRadiusMeters
        };
        const displayName = loc.locationCode
          ? `${loc.locationCode} \u2014 ${loc.locationName}`
          : loc.locationName;

        currentDutyObj = {
          source: "DEFAULT_LOCATION",
          locationId: loc.id,
          locationCode: loc.locationCode ?? null,
          locationName: loc.locationName,
          worksiteName: null,
          siteName: null,
          displayName
        };
        currentAssignment = {
          name: loc.locationName,
          site: loc.locationCode ?? null,
          type: "OFFICE"
        };
        assignmentType = "OFFICE";
      } else {
        currentDutyStr = "Default Office Not Configured";
        reason = "DEFAULT_LOCATION_NOT_CONFIGURED";
        currentDutyObj = {
          source: "DEFAULT_LOCATION",
          locationId: null,
          locationCode: null,
          locationName: null,
          worksiteName: null,
          siteName: null,
          displayName: "Default Office Not Configured"
        };
        currentAssignment = null;
        assignmentType = "OFFICE";
      }
    } else if (isSecurityGuard) {
      dutySource = "SHIFT_PLANNER";
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const activeAssignment = await prisma.manpowerDeploymentAssignment.findFirst({
        where: {
          employeeId: employee.id,
          deployment: {
            date: { gte: todayStart, lte: todayEnd },
            operationType: "SECURITY_GUARDING"
          }
        },
        include: {
          deployment: {
            include: {
              shiftRequirement: {
                include: {
                  site: {
                    include: { project: true }
                  }
                }
              }
            }
          }
        }
      });

      if (activeAssignment && activeAssignment.deployment?.shiftRequirement?.site) {
        const site = activeAssignment.deployment.shiftRequirement.site;
        currentDutyStr = site.name;
        currentLocationVal = site.name;
        activeAssignmentObj = activeAssignment;
        siteObj = site;

        const displayName = site.project?.name
          ? `${site.project.name} \u2014 ${site.name}`
          : site.name;

        currentDutyObj = {
          source: "SHIFT_PLANNER",
          locationId: null,
          locationCode: site.code ?? null,
          locationName: site.name,
          worksiteName: site.project?.name ?? null,
          siteName: site.name,
          displayName
        };
        currentAssignment = {
          name: site.project?.name || "Security Duty",
          site: site.name,
          type: "PROJECT_SITE"
        };
        assignmentType = "DEPLOYMENT";
      } else {
        currentDutyStr = "Not Assigned";
        reason = "NO_ACTIVE_ASSIGNMENT";
        currentDutyObj = {
          source: "SHIFT_PLANNER",
          locationId: null,
          locationCode: null,
          locationName: null,
          worksiteName: null,
          siteName: null,
          displayName: "Not Assigned"
        };
        currentAssignment = null;
        assignmentType = "OFFICE";
      }
    } else {
      dutySource = "EMPLOYEE_DEPLOYMENT";
      if (activeDeployment) {
        currentDutyStr = activeDeployment.site?.siteName || activeDeployment.project.projectName;
        currentLocationVal = currentDutyStr;
        siteObj = activeDeployment.site;

        const displayName = activeDeployment.site?.siteName
          ? `${activeDeployment.project.projectName} \u2014 ${activeDeployment.site.siteName}`
          : activeDeployment.project.projectName;

        currentDutyObj = {
          source: "DEPLOYMENT",
          locationId: null,
          locationCode: null,
          locationName: null,
          worksiteName: activeDeployment.project.projectName,
          siteName: activeDeployment.site?.siteName ?? null,
          displayName
        };
        currentAssignment = {
          name: activeDeployment.project.projectName,
          site: activeDeployment.site?.siteName,
          type: "PROJECT_SITE"
        };
        assignmentType = "DEPLOYMENT";
      } else if (activeOnCall) {
        const displayName =
          activeOnCall.site?.siteName ||
          activeOnCall.allowedPunchLocation?.name ||
          activeOnCall.project?.projectName ||
          "On-Call Duty";

        currentDutyStr = activeOnCall.site?.siteName || activeOnCall.allowedPunchLocation?.name || "On-Call Duty";
        currentLocationVal = currentDutyStr;
        activeAssignmentObj = activeOnCall;
        siteObj = activeOnCall.site;

        currentDutyObj = {
          source: "ON_CALL",
          locationId: null,
          locationCode: null,
          locationName: null,
          worksiteName: activeOnCall.project?.projectName ?? null,
          siteName: activeOnCall.site?.siteName ?? null,
          displayName
        };
        currentAssignment = {
          name: activeOnCall.project?.projectName || "On-Call Duty",
          site: activeOnCall.site?.siteName || activeOnCall.allowedPunchLocation?.name,
          type: "ON_CALL"
        };
        assignmentType = "ON_CALL";
      } else {
        currentDutyStr = "Not Assigned";
        currentDutyObj = {
          source: "NONE",
          locationId: null,
          locationCode: null,
          locationName: null,
          worksiteName: null,
          siteName: null,
          displayName: "Not Assigned"
        };
        currentAssignment = null;
        assignmentType = "OFFICE";
      }
    }

    console.log("[DASHBOARD] currentDutyStr:", currentDutyStr);

    return NextResponse.json({
      employeeId: employee.id,
      employeeCode: employee.id,
      fullName: employee.name,
      employeeName: employee.name,
      employeeCategory: employee.employeeCategory,
      operationType: employee.operationType,
      designation: employee.designation?.name,
      dutyStatus: employee.dutyStatus,
      
      currentDuty: currentDutyStr,
      currentLocation: currentLocationVal,
      dutySource,
      reason,
      defaultLocation: employee.defaultLocation ? {
        id: employee.defaultLocation.id,
        name: employee.defaultLocation.locationName,
        locationName: employee.defaultLocation.locationName,
        lat: employee.defaultLocation.latitude,
        lng: employee.defaultLocation.longitude,
        radiusMeters: employee.defaultLocation.defaultGeofenceRadiusMeters
      } : null,
      activeAssignment: activeAssignmentObj,
      site: siteObj,

      // Legacy currentDuty object for backward compatibility
      currentDutyObject: currentDutyObj,
      currentDutyCompat: currentDutyObj,
      // Provide legacy property for dashboard screen rendering
      currentDutyLegacy: currentDutyObj,
      currentAssignment: currentAssignment ?? { name: currentDutyObj.displayName, site: null, type: "NONE" },
      assignmentType,
      todayShift: activeShift?.shiftTemplate?.name || "Standard Shift",
      attendanceStatus: todaysAttendance
        ? (todaysAttendance.checkOut ? "COMPLETED" : "CHECKED_IN")
        : "NOT_CHECKED_IN",
      todaysAttendance
    });

  } catch (error) {
    console.error("GET /dashboard Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

