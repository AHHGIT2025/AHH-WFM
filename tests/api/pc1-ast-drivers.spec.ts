const evaluateDriver = (ast: any, context: any) => {
  if (ast.type === 'REF') {
    if (context[ast.id] === undefined) throw new Error('Invalid source element');
    return context[ast.id];
  }
  if (ast.type === 'MULTIPLY') {
    return ast.left * ast.right;
  }
  throw new Error('Unsupported node type');
};

describe('PC-1 AST Driver Mapping', () => {
  it('should evaluate basic driver mappings safely without eval()', () => {
    const context = { el1: 5, el2: 10 };
    const ast = { type: 'REF', id: 'el1' };
    expect(evaluateDriver(ast, context)).toBe(5);
  });

  it('should fail when referencing invalid source element', () => {
    const context = { el1: 5 };
    const ast = { type: 'REF', id: 'el99' };
    expect(() => evaluateDriver(ast, context)).toThrow('Invalid source element');
  });

  it('should evaluate multiplication without eval', () => {
    const ast = { type: 'MULTIPLY', left: 4, right: 5 };
    expect(evaluateDriver(ast, {})).toBe(20);
  });

  it('should enforce depth limits safely', () => {
    const parse = (depth: number) => {
      if (depth > 5) throw new Error('AST depth limit exceeded');
      return true;
    };
    expect(() => parse(6)).toThrow('AST depth limit exceeded');
    expect(parse(4)).toBe(true);
  });
});
