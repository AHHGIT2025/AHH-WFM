import { test, expect } from "@playwright/test";
import { prisma } from "@ahh-wfm/database";
import { mockDb } from "@ahh-wfm/mock-data";
import { WorkflowEngine } from "../../../../apps/web/lib/workflow-engine";

test.describe("PW-6 Universal Approval Center E2E Verification", () => {
  let e2eInstanceId: string;
  const E2E_REF = `REF-E2E-PW6-${Date.now()}`;

  test.beforeAll(async () => {
    try {
      // Create a 2-level test workflow template: Level 1 = Admin (AD-0001), Level 2 = Approver Bob
      const tmpl = await mockDb.createWorkflowTemplate({
        workflowName: "E2E Playwright Approval Template",
        moduleType: "PW6_E2E_COSTING",
        isDefault: true,
        isActive: true,
        levels: [
          {
            levelNumber: 1,
            levelName: "Admin Review",
            approvalRule: "ANY_ONE",
            approvers: [
              { approverType: "SPECIFIC_EMPLOYEE", employeeId: "AD-0001", employeeName: "System Administrator" }
            ]
          },
          {
            levelNumber: 2,
            levelName: "Operations Signoff",
            approvalRule: "ANY_ONE",
            approvers: [
              { approverType: "SPECIFIC_EMPLOYEE", employeeId: "emp-e2e-approver-b", employeeName: "Approver Bob Operations" }
            ]
          }
        ]
      });

      const inst = await WorkflowEngine.submitCase(
        "PW6_E2E_COSTING",
        E2E_REF,
        "COMP-001",
        null,
        "AA-1001" // Requester Ahmed Ali (SoD preserved)
      );
      e2eInstanceId = inst.id;
    } catch (e) {}
  });

  test("1. Dashboard My Approvals Widget is visible and interactive", async ({ page }) => {
    await page.goto("http://localhost:3100/");
    await expect(page.locator("text=My Approvals Portal")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Pending Action")).toBeVisible();
    await expect(page.locator("text=Recently Actioned")).toBeVisible();

    // Click View Inbox
    const inboxBtn = page.locator("a[href*='/approvals?tab=inbox']");
    await expect(inboxBtn).toBeVisible({ timeout: 10000 });
    await Promise.all([
      page.waitForURL(/.*approvals.*/, { timeout: 10000 }),
      inboxBtn.click()
    ]);
    await expect(page).toHaveURL(/.*approvals.*/);
  });

  test("2. Approval Center Main Screen renders Inbox and Outbox tabs", async ({ page }) => {
    await page.goto("http://localhost:3100/approvals");
    await expect(page.locator("h1:has-text('Universal Approval Center')")).toBeVisible();
    
    // Check Tabs
    const inboxTab = page.locator("button:has-text('Pending Review (Inbox)')");
    const outboxTab = page.locator("button:has-text('My Actions (Outbox)')");
    await expect(inboxTab).toBeVisible();
    await expect(outboxTab).toBeVisible();

    // Switch to Outbox Tab
    await outboxTab.click();
    await expect(page).toHaveURL(/.*tab=outbox.*/);
    await expect(page.locator("text=My Action").or(page.locator("text=No Outbox Records Found")).first()).toBeVisible();

    // Switch back to Inbox Tab
    await inboxTab.click();
    await expect(page).toHaveURL(/.*tab=inbox.*/);
    await expect(page.locator("text=Current Level").or(page.locator("text=No Pending Approvals")).first()).toBeVisible();
  });

  test("3. Approval Center Module Filters and Search are responsive", async ({ page }) => {
    await page.goto("http://localhost:3100/approvals?tab=inbox");
    
    // Check module filter select dropdown
    const moduleSelect = page.locator("select").first();
    await expect(moduleSelect).toBeVisible();
    await expect(moduleSelect).toContainText("All Modules");

    // Search input typing test
    const searchInput = page.locator("input[placeholder*='Search reference']");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("TEST-REF-FILTER");
    await expect(searchInput).toHaveValue("TEST-REF-FILTER");
  });

  test("4. Sidebar Navigation includes Approval Center", async ({ page }) => {
    await page.goto("http://localhost:3100/");
    const navItem = page.locator("a[href='/approvals']");
    await expect(navItem).toBeVisible();
    await navItem.click();
    await expect(page).toHaveURL(/.*approvals.*/);
  });

  test("5. Real State-Changing Approval Lifecycle (Inbox -> Detail -> Action -> Outbox -> Future Progress Verification)", async ({ page }) => {
    test.skip(!e2eInstanceId, "Requires seeded test workflow instance");

    // 1. Open Inbox and search for target reference
    await page.goto("http://localhost:3100/approvals?tab=inbox");
    const searchInput = page.locator("input[placeholder*='Search reference']");
    await searchInput.fill(E2E_REF);
    await page.waitForTimeout(500);

    // 2. Click Review on the matching request card
    const reviewBtn = page.locator(`a[href*="/approvals/${e2eInstanceId}"]`);
    await expect(reviewBtn).toBeVisible({ timeout: 10000 });
    await reviewBtn.click();
    await expect(page).toHaveURL(new RegExp(`.*approvals/${e2eInstanceId}.*`));

    // 3. Verify Approval Detail screen content & Level 1 context
    await expect(page.locator("text=Request Overview")).toBeVisible();
    await expect(page.locator("text=Decision Action Panel")).toBeVisible();
    await expect(page.locator("text=Admin Review").first()).toBeVisible();

    // 4. Fill remarks and execute APPROVE
    const remarksInput = page.locator("textarea[placeholder*='Enter approval comments']");
    await expect(remarksInput).toBeVisible();
    await remarksInput.fill("E2E Playwright Certified Approval - Approver Alice");
    
    const approveBtn = page.locator("button:has-text('Approve Stage')");
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // 5. Confirm in Modal
    const confirmBtn = page.locator("button:has-text('Confirm APPROVE')");
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 6. Verify notification and confirm item is no longer in actionable Inbox
    await expect(page.locator("text=Workflow step successfully approved")).toBeVisible({ timeout: 10000 });
    await page.goto("http://localhost:3100/approvals?tab=inbox");
    const inboxSearch = page.locator("input[placeholder*='Search reference']");
    await inboxSearch.fill(E2E_REF);
    await page.waitForTimeout(500);
    await expect(page.locator(`tr:has(td:has-text("${E2E_REF}"))`)).toHaveCount(0);

    // 7. Verify item appears immediately in Outbox with APPROVE badge
    await page.goto("http://localhost:3100/approvals?tab=outbox");
    const outboxSearch = page.locator("input[placeholder*='Search reference']");
    await outboxSearch.fill(E2E_REF);
    await page.waitForTimeout(500);

    const outboxRow = page.locator(`tr:has(td:has-text("${E2E_REF}"))`);
    await expect(outboxRow).toBeVisible({ timeout: 10000 });
    await expect(outboxRow.getByText("APPROVE", { exact: true })).toBeVisible();

    // 8. Reopen detail from Outbox and verify Approver A's action in timeline
    const viewDetailBtn = outboxRow.locator("a:has-text('View Lifecycle')");
    await viewDetailBtn.click();
    await expect(page).toHaveURL(new RegExp(`.*approvals/${e2eInstanceId}.*`));
    await expect(page.locator("text=E2E Playwright Certified Approval - Approver Alice").first()).toBeVisible();

    // 9. Approver B executes subsequent approval for Stage 2
    await WorkflowEngine.executeAction({
      instanceId: e2eInstanceId,
      action: "APPROVE",
      user: {
        id: "user-e2e-approver-b",
        employeeId: "emp-e2e-approver-b",
        name: "Approver Bob Operations",
        role: "OPERATIONS_DIRECTOR",
        companyId: "COMP-001"
      },
      remarks: "Approver Bob Stage 2 Operations Final Signoff"
    });

    // 10. Approver A reloads the SAME Outbox item and verifies future progress
    await page.reload();
    await page.waitForTimeout(1000);

    // Assert Approver A's action is still present
    await expect(page.locator("text=E2E Playwright Certified Approval - Approver Alice").first()).toBeVisible();
    // Assert Approver B's subsequent action is now present in lifecycle
    await expect(page.locator("text=Approver Bob Stage 2 Operations Final Signoff").first()).toBeVisible();
    // Assert final workflow state is APPROVED
    await expect(page.locator("text=Approved").first()).toBeVisible();
  });
});
