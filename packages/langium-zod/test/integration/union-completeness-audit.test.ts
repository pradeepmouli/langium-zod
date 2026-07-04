import { describe, it, expect } from 'vitest';
import { EmptyFileSystem, type Grammar } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { collectAst } from 'langium/grammar';
import { extractTypeDescriptors } from '../../src/extractor.js';
import type { AstTypesLike, ZodUnionTypeDescriptor } from '../../src/types.js';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const parse = parseHelper<Grammar>(services);

async function grammarFrom(src: string): Promise<Grammar> {
  const doc = await parse(src);
  return doc.parseResult.value;
}

/**
 * Completeness audit for discriminated-union member derivation.
 *
 * Ground truth: for every union `U` in `collectAst()`'s raw output, compute
 * the transitive closure of LEAF INTERFACE names reachable from `U`'s raw
 * member list by a SEPARATE, minimal closure computation (a plain BFS over
 * `astTypes.unions`, NOT calling into the extractor's own
 * `resolveTransitiveInterfaceMembers` — an audit that re-used the code under
 * test would only catch regressions in code paths OUTSIDE that function, not
 * bugs IN it). That closure must equal the actual generated
 * `ZodUnionTypeDescriptor.members` set for `U` (as a set — order doesn't
 * matter, only completeness). A mismatch means some real, parseable node
 * shape is missing from the generated discriminated union — the exact class
 * of bug that let `RosettaExpression` silently omit `RosettaLiteral`'s 4
 * members (rune corpus evidence: 29 `RosettaTypeAlias` nodes whose
 * `TypeCallArgument.value` is a bare literal all failed schema validation).
 *
 * Exercises a REAL parsed grammar (not a hand-built `AstTypesLike` fixture)
 * with a union-of-unions THREE LEVELS deep, several sibling unions at
 * different nesting depths, and a mix of shapes (keyword-enum union
 * alongside object unions) — broader coverage than the single reproduction
 * case in `extractor.test.ts`, so this test can catch a regression in ANY
 * union shape, not just the exact rune shape.
 */
describe('union completeness audit (grammar ground truth, independent of the code under test)', () => {
  it('every union descriptor\'s members set matches an independently-computed transitive interface closure', async () => {
    const grammar = await grammarFrom(
      `grammar UnionAudit3
entry Model: value=Expr;

// Three-level union-of-unions, extending the proven RosettaExpression/
// RosettaLiteral reproduction shape one level deeper: Expression -> Literal
// -> Nested, each level mixing a direct leaf sibling with a nested union.
Expr infers Expression:
    OtherExpr | LiteralRule
;
OtherExpr infers Expression:
    {infer OtherExpr} 'other'
;
LiteralRule infers Literal:
    BoolLiteralRule | NestedRule
;
BoolLiteralRule infers BoolLiteral:
    value?='true'
;
NestedRule infers Nested:
    NestedARule | NestedBRule
;
NestedARule infers NestedA:
    {infer NestedA} value=ID
;
NestedBRule infers NestedB:
    {infer NestedB} value=ID
;

// A keyword-enum union sitting alongside the object-union hierarchy — must
// be correctly SKIPPED by the audit (no interface members expected).
Modifier returns string:
    'any' | 'all'
;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );

    const astTypes = collectAst(grammar) as unknown as AstTypesLike;
    const descriptors = extractTypeDescriptors(astTypes);
    const interfaceNames = new Set(
      descriptors.filter((d) => d.kind === 'object').map((d) => d.name)
    );
    const unionDescriptorsByName = new Map(
      descriptors
        .filter((d): d is ZodUnionTypeDescriptor => d.kind === 'union')
        .map((d) => [d.name, d])
    );

    const rawMembersByUnionName = new Map<string, string[]>();
    for (const union of astTypes.unions) {
      rawMembersByUnionName.set(union.name, extractRawMemberNames(union));
    }

    // Sanity: this grammar actually produces a union-of-unions at 3 levels —
    // if it didn't, the audit below would trivially pass without exercising
    // anything, which would be a silently vacuous test.
    expect(rawMembersByUnionName.get('Expression')).toEqual(
      expect.arrayContaining(['OtherExpr', 'Literal'])
    );
    expect(rawMembersByUnionName.get('Literal')).toEqual(
      expect.arrayContaining(['BoolLiteral', 'Nested'])
    );
    expect(rawMembersByUnionName.get('Nested')).toEqual(
      expect.arrayContaining(['NestedA', 'NestedB'])
    );

    function independentClosure(unionName: string): Set<string> {
      const closure = new Set<string>();
      const queue = [...(rawMembersByUnionName.get(unionName) ?? [])];
      const visitedUnions = new Set([unionName]);
      while (queue.length > 0) {
        const member = queue.shift() as string;
        if (interfaceNames.has(member)) {
          closure.add(member);
          continue;
        }
        const nestedRaw = rawMembersByUnionName.get(member);
        if (nestedRaw && !visitedUnions.has(member)) {
          visitedUnions.add(member);
          queue.push(...nestedRaw);
        }
      }
      return closure;
    }

    const mismatches: string[] = [];
    for (const unionName of rawMembersByUnionName.keys()) {
      const expectedClosure = independentClosure(unionName);
      if (expectedClosure.size === 0) {
        continue; // Keyword/regex/primitive-alias union shape — no object members expected.
      }
      const actualMembers = new Set(unionDescriptorsByName.get(unionName)?.members ?? []);
      const missing = [...expectedClosure].filter((name) => !actualMembers.has(name));
      if (missing.length > 0) {
        mismatches.push(`${unionName}: missing [${missing.join(', ')}]`);
      }
      // Extras direction: the generated union must not contain MORE members
      // than the independently-computed closure either — an over-flattening
      // regression (e.g. a future change that widens the recursion and pulls
      // in unrelated types) would silently accept parser output that should
      // be rejected, the opposite failure mode from the one this bug fixed.
      const extra = [...actualMembers].filter((name) => !expectedClosure.has(name));
      if (extra.length > 0) {
        mismatches.push(`${unionName}: extra [${extra.join(', ')}]`);
      }
    }

    expect(mismatches).toEqual([]);

    // Explicit assertion on the deepest case: Expression's flattened members
    // must include NestedA and NestedB, three levels down through Literal ->
    // Nested — the exact class of gap the RosettaExpression bug exposed,
    // extended one level further than the real-world reproduction to prove
    // the fix generalizes to arbitrary nesting depth, not just depth 2.
    expect(unionDescriptorsByName.get('Expression')?.members).toEqual(
      expect.arrayContaining(['OtherExpr', 'BoolLiteral', 'NestedA', 'NestedB'])
    );
  });
});

// Deliberately reimplements the same raw-shape parsing as extractor.ts's
// private `extractUnionMembers` (rather than importing it) so this audit
// stays independent of the code under test. If `collectAst()`'s raw union
// shape ever changes (e.g. a future Langium version), BOTH this copy and
// `extractUnionMembers` need updating together, or this audit will silently
// stop exercising anything (every union would report an empty closure and
// be skipped, not fail loudly) — keep them in sync.
function extractRawMemberNames(unionType: { members?: unknown; type?: unknown }): string[] {
  if (Array.isArray(unionType.members)) {
    return unionType.members.filter((m): m is string => typeof m === 'string');
  }
  const source = unionType.type as { types?: unknown[]; alternatives?: unknown[] } | undefined;
  const alternatives = source?.types ?? source?.alternatives ?? [];
  if (!Array.isArray(alternatives)) {
    return [];
  }
  const members: string[] = [];
  for (const item of alternatives) {
    if (typeof item === 'string') {
      members.push(item);
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (obj['value'] && typeof obj['value'] === 'object') {
      const val = obj['value'] as Record<string, unknown>;
      if (typeof val['name'] === 'string') {
        members.push(val['name']);
        continue;
      }
    }
    const maybeName = obj['name'] ?? obj['type'];
    if (typeof maybeName === 'string') {
      members.push(maybeName);
    }
  }
  return members;
}
