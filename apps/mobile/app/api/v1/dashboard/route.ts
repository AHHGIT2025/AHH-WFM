import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Get employee details with default locations
    const employee = await prisma.employee.findUnique({
      where: { id: (session?.user as any)?.id },
      include: {
        company: true,
        defaultProject: true,
        defaultSite: true,
        officeLocation: true,
        designation: true,
        tradeClassification: true
      }
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // 1. Get Active Deployment (if any)
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

    // 2. Get Active Shift
    const activeShift = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId: employee.id,
        assignmentStatus: "ACTIVE",
        // Using createdAt as a proxy for date since date is missing in ShiftAssignment
        // In real app, we'd join with ShiftTemplate or have a specific date field
      },
      orderBy: { createdAt: "desc" },
      include: {
        shiftTemplate: true
      }
    });

    // 3. Get Active On-Call Assignment
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

    // 4. Get Today's Attendance Record (if any open)
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

    // Determine current logical assignment based on priority:
    // 1. Deployment
    // 2. OnCall
    // 3. Shift
    // 4. Office
    let currentAssignment = null;
    let assignmentType = "OFFICE";

    if (activeDeployment) {
      currentAssignment = {
        name: activeDeployment.project.projectName,
        site: activeDeployment.site.siteName,
        type: "PROJECT_SITE"
      };
      assignmentType = "DEPLOYMENT";
    } else if (activeOnCall) {
      currentAssignment = {
        name: activeOnCall.project?.projectName || "On-Call Duty",
        site: activeOnCall.site?.siteName || activeOnCall.allowedPunchLocation?.name,
        type: "ON_CALL"
      };
      assignmentType = "ON_CALL";

    } else {
      currentAssignment = {
        name: employee.officeLocation?.locationName || employee.company?.companyName || "Default Office",
        site: "HQ",
        type: "OFFICE"
      };
    }

    return NextResponse.json({
      employeeName: employee.name,
      employeeCategory: employee.employeeCategory,
      designation: employee.designation?.name,
      dutyStatus: employee.dutyStatus,
      currentAssignment,
      assignmentType,
      todayShift: activeShift?.shiftTemplate?.name || "Standard Shift",
      attendanceStatus: todaysAttendance ? (todaysAttendance.checkOut ? "COMPLETED" : "CHECKED_IN") : "NOT_CHECKED_IN",
      todaysAttendance
    });

  } catch (error) {
    console.error("GET /dashboard Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
