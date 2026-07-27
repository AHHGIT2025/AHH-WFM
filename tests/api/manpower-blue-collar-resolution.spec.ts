import { resolveBlueCollarRosterRestDay, resolveEmployeeCalendarContext } from "../../apps/web/lib/manpower-work-calendar-engine";

describe("Phase MD-1: Blue Collar Roster-Managed Rest Day & Resolution Tests", () => {

  test("1. resolveBlueCollarRosterRestDay returns UNASSIGNED when no explicit roster record exists", async () => {
    const status = await resolveBlueCollarRosterRestDay({
      employeeId: "NON_EXISTENT_EMP_999",
      businessDate: new Date("2026-07-27")
    });

    expect(status).toBe("UNASSIGNED");
    expect(status).not.toBe("WEEKLY_REST"); // Never infers WEEKLY_REST from no assignment!
  });
});
