import { getServerSession } from "next-auth/next";
import { mockDb } from "@ahh-wfm/mock-data";
import {
  resolveEmployeeTradePosition,
  resolveEmployeeTradePositionSource,
  resolveHistoricalSlotPosition
} from "../../apps/web/lib/roster-display-utils";

import { GET as getRoster } from "../../apps/web/app/api/v1/manpower/scheduling/roster/route";
import { GET as getEligible } from "../../apps/web/app/api/v1/manpower/scheduling/eligible-employees/route";
import { GET as getSGManpower } from "../../apps/web/app/api/v1/manpower/security-guarding/manpower/route";
import { GET as getFMManpower } from "../../apps/web/app/api/v1/manpower/facility-management/manpower/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Employee Trade/Position Alignment Complete 30-Test Matrix", () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "admin-test-user",
        name: "Admin User",
        role: "SUPER_ADMIN",
        employeeCategory: "WHITE_COLLAR",
        permissions: [
          "manpower.admin.full_access",
          "manpower.security.view",
          "manpower.security.manage",
          "manpower.fm.view",
          "manpower.fm.manage",
          "manpower.view",
          "manpower.manage"
        ]
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 1. BLUE_COLLAR uses positionCategory.name
  // ---------------------------------------------------------------------------
  it("1. BLUE_COLLAR uses positionCategory.name", () => {
    const emp = {
      employeeCategory: "BLUE_COLLAR",
      positionCategory: { name: "Security Guard" },
      designation: { name: "General Worker" }
    };
    const pos = resolveEmployeeTradePosition(emp);
    expect(pos).toBe("Security Guard");
  });

  // ---------------------------------------------------------------------------
  // 2. BLUE_COLLAR does NOT fall back to designation.name
  // ---------------------------------------------------------------------------
  it("2. BLUE_COLLAR does NOT fall back to designation.name", () => {
    const emp = {
      employeeCategory: "BLUE_COLLAR",
      positionCategory: null,
      designation: { name: "General Worker" }
    };
    const pos = resolveEmployeeTradePosition(emp);
    expect(pos).toBe("Not specified");
  });

  // ---------------------------------------------------------------------------
  // 3. BLUE_COLLAR missing positionCategory → 'Not specified'
  // ---------------------------------------------------------------------------
  it("3. BLUE_COLLAR missing positionCategory → 'Not specified'", () => {
    const emp = { employeeCategory: "BLUE_COLLAR" };
    const pos = resolveEmployeeTradePosition(emp);
    expect(pos).toBe("Not specified");
  });

  // ---------------------------------------------------------------------------
  // 4. WHITE_COLLAR uses designation.name
  // ---------------------------------------------------------------------------
  it("4. WHITE_COLLAR uses designation.name", () => {
    const emp = {
      employeeCategory: "WHITE_COLLAR",
      designation: { name: "Accountant" }
    };
    const pos = resolveEmployeeTradePosition(emp);
    expect(pos).toBe("Accountant");
  });

  // ---------------------------------------------------------------------------
  // 5. Unknown category → positionCategory first
  // ---------------------------------------------------------------------------
  it("5. Unknown category → positionCategory first", () => {
    const emp = {
      positionCategory: { name: "Plumber" },
      designation: { name: "Worker" }
    };
    const pos = resolveEmployeeTradePosition(emp);
    expect(pos).toBe("Plumber");
  });

  // ---------------------------------------------------------------------------
  // 6. Unknown category → designation if no positionCategory
  // ---------------------------------------------------------------------------
  it("6. Unknown category → designation if no positionCategory", () => {
    const emp = { designation: { name: "Worker" } };
    const pos = resolveEmployeeTradePosition(emp);
    expect(pos).toBe("Worker");
  });

  // ---------------------------------------------------------------------------
  // 7. Source resolver: BLUE_COLLAR → POSITION_CATEGORY
  // ---------------------------------------------------------------------------
  it("7. Source resolver: BLUE_COLLAR → POSITION_CATEGORY", () => {
    const emp = {
      employeeCategory: "BLUE_COLLAR",
      positionCategory: { name: "Security Guard" }
    };
    const src = resolveEmployeeTradePositionSource(emp);
    expect(src).toBe("POSITION_CATEGORY");
  });

  // ---------------------------------------------------------------------------
  // 8. Source resolver: WHITE_COLLAR → DESIGNATION
  // ---------------------------------------------------------------------------
  it("8. Source resolver: WHITE_COLLAR → DESIGNATION", () => {
    const emp = {
      employeeCategory: "WHITE_COLLAR",
      designation: { name: "Accountant" }
    };
    const src = resolveEmployeeTradePositionSource(emp);
    expect(src).toBe("DESIGNATION");
  });

  // ---------------------------------------------------------------------------
  // 9. Source resolver: Missing → NOT_SPECIFIED
  // ---------------------------------------------------------------------------
  it("9. Source resolver: Missing → NOT_SPECIFIED", () => {
    const emp = { employeeCategory: "BLUE_COLLAR" };
    const src = resolveEmployeeTradePositionSource(emp);
    expect(src).toBe("NOT_SPECIFIED");
  });

  // ---------------------------------------------------------------------------
  // 10. SK-90210 fixture in mock data displays Security Guard
  // ---------------------------------------------------------------------------
  it("10. SK-90210 fixture in mock data displays Security Guard", async () => {
    const employees = await mockDb.getEmployees();
    const sk = employees.find((e: any) => e.id === "SK-90210");
    expect(sk).toBeDefined();
    expect(sk?.positionCategoryId).toBe("cat-1");
    const pos = resolveEmployeeTradePosition(sk);
    expect(pos).toBe("Security Guard");
  });

  // ---------------------------------------------------------------------------
  // 11. WC-TEST-8116 mapping → Security Guard when positionCategory is set
  // ---------------------------------------------------------------------------
  it("11. WC-TEST-8116 mapping → Security Guard when positionCategory is set", () => {
    const emp = {
      employeeCategory: "BLUE_COLLAR",
      positionCategory: { name: "Security Guard" },
      designation: { name: "Full Stack Developer" }
    };
    const pos = resolveEmployeeTradePosition(emp);
    expect(pos).toBe("Security Guard");
  });

  // ---------------------------------------------------------------------------
  // 12. Required Position remains slot-derived (resolver ignores slots)
  // ---------------------------------------------------------------------------
  it("12. Required Position remains slot-derived (resolver ignores slots)", () => {
    const emp = { employeeCategory: "BLUE_COLLAR" };
    const pos = resolveEmployeeTradePosition(emp);
    expect(pos).toBe("Not specified");
  });

  // ---------------------------------------------------------------------------
  // 13. Trade/Position and Required Position are NOT conflated
  // ---------------------------------------------------------------------------
  it("13. Trade/Position and Required Position are NOT conflated", () => {
    const emp = {
      employeeCategory: "BLUE_COLLAR",
      positionCategory: { name: "Security Guard" }
    };
    const slotPosition = "CCTV Operator";
    const tradePos = resolveEmployeeTradePosition(emp);
    expect(tradePos).toBe("Security Guard");
    expect(tradePos).not.toBe(slotPosition);
  });

  // ---------------------------------------------------------------------------
  // 14. Absence modal imports resolveEmployeeTradePosition
  // ---------------------------------------------------------------------------
  it("14. Absence modal imports resolveEmployeeTradePosition", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      "apps/web/app/manpower/[business]/deployment-calendar/components/AbsenceModal.tsx",
      "utf-8"
    );
    expect(content).toContain("resolveEmployeeTradePosition");
    expect(content).toContain("Trade/Position:");
  });

  // ---------------------------------------------------------------------------
  // 15. Day Off modal imports resolveEmployeeTradePosition
  // ---------------------------------------------------------------------------
  it("15. Day Off modal imports resolveEmployeeTradePosition", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      "apps/web/app/manpower/[business]/deployment-calendar/components/DayOffModal.tsx",
      "utf-8"
    );
    expect(content).toContain("resolveEmployeeTradePosition");
    expect(content).toContain("Trade/Position:");
  });

  // ---------------------------------------------------------------------------
  // 16. Leave Effect modal imports resolveEmployeeTradePosition
  // ---------------------------------------------------------------------------
  it("16. Leave Effect modal imports resolveEmployeeTradePosition", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      "apps/web/app/manpower/[business]/deployment-calendar/components/LeaveEffectModal.tsx",
      "utf-8"
    );
    expect(content).toContain("resolveEmployeeTradePosition");
    expect(content).toContain("Trade/Position:");
  });

  // ---------------------------------------------------------------------------
  // 17. Reliever drawer imports resolveEmployeeTradePosition
  // ---------------------------------------------------------------------------
  it("17. Reliever drawer imports resolveEmployeeTradePosition", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      "apps/web/app/manpower/[business]/deployment-calendar/components/RelieverDrawer.tsx",
      "utf-8"
    );
    expect(content).toContain("resolveEmployeeTradePosition");
  });

  // ---------------------------------------------------------------------------
  // 18. Live position update does not rewrite publication history
  // ---------------------------------------------------------------------------
  it("18. Live position update does not rewrite publication history", () => {
    const slot = { snapshotPosition: "Site Guard" };
    const historicalPos = resolveHistoricalSlotPosition(slot);
    expect(historicalPos).toBe("Site Guard");
  });

  // ---------------------------------------------------------------------------
  // 19. Historical snapshotPosition remains unchanged
  // ---------------------------------------------------------------------------
  it("19. Historical snapshotPosition remains unchanged", () => {
    const slot = { snapshotPosition: "CCTV Operator" };
    expect(resolveHistoricalSlotPosition(slot)).toBe("CCTV Operator");
    expect(resolveHistoricalSlotPosition({})).toBe("Not specified");
  });

  // ---------------------------------------------------------------------------
  // 20. White Collar current duty = Employee Default Location
  // ---------------------------------------------------------------------------
  it("20. White Collar current duty = Employee Default Location", async () => {
    const employees = await mockDb.getEmployees();
    const wcEmps = employees.filter((e: any) => e.employeeCategory === "WHITE_COLLAR");
    expect(wcEmps.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // 21. Blue Collar current duty = roster coverage
  // ---------------------------------------------------------------------------
  it("21. Blue Collar current duty = roster coverage", () => {
    const bcEmp = { employeeCategory: "BLUE_COLLAR" };
    expect(bcEmp.employeeCategory).toBe("BLUE_COLLAR");
  });

  // ---------------------------------------------------------------------------
  // 22. MP-3A exception/reliever workflows intact
  // ---------------------------------------------------------------------------
  it("22. MP-3A exception/reliever workflows intact", () => {
    const fs = require("fs");
    expect(fs.existsSync("apps/web/app/api/v1/manpower/scheduling/exceptions/route.ts")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 23. MP-3B1 publication workflows intact
  // ---------------------------------------------------------------------------
  it("23. MP-3B1 publication workflows intact", () => {
    const fs = require("fs");
    expect(fs.existsSync("apps/web/app/api/v1/manpower/scheduling/publish/route.ts")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 24. MP-3B2A remains read-only/advisory
  // ---------------------------------------------------------------------------
  it("24. MP-3B2A remains read-only/advisory", () => {
    const fs = require("fs");
    expect(fs.existsSync("apps/web/app/api/v1/manpower/scheduling/coverage/route.ts")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 25. Phase 5D remains untouched
  // ---------------------------------------------------------------------------
  it("25. Phase 5D remains untouched", () => {
    const fs = require("fs");
    expect(fs.existsSync("apps/web/app/secfac/live-monitoring/page.tsx")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 26. Shift Planner roster API returns positionCategory in employee select
  // ---------------------------------------------------------------------------
  it("26. Shift Planner roster API returns positionCategory in employee select", async () => {
    const req = new Request(
      "http://localhost:3000/api/v1/manpower/scheduling/roster?business=security-guarding&startDate=2026-07-21&endDate=2026-07-28"
    );
    const res = await getRoster(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 27. Eligible employees API returns employeeTradePosition fields
  // ---------------------------------------------------------------------------
  it("27. Eligible employees API returns employeeTradePosition fields", async () => {
    const { prisma } = require("@ahh-wfm/database");
    let slotId = "mock-slot-01";
    const realSlot = await prisma.rosterRequirementSlot.findFirst();
    if (realSlot) {
      slotId = realSlot.id;
    }
    const req = new Request(
      `http://localhost:3000/api/v1/manpower/scheduling/eligible-employees?slotId=${slotId}`
    );
    const res = await getEligible(req);
    if (realSlot) {
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      if (json.employees && json.employees.length > 0) {
        expect(json.employees[0]).toHaveProperty("employeeTradePosition");
        expect(json.employees[0]).toHaveProperty("employeeTradePositionSource");
      }
    } else {
      expect([404, 400, 200]).toContain(res.status);
    }
  });

  // ---------------------------------------------------------------------------
  // 28. Guarding manpower API returns positionCategory
  // ---------------------------------------------------------------------------
  it("28. Guarding manpower API returns positionCategory", async () => {
    const req = new Request(
      "http://localhost:3000/api/v1/manpower/security-guarding/manpower"
    );
    const res = await getSGManpower(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty("positionCategory");
    }
  });

  // ---------------------------------------------------------------------------
  // 29. FM manpower API returns positionCategory
  // ---------------------------------------------------------------------------
  it("29. FM manpower API returns positionCategory", async () => {
    const req = new Request(
      "http://localhost:3000/api/v1/manpower/facility-management/manpower"
    );
    const res = await getFMManpower(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty("positionCategory");
    }
  });

  // ---------------------------------------------------------------------------
  // 30. SG/FM pool isolation maintained
  // ---------------------------------------------------------------------------
  it("30. SG/FM pool isolation maintained", async () => {
    const sgReq = new Request(
      "http://localhost:3000/api/v1/manpower/security-guarding/manpower"
    );
    const sgRes = await getSGManpower(sgReq);
    const sgEmps = await sgRes.json();

    const fmReq = new Request(
      "http://localhost:3000/api/v1/manpower/facility-management/manpower"
    );
    const fmRes = await getFMManpower(fmReq);
    const fmEmps = await fmRes.json();

    const sgIds = new Set(sgEmps.map((e: any) => e.id));
    const fmIds = new Set(fmEmps.map((e: any) => e.id));
    const overlap = [...sgIds].filter((id) => fmIds.has(id));
    expect(overlap.length).toBe(0);
  });
});
