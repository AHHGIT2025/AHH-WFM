import { AstEvaluator, AstContext } from '../../apps/web/lib/ast-evaluator';

describe('AstEvaluator', () => {
  it('evaluates constants', () => {
    const evaluator = new AstEvaluator();
    expect(evaluator.evaluate({ const: 42 })).toBe(42);
  });

  it('evaluates variables from context', () => {
    const context: AstContext = { BASE_PAY: 5000, ALLOWANCE: 1500 };
    const evaluator = new AstEvaluator(context);
    expect(evaluator.evaluate({ var: 'BASE_PAY' })).toBe(5000);
    expect(evaluator.evaluate({ var: 'ALLOWANCE' })).toBe(1500);
  });

  it('throws on missing variables', () => {
    const evaluator = new AstEvaluator();
    expect(() => evaluator.evaluate({ var: 'MISSING' })).toThrow('AST evaluation missing variable: MISSING');
  });

  it('evaluates binary operations (+, -, *, /)', () => {
    const context: AstContext = { A: 10, B: 5 };
    const evaluator = new AstEvaluator(context);
    
    expect(evaluator.evaluate({ op: '+', left: { var: 'A' }, right: { var: 'B' } })).toBe(15);
    expect(evaluator.evaluate({ op: '-', left: { var: 'A' }, right: { var: 'B' } })).toBe(5);
    expect(evaluator.evaluate({ op: '*', left: { var: 'A' }, right: { var: 'B' } })).toBe(50);
    expect(evaluator.evaluate({ op: '/', left: { var: 'A' }, right: { var: 'B' } })).toBe(2);
  });

  it('prevents division by zero', () => {
    const context: AstContext = { A: 10, B: 0 };
    const evaluator = new AstEvaluator(context);
    
    expect(() => evaluator.evaluate({ op: '/', left: { var: 'A' }, right: { var: 'B' } })).toThrow('AST evaluation division by zero');
  });

  it('evaluates comparisons (>, <, >=, <=, ==, !=)', () => {
    const context: AstContext = { A: 10, B: 5, C: 10 };
    const evaluator = new AstEvaluator(context);
    
    expect(evaluator.evaluate({ op: '>', left: { var: 'A' }, right: { var: 'B' } })).toBe(1);
    expect(evaluator.evaluate({ op: '<', left: { var: 'A' }, right: { var: 'B' } })).toBe(0);
    expect(evaluator.evaluate({ op: '>=', left: { var: 'A' }, right: { var: 'C' } })).toBe(1);
    expect(evaluator.evaluate({ op: '==', left: { var: 'A' }, right: { var: 'C' } })).toBe(1);
    expect(evaluator.evaluate({ op: '!=', left: { var: 'A' }, right: { var: 'B' } })).toBe(1);
  });

  it('evaluates math functions (min, max, round)', () => {
    const evaluator = new AstEvaluator();
    
    expect(evaluator.evaluate({ op: 'min', left: { const: 10 }, right: { const: 20 } })).toBe(10);
    expect(evaluator.evaluate({ op: 'max', left: { const: 10 }, right: { const: 20 } })).toBe(20);
    expect(evaluator.evaluate({ op: 'round', arg: { const: 10.6 } })).toBe(11);
    expect(evaluator.evaluate({ op: 'round', arg: { const: 10.4 } })).toBe(10);
  });

  it('evaluates conditionals (ternary)', () => {
    const context: AstContext = { SCORE: 85 };
    const evaluator = new AstEvaluator(context);
    
    // SCORE >= 80 ? 100 : 0
    const ast = {
      cond: { op: '>=', left: { var: 'SCORE' }, right: { const: 80 } },
      then: { const: 100 },
      else: { const: 0 }
    };
    
    expect(evaluator.evaluate(ast)).toBe(100);
    
    // SCORE < 80 ? 100 : 0
    const ast2 = {
      cond: { op: '<', left: { var: 'SCORE' }, right: { const: 80 } },
      then: { const: 100 },
      else: { const: 0 }
    };
    
    expect(evaluator.evaluate(ast2)).toBe(0);
  });

  it('prevents unsupported operations', () => {
    const evaluator = new AstEvaluator();
    // @ts-ignore
    expect(() => evaluator.evaluate({ op: 'eval', left: { const: 1 }, right: { const: 2 } })).toThrow('AST evaluation disallowed operator: eval');
  });

  it('enforces depth limits', () => {
    const evaluator = new AstEvaluator();
    let deepAst: any = { const: 1 };
    for (let i = 0; i < 55; i++) {
      deepAst = { op: '+', left: { const: 1 }, right: deepAst };
    }
    
    expect(() => evaluator.evaluate(deepAst)).toThrow('AST evaluation exceeded maximum depth of 50');
  });
});
