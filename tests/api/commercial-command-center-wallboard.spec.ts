import { GET } from "@/app/api/v1/commercial/command-center/wallboard/route";
import { checkApiAuth } from "@/lib/api-guards";
import { getAttendancePulseAggregations } from "@/lib/attendance-helpers";
import { getRosterCoverageAggregations } from "@/lib/roster-coverage-helpers";
import { getEscalationAggregations } from "@/lib/escalation-helpers";
import { getCommercialHealthAggregations } from "@/lib/commercial-health-helpers";

jest.mock("@/lib/api-guards", () => ({
  checkApiAuth: jest.fn()
}));

jest.mock("@/lib/attendance-helpers", () => ({
  getAttendancePulseAggregations: jest.fn()
}));

jest.mock("@/lib/roster-coverage-helpers", () => ({
  getRosterCoverageAggregations: jest.fn()
}));

jest.mock("@/lib/escalation-helpers", () => ({
  getEscalationAggregations: jest.fn()
}));

jest.mock("@/lib/commercial-health-helpers", () => ({
  getCommercialHealthAggregations: jest.fn()
}));

describe("CCC-5 Wallboard API Endpoint Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getAttendancePulseAggregations as jest.Mock).mockResolvedValue({
      businessDate: "2026-08-09",
      presentToday: 45,
      absentToday: 3,
      lateToday: 2,
      missingPunch: 1,
      leavesToday: 4,
      unresolvedCorrections: 2
    });

    (getRosterCoverageAggregations as jest.Mock).mockResolvedValue({
      businessDate: "2026-08-09",
      requiredSlotsCount: 50,
      assignedSlotsCount: 47,
      uncoveredSlotsCount: 3,
      coveragePercentage: 94,
      relieverReqsCount: 5,
      assignedRelieversCount: 4,
      availableStandbyCount: 6,
      uncoveredRelieverDemand: 1,
      readinessStatus: "ATTENTION"
    });

    (getEscalationAggregations as jest.Mock).mockResolvedValue({
      businessDate: "2026-08-09",
      totalEscalations: 4,
      summaryMetrics: {
        totalOpen: 4,
        criticalCount: 1,
        highCount: 2,
        overdueCount: 1
      },
      escalations: [
        {
          id: "UNCOVERED_ROSTER_SLOT:1:2026-08-09",
          sourceKey: "UNCOVERED_ROSTER_SLOT:1:2026-08-09",
          sourceType: "UNCOVERED_ROSTER_SLOT",
          severity: "CRITICAL",
          title: "Uncovered Roster Slot",
          description: "Unfilled slot",
          clientName: "Client A",
          contractTitle: "Contract A",
          siteName: "Site A",
          status: "OPEN",
          drillDownUrl: "/commercial/command-center/roster-coverage"
        }
      ],
      pagination: { page: 1, limit: 50, totalItems: 4, totalPages: 1 }
    });

    (getCommercialHealthAggregations as jest.Mock).mockResolvedValue({
      businessDate: "2026-08-09",
      dateFrom: "2026-08-09",
      dateTo: "2026-08-09",
      rangeLengthDays: 1,
      portfolioMetrics: {
        totalActiveContracts: 10,
        healthyContractsCount: 8,
        attentionContractsCount: 1,
        criticalContractsCount: 1,
        averageCoveragePercentage: 94,
        totalRequiredManpower: 100,
        totalAssignedManpower: 94,
        totalUncoveredSlots: 6,
        contractsWithSlaRiskCount: 2,
        contractsWithEscalationsCount: 3,
        contractsExpiringSoonCount: 1,
        contractsExpiredCount: 0
      },
      pagination: { page: 1, limit: 50, totalItems: 10, totalPages: 1 },
      contracts: [
        {
          contractId: "c-1",
          contractNumber: "CNT-001",
          contractTitle: "Security Services A",
          clientName: "Client A",
          operationType: "SECURITY_GUARDING",
          daysToExpiry: 120,
          expiryStatus: "ACTIVE",
          coverage: { requiredSlots: 10, assignedSlots: 10, uncoveredSlots: 0, coveragePercentage: 100 },
          health: { status: "HEALTHY", score: 100, deductions: 0, reasons: [] },
          slaExposure: { isSlaRisk: false, slaRiskReasons: [] },
          drillDownUrls: {
            contractMaster: "/manpower/security_guarding/contracts?contractId=c-1",
            rosterCoverage: "/commercial/command-center/roster-coverage?contractId=c-1",
            escalationQueue: "/commercial/command-center/escalations?contractId=c-1"
          }
        }
      ]
    });
  });

  test("1. Returns 200 OK with unified Wallboard structure for authorized user", async () => {
    (checkApiAuth as jest.Mock).mockResolvedValue({
      session: {
        user: {
          id: "u-1",
          role: "SUPER_ADMIN",
          permissions: ["commercial.commandCenter.view"]
        }
      }
    });

    const req = new Request("http://localhost:3100/api/v1/commercial/command-center/wallboard");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.context.businessDate).toBe("2026-08-09");
    expect(json.primaryKpis.overallHealthScore).toBe(80);
    expect(json.primaryKpis.overallCoveragePercentage).toBe(94);
    expect(json.primaryKpis.totalOpenEscalations).toBe(4);
    expect(json.primaryKpis.relieverReadinessStatus).toBe("ATTENTION");

    expect(json.attendancePulse.presentToday).toBe(45);
    expect(json.rosterCoverage.assignedSlotsCount).toBe(47);
    expect(json.escalationSummary.metrics.criticalCount).toBe(1);
    expect(json.commercialPortfolio.portfolioMetrics.totalActiveContracts).toBe(10);
  });

  test("2. Sets Cache-Control header to private, no-store, no-cache", async () => {
    (checkApiAuth as jest.Mock).mockResolvedValue({
      session: {
        user: {
          id: "u-1",
          role: "SUPER_ADMIN",
          permissions: ["commercial.commandCenter.view"]
        }
      }
    });

    const req = new Request("http://localhost:3100/api/v1/commercial/command-center/wallboard");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  test("3. Returns 403 Forbidden for unauthorized user lacking permissions", async () => {
    (checkApiAuth as jest.Mock).mockResolvedValue({
      session: {
        user: {
          id: "u-2",
          role: "EMPLOYEE",
          permissions: []
        }
      }
    });

    const req = new Request("http://localhost:3100/api/v1/commercial/command-center/wallboard");
    const res = await GET(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Forbidden");
  });

  test("4. Enforces company boundary from user session for non-superadmin", async () => {
    (checkApiAuth as jest.Mock).mockResolvedValue({
      session: {
        user: {
          id: "u-3",
          role: "COMPANY_ADMIN",
          companyId: "comp-123",
          permissions: ["commercial.commandCenter.view"]
        }
      }
    });

    const req = new Request("http://localhost:3100/api/v1/commercial/command-center/wallboard");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getAttendancePulseAggregations).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "comp-123" })
    );
  });
});
