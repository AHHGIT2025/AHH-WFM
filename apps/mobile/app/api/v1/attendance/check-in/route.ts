import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { latitude, longitude, device } = body;

    if (!latitude || !longitude) {
      return NextResponse.json({ error: "GPS coordinates required" }, { status: 400 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const employee = await prisma.employee.findUnique({
      where: { id: (session?.user as any)?.id },
      include: { 
        company: true,
        officeLocation: true,
        defaultPunchLocation: true,
        allowedPunchLocations: { 
          where: { isActive: true },
          include: { allowedPunchLocation: true } 
        },
        deployments: { 
          where: { deploymentDate: { gte: todayStart, lte: todayEnd }, status: "ACTIVE" },
          include: { site: true }
        },
        onCallAssignments: {
          where: { assignmentDate: { gte: todayStart, lte: todayEnd }, status: "STANDBY" },
          include: { allowedPunchLocation: true, site: true }
        }
      }
    });

    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    // Collect all possible valid locations for this employee today
    type ValidLocation = { type: string, id: string | null, lat: number, lng: number, radius: number, priority: number, originalId: string | null };
    const validLocations: ValidLocation[] = [];

    // 1. Active Deployment Location
    for (const dep of employee.deployments) {
      if (dep.site?.latitude && dep.site?.longitude) {
        validLocations.push({
          type: "DEPLOYMENT",
          id: dep.siteId,
          lat: dep.site.latitude,
          lng: dep.site.longitude,
          radius: dep.site.geofenceRadiusMeters || 150,
          priority: 1,
          originalId: null
        });
      }
    }

    // 2. Active On-Call Location
    for (const oc of employee.onCallAssignments) {
      if (oc.allowedPunchLocation) {
        validLocations.push({
          type: "ON_CALL",
          id: oc.allowedPunchLocationId,
          lat: oc.allowedPunchLocation.latitude,
          lng: oc.allowedPunchLocation.longitude,
          radius: oc.allowedPunchLocation.radiusMeters || 150,
          priority: 2,
          originalId: oc.allowedPunchLocationId
        });
      } else if (oc.site?.latitude && oc.site?.longitude) {
        validLocations.push({
          type: "ON_CALL_SITE",
          id: oc.siteId,
          lat: oc.site.latitude,
          lng: oc.site.longitude,
          radius: oc.site.geofenceRadiusMeters || 150,
          priority: 2,
          originalId: null
        });
      }
    }

    // 3. Shift Assignment (Skip for now as it's typically tied to site)

    // 4. Employee Default Punch Location
    if (employee.defaultPunchLocation && employee.defaultPunchLocation.isActive) {
      validLocations.push({
        type: "DEFAULT_PUNCH",
        id: employee.defaultPunchLocation.id,
        lat: employee.defaultPunchLocation.latitude,
        lng: employee.defaultPunchLocation.longitude,
        radius: employee.geofenceRadiusOverrideMeters || employee.defaultPunchLocation.radiusMeters || 150,
        priority: 4,
        originalId: employee.defaultPunchLocation.id
      });
    }

    // 5. Employee Allowed Punch Locations
    if (employee.allowMultiplePunchLocations) {
      for (const al of employee.allowedPunchLocations) {
        if (al.allowedPunchLocation && al.allowedPunchLocation.isActive) {
          validLocations.push({
            type: "ALLOWED_PUNCH",
            id: al.allowedPunchLocationId,
            lat: al.allowedPunchLocation.latitude,
            lng: al.allowedPunchLocation.longitude,
            radius: employee.geofenceRadiusOverrideMeters || al.allowedPunchLocation.radiusMeters || 150,
            priority: 5 + (al.priority * 0.1), // lower priority number means higher priority. Keep it relative to 5.
            originalId: al.allowedPunchLocationId
          });
        }
      }
    }

    // 6. Office Location
    if (employee.allowOfficePunch && employee.officeLocation && employee.officeLocation.latitude && employee.officeLocation.longitude) {
      validLocations.push({
        type: "OFFICE",
        id: employee.officeLocation.id,
        lat: employee.officeLocation.latitude,
        lng: employee.officeLocation.longitude,
        radius: employee.geofenceRadiusOverrideMeters || 150,
        priority: 6,
        originalId: null
      });
    }

    // Sort by priority (1 is highest)
    validLocations.sort((a, b) => a.priority - b.priority);

    // Evaluate matching locations
    let matchedLocation: ValidLocation | null = null;
    let minDistance = Infinity;

    for (const loc of validLocations) {
      const distance = getDistanceFromLatLonInMeters(latitude, longitude, loc.lat, loc.lng);
      if (distance <= loc.radius) {
        if (!matchedLocation || loc.priority < matchedLocation.priority) {
          matchedLocation = loc;
          minDistance = distance;
        } else if (matchedLocation && loc.priority === matchedLocation.priority) {
           // Break ties by distance
           if (distance < minDistance) {
              matchedLocation = loc;
              minDistance = distance;
           }
        }
      }
    }

    let isWithinGeofence = !!matchedLocation;
    let finalStatus = "ON_TIME";
    
    if (!isWithinGeofence) {
      // Out of zone fallback evaluation
      if (employee.allowOutOfZonePunch) {
        finalStatus = employee.requireOutOfZoneReview ? "OUT_OF_ZONE_REVIEW_REQUIRED" : "OUT_OF_ZONE";
      } else {
        // Evaluate company fallback
        // Assume company allows it but flags it OUT_OF_ZONE
        finalStatus = "OUT_OF_ZONE";
      }
    }

    const now = new Date();
    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId: employee.id,
        employeeName: employee.name,
        checkIn: now,
        originalCheckIn: now,
        lat: latitude,
        lng: longitude,
        status: finalStatus,
        device: device || "Mobile App",
        locationName: matchedLocation ? matchedLocation.type : "Unknown",
        punchLocationType: matchedLocation ? matchedLocation.type : "UNKNOWN",
        companyId: employee.companyId || null,
        officeLocationId: matchedLocation?.type === "OFFICE" ? matchedLocation.id : null,
        allowedPunchLocationId: matchedLocation ? matchedLocation.originalId : null,
        siteId: matchedLocation?.type === "DEPLOYMENT" || matchedLocation?.type === "ON_CALL_SITE" ? matchedLocation.id : null,
      }
    });

    return NextResponse.json({
      success: true,
      record,
      geofenceValid: isWithinGeofence,
      distanceMeters: minDistance !== Infinity ? Math.round(minDistance) : null,
      matchedLocationType: matchedLocation?.type || null
    });

  } catch (error) {
    console.error("POST /attendance/check-in Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
