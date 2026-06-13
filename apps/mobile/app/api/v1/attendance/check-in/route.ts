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
    const { latitude, longitude, device, locationType, locationId, radiusMeters, targetLat, targetLng } = body;

    if (!latitude || !longitude) {
      return NextResponse.json({ error: "GPS coordinates required" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: (session?.user as any)?.id },
      include: { company: true }
    });

    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const now = new Date();
    
    // Evaluate Geofence strictly
    const distance = getDistanceFromLatLonInMeters(latitude, longitude, targetLat, targetLng);
    const isWithinGeofence = distance <= (radiusMeters || 100);

    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId: employee.id,
        employeeName: employee.name,
        checkIn: now,
        originalCheckIn: now,
        lat: latitude,
        lng: longitude,
        status: isWithinGeofence ? "ON_TIME" : "OUT_OF_ZONE",
        device: device || "Mobile App",
        locationName: locationType || "Unknown",
        punchLocationType: locationType,
        companyId: employee.companyId || null,
        officeLocationId: locationType === "OFFICE" ? locationId : null,
        allowedPunchLocationId: locationType === "CUSTOM_ALLOWED" || locationType === "ON_CALL_CUSTOM" ? locationId : null,
        siteId: locationType === "DEPLOYMENT" || locationType === "ON_CALL_SITE" ? locationId : null,
        // Since we don't pass projectId yet, we'll let web/admin fix it or we can pass it from the allowed-punch payload
      }
    });

    return NextResponse.json({
      success: true,
      record,
      geofenceValid: isWithinGeofence,
      distanceMeters: Math.round(distance)
    });

  } catch (error) {
    console.error("POST /attendance/check-in Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
