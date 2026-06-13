import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { action } = payload;

    if (!action) {
      return NextResponse.json({ error: "Missing action type" }, { status: 400 });
    }

    let result: any = null;
    const actionKey = action.toUpperCase();

    const { employeeId, date } = payload;

    if (actionKey === "ASSIGN_SHIFT" || actionKey === "ASSIGN SHIFT") {
      const { shiftTemplateId } = payload;
      if (!shiftTemplateId || !employeeId || !date) {
        return NextResponse.json({ error: "employeeId, date, and shiftTemplateId are required for assign shift" }, { status: 400 });
      }
      result = await mockDb.createShiftAssignment(employeeId, shiftTemplateId, date);
    } else if (
      actionKey === "MARK_LEAVE" || actionKey === "MARK LEAVE" ||
      actionKey === "MARK_VACATION" || actionKey === "MARK VACATION" ||
      actionKey === "MARK_OFF" || actionKey === "MARK OFF"
    ) {
      let leaveType = "Sick Leave";
      if (actionKey.includes("VACATION")) {
        leaveType = "Annual Leave";
      } else if (actionKey.includes("OFF")) {
        leaveType = "Unpaid Leave";
      } else if (payload.leaveType) {
        leaveType = payload.leaveType;
      }
      const reason = payload.reason || `Marked as ${action} via cell-action`;
      const dateRange = `${date} to ${date}`;
      const leaveRequest = await mockDb.applyLeave(employeeId, leaveType, dateRange, reason);
      result = await mockDb.updateLeaveStatus(leaveRequest.id, "Approved");
    } else if (actionKey === "SPLIT_SHIFT" || actionKey === "SPLIT SHIFTS") {
      const { shiftTemplateId } = payload;
      if (!shiftTemplateId) {
        return NextResponse.json({ error: "shiftTemplateId is required for split shifts" }, { status: 400 });
      }
      const assignmentRes = await mockDb.createShiftAssignment(employeeId, shiftTemplateId, date);
      if (assignmentRes.success && assignmentRes.assignment) {
        const assignments = await mockDb.getShiftAssignments();
        const found = assignments.find(a => a.id === assignmentRes.assignment?.id);
        if (found) {
          found.isSplitShift = true;
        }
        result = { ...assignmentRes.assignment, isSplitShift: true };
      } else {
        result = assignmentRes;
      }
    } else if (actionKey === "ASSIGN_PROJECT_SITE" || actionKey === "ASSIGN PROJECT/SITE") {
      const { projectId, siteId, startTime, endTime, positionCategoryId } = payload;
      if (!projectId || !siteId) {
        return NextResponse.json({ error: "projectId and siteId are required" }, { status: 400 });
      }
      result = await mockDb.createDeployment({
        employeeId,
        projectId,
        siteId,
        deploymentDate: date,
        startTime: startTime || "08:00",
        endTime: endTime || "17:00",
        positionCategoryId: positionCategoryId || "cat-1",
        status: "PLANNED",
        createdById: (auth.session?.user as any)?.id || "system"
      });
    } else if (actionKey === "LINK_RELIEVER" || actionKey === "LINK RELIEVER") {
      const { relieverEmployeeId, startTime, endTime, projectId, siteId, reason } = payload;
      if (!relieverEmployeeId) {
        return NextResponse.json({ error: "relieverEmployeeId is required" }, { status: 400 });
      }
      result = await mockDb.createShiftRelieverAssignment({
        originalEmployeeId: employeeId,
        relieverEmployeeId,
        date,
        startTime: startTime || "08:00",
        endTime: endTime || "17:00",
        projectId,
        siteId,
        reason: reason || "Reliever linked via cell-action",
        status: "PLANNED",
        createdById: (auth.session?.user as any)?.id || "system"
      });
    } else if (actionKey === "ASSIGN_ON_CALL" || actionKey === "ASSIGN ON CALL") {
      const { startTime, endTime, projectId, siteId } = payload;
      
      const { prisma } = require("@ahh-wfm/database");
      result = await prisma.onCallAssignment.create({
        data: {
          employeeId,
          companyId: "AHH-WFM", // Default for now
          assignmentDate: new Date(date),
          startTime: startTime || "08:00",
          endTime: endTime || "17:00",
          projectId,
          siteId,
          status: "ASSIGNED",
          createdById: (auth.session?.user as any)?.id || "system"
        }
      });
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to execute cell action" }, { status: 500 });
  }
}
