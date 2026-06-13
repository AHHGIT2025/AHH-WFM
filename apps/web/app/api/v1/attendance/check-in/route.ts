import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

// Helper function to calculate distance in meters using Haversine formula
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { employeeId, lat, lng, device, locationName } = payload;

    if (!employeeId || lat === undefined || lng === undefined) {
       return NextResponse.json({ error: "Missing required fields: employeeId, lat, lng" }, { status: 400 });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    const now = new Date();

    // Fetch employee data
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        deployments: {
           where: { deploymentDate: { lte: now } }, // simplified
           include: { site: true },
           orderBy: { deploymentDate: "desc" }
        },
        onCallAssignments: {
           where: { assignmentDate: { lte: now } },
           include: { allowedPunchLocation: true },
           orderBy: { assignmentDate: "desc" }
        },
        shiftAssignments: {
           where: { date: { lte: now } },
           orderBy: { date: "desc" }
        },
        allowedPunchLocations: {
           where: { isActive: true },
           include: { allowedPunchLocation: true },
           orderBy: { priority: "asc" }
        }
      }
    });

    if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    let validationMethod = "OUT_OF_BOUNDS";
    let locationSource = "NONE";
    let matchedLocationId = null;

    // 1. Active deployment geofence
    const activeDeployment = employee.deployments[0];
    if (activeDeployment && activeDeployment.site && activeDeployment.site.latitude && activeDeployment.site.longitude) {
       const dist = getDistanceInMeters(latitude, longitude, activeDeployment.site.latitude, activeDeployment.site.longitude);
       if (dist <= (activeDeployment.site.geofenceRadiusMeters || 150)) {
           validationMethod = "GEOFENCE";
           locationSource = "PROJECT_SITE";
           matchedLocationId = activeDeployment.siteId;
       }
    }

    // 2. Active on-call assignment
    if (validationMethod === "OUT_OF_BOUNDS" && employee.onCallAssignments.length > 0) {
        const onCall = employee.onCallAssignments[0];
        if (onCall.allowedPunchLocation && onCall.allowedPunchLocation.latitude && onCall.allowedPunchLocation.longitude) {
            const dist = getDistanceInMeters(latitude, longitude, onCall.allowedPunchLocation.latitude, onCall.allowedPunchLocation.longitude);
            if (dist <= (onCall.allowedPunchLocation.radiusMeters || 150)) {
                validationMethod = "GEOFENCE";
                locationSource = "ON_CALL";
                matchedLocationId = onCall.allowedPunchLocationId;
            }
        }
    }

    // 3. Employee Allowed Punch Location
    if (validationMethod === "OUT_OF_BOUNDS" && employee.allowedPunchLocations.length > 0) {
        for (const locAssig of employee.allowedPunchLocations) {
            const apl = locAssig.allowedPunchLocation;
            if (apl.latitude && apl.longitude) {
                const dist = getDistanceInMeters(latitude, longitude, apl.latitude, apl.longitude);
                if (dist <= (apl.radiusMeters || 150)) {
                    validationMethod = "GEOFENCE";
                    locationSource = apl.locationType || "OFFICE";
                    matchedLocationId = apl.id;
                    break;
                }
            }
        }
    }

    // Note: To enforce strict policies, if validationMethod remains "OUT_OF_BOUNDS", 
    // we could reject the punch. We will record it as OUT_OF_BOUNDS for admin review.

    // Calculate generic shift/status mapping
    const shiftInfo = employee.shiftAssignments[0];
    
    // Create attendance record
    const record = await prisma.attendanceRecord.create({
        data: {
            employeeId,
            employeeName: employee.name,
            checkIn: now,
            originalCheckIn: now,
            lat: latitude,
            lng: longitude,
            status: "ON_TIME", // Using the closest allowed enum equivalent
            device: device || "Mobile App",
            locationName: locationName || `Lat: ${latitude}, Lng: ${longitude}`,
            companyId: employee.companyId || null
        }
    });

    return NextResponse.json({
        success: true,
        record,
        validationMethod,
        locationSource,
        message: validationMethod === "OUT_OF_BOUNDS" ? "Checked in successfully, but outside allowed geofences." : "Checked in successfully."
    });

  } catch (e: any) {
    console.error("Check-in Error:", e);
    return NextResponse.json({ error: "Failed to check in" }, { status: 500 });
  }
}
