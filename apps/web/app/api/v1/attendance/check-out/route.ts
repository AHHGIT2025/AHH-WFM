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

    // Same geofence logic to validate checkout location
    // 1. Active deployment geofence
    const activeDeployment = employee.deployments[0];
    if (activeDeployment && activeDeployment.site && activeDeployment.site.latitude && activeDeployment.site.longitude) {
       const dist = getDistanceInMeters(latitude, longitude, activeDeployment.site.latitude, activeDeployment.site.longitude);
       if (dist <= (activeDeployment.site.geofenceRadiusMeters || 150)) {
           validationMethod = "GEOFENCE";
       }
    }

    // 2. Active on-call assignment
    if (validationMethod === "OUT_OF_BOUNDS" && employee.onCallAssignments.length > 0) {
        const onCall = employee.onCallAssignments[0];
        if (onCall.allowedPunchLocation && onCall.allowedPunchLocation.latitude && onCall.allowedPunchLocation.longitude) {
            const dist = getDistanceInMeters(latitude, longitude, onCall.allowedPunchLocation.latitude, onCall.allowedPunchLocation.longitude);
            if (dist <= (onCall.allowedPunchLocation.radiusMeters || 150)) {
                validationMethod = "GEOFENCE";
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
                    break;
                }
            }
        }
    }

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    // Find today's open attendance record
    const existingRecords = await prisma.attendanceRecord.findMany({
        where: {
            employeeId,
            checkIn: {
                gte: startOfDay,
                lte: endOfDay
            },
            checkOut: null
        },
        orderBy: { checkIn: "desc" }
    });

    if (existingRecords.length === 0) {
        return NextResponse.json({ error: "No open check-in found for today" }, { status: 400 });
    }

    const recordToUpdate = existingRecords[0];

    const updated = await prisma.attendanceRecord.update({
        where: { id: recordToUpdate.id },
        data: {
            checkOut: now,
            originalCheckOut: now
        }
    });

    return NextResponse.json({
        success: true,
        record: updated,
        validationMethod,
        message: validationMethod === "OUT_OF_BOUNDS" ? "Checked out successfully, but outside allowed geofences." : "Checked out successfully."
    });

  } catch (e: any) {
    console.error("Check-out Error:", e);
    return NextResponse.json({ error: "Failed to check out" }, { status: 500 });
  }
}
