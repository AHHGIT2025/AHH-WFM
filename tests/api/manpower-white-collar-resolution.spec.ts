import { resolveApplicableWorkCalendarProfile, resolveEmployeeCalendarContext } from "../../apps/web/lib/manpower-work-calendar-engine";
import { prisma } from "@ahh-wfm/database";

describe("Phase MD-1: White Collar Resolution Engine & Precedence Tests", () => {
  let holdingCompanyId: string;

  beforeAll(async () => {
    const holding = await prisma.company.findFirst({ where: { isHoldingCompany: true, isActive: true } });
    holdingCompanyId = holding?.id || "";
  });

  test("1. White Collar falls back to Group-wide Holding profile when no company override exists", async () => {
    const context = await resolveEmployeeCalendarContext({
      workerClass: "WHITE_COLLAR",
      companyId: holdingCompanyId,
      date: new Date("2026-07-27")
    });

    expect(context.profile).toBeDefined();
    if (context.profile) {
      expect(context.profile.workerClass).toBe("WHITE_COLLAR");
      expect(context.profile.weeklyRestSource).toBe("PROFILE_FIXED_DAYS");
    }
  });
});
