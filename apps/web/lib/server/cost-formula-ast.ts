import crypto from 'crypto';

export type ASTNode =
  | { type: 'literal'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'binary'; operator: '+' | '-' | '*' | '/'; left: ASTNode; right: ASTNode };

export interface FormulaResult {
  value: number;
  warnings?: string[];
}

export class CostFormulaEngine {
  private static readonly MAX_DEPTH = 10;
  private static readonly MAX_NODES = 50;

  static validate(node: ASTNode, depth = 0, nodeCount = { count: 0 }): void {
    if (depth > this.MAX_DEPTH) {
      throw new Error(`Formula exceeds maximum allowed depth of ${this.MAX_DEPTH}`);
    }
    nodeCount.count++;
    if (nodeCount.count > this.MAX_NODES) {
      throw new Error(`Formula exceeds maximum allowed node count of ${this.MAX_NODES}`);
    }

    if (!node || typeof node !== 'object' || !node.type) {
      throw new Error('Invalid AST node structure');
    }

    switch (node.type) {
      case 'literal':
        if (typeof node.value !== 'number' || isNaN(node.value) || !isFinite(node.value)) {
          throw new Error(`Invalid literal value: ${node.value}`);
        }
        break;
      case 'variable':
        if (typeof node.name !== 'string' || !/^[A-Z_][A-Z0-9_]*$/.test(node.name)) {
          throw new Error(`Invalid variable name: ${node.name}`);
        }
        break;
      case 'binary':
        if (!['+', '-', '*', '/'].includes(node.operator)) {
          throw new Error(`Invalid operator: ${node.operator}`);
        }
        this.validate(node.left, depth + 1, nodeCount);
        this.validate(node.right, depth + 1, nodeCount);
        break;
      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
    }
  }

  static evaluate(node: ASTNode, variables: Record<string, number>): number {
    switch (node.type) {
      case 'literal':
        return node.value;
      case 'variable':
        if (!(node.name in variables)) {
          throw new Error(`Missing driver/variable: ${node.name}`);
        }
        return variables[node.name];
      case 'binary': {
        const left = this.evaluate(node.left, variables);
        const right = this.evaluate(node.right, variables);
        
        switch (node.operator) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/':
            if (right === 0) {
              throw new Error('Division by zero error');
            }
            return left / right;
          default:
            throw new Error(`Unknown operator: ${node.operator}`);
        }
      }
    }
  }

  static calculateHash(node: ASTNode): string {
    // Deterministic JSON stringify by manually ordering keys
    const stringify = (n: ASTNode): string => {
      switch (n.type) {
        case 'literal': return `{"type":"literal","value":${n.value}}`;
        case 'variable': return `{"name":"${n.name}","type":"variable"}`;
        case 'binary': return `{"left":${stringify(n.left)},"operator":"${n.operator}","right":${stringify(n.right)},"type":"binary"}`;
      }
    };
    const jsonStr = stringify(node);
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
  }

  static extractVariables(node: ASTNode, vars = new Set<string>()): Set<string> {
    if (node.type === 'variable') {
      vars.add(node.name);
    } else if (node.type === 'binary') {
      this.extractVariables(node.left, vars);
      this.extractVariables(node.right, vars);
    }
    return vars;
  }
}
