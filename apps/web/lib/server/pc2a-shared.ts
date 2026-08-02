import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { z } from "zod";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const HARD_MIN = -1_000_000_000_000;
const HARD_MAX = 1_000_000_000_000;
const MAX_SCALE = 6;

function decimalInRange(v: number) {
  if (!isFinite(v) || isNaN(v)) return false;
  const str = v.toString();
  const dec = str.includes(".") ? str.split(".")[1].length : 0;
  return v >= HARD_MIN && v <= HARD_MAX && dec <= MAX_SCALE;
}

const SafeDecimal = z.number().refine(decimalInRange, {
  message: `Value must be finite, within ±1,000,000,000,000, with at most ${MAX_SCALE} decimal places`,
});

const CategoryMasterSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  operationType: z.enum(["SECURITY_GUARDING", "FACILITY_MANAGEMENT", "WHITE_COLLAR"]).optional(),
  companyId: z.string().uuid().optional(),
}).strict();

const CategoryVersionSchema = z.object({
  masterId: z.string().uuid(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
}).strict();

const ElementMasterSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  operationType: z.enum(["SECURITY_GUARDING", "FACILITY_MANAGEMENT", "WHITE_COLLAR"]).optional(),
  companyId: z.string().uuid().optional(),
}).strict();

const ElementVersionSchema = z.object({
  masterId: z.string().uuid(),
  categoryId: z.string().uuid(),
  categoryCode: z.string().min(1).max(50),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  unitOfMeasure: z.string().max(50).optional(),
  isOneTime: z.boolean().optional(),
  isDirect: z.boolean().optional(),
  isFixed: z.boolean().optional(),
  clientProvided: z.boolean().optional(),
  quantitySource: z.enum(["FIXED", "FORMULA", "DRIVER"]),
  rateSource: z.enum(["MASTER", "FORMULA", "OVERRIDE"]),
  allocationMethod: z.enum(["FIXED_AMOUNT", "PERCENTAGE", "FORMULA_DRIVEN", "RATE_CARD"]).optional(),
}).strict();

const DriverMasterSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sourceType: z.enum(["SURVEY_ELEMENT", "SITE_CONDITION"]),
  companyId: z.string().uuid().optional(),
}).strict();

const DriverVersionSchema = z.object({
  masterId: z.string().uuid(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  targetElementCode: z.string().max(50).optional(),
  quantityRuleAst: z.record(z.unknown()).optional(),
  rateRuleAst: z.record(z.unknown()).optional(),
  escalationRuleAst: z.record(z.unknown()).optional(),
}).strict();

const RateCardMasterSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  currency: z.string().length(3).optional(),
  companyId: z.string().uuid().optional(),
}).strict();

const RateCardVersionSchema = z.object({
  masterId: z.string().uuid(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  ratesJson: z.record(SafeDecimal),
}).strict();

const ASTNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("literal"), value: SafeDecimal }),
    z.object({ type: z.literal("variable"), name: z.string().regex(/^[A-Z_][A-Z0-9_]*$/) }),
    z.object({
      type: z.literal("binary"),
      operator: z.enum(["+", "-", "*", "/"]),
      left: ASTNodeSchema,
      right: ASTNodeSchema,
    }),
  ])
);

const FormulaMasterSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  companyId: z.string().uuid().optional(),
}).strict();

const FormulaVersionSchema = z.object({
  masterId: z.string().uuid(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  formulaAst: ASTNodeSchema,
  variables: z.record(z.unknown()).optional(),
}).strict();

const FormulaTestSchema = z.object({
  formulaAst: ASTNodeSchema,
  variables: z.record(SafeDecimal),
}).strict();

const PackageMasterSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  companyId: z.string().uuid().optional(),
}).strict();

const PackageVersionSchema = z.object({
  masterId: z.string().uuid(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
}).strict();

const PackageItemSchema = z.object({
  elementCode: z.string().min(1).max(50),
  sequence: z.number().int().min(1).max(9999),
  isMandatory: z.boolean().optional(),
  defaultQuantity: z.number().min(0).max(1_000_000).refine(
    v => { const s = v.toString(); const d = s.includes(".") ? s.split(".")[1].length : 0; return d <= 6; },
    { message: "defaultQuantity must have at most 6 decimal places" }
  ).optional(),
}).strict();

const LifecycleActionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "RETIRE", "ACTIVATE", "RESUBMIT"]),
  comment: z.string().max(1000).optional(),
}).strict();

const EffectiveResolutionSchema = z.object({
  entityType: z.enum(["CATEGORY", "ELEMENT", "DRIVER", "RATECARD", "FORMULA", "PACKAGE"]),
  masterId: z.string().uuid(),
  effectiveDate: z.coerce.date(),
}).strict();

const PrecedenceTraceSchema = z.object({
  entityType: z.enum(["RATECARD"]),
  companyId: z.string().uuid(),
  operationType: z.enum(["SECURITY_GUARDING", "FACILITY_MANAGEMENT", "WHITE_COLLAR"]),
  effectiveDate: z.coerce.date(),
  currency: z.string().length(3).optional(),
}).strict();

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
}).strip();

// ─── Validation helpers ───────────────────────────────────────────────────────

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T } | { error: Response } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: NextResponse.json(
        { success: false, error: "Validation failed", details: (result as any).error.flatten() },
        { status: 422 }
      ) as unknown as Response,
    };
  }
  return { data: result.data };
}

// ─── Lifecycle state machine ──────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ACTIVE", "RETIRED"],
  ACTIVE: ["RETIRED", "SUPERSEDED"],
  REJECTED: [],
  RETIRED: [],
  SUPERSEDED: [],
};

function actionToState(action: string, currentStatus: string): string {
  switch (action) {
    case "SUBMIT": return "UNDER_REVIEW";
    case "APPROVE": return "APPROVED";
    case "REJECT": return "REJECTED";
    case "RETIRE": return "RETIRED";
    case "ACTIVATE": return "ACTIVE";
    case "RESUBMIT": return "DRAFT";
    default: throw new Error(`409: Unknown lifecycle action: ${action}`);
  }
}

function assertValidTransition(current: string, next: string) {
  const allowed = VALID_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`409: Transition ${current} → ${next} is not permitted`);
  }
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function writeAudit(userId: string, action: string, entity: string, entityId: string, details: object) {
  try {
    await (prisma as any).userActionAudit.create({
      data: { userId, action, targetEntity: entity, targetId: entityId, details },
    });
  } catch {
    // Audit must not crash the operation; log silently
  }
}

// ─── Master CRUD helpers ──────────────────────────────────────────────────────

const TABLE_MAP: Record<string, { master: string; version: string; entityLabel: string }> = {
  categories:  { master: "costCategoryMaster",     version: "costCategoryVersion",     entityLabel: "CostCategory" },
  elements:    { master: "costElementMaster",       version: "costElementVersion",       entityLabel: "CostElement" },
  drivers:     { master: "costDriverMaster",        version: "costDriverVersion",        entityLabel: "CostDriver" },
  "rate-cards":{ master: "costRateCardMaster",      version: "costRateCardVersion",      entityLabel: "CostRateCard" },
  formulas:    { master: "costFormulaDefinition",   version: "costFormulaVersion",       entityLabel: "CostFormula" },
  packages:    { master: "costPackageMaster",       version: "costPackageVersion",       entityLabel: "CostPackage" },
};

const ENTITY_TYPE_MAP: Record<string, string> = {
  categories: "CATEGORY", elements: "ELEMENT", drivers: "DRIVER",
  "rate-cards": "RATECARD", formulas: "FORMULA", packages: "PACKAGE",
};

function getTable(slug: string) {
  const t = TABLE_MAP[slug];
  if (!t) throw new Error("404: Unknown entity type: " + slug);
  return t;
}

function safeError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : "Internal error";
  if (msg.startsWith("401:")) return NextResponse.json({ success: false, error: msg.replace(/^4\d\d: /, "") }, { status: 401 }) as unknown as Response;
  if (msg.startsWith("403:")) return NextResponse.json({ success: false, error: msg.replace(/^4\d\d: /, "") }, { status: 403 }) as unknown as Response;
  if (msg.startsWith("404:")) return NextResponse.json({ success: false, error: msg.replace(/^4\d\d: /, "") }, { status: 404 }) as unknown as Response;
  if (msg.startsWith("409:")) return NextResponse.json({ success: false, error: msg.replace(/^4\d\d: /, "") }, { status: 409 }) as unknown as Response;
  return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 }) as unknown as Response;
}

export {
  checkApiAuth,
  parseBody,
  getTable,
  TABLE_MAP,
  ENTITY_TYPE_MAP,
  assertValidTransition,
  actionToState,
  writeAudit,
  safeError,
  CategoryMasterSchema,
  CategoryVersionSchema,
  ElementMasterSchema,
  ElementVersionSchema,
  DriverMasterSchema,
  DriverVersionSchema,
  RateCardMasterSchema,
  RateCardVersionSchema,
  FormulaMasterSchema,
  FormulaVersionSchema,
  FormulaTestSchema,
  PackageMasterSchema,
  PackageVersionSchema,
  PackageItemSchema,
  LifecycleActionSchema,
  EffectiveResolutionSchema,
  PrecedenceTraceSchema,
  PaginationSchema,
  ASTNodeSchema,
  HARD_MIN,
  HARD_MAX,
};
