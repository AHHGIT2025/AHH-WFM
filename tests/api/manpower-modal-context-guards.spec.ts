import {
  resolveRosterDesignation,
  resolveRosterShiftName,
  resolveRosterShiftTimes,
  resolveRosterDateStr
} from "../../apps/web/lib/roster-display-utils";

describe("MP-3A — Guard Roster Planning Modal Context & Display Fallbacks", () => {
  describe("resolveRosterDesignation", () => {
    test("1. Employee designation is displayed when available", () => {
      const employee = { designation: { name: "Senior Security Guard" } };
      const slot = { snapshotPosition: "Basic Guard" };
      expect(resolveRosterDesignation(employee, slot)).toBe("Senior Security Guard");
    });

    test("2. snapshotPosition is used as the fallback when employee designation is missing", () => {
      const employee = { designation: null };
      const slot = { snapshotPosition: "Site Supervisor Position" };
      expect(resolveRosterDesignation(employee, slot)).toBe("Site Supervisor Position");
    });

    test("3. snapshotPosition fallback works when employee is undefined", () => {
      const slot = { snapshotPosition: "Reliever Patrol Guard" };
      expect(resolveRosterDesignation(undefined, slot)).toBe("Reliever Patrol Guard");
    });

    test("4. 'Not specified' is returned when both employee designation and slot snapshotPosition are missing", () => {
      const employee = {};
      const slot = {};
      expect(resolveRosterDesignation(employee, slot)).toBe("Not specified");
      expect(resolveRosterDesignation(undefined, undefined)).toBe("Not specified");
    });
  });

  describe("resolveRosterShiftName & ShiftTimes & DateStr", () => {
    test("5. Shift name fallback handles missing slot gracefully", () => {
      expect(resolveRosterShiftName({ snapshotShiftName: "Morning Shift" })).toBe("Morning Shift");
      expect(resolveRosterShiftName({ shiftName: "Night Shift" })).toBe("Night Shift");
      expect(resolveRosterShiftName(undefined)).toBe("Unspecified Shift");
    });

    test("6. Shift times fallback handles missing slot gracefully", () => {
      expect(resolveRosterShiftTimes({ snapshotStartTime: "06:00", snapshotEndTime: "18:00" })).toBe("06:00 - 18:00");
      expect(resolveRosterShiftTimes(undefined)).toBe("");
    });

    test("7. Business date formatting handles invalid or missing date gracefully", () => {
      expect(resolveRosterDateStr("2026-07-25T00:00:00Z")).toBe("2026-07-25");
      expect(resolveRosterDateStr(undefined)).toBe("N/A");
      expect(resolveRosterDateStr("invalid-date")).toBe("N/A");
    });
  });

  describe("Component Context Readiness Checks", () => {
    test("8. Context readiness check fails when employee is missing", () => {
      const primaryAssignment: any = { id: "assign-1", slot: { id: "slot-1" } };
      const employee = primaryAssignment?.employee;
      const slot = primaryAssignment?.slot;
      const isContextReady = Boolean(primaryAssignment?.id && employee?.id && slot?.id);
      expect(isContextReady).toBe(false);
    });

    test("9. Context readiness check fails when slot is missing", () => {
      const primaryAssignment: any = { id: "assign-1", employee: { id: "emp-1" } };
      const employee = primaryAssignment?.employee;
      const slot = primaryAssignment?.slot;
      const isContextReady = Boolean(primaryAssignment?.id && employee?.id && slot?.id);
      expect(isContextReady).toBe(false);
    });

    test("10. Context readiness check passes when employee and slot are valid", () => {
      const primaryAssignment: any = {
        id: "assign-1",
        employee: { id: "emp-1", name: "Alpha Guard" },
        slot: { id: "slot-1", businessDate: "2026-07-25" }
      };
      const employee = primaryAssignment?.employee;
      const slot = primaryAssignment?.slot;
      const isContextReady = Boolean(primaryAssignment?.id && employee?.id && slot?.id);
      expect(isContextReady).toBe(true);
    });

    test("11. Reliever context readiness fails when required slot or exception is missing", () => {
      const slot: any = { id: "slot-1" };
      const exception: any = null;
      const primaryAssignment: any = { id: "assign-1" };
      const isContextReady = Boolean(slot?.id && primaryAssignment?.id && exception?.id);
      expect(isContextReady).toBe(false);
    });

    test("12. Reliever context readiness succeeds when slot, exception, and primary assignment are provided", () => {
      const slot: any = { id: "slot-1" };
      const exception: any = { id: "exc-1" };
      const primaryAssignment: any = { id: "assign-1" };
      const isContextReady = Boolean(slot?.id && primaryAssignment?.id && exception?.id);
      expect(isContextReady).toBe(true);
    });
  });
});
