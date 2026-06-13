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

    const employee = await prisma.employee.findUnique({
      where: { id: (session?.user as any)?.id },
      include: {
        officeLocation: true,
        allowedPunchLocations: {
          include: { allowedPunchLocation: true },
          where: { isActive: true }
        }
      }
    });

    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    // 1. Check Active Deployment
    const activeDeployment = await prisma.employeeDeployment.findFirst({
      where: { employeeId: employee.id, deploymentDate: todayStr, status: { in: ["PLANNED", "ACTIVE"] } },
      include: { project: true, site: true }
    });

    if (activeDeployment && activeDeployment.site?.latitude && activeDeployment.site?.longitude) {
      return NextResponse.json({
        type: "DEPLOYMENT",
        name: activeDeployment.site.siteName,
        lat: activeDeployment.site.latitude,
        lng: activeDeployment.site.longitude,
        radiusMeters: activeDeployment.site.geofenceRadiusMeters || 100,
        projectId: activeDeployment.projectId,
        siteId: activeDeployment.siteId,
        deploymentId: activeDeployment.id
      });
    }

    // 2. Check On-Call Assignment
    const activeOnCall = await prisma.onCallAssignment.findFirst({
      where: { employeeId: employee.id, assignmentDate: todayStr, status: "ACTIVE" },
      include: { site: true, allowedPunchLocation: true }
    });

    if (activeOnCall) {
      if (activeOnCall.site?.latitude) {
        return NextResponse.json({
          type: "ON_CALL_SITE",
          name: activeOnCall.site.siteName,
          lat: activeOnCall.site.latitude,
          lng: activeOnCall.site.longitude,
          radiusMeters: activeOnCall.site.geofenceRadiusMeters || 100,
          projectId: activeOnCall.projectId,
          siteId: activeOnCall.siteId,
          onCallAssignmentId: activeOnCall.id
        });
      } else if (activeOnCall.allowedPunchLocation?.latitude) {
        return NextResponse.json({
          type: "ON_CALL_CUSTOM",
          name: activeOnCall.allowedPunchLocation.name,
          lat: activeOnCall.allowedPunchLocation.latitude,
          lng: activeOnCall.allowedPunchLocation.longitude,
          radiusMeters: activeOnCall.allowedPunchLocation.radiusMeters || 100,
          allowedPunchLocationId: activeOnCall.allowedPunchLocationId,
          onCallAssignmentId: activeOnCall.id
        });
      }
    }

    // 3. Employee Specific Allowed Locations
    if (employee.allowedPunchLocations.length > 0) {
      const defaultAllowed = employee.allowedPunchLocations.find(l => l.isDefault) || employee.allowedPunchLocations[0];
      const loc = defaultAllowed.allowedPunchLocation;
      if (loc && loc.latitude) {
        return NextResponse.json({
          type: "CUSTOM_ALLOWED",
          name: loc.name,
          lat: loc.latitude,
          lng: loc.longitude,
          radiusMeters: loc.radiusMeters || 100,
          allowedPunchLocationId: loc.id
        });
      }
    }

    // 4. Default Office Location
    if (employee.officeLocation && employee.officeLocation.latitude && employee.officeLocation.longitude) {
      return NextResponse.json({
        type: "OFFICE",
        name: employee.officeLocation.locationName,
        lat: employee.officeLocation.latitude,
        lng: employee.officeLocation.longitude,
        radiusMeters: employee.officeLocation.defaultGeofenceRadiusMeters || 100,
        officeLocationId: employee.officeLocation.id
      });
    }

    return NextResponse.json({ type: "NONE_CONFIGURED", radiusMeters: 0 });

  } catch (error) {
    console.error("GET /allowed-punch-locations Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
