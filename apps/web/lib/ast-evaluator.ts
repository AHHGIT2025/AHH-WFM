/**
 * AHH WFM - Safe AST Evaluator for Costing Formulas
 * 
 * Provides a safe, non-eval execution environment for cost calculation formulas.
 * Only allow-listed mathematical operations are supported.
 * 
 * Example AST:
 * { "op": "+", "left": { "var": "BASE_PAY" }, "right": { "var": "ALLOWANCE" } }
 */

type AstNode = 
  | { op: string; left: AstNode; right: AstNode }
  | { op: string; arg: AstNode } // unary
  | { var: string }
  | { const: number }
  | { cond: AstNode; then: AstNode; else: AstNode }; // ternary

export interface AstContext {
  [key: string]: number;
}

const ALLOWED_OPERATORS = new Set(['+', '-', '*', '/', 'min', 'max', 'round', '>', '<', '>=', '<=', '==', '!=']);

const MAX_DEPTH = 10;
const MAX_NODES = 50;
const MAX_DEPS = 20;

export class AstEvaluator {
  private nodeCount = 0;
  private dependencies = new Set<string>();

  constructor(private context: AstContext = {}) {}

  public evaluate(node: AstNode): number {
    this.nodeCount = 0;
    this.dependencies.clear();
    const result = this._evaluate(node, 0);
    if (this.dependencies.size > MAX_DEPS) {
      throw new Error(`AST evaluation exceeded maximum dependencies of ${MAX_DEPS}`);
    }
    return result;
  }

  private _evaluate(node: AstNode, depth: number): number {
    this.nodeCount++;
    if (depth > MAX_DEPTH) {
      throw new Error("AST evaluation exceeded maximum depth of " + MAX_DEPTH);
    }
    if (this.nodeCount > MAX_NODES) {
      throw new Error("AST evaluation exceeded maximum node count of " + MAX_NODES);
    }

    if (typeof node === 'object' && node !== null && 'const' in node) {
      return Number(node.const);
    }

    if (typeof node === 'object' && node !== null && 'var' in node) {
      this.dependencies.add(node.var);
      const val = this.context[node.var];
      if (val === undefined || val === null) {
        throw new Error(`AST evaluation missing variable: ${node.var}`);
      }
      return Number(val);
    }

    if (typeof node === 'object' && node !== null && 'cond' in node) {
      const condition = this._evaluate(node.cond, depth + 1);
      if (condition !== 0) {
        return this._evaluate(node.then, depth + 1);
      } else {
        return this._evaluate(node.else, depth + 1);
      }
    }

    if (typeof node === 'object' && node !== null && 'op' in node) {
      if (!ALLOWED_OPERATORS.has(node.op)) {
        throw new Error(`AST evaluation disallowed operator: ${node.op}`);
      }

      if ('arg' in node) {
        const arg = this._evaluate(node.arg as AstNode, depth + 1);
        switch (node.op) {
          case 'round': return Math.round(arg);
          default: throw new Error(`Unsupported unary operator: ${node.op}`);
        }
      }

      if ('left' in node && 'right' in node) {
        const left = this._evaluate(node.left as AstNode, depth + 1);
        const right = this._evaluate(node.right as AstNode, depth + 1);

        switch (node.op) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': 
            if (right === 0) throw new Error("AST evaluation division by zero");
            return left / right;
          case 'min': return Math.min(left, right);
          case 'max': return Math.max(left, right);
          case '>': return left > right ? 1 : 0;
          case '<': return left < right ? 1 : 0;
          case '>=': return left >= right ? 1 : 0;
          case '<=': return left <= right ? 1 : 0;
          case '==': return left === right ? 1 : 0;
          case '!=': return left !== right ? 1 : 0;
          default: throw new Error(`Unsupported binary operator: ${node.op}`);
        }
      }
    }

    throw new Error("Invalid AST node format");
  }
}
