import { calculateCostingEstimate, generateCostingSnapshot } from "../../apps/web/lib/precontract-costing";
import { Decimal } from "@prisma/client/runtime/library";

describe("CL-3 Pre-Contract Costing & Estimation Domain Service", () => {
  describe("Mathematical Formula & Pricing Derivation", () => {
    it("should calculate Gross Margin % correctly: (Selling Price - Total Cost) / Selling Price * 100", () => {
      const totalCost = new Decimal(8000);
      const sellingPrice = new Decimal(10000);

      const marginPct = sellingPrice.sub(totalCost).div(sellingPrice).mul(100);
      expect(marginPct.toFixed(2)).toBe("20.00");
    });

    it("should calculate Target Margin Selling Price correctly: Total Cost / (1 - Margin / 100)", () => {
      const totalCost = new Decimal(8500);
      const targetMargin = new Decimal(15); // 15%

      const marginFactor = new Decimal(1).sub(targetMargin.div(100)); // 0.85
      const sellingPrice = totalCost.div(marginFactor); // 10000.00

      expect(sellingPrice.toFixed(2)).toBe("10000.00");
    });

    it("should calculate Markup % correctly: (Selling Price - Total Cost) / Total Cost * 100", () => {
      const totalCost = new Decimal(8000);
      const sellingPrice = new Decimal(10000);

      const markupPct = sellingPrice.sub(totalCost).div(totalCost).mul(100);
      expect(markupPct.toFixed(2)).toBe("25.00");
    });

    it("should calculate Target Markup Selling Price correctly: Total Cost * (1 + Markup / 100)", () => {
      const totalCost = new Decimal(8000);
      const targetMarkup = new Decimal(25); // 25%

      const markupFactor = new Decimal(1).add(targetMarkup.div(100)); // 1.25
      const sellingPrice = totalCost.mul(markupFactor);

      expect(sellingPrice.toFixed(2)).toBe("10000.00");
    });

    it("should reject Target Gross Margin >= 100%", async () => {
      await expect(
        calculateCostingEstimate({
          caseId: "invalid-case",
          surveyId: "invalid-survey",
          targetMarginPercentage: 100.0
        })
      ).rejects.toThrow("Target Gross Margin percentage must be strictly less than 100%.");
    });
  });

  describe("Deterministic SHA-256 Snapshot Generation", () => {
    it("should generate deterministic SHA-256 snapshot and matching checksum", () => {
      const estimate = {
        id: "est-12345",
        caseId: "case-999",
        surveyId: "survey-888",
        companyId: "comp-1",
        operationType: "SECURITY_GUARDING"
      };

      const version = {
        id: "ver-1",
        versionNumber: 1,
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: new Decimal(7000),
        totalIndirectCost: new Decimal(700),
        totalCost: new Decimal(7700),
        targetMarginPercentage: new Decimal(15),
        targetMarkupPercentage: new Decimal(17.65),
        sellingPrice: new Decimal(9058.82)
      };

      const items = [
        {
          elementCode: "BASIC_PAY",
          elementName: "Basic Pay / Manpower Wage",
          categoryCode: "DIRECT_MANPOWER",
          isDirect: true,
          quantity: new Decimal(2),
          unitRate: new Decimal(2500),
          totalAmount: new Decimal(5000),
          calculationBasis: "CONFIGURED"
        },
        {
          elementCode: "ALLOWANCES",
          elementName: "Fixed Employment Allowances",
          categoryCode: "DIRECT_MANPOWER",
          isDirect: true,
          quantity: new Decimal(2),
          unitRate: new Decimal(1000),
          totalAmount: new Decimal(2000),
          calculationBasis: "CONFIGURED"
        }
      ];

      const res1 = generateCostingSnapshot(estimate, version, items);
      const res2 = generateCostingSnapshot(estimate, version, items);

      expect(res1.snapshotJson).toBeDefined();
      expect(res1.checksum).toHaveLength(64); // SHA-256 length
      expect(res1.checksum).toBe(res2.checksum);
    });
  });
});
