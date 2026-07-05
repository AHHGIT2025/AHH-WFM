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

    // 1. Get Active Deployment (for Blue Collar)
    const activeDeployment = await prisma.employeeDeployment.findFirst({
      where: {
        employeeId: employee.id,
        deploymentDate: todayStr,
        status: { in: ["PLANNED", "ACTIVE"] }
      },
      include: {
        project: true,
        site: true
      }
    });

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
    const activeOnCall = await prisma.onCallAssignment.findFirst({
      where: {
        employeeId: employee.id,
        assignmentDate: todayStr,
        status: "ACTIVE"
      },
      include: {
        project: true,
        site: true,
        allowedPunchLocation: true
      }
    });

    // 4. Get Today's Attendance Record
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

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

    type DutySource = "DEFAULT_LOCATION" | "SHIFT_PLANNER" | "DEPLOYMENT" | "ON_CALL" | "NONE";

    let currentDuty: {
      source: DutySource;
      locationId: string | null;
      locationCode: string | null;
      locationName: string | null;
      worksiteName: string | null;
      siteName: string | null;
      displayName: string;
    };

    // Legacy fields kept for backward compatibility with existing UI
    let currentAssignment: { name: string; site: string | null | undefined; type: string } | null = null;
    let assignmentType = "OFFICE";

    if (isWhiteCollar) {
      // White Collar — work location comes from Default Location in Employee Profile
      let loc = employee.defaultLocation as any;

      // Fallback: if relation wasn't populated but FK exists, query directly
      if (!loc && (employee as any).defaultLocationId) {
        console.log("[DASHBOARD] defaultLocation relation not loaded — querying by ID:", (employee as any).defaultLocationId);
        loc = await prisma.locationMaster.findUnique({
          where: { id: (employee as any).defaultLocationId }
        });
      }

      if (loc) {

        const displayName = loc.locationCode
          ? `${loc.locationCode} \u2014 ${loc.locationName}`
          : loc.locationName;
        currentDuty = {
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
        // No default location configured for this White Collar employee
        currentDuty = {
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
    } else {
      // Blue Collar — location comes from dynamic Shift Planner / Deployment / On-Call
      if (activeDeployment) {
        const displayName = activeDeployment.site?.siteName
          ? `${activeDeployment.project.projectName} \u2014 ${activeDeployment.site.siteName}`
          : activeDeployment.project.projectName;

        currentDuty = {
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

        currentDuty = {
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
        // No active deployment/on-call — Blue Collar shows Not Assigned
        currentDuty = {
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

    console.log("[DASHBOARD] currentDuty:", JSON.stringify(currentDuty));

    return NextResponse.json({
      employeeName: employee.name,
      employeeCategory: employee.employeeCategory,
      designation: employee.designation?.name,
      dutyStatus: employee.dutyStatus,
      // New structured currentDuty object for richer consumers
      currentDuty,
      // Legacy currentAssignment fields — kept for backward-compat with existing UI
      currentAssignment: currentAssignment ?? { name: currentDuty.displayName, site: null, type: "NONE" },
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

