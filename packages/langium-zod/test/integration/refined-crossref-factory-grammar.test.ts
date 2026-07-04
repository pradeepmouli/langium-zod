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

const scratchRoot = join(
  process.cwd(),
  'packages/langium-zod/test/.scratch-refined-crossref-factory'
);
mkdirSync(scratchRoot, { recursive: true });

// .ts (not .mjs): the crossRefValidation projection emits `export interface`
// declarations alongside runtime code — Vite's dynamic import() only strips
// TS-only syntax when the file extension signals TS to its transform pipeline.
async function importGenerated(source: string): Promise<Record<string, unknown>> {
  const dir = mkdtempSync(join(scratchRoot, 'run-'));
  const filePath = join(dir, 'schema.ts');
  try {
    writeFileSync(filePath, source, 'utf8');
    return (await import(`${filePath}?t=${Date.now()}`)) as Record<string, unknown>;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Regression coverage for a real consumer break (rune-langium's
 * `deriveUiSchema`, commit `e789fbad`): the generated `create<X>Schema(refs)`
 * cross-reference factory calls `.extend()` on the descriptor's OWN base
 * schema. When that base carries a `.superRefine()` (an at-least-one-of
 * constraint), zod v4's `.extend()` THROWS at the first invocation —
 * "Cannot overwrite keys on object schemas containing refinements" — because
 * the factory always overrides at least one cross-reference-bearing key that
 * already exists on the base object shape. This is a landmine for the first
 * real adopter of the generated cross-ref factories against a refined type,
 * not just a rune-side symptom.
 */
describe('cross-reference factory on a refined (superRefine-bearing) base schema', () => {
  it('constructs AND validates without throwing (RosettaMappingInstance-shaped alternation + a cross-reference sibling)', async () => {
    // A 2-way mandatory alternation (gains an at-least-one-of superRefine, per
    // the schema-driven-synonym-validity work) PLUS a cross-reference property
    // on the same type, so the descriptor is BOTH refined and cross-ref-bearing
    // — the exact combination the factory emitter must handle.
    const grammar = await grammarFrom(
      `grammar TestRefinedCrossRef
entry Model: 'map' inst=Instance;
Instance:
    (('set' 'when') when=STRING | (default?='default' 'to') set=STRING)
    ref=[Target:ID]
;
Target: name=ID;
terminal ID: /[a-z]+/;
terminal STRING: /"[^"]*"/;
hidden terminal WS: /\\s+/;`
    );

    const source = generateZodSchemas({ grammar, crossRefValidation: true });

    // Confirm the fixture actually exercises BOTH shapes — otherwise this
    // test would pass vacuously without ever calling the buggy code path.
    const instanceSchemaLine = source
      .split('\n')
      .find((line) => line.startsWith('export const InstanceSchema'));
    expect(instanceSchemaLine).toMatch(/\.superRefine\(/);
    expect(source).toContain('export function createInstanceSchema');
    expect(source).toContain('.safeExtend({');
    expect(source).not.toMatch(/InstanceSchema\.extend\(/);

    const module = await importGenerated(source);
    const createInstanceSchema = module.createInstanceSchema as (refs?: unknown) => {
      safeParse: (v: unknown) => { success: boolean };
    };

    // Constructing the factory (calling safeExtend on a refined base) must
    // not throw — this is the exact failure mode being guarded against.
    let refinedSchema: { safeParse: (v: unknown) => { success: boolean } };
    expect(() => {
      refinedSchema = createInstanceSchema({ Target: ['known'] });
    }).not.toThrow();

    // And the resulting schema must still validate correctly: both the
    // at-least-one-of refinement AND the cross-reference resolution.
    expect(
      refinedSchema!.safeParse({
        $type: 'Instance',
        when: 'x',
        ref: { $refText: 'known' }
      }).success
    ).toBe(true);
    expect(
      refinedSchema!.safeParse({
        $type: 'Instance',
        default: false,
        ref: { $refText: 'known' }
      }).success
    ).toBe(false); // neither `when` nor `set` populated — refinement must still fire
  });
});
