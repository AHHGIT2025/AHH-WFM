import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET() {
  return NextResponse.json({
    employees: mockDb.getEmployees(),
    attendance: mockDb.getAttendance(),
    shifts: mockDb.getShifts(),
    leaves: mockDb.getLeaves(),
    sapMappings: mockDb.getSapMappings(),
    syncLogs: mockDb.getSyncLogs(),
    announcements: mockDb.getAnnouncements()
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    switch (action) {
      case "updateEmployeeStatus":
        return NextResponse.json(mockDb.updateEmployeeStatus(payload.id, payload.status));
      case "checkIn":
        return NextResponse.json(mockDb.checkIn(
          payload.employeeId,
          payload.lat,
          payload.lng,
          payload.device,
          payload.locationName
        ));
      case "checkOut":
        return NextResponse.json(mockDb.checkOut(payload.employeeId));
      case "addShift":
        return NextResponse.json(mockDb.addShift(payload));
      case "applyLeave":
        return NextResponse.json(mockDb.applyLeave(
          payload.employeeId,
          payload.type,
          payload.dateRange,
          payload.reason
        ));
      case "updateLeaveStatus":
        return NextResponse.json(mockDb.updateLeaveStatus(payload.id, payload.status));
      case "updateSapMappingStatus":
        return NextResponse.json(mockDb.updateSapMappingStatus(payload.id, payload.status));
      case "addSyncLog":
        return NextResponse.json(mockDb.addSyncLog(payload));
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
