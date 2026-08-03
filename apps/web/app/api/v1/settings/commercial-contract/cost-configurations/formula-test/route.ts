// POST /api/v1/settings/commercial-contract/cost-configurations/formula-test
// Synthetic formula execution – uses ONLY supplied test inputs, never live data
import { NextResponse } from "next/server";
import { AstEvaluator } from "@/lib/ast-evaluator";
import { checkApiAuth, parseBody, safeError, FormulaTestSchema } from "@/lib/server/pc2a-shared";

export async function POST(req: Request) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "precontract.costConfig.view" });
    if (auth.error) return auth.error;

    const body = await req.json();
    const parsed = parseBody(FormulaTestSchema, body);
    if ("error" in parsed) return parsed.error as any;

    const { formulaAst, variables } = parsed.data;

    // Validate using the canonical project evaluator (NOT the test-only cost-formula-ast)
    const evaluator = new AstEvaluator(variables);
    let result: number;
    try {
      result = evaluator.evaluate(formulaAst as any);
    } catch (evalErr: any) {
      return NextResponse.json(
        { success: false, error: evalErr.message },
        { status: 422 }
      );
    }

    if (!isFinite(result) || isNaN(result)) {
      return NextResponse.json(
        { success: false, error: "Formula produced a non-finite result" },
        { status: 422 }
      );
    }

    if (result < -1_000_000_000_000 || result > 1_000_000_000_000) {
      return NextResponse.json(
        { success: false, error: "Formula result exceeds the allowed output range" },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, data: { result } });
  } catch (err) {
    return safeError(err) as any;
  }
}
