import { validateSeasonalRuleScopeAndTimeWindow } from "../../apps/web/lib/master-data-validator";

describe("Phase MD-1: Ramadan Overlay & Seasonal Work Rule Validation Tests", () => {

  test("1. validateSeasonalRuleScopeAndTimeWindow accepts valid summer working hours rule", () => {
    expect(() => {
      validateSeasonalRuleScopeAndTimeWindow({
        ruleScope: "COMPANY_WIDE",
        companyId: "COMP_1",
        morningStartMinutes: 360,          // 06:00
        morningEndMinutes: 600,            // 10:00
        mandatoryBreakStartMinutes: 600,   // 10:00
        mandatoryBreakEndMinutes: 930,     // 15:30
        eveningStartMinutes: 930,          // 15:30
        eveningEndMinutes: 1140,           // 19:00
        allowedDailyMinutes: 300           // 5 hours
      });
    }).not.toThrow();
  });

  test("2. validateSeasonalRuleScopeAndTimeWindow rejects invalid break window overlap", () => {
    expect(() => {
      validateSeasonalRuleScopeAndTimeWindow({
        ruleScope: "COMPANY_WIDE",
        companyId: "COMP_1",
        morningStartMinutes: 360,
        morningEndMinutes: 660,            // 11:00 (overlaps with break start at 10:00)
        mandatoryBreakStartMinutes: 600,   // 10:00
        mandatoryBreakEndMinutes: 930,
        allowedDailyMinutes: 300
      });
    }).toThrow("TIME_WINDOW_INVALID");
  });
});
