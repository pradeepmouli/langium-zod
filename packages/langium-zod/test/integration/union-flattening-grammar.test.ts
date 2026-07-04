import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EmptyFileSystem, type Grammar } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { generateZodSchemas } from '../../src/index.js';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const parse = parseHelper<Grammar>(services);

async function grammarFrom(src: string): Promise<Grammar> {
  const doc = await parse(src);
  return doc.parseResult.value;
}

// Scratch dir INSIDE the package so `import 'zod'` resolves against this
// package's real node_modules (a tmpdir-rooted file has no node_modules chain).
const scratchRoot = join(process.cwd(), 'packages/langium-zod/test/.scratch-union-flattening');
mkdirSync(scratchRoot, { recursive: true });

async function importGenerated(source: string): Promise<Record<string, unknown>> {
  const dir = mkdtempSync(join(scratchRoot, 'run-'));
  const filePath = join(dir, 'schema.mjs');
  try {
    writeFileSync(filePath, source, 'utf8');
    return (await import(`${filePath}?t=${Date.now()}`)) as Record<string, unknown>;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

interface SafeParseable {
  safeParse: (v: unknown) => { success: boolean };
}

describe('union-of-unions member flattening from a real parsed grammar', () => {
  it('flattens a nested literal-style union into the outer expression union (RosettaExpression/RosettaLiteral shape)', async () => {
    // Mirrors rune's PrimaryExpression infers RosettaExpression: ... | RosettaLiteralRule | ...
    // where RosettaLiteralRule infers RosettaLiteral: RosettaBooleanLiteralRule | RosettaStringLiteralRule | ...
    const grammar = await grammarFrom(
      `grammar TestUnionFlatten
entry Model: value=Expr;
Expr infers Expression:
    OtherExpr | LiteralRule
;
OtherExpr infers Expression:
    {infer OtherExpr} 'other'
;
LiteralRule infers Literal:
    BoolLiteralRule | StringLiteralRule
;
BoolLiteralRule infers BoolLiteral:
    value?='true'
;
StringLiteralRule infers StringLiteral:
    value=STRING
;
terminal STRING: /"[^"]*"/;
hidden terminal WS: /\\s+/;`
    );

    const source = generateZodSchemas({ grammar });

    // The generated ExpressionSchema union must include BOTH literal variants,
    // not just OtherExpr — the pre-fix bug silently dropped nested-union
    // members whose name is a union (Literal), not a leaf interface.
    const expressionUnionLine = source
      .split('\n')
      .find((line) => line.startsWith('export const ExpressionSchema'));
    expect(expressionUnionLine).toContain('BoolLiteralSchema');
    expect(expressionUnionLine).toContain('StringLiteralSchema');
    expect(expressionUnionLine).toContain('OtherExprSchema');

    const module = await importGenerated(source);
    const modelSchema = module.ModelSchema as SafeParseable;

    // A bare string literal wherever an Expression is expected — the exact
    // rune corpus shape (`typeAlias X: Y(domain: "value")`) — must parse.
    expect(
      modelSchema.safeParse({ $type: 'Model', value: { $type: 'StringLiteral', value: 'hi' } })
        .success
    ).toBe(true);
    expect(
      modelSchema.safeParse({ $type: 'Model', value: { $type: 'BoolLiteral', value: true } })
        .success
    ).toBe(true);
    expect(
      modelSchema.safeParse({ $type: 'Model', value: { $type: 'OtherExpr' } }).success
    ).toBe(true);
  });

  it('still emits the nested union as its own schema alongside the flattened outer union', async () => {
    const grammar = await grammarFrom(
      `grammar TestUnionFlatten2
entry Model: value=Expr;
Expr infers Expression:
    OtherExpr | LiteralRule
;
OtherExpr infers Expression:
    {infer OtherExpr} 'other'
;
LiteralRule infers Literal:
    BoolLiteralRule | StringLiteralRule
;
BoolLiteralRule infers BoolLiteral:
    value?='true'
;
StringLiteralRule infers StringLiteral:
    value=STRING
;
terminal STRING: /"[^"]*"/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).toContain('export const LiteralSchema');

    const module = await importGenerated(source);
    const literalSchema = module.LiteralSchema as SafeParseable;
    expect(literalSchema.safeParse({ $type: 'StringLiteral', value: 'hi' }).success).toBe(true);
    // Literal's own union must NOT accept OtherExpr (flattening Expression
    // must not corrupt Literal's own narrower member set).
    expect(literalSchema.safeParse({ $type: 'OtherExpr' }).success).toBe(false);
  });
});
