import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET() {
  return NextResponse.json({
    employees: await mockDb.getEmployees(),
    attendance: await mockDb.getAttendance(),
    shifts: await mockDb.getShifts(),
    leaves: await mockDb.getLeaves(),
    sapMappings: await mockDb.getSapMappings(),
    syncLogs: await mockDb.getSyncLogs(),
    announcements: await mockDb.getAnnouncements()
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    switch (action) {
      case "updateEmployeeStatus":
        return NextResponse.json(await mockDb.updateEmployeeStatus(payload.id, payload.status));
      case "checkIn":
        return NextResponse.json(await mockDb.checkIn(
          payload.employeeId,
          payload.lat,
          payload.lng,
          payload.device,
          payload.locationName
        ));
      case "checkOut":
        return NextResponse.json(await mockDb.checkOut(payload.employeeId));
      case "addShift":
        return NextResponse.json(await mockDb.addShift(payload));
      case "applyLeave":
        return NextResponse.json(await mockDb.applyLeave(
          payload.employeeId,
          payload.type,
          payload.dateRange,
          payload.reason
        ));
      case "updateLeaveStatus":
        return NextResponse.json(await mockDb.updateLeaveStatus(payload.id, payload.status));
      case "updateSapMappingStatus":
        return NextResponse.json(await mockDb.updateSapMappingStatus(payload.id, payload.status));
      case "addSyncLog":
        return NextResponse.json(await mockDb.addSyncLog(payload));
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
