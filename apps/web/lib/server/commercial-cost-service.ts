/**
 * PC-2A Commercial Cost Service
 * Canonical service layer. All PC-2A API routes must call this service.
 * Do not duplicate business logic in route handlers.
 */
import { prisma } from "@ahh-wfm/database";
import { AstEvaluator } from "../ast-evaluator";

export type CostLifecycleState =
  | "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE"
  | "REJECTED" | "RETIRED" | "SUPERSEDED";

export interface UserContext {
  id: string;
  role: string;
  companyId?: string;
  operationAccess?: {
    allowedSecurityGuarding?: boolean;
    allowedFacilityManagement?: boolean;
  };
}

const TABLE_MAP: Record<string, { master: string; version: string }> = {
  CATEGORY:  { master: "costCategoryMaster",   version: "costCategoryVersion" },
  ELEMENT:   { master: "costElementMaster",     version: "costElementVersion" },
  DRIVER:    { master: "costDriverMaster",      version: "costDriverVersion" },
  RATECARD:  { master: "costRateCardMaster",    version: "costRateCardVersion" },
  FORMULA:   { master: "costFormulaDefinition", version: "costFormulaVersion" },
  PACKAGE:   { master: "costPackageMaster",     version: "costPackageVersion" },
};

export class CommercialCostService {
  constructor(private user: UserContext) {}

  // ── Company + Scope isolation ──────────────────────────────────────────────

  assertCompany(recordCompanyId: string | null | undefined) {
    const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"];
    if (ADMIN_ROLES.includes((this.user.role ?? "").toUpperCase())) return;
    if (recordCompanyId && this.user.companyId && recordCompanyId !== this.user.companyId) {
      throw new Error("403: Cross-company access is prohibited");
    }
  }

  assertScope(operationType: string | null | undefined) {
    const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"];
    if (ADMIN_ROLES.includes((this.user.role ?? "").toUpperCase())) return;
    const oa = this.user.operationAccess ?? {};
    if (operationType === "SECURITY_GUARDING" && !oa.allowedSecurityGuarding) {
      throw new Error("403: No Security Guarding access");
    }
    if (operationType === "FACILITY_MANAGEMENT" && !oa.allowedFacilityManagement) {
      throw new Error("403: No Facility Management access");
    }
  }

  // ── Draft creation ─────────────────────────────────────────────────────────

  async createDraft(entityType: string, masterId: string, payload: Record<string, unknown>) {
    const tbl = this.getTable(entityType);

    const existingOpen = await (prisma as any)[tbl.version].findFirst({
      where: { masterId, status: { in: ["DRAFT", "UNDER_REVIEW"] } },
    });
    if (existingOpen) throw new Error("409: Cannot create draft while another open version exists");

    const last = await (prisma as any)[tbl.version].findFirst({
      where: { masterId },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;

    const { items, ...versionPayload } = payload as any;

    const version = await (prisma as any)[tbl.version].create({
      data: { ...versionPayload, masterId, versionNumber, status: "DRAFT", createdBy: this.user.id },
    });

    if (entityType === "PACKAGE" && Array.isArray(items)) {
      if (items.length > 200) {
        await (prisma as any)[tbl.version].delete({ where: { id: version.id } });
        throw new Error("409: Package cannot exceed 200 items");
      }
      await prisma.costPackageItem.createMany({
        data: items.map((it: any) => ({ ...it, packageVersionId: version.id })),
      });
    }

    return version;
  }

  // ── Lifecycle transition ───────────────────────────────────────────────────

  async transitionState(entityType: string, versionId: string, newState: CostLifecycleState) {
    const tbl = this.getTable(entityType);
    const version = await (prisma as any)[tbl.version].findUnique({ where: { id: versionId } });
    if (!version) throw new Error("404: Version not found");

    if (newState === "APPROVED") {
      if (version.createdBy === this.user.id) {
        throw new Error("409: Maker and Checker must differ. You cannot approve your own submission.");
      }
    }

    if (newState === "ACTIVE") {
      return this.activateVersion(entityType, tbl, version);
    }

    return (prisma as any)[tbl.version].update({
      where: { id: versionId },
      data: { status: newState, ...(newState === "APPROVED" ? { approvedBy: this.user.id } : {}) },
    });
  }

  async resubmitVersion(entityType: string, versionId: string) {
    const tbl = this.getTable(entityType);
    const version = await (prisma as any)[tbl.version].findUnique({
      where: { id: versionId },
      include: entityType === "PACKAGE" ? { items: true } : undefined,
    });
    if (!version) throw new Error("404: Version not found");
    if (version.status !== "REJECTED") {
      throw new Error("409: Only REJECTED versions can be resubmitted");
    }

    const existingOpen = await (prisma as any)[tbl.version].findFirst({
      where: { masterId: version.masterId, status: { in: ["DRAFT", "UNDER_REVIEW"] } },
    });
    if (existingOpen) throw new Error("409: Cannot resubmit while another open version exists");

    const last = await (prisma as any)[tbl.version].findFirst({
      where: { masterId: version.masterId },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;

    // Clone content, omitting system fields
    const { id, createdAt, updatedAt, versionNumber: _vn, status: _st, approvedBy: _ap, clonedFromVersionId: _cf, items, ...fields } = version;

    const newVersion = await (prisma as any)[tbl.version].create({
      data: {
        ...fields,
        versionNumber,
        status: "DRAFT",
        clonedFromVersionId: versionId,
        createdBy: this.user.id,
      },
    });

    if (entityType === "PACKAGE" && Array.isArray(items)) {
      await prisma.costPackageItem.createMany({
        data: items.map((it: any) => {
          const { id: _iid, createdAt: _ca, updatedAt: _ua, packageVersionId: _pv, ...itFields } = it;
          return { ...itFields, packageVersionId: newVersion.id };
        }),
      });
    }

    return newVersion;
  }

  // ── Concurrency-safe activation ────────────────────────────────────────────

  private async activateVersion(entityType: string, tbl: { master: string; version: string }, version: any) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`
        INSERT IGNORE INTO CostRateActivationLock (id, entityType, masterId, versionId, locked, updatedAt)
        VALUES (UUID(), ${entityType}, ${version.masterId}, ${version.id}, 0, NOW(3))
      `;
      await tx.$executeRaw`
        SELECT id FROM CostRateActivationLock
        WHERE entityType = ${entityType} AND masterId = ${version.masterId}
        FOR UPDATE
      `;

      const actives = await tx[tbl.version].findMany({
        where: { masterId: version.masterId, status: "ACTIVE" },
      });

      for (const active of actives) {
        const aFrom = active.effectiveFrom.getTime();
        const aTo   = active.effectiveTo?.getTime() ?? Infinity;
        const nFrom = version.effectiveFrom.getTime();
        const nTo   = version.effectiveTo?.getTime() ?? Infinity;
        if (nFrom < aTo && aFrom < nTo) {
          throw new Error("409: Overlapping ACTIVE version for this date range");
        }
      }

      const activated = await tx[tbl.version].update({
        where: { id: version.id },
        data: { status: "ACTIVE", approvedBy: this.user.id },
      });

      await tx.$executeRaw`
        UPDATE CostRateActivationLock SET locked = 0, updatedAt = NOW(3)
        WHERE entityType = ${entityType} AND masterId = ${version.masterId}
      `;

      return activated;
    });
  }

  // ── Formula synthetic test ─────────────────────────────────────────────────

  testFormula(ast: unknown, variables: Record<string, number>) {
    const evaluator = new AstEvaluator(variables);
    const result = evaluator.evaluate(ast as any);
    if (!isFinite(result) || isNaN(result)) throw new Error("422: Formula produced a non-finite result");
    if (result < -1_000_000_000_000 || result > 1_000_000_000_000) {
      throw new Error("422: Formula result exceeds the allowed output range");
    }
    return { result };
  }

  // ── Helper ─────────────────────────────────────────────────────────────────

  private getTable(entityType: string) {
    const t = TABLE_MAP[entityType];
    if (!t) throw new Error("400: Invalid entity type: " + entityType);
    return t;
  }
}
