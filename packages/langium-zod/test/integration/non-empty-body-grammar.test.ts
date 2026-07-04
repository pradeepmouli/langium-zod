import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EmptyFileSystem, type Grammar } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { generateZodSchemas } from '../../src/api.js';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const parse = parseHelper<Grammar>(services);

async function grammarFrom(src: string): Promise<Grammar> {
  const doc = await parse(src);
  return doc.parseResult.value;
}

// Scratch dir INSIDE the package so `import 'zod'` resolves against this
// package's real node_modules (a tmpdir-rooted file has no node_modules chain).
const scratchRoot = join(process.cwd(), 'packages/langium-zod/test/.scratch-non-empty-body');
mkdirSync(scratchRoot, { recursive: true });

/** Writes generated source to a scratch .mjs file (under the package tree, so
 * `import 'zod'` resolves) and imports it. */
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

describe('at-least-one-of refinement from a real parsed grammar', () => {
  it('emits .superRefine for a RosettaSynonymBody-shaped 5-way alternation', async () => {
    const grammar = await grammarFrom(
      `grammar Test
entry Model: 'synonym' body=Body;
Body:
    (
        'value' values+=ID (',' values+=ID)*
        | 'hint' hints+=STRING (',' hints+=STRING)*
        | 'merge' merge=STRING
        | mappingLogic=STRING
        | 'meta' metaValues+=STRING (',' metaValues+=STRING)*
    )
    ('dateFormat' format=STRING)?
;
terminal ID: /[a-z]+/;
terminal STRING: /"[^"]*"/;
hidden terminal WS: /\\s+/;`
    );

    const source = generateZodSchemas({ grammar });
    expect(source).toContain('BodySchema');
    expect(source).toMatch(/\.superRefine\(/);

    const module = await importGenerated(source);
    const bodySchema = module.BodySchema as SafeParseable;

    // None of {values, hints, merge, mappingLogic, metaValues} populated → fails.
    expect(
      bodySchema.safeParse({ $type: 'Body', values: [], hints: [], metaValues: [] }).success
    ).toBe(false);

    // One alternative populated (mappingLogic) → passes.
    expect(
      bodySchema.safeParse({
        $type: 'Body',
        values: [],
        hints: [],
        metaValues: [],
        mappingLogic: 'foo'
      }).success
    ).toBe(true);

    // One alternative populated (non-empty values array) → passes.
    expect(
      bodySchema.safeParse({ $type: 'Body', values: ['a'], hints: [], metaValues: [] }).success
    ).toBe(true);
  });

  it('excludes a boolean flag from the at-least-one-of set (RosettaMappingInstance shape)', async () => {
    const grammar = await grammarFrom(
      `grammar Test2
entry Model: 'map' inst=Instance;
Instance:
    ('set' 'when') when=STRING
    | (default?='default' 'to') set=STRING
;
terminal STRING: /"[^"]*"/;
hidden terminal WS: /\\s+/;`
    );

    const source = generateZodSchemas({ grammar });
    expect(source).toMatch(/\.superRefine\(/);
    // The boolean flag must not appear inside the superRefine's presence check.
    const refineBlock = source.slice(source.indexOf('.superRefine('));
    expect(refineBlock).not.toMatch(/val\["default"\]/);

    const module = await importGenerated(source);
    const instanceSchema = module.InstanceSchema as SafeParseable;

    // Neither `when` nor `set` populated (only the boolean flag, false) → fails.
    expect(instanceSchema.safeParse({ $type: 'Instance', default: false }).success).toBe(false);
    // `set` populated → passes.
    expect(
      instanceSchema.safeParse({ $type: 'Instance', default: true, set: 'x' }).success
    ).toBe(true);
    // `when` populated → passes.
    expect(instanceSchema.safeParse({ $type: 'Instance', when: 'x' }).success).toBe(true);
  });

  it('does NOT emit .superRefine for a plain (non-alternating) rule', async () => {
    const grammar = await grammarFrom(
      `grammar Test3
entry Model: name=ID;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/\.superRefine\(/);
  });

  it('does NOT emit .superRefine when a bare-star array property is genuinely optional-empty (Choice/Data shape)', async () => {
    // Mirrors rune's `Choice: 'choice' name=ID ':' attributes+=Option*;` — a plain
    // star with no alternation; an empty body is grammatically legal.
    const grammar = await grammarFrom(
      `grammar Test4
entry Model: 'choice' name=ID ':' attributes+=Option*;
Option: name=ID;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/\.superRefine\(/);
    expect(source).not.toMatch(/"attributes":\s*z\.array\([^)]*\)\.min\(1\)/);
  });

  it('does NOT emit .superRefine when a branch has ONLY a boolean flag (RuleReferenceAnnotation shape)', async () => {
    // (reportingRule=[Rule] | empty?='empty') — the `empty` branch has no
    // checkable (non-flag) assignment, so a document taking that branch has
    // `reportingRule` undefined. A refinement keyed only on `reportingRule`
    // would reject that legitimately-parsed document (THE HARD INVARIANT).
    const grammar = await grammarFrom(
      `grammar Test6
entry Model: 'ref' (reportingRule=[Rule:ID] | empty?='empty');
Rule: name=ID;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/\.superRefine\(/);

    const module = await importGenerated(source);
    const modelSchema = module.ModelSchema as SafeParseable;
    // The `empty` branch parses with `reportingRule` absent — must be valid.
    expect(modelSchema.safeParse({ $type: 'Model', empty: true }).success).toBe(true);
  });

  it('does NOT emit .superRefine when the alternation is wrapped in an optional group (probe a1)', async () => {
    // 'kw' name=ID (a=STRING | b=INT)? — the optional GROUP wrapping the
    // alternation means a document may take it zero times, producing
    // {$type, name} with neither `a` nor `b` populated. A refinement here
    // would reject that legitimately-parsed shape.
    const grammar = await grammarFrom(
      `grammar TestA1
entry Model: 'kw' name=ID (a=STRING | b=INT)?;
terminal ID: /[a-z]+/;
terminal STRING: /"[^"]*"/;
terminal INT returns number: /[0-9]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/\.superRefine\(/);

    const module = await importGenerated(source);
    const modelSchema = module.ModelSchema as SafeParseable;
    // Taking the optional group zero times: neither `a` nor `b` present.
    expect(modelSchema.safeParse({ $type: 'Model', name: 'x' }).success).toBe(true);
  });

  it('does NOT emit .superRefine when the alternation is starred (probe a2)', async () => {
    // ('add' adds+=S | 'rem' rems+=S)* — zero iterations is legal; a document
    // with `name` only and empty `adds`/`rems` arrays must remain valid.
    const grammar = await grammarFrom(
      `grammar TestA2
entry Model: name=ID ('add' adds+=ID | 'rem' rems+=ID)*;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/\.superRefine\(/);

    const module = await importGenerated(source);
    const modelSchema = module.ModelSchema as SafeParseable;
    expect(
      modelSchema.safeParse({ $type: 'Model', name: 'x', adds: [], rems: [] }).success
    ).toBe(true);
  });

  it('does NOT emit .superRefine for a mandatory alternation nested inside an optional group (probe a3)', async () => {
    // ('with' (a=STRING | b=INT))? — the alternation itself has no cardinality,
    // but its enclosing Group is optional, so zero-occurrence is still legal.
    const grammar = await grammarFrom(
      `grammar TestA3
entry Model: name=ID ('with' (a=STRING | b=INT))?;
terminal ID: /[a-z]+/;
terminal STRING: /"[^"]*"/;
terminal INT returns number: /[0-9]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/\.superRefine\(/);

    const module = await importGenerated(source);
    const modelSchema = module.ModelSchema as SafeParseable;
    expect(modelSchema.safeParse({ $type: 'Model', name: 'x' }).success).toBe(true);
  });

  it('does NOT emit .superRefine for a mandatory alternation inside an optionally-called fragment (probe d2)', async () => {
    // Body? where fragment Body: (a=STRING | b=INT) — the fragment's OWN
    // content is a mandatory 2-way alternation, but the CALL SITE is optional
    // (`Body?`), and the fragment's $container chain ends at the fragment
    // rule itself (invisible to the call-site cardinality) — same
    // fragment-boundary class array-min-occurrence handles (PR #96).
    const grammar = await grammarFrom(
      `grammar TestD2
entry Model: name=ID (Body)?;
fragment Body: (a=STRING | b=INT);
terminal ID: /[a-z]+/;
terminal STRING: /"[^"]*"/;
terminal INT returns number: /[0-9]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/\.superRefine\(/);

    const module = await importGenerated(source);
    const modelSchema = module.ModelSchema as SafeParseable;
    expect(modelSchema.safeParse({ $type: 'Model', name: 'x' }).success).toBe(true);
  });

  it('does NOT emit .superRefine for a type-inferring alternation (NestedAnnotationPath shape)', async () => {
    // Mirrors rune's NestedAnnotationPath: an Alternatives whose branches infer
    // DIFFERENT types (Path vs DeepPath) via `{infer Type.feature=current}` — a
    // type-union rule, not an intra-type alternation. DeepPath's own properties
    // (receiver/operator/attribute) all live on ONE branch and must not produce
    // a (vacuously-true) at-least-one-of refinement on DeepPath.
    const grammar = await grammarFrom(
      `grammar Test5
entry Model: value=Nested;
Nested infers Path:
    Primary (
        {infer Path.receiver=current} operator='->' attribute=ID
        | {infer DeepPath.receiver=current} operator='->>' attribute=ID
    )*
;
Primary infers Path:
    {infer Ref} attribute=ID
;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).toContain('DeepPathSchema');
    const deepPathSchemaLine = source
      .split('\n')
      .find((line) => line.startsWith('export const DeepPathSchema'));
    expect(deepPathSchemaLine).not.toMatch(/\.superRefine\(/);
  });
});
