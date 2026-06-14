import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();

    const updateData: any = {};
    if (payload.defaultPunchLocationId !== undefined) updateData.defaultPunchLocationId = payload.defaultPunchLocationId || null;
    if (payload.allowMultiplePunchLocations !== undefined) updateData.allowMultiplePunchLocations = Boolean(payload.allowMultiplePunchLocations);
    if (payload.allowOfficePunch !== undefined) updateData.allowOfficePunch = Boolean(payload.allowOfficePunch);
    if (payload.allowProjectSitePunch !== undefined) updateData.allowProjectSitePunch = Boolean(payload.allowProjectSitePunch);
    if (payload.allowOnCallPunch !== undefined) updateData.allowOnCallPunch = Boolean(payload.allowOnCallPunch);
    if (payload.allowOutOfZonePunch !== undefined) updateData.allowOutOfZonePunch = Boolean(payload.allowOutOfZonePunch);
    if (payload.requireOutOfZoneReview !== undefined) updateData.requireOutOfZoneReview = Boolean(payload.requireOutOfZoneReview);
    if (payload.geofenceRadiusOverrideMeters !== undefined) {
      updateData.geofenceRadiusOverrideMeters = payload.geofenceRadiusOverrideMeters ? Number(payload.geofenceRadiusOverrideMeters) : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json(updatedEmployee);
  } catch (error: any) {
    console.error("Error updating employee punch policy:", error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update punch policy" }, { status: 500 });
  }
}
