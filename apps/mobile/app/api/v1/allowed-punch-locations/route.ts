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
        defaultLocation: true,
        allowedPunchLocations: {
          include: { allowedPunchLocation: true },
          where: { isActive: true }
        }
      }
    });

    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const isSecurityGuard = employee.employeeCategory === "BLUE_COLLAR" && employee.operationType === "SECURITY_GUARDING";
    const isFMBlueCollar = employee.employeeCategory === "BLUE_COLLAR" && employee.operationType === "FACILITY_MANAGEMENT";
    const isWhiteCollar = employee.employeeCategory === "WHITE_COLLAR";

    // 1. Check Security Guarding active deployment assignment
    if (isSecurityGuard) {
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
        if (site.lat !== null && site.lng !== null && site.lat !== undefined && site.lng !== undefined) {
          return NextResponse.json({
            geofenceConfigured: true,
            dutySource: "SHIFT_PLANNER",
            type: "SECURITY_GUARDING_SITE",
            assignmentId: activeAssignment.id,
            deploymentId: activeAssignment.id, // compatibility
            projectId: site.projectId,
            projectName: site.project?.name || "Security Project",
            siteId: site.id,
            siteName: site.name,
            locationName: site.name,
            name: site.name, // compatibility
            lat: site.lat,
            lng: site.lng,
            radiusMeters: site.radiusMeters || 100
          });
        } else {
          return NextResponse.json({
            geofenceConfigured: false,
            dutySource: "SHIFT_PLANNER",
            reason: "SITE_GEOFENCE_NOT_CONFIGURED",
            siteName: site.name,
            siteId: site.id,
            name: site.name, // compatibility
            locationName: "Not Configured"
          });
        }
      } else {
        return NextResponse.json({
          geofenceConfigured: false,
          dutySource: "SHIFT_PLANNER",
          reason: "NO_ACTIVE_ASSIGNMENT",
          name: "Not Configured",
          locationName: "Not Configured"
        });
      }
    }

    // 2. Check Facility Management / general Blue Collar active deployment
    if (isFMBlueCollar) {
      const activeDeployment = await prisma.employeeDeployment.findFirst({
        where: { employeeId: employee.id, deploymentDate: today, status: { in: ["PLANNED", "ACTIVE"] } },
        include: { project: true, site: true }
      });

      if (activeDeployment && activeDeployment.site?.latitude && activeDeployment.site?.longitude) {
        return NextResponse.json({
          geofenceConfigured: true,
          dutySource: "DEPLOYMENT",
          type: "DEPLOYMENT",
          name: activeDeployment.site.siteName,
          locationName: activeDeployment.site.siteName,
          lat: activeDeployment.site.latitude,
          lng: activeDeployment.site.longitude,
          radiusMeters: activeDeployment.site.geofenceRadiusMeters || 100,
          projectId: activeDeployment.projectId,
          siteId: activeDeployment.siteId,
          deploymentId: activeDeployment.id
        });
      }
    }

    // 3. Check On-Call Assignment
    if (!isSecurityGuard) {
      const activeOnCall = await prisma.onCallAssignment.findFirst({
        where: { employeeId: employee.id, assignmentDate: today, status: "ACTIVE" },
        include: { site: true, allowedPunchLocation: true }
      });

      if (activeOnCall) {
        if (activeOnCall.site?.latitude) {
          return NextResponse.json({
            geofenceConfigured: true,
            dutySource: "ON_CALL_SITE",
            type: "ON_CALL_SITE",
            name: activeOnCall.site.siteName,
            locationName: activeOnCall.site.siteName,
            lat: activeOnCall.site.latitude,
            lng: activeOnCall.site.longitude,
            radiusMeters: activeOnCall.site.geofenceRadiusMeters || 100,
            projectId: activeOnCall.projectId,
            siteId: activeOnCall.siteId,
            onCallAssignmentId: activeOnCall.id
          });
        } else if (activeOnCall.allowedPunchLocation?.latitude) {
          return NextResponse.json({
            geofenceConfigured: true,
            dutySource: "ON_CALL_CUSTOM",
            type: "ON_CALL_CUSTOM",
            name: activeOnCall.allowedPunchLocation.name,
            locationName: activeOnCall.allowedPunchLocation.name,
            lat: activeOnCall.allowedPunchLocation.latitude,
            lng: activeOnCall.allowedPunchLocation.longitude,
            radiusMeters: activeOnCall.allowedPunchLocation.radiusMeters || 100,
            allowedPunchLocationId: activeOnCall.allowedPunchLocationId,
            onCallAssignmentId: activeOnCall.id
          });
        }
      }
    }

    // 4. White Collar current duty: defaultLocation or officeLocation
    if (isWhiteCollar) {
      const loc = employee.defaultLocation;
      if (loc && loc.latitude !== null && loc.longitude !== null && loc.latitude !== undefined && loc.longitude !== undefined) {
        return NextResponse.json({
          geofenceConfigured: true,
          dutySource: "EMPLOYEE_DEFAULT_LOCATION",
          type: "EMPLOYEE_DEFAULT_LOCATION",
          defaultLocation: loc.locationName,
          locationName: loc.locationName,
          name: loc.locationName, // compatibility
          lat: loc.latitude,
          lng: loc.longitude,
          radiusMeters: loc.defaultGeofenceRadiusMeters || 100,
          officeLocationId: loc.id
        });
      } else {
        return NextResponse.json({
          geofenceConfigured: false,
          dutySource: "EMPLOYEE_DEFAULT_LOCATION",
          reason: "EMPLOYEE_DEFAULT_LOCATION_GEOFENCE_NOT_CONFIGURED",
          name: "Not Configured",
          locationName: "Not Configured"
        });
      }
    }

    // 5. Custom Allowed Locations (Fallback)
    if (employee.allowedPunchLocations.length > 0) {
      const defaultAllowed = employee.allowedPunchLocations.find(l => l.isDefault) || employee.allowedPunchLocations[0];
      const loc = defaultAllowed.allowedPunchLocation;
      if (loc && loc.latitude) {
        return NextResponse.json({
          geofenceConfigured: true,
          dutySource: "CUSTOM_ALLOWED",
          type: "CUSTOM_ALLOWED",
          name: loc.name,
          locationName: loc.name,
          lat: loc.latitude,
          lng: loc.longitude,
          radiusMeters: loc.radiusMeters || 100,
          allowedPunchLocationId: loc.id
        });
      }
    }

    // 6. Default Office Location (Fallback)
    if (employee.officeLocation && employee.officeLocation.latitude && employee.officeLocation.longitude) {
      return NextResponse.json({
        geofenceConfigured: true,
        dutySource: "OFFICE",
        type: "OFFICE",
        name: employee.officeLocation.locationName,
        locationName: employee.officeLocation.locationName,
        lat: employee.officeLocation.latitude,
        lng: employee.officeLocation.longitude,
        radiusMeters: employee.officeLocation.defaultGeofenceRadiusMeters || 100,
        officeLocationId: employee.officeLocation.id
      });
    }

    return NextResponse.json({
      geofenceConfigured: false,
      dutySource: "EMPLOYEE_DEFAULT_LOCATION",
      reason: "EMPLOYEE_DEFAULT_LOCATION_GEOFENCE_NOT_CONFIGURED",
      name: "Not Configured",
      locationName: "Not Configured"
    });

  } catch (error) {
    console.error("GET /allowed-punch-locations Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
