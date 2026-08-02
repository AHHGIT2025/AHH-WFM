import { getHoldingCompany, getActiveCompanies, getWhiteCollarDesignations, getBlueCollarPositionCategories } from "../../apps/web/lib/server/master-data-service";
import { validateCompanyDepartment, validatePositionApplicability } from "../../apps/web/lib/master-data-validator";
import { mockDb } from "../../packages/mock-data/src/index";

describe("Phase MD-1: Master Data Architecture & Validator Unit Tests", () => {
  beforeAll(async () => {
    await mockDb.getCompanies(); // Force DB seeding
  });

  test("1. Master Data Service resolves singleton Holding Company without hardcoded code or ID", async () => {
    const holding = await getHoldingCompany();
    expect(holding).toBeDefined();
    expect(holding.isHoldingCompany).toBe(true);
    expect(holding.companyName).toContain("Holding");
  });

  test("2. White Collar Designations service returns active Designations only", async () => {
    const designations = await getWhiteCollarDesignations();
    expect(Array.isArray(designations)).toBe(true);
    designations.forEach((d) => expect(d.isActive).toBe(true));
  });

  test("3. Blue Collar Position Categories service returns active Categories only", async () => {
    const categories = await getBlueCollarPositionCategories();
    expect(Array.isArray(categories)).toBe(true);
    categories.forEach((c) => expect(c.isActive).toBe(true));
  });

  test("4. validatePositionApplicability enforces White Collar null position fields", () => {
    expect(() => {
      validatePositionApplicability({
        workerClass: "WHITE_COLLAR",
        appliesToAllPositionCategories: true as any
      });
    }).toThrow("POSITION_APPLICABILITY_INVALID");
  });

  test("5. validatePositionApplicability enforces Blue Collar specific position category requirement", () => {
    expect(() => {
      validatePositionApplicability({
        workerClass: "BLUE_COLLAR",
        appliesToAllPositionCategories: false,
        positionCategoryId: null
      });
    }).toThrow("BLUE_COLLAR_POSITION_CATEGORY_REQUIRED");
  });

  test("6. validatePositionApplicability accepts valid Blue Collar all-position config", () => {
    expect(() => {
      validatePositionApplicability({
        workerClass: "BLUE_COLLAR",
        appliesToAllPositionCategories: true,
        positionCategoryId: null
      });
    }).not.toThrow();
  });
});
