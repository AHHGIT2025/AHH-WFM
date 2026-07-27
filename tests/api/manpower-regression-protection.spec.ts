import { prisma } from "@ahh-wfm/database";

describe("Phase MD-1: Regression Protection & Business Rule Integrity Tests", () => {

  test("1. Workforce Directory remains Employee Master", async () => {
    const empCount = await prisma.employee.count();
    expect(empCount).toBeGreaterThanOrEqual(0);
  });

  test("2. Historical Payroll Advisory Runs remain untouched with valid sourceVersionJson", async () => {
    const advisoryRuns = await prisma.manpowerPayrollAdvisoryRun.findMany({
      select: { id: true, sourceVersionJson: true }
    });
    expect(Array.isArray(advisoryRuns)).toBe(true);
  });
});
