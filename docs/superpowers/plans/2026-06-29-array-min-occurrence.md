# langium-zod Array Min-Occurrence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit `z.array(...).min(1)` for array properties whose grammar minimum-occurrence is ≥1, derived from real parsed grammars (not just synthetic fixtures), covering both `x+=A+` and the comma-list idiom `x+=A (',' x+=A)*`.

**Architecture:** Langium's `collectAst` `Property` carries `astNodes: Set<Assignment | Action | TypeAttribute>` but no `cardinality`/`operator` fields, so the current `resolveArrayMinItems` (which reads `property.cardinality`/`operator`) only ever fires for synthetic test fixtures — never a real grammar. Add a min-occurrence analysis that walks each contributing `+=` `Assignment`'s `$container` cardinality chain to the `ParserRule` (mandatory iff no `?`/`*` ancestor) and returns `minItems = 1` if any contributing assignment is mandatory. Surface `astNodes` to the extractor by adding it to `PropertyLike` (the runtime objects already carry it; only the type drops it). Emission is unchanged — both `withArrayMin` sites already key off `minItems`.

**Tech Stack:** TypeScript (ESM), Langium `^4.2.4` (`GrammarAST`, `GrammarUtils.isOptionalCardinality`), Vitest, Changesets.

## Global Constraints

- Base branch: `feat/array-min-occurrence` off `origin/develop` (the 0.9.0 release line) — worktree at `/Users/pmouli/GitHub.nosync/active/ts/langium-zod-min-occurrence`. NOT master (stale at 0.5.4).
- Package: `langium-zod` at `packages/langium-zod`. Commands run from the package dir or root via `pnpm --filter langium-zod <script>`.
- **Additive / back-compat:** the existing synthetic-fixture path (`property.assignment === '+=' && cardinality === '+'`) MUST keep working — `test/integration/generation.test.ts` and `test/unit/extractor.test.ts` rely on it. The new astNodes path takes precedence only when it yields a result.
- **Emission untouched:** do NOT change the two `withArrayMin` blocks in `src/generator.ts` (lines ~126 and ~171) — they already emit `.min(minItems)` for array properties.
- Imports come from the top-level `langium` package: `import { GrammarAST, GrammarUtils } from 'langium'` and `import type { AstNode } from 'langium'`.
- Release: a **minor** changeset (`langium-zod`) → `0.10.0`.
- Commands: test `pnpm --filter langium-zod test` (`vitest run`); type-check `pnpm --filter langium-zod type-check` (`tsc -p tsconfig.json --noEmit`); build `pnpm --filter langium-zod build` (`tsc -p tsconfig.json`).

## File Structure

- **Create** `packages/langium-zod/src/array-min-occurrence.ts` — the analysis: `arrayMinFromAstNodes(astNodes)` + the internal `isMandatoryOccurrence` walk. One responsibility: grammar → array minimum.
- **Modify** `packages/langium-zod/src/types.ts` — add `astNodes?: ReadonlySet<AstNode>` to `PropertyLike` (+ `import type { AstNode } from 'langium'`).
- **Modify** `packages/langium-zod/src/extractor.ts` — `resolveArrayMinItems` consults the new analysis first, then falls back to the existing synthetic check.
- **Create** `packages/langium-zod/test/unit/array-min-occurrence.test.ts` — unit tests on hand-built grammar element trees.
- **Create** `packages/langium-zod/test/integration/min-occurrence-grammar.test.ts` — end-to-end: parse a real grammar → `generateZodSchemas({ grammar })` → assert `.min(1)`.
- **Create** `.changeset/array-min-occurrence.md` — minor bump + notes.

---

### Task 1: Worktree setup + surface `astNodes` on `PropertyLike`

**Files:**
- Setup: the worktree `/Users/pmouli/GitHub.nosync/active/ts/langium-zod-min-occurrence` (already created off `origin/develop`, branch `feat/array-min-occurrence`).
- Modify: `packages/langium-zod/src/types.ts` (the `PropertyLike` interface, ~line 192; add an import at the top).

**Interfaces:**
- Produces: `PropertyLike.astNodes?: ReadonlySet<AstNode>` — the originating Langium grammar nodes, consumed by Task 2/3.

- [ ] **Step 1: Install deps + confirm green baseline**

```bash
cd /Users/pmouli/GitHub.nosync/active/ts/langium-zod-min-occurrence
pnpm install
pnpm --filter langium-zod test
```
Expected: existing suite passes (includes `test/integration/generation.test.ts` "emits .min(1) only for += properties with + cardinality" and `test/unit/extractor.test.ts` "sets minItems=1 only for += properties with + cardinality").

- [ ] **Step 2: Add the `astNodes` field to `PropertyLike`**

At the top of `packages/langium-zod/src/types.ts`, add (next to existing imports):
```ts
import type { AstNode } from 'langium';
```
Inside `export interface PropertyLike { ... }` (after the `comment?` field), add:
```ts
  /**
   * Originating Langium grammar nodes for this property, from collectAst's
   * `Property.astNodes` (a `Set<Assignment | Action | TypeAttribute>`). Used to
   * derive array minimum-occurrence by walking each `+=` Assignment's cardinality
   * chain. Absent on synthetic (hand-authored) `astTypes` test fixtures.
   */
  astNodes?: ReadonlySet<AstNode>;
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter langium-zod type-check`
Expected: PASS (the real `collectAst` `Property` already provides `astNodes` at runtime; this only widens the type — `src/api.ts:143`'s `as unknown as AstTypesLike` cast is unaffected).

- [ ] **Step 4: Commit**

```bash
git add packages/langium-zod/src/types.ts
git commit -m "feat(types): surface Property.astNodes on PropertyLike"
```

---

### Task 2: Min-occurrence analysis module

**Files:**
- Create: `packages/langium-zod/src/array-min-occurrence.ts`
- Test: `packages/langium-zod/test/unit/array-min-occurrence.test.ts`

**Interfaces:**
- Consumes: `PropertyLike.astNodes` (Task 1); Langium `GrammarAST`, `GrammarUtils.isOptionalCardinality`.
- Produces: `export function arrayMinFromAstNodes(astNodes: ReadonlySet<AstNode> | undefined): number | undefined` — returns `1` if any `+=` assignment for the property is on a mandatory path, else `undefined`.

- [ ] **Step 1: Write the failing test**

Create `packages/langium-zod/test/unit/array-min-occurrence.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { arrayMinFromAstNodes } from '../../src/array-min-occurrence.js';

// Hand-built grammar element nodes. Langium's GrammarAST predicates key off
// `$type`, so plain objects with the right `$type` + `$container` chain suffice.
const RULE = { $type: 'ParserRule' } as never; // not an AbstractElement → walk stops
function assignment(operator: '+=' | '=' | '?=', cardinality: '*' | '+' | '?' | undefined, container: unknown) {
  return { $type: 'Assignment', operator, cardinality, $container: container } as never;
}
function group(cardinality: '*' | '+' | '?' | undefined, container: unknown) {
  return { $type: 'Group', cardinality, $container: container } as never;
}

describe('arrayMinFromAstNodes', () => {
  it('returns 1 for a mandatory += assignment directly under the rule', () => {
    expect(arrayMinFromAstNodes(new Set([assignment('+=', undefined, RULE)]))).toBe(1);
  });

  it('returns 1 for the comma-list idiom (first mandatory, second inside a * group)', () => {
    const first = assignment('+=', undefined, RULE);
    const star = group('*', RULE);
    const second = assignment('+=', undefined, star);
    expect(arrayMinFromAstNodes(new Set([first, second]))).toBe(1);
  });

  it('returns undefined when every contributing assignment is optional', () => {
    const star = group('*', RULE);
    expect(arrayMinFromAstNodes(new Set([assignment('+=', undefined, star)]))).toBeUndefined();
  });

  it('returns 1 for an explicit + cardinality assignment', () => {
    expect(arrayMinFromAstNodes(new Set([assignment('+=', '+', RULE)]))).toBe(1);
  });

  it('returns undefined for a non-array (=) assignment', () => {
    expect(arrayMinFromAstNodes(new Set([assignment('=', undefined, RULE)]))).toBeUndefined();
  });

  it('returns undefined for empty/absent astNodes', () => {
    expect(arrayMinFromAstNodes(undefined)).toBeUndefined();
    expect(arrayMinFromAstNodes(new Set())).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter langium-zod test -- test/unit/array-min-occurrence.test.ts`
Expected: FAIL — `Cannot find module '../../src/array-min-occurrence.js'`.

- [ ] **Step 3: Implement the module**

Create `packages/langium-zod/src/array-min-occurrence.ts`:
```ts
import { GrammarAST, GrammarUtils } from 'langium';
import type { AstNode } from 'langium';

/**
 * True when `node` (a grammar Assignment/Action) contributes on an UNCONDITIONAL
 * path: neither it nor any AbstractElement ancestor up to the ParserRule carries
 * an optional cardinality (`?` or `*`). `+` and absent cardinality are mandatory.
 */
function isMandatoryOccurrence(node: AstNode): boolean {
  let el: AstNode | undefined = node;
  while (el && GrammarAST.isAbstractElement(el)) {
    const element = el as GrammarAST.AbstractElement;
    if (GrammarUtils.isOptionalCardinality(element.cardinality, element)) {
      return false;
    }
    el = el.$container;
  }
  return true;
}

/**
 * Array minimum length derived from the grammar Assignment nodes that produce an
 * array property (`Property.astNodes`). Returns `1` when ANY `+=` assignment for
 * the property occurs on a mandatory path — covering both `x+=A+` and the
 * comma-list idiom `x+=A (',' x+=A)*` (where the first `x+=A` is mandatory and
 * the repeated one sits in a `*` group). Returns `undefined` otherwise.
 */
export function arrayMinFromAstNodes(astNodes: ReadonlySet<AstNode> | undefined): number | undefined {
  if (!astNodes) return undefined;
  for (const node of astNodes) {
    const isArrayAssign =
      (GrammarAST.isAssignment(node) && node.operator === '+=') ||
      (GrammarAST.isAction(node) && node.operator === '+=');
    if (isArrayAssign && isMandatoryOccurrence(node)) {
      return 1;
    }
  }
  return undefined;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter langium-zod test -- test/unit/array-min-occurrence.test.ts`
Expected: PASS (6 tests). If `GrammarAST.isAssignment`/`isAbstractElement` reject the hand-built objects, that is a real signal — verify against the Langium `reflection.isInstance` ($type-based) behavior; the integration test in Task 4 is the authoritative cross-check.

- [ ] **Step 5: Commit**

```bash
git add packages/langium-zod/src/array-min-occurrence.ts packages/langium-zod/test/unit/array-min-occurrence.test.ts
git commit -m "feat: array min-occurrence analysis from grammar Assignment nodes"
```

---

### Task 3: Wire the analysis into `resolveArrayMinItems` (back-compat preserved)

**Files:**
- Modify: `packages/langium-zod/src/extractor.ts` (`resolveArrayMinItems`, ~lines 76-96; add an import).
- Test: `packages/langium-zod/test/unit/extractor.test.ts` (add an astNodes case; existing cases stay).

**Interfaces:**
- Consumes: `arrayMinFromAstNodes` (Task 2), `PropertyLike.astNodes` (Task 1).
- Produces: `resolveArrayMinItems` now returns `1` for real-grammar mandatory `+=` arrays AND the existing synthetic `+` case.

- [ ] **Step 1: Write the failing test**

In `packages/langium-zod/test/unit/extractor.test.ts`, add inside the existing `describe` that covers minItems (mirror the existing "sets minItems=1 only for += properties with + cardinality" test, near line 108):
```ts
it('sets minItems=1 from astNodes (comma-list idiom, no synthetic cardinality)', () => {
  const RULE = { $type: 'ParserRule' } as never;
  const star = { $type: 'Group', cardinality: '*', $container: RULE } as never;
  const first = { $type: 'Assignment', operator: '+=', cardinality: undefined, $container: RULE } as never;
  const second = { $type: 'Assignment', operator: '+=', cardinality: undefined, $container: star } as never;

  const descriptors = extractTypeDescriptors({
    interfaces: [
      {
        name: 'Container',
        properties: [
          // No `assignment`/`cardinality` — exercises the real-grammar path only.
          { name: 'sources', type: 'Item', optional: false, astNodes: new Set([first, second]) }
        ]
      },
      { name: 'Item', properties: [{ name: 'name', type: 'ID', optional: false }] }
    ],
    unions: []
  });
  const container = descriptors.find((e) => e.name === 'Container' && e.kind === 'object');
  if (!container || container.kind !== 'object') throw new Error('Container descriptor not found');
  expect(container.properties.find((p) => p.name === 'sources')?.minItems).toBe(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter langium-zod test -- test/unit/extractor.test.ts`
Expected: FAIL — `sources` `minItems` is `undefined` (resolveArrayMinItems ignores `astNodes` today).

- [ ] **Step 3: Implement — consult the analysis first**

In `packages/langium-zod/src/extractor.ts`, add the import near the top (with the other `./` imports):
```ts
import { arrayMinFromAstNodes } from './array-min-occurrence.js';
```
Replace the body of `resolveArrayMinItems` (keep the signature) so the grammar path runs first and the synthetic path remains as fallback:
```ts
function resolveArrayMinItems(property: PropertyLike): number | undefined {
  // Real-grammar path: derive the minimum from the originating Assignment nodes'
  // cardinality chains. Covers `x+=A+` AND the comma-list idiom `x+=A (',' x+=A)*`.
  const fromGrammar = arrayMinFromAstNodes(property.astNodes);
  if (fromGrammar !== undefined) {
    return fromGrammar;
  }

  // Back-compat: synthetic test fixtures set `assignment`/`cardinality` directly
  // (no astNodes). Real `collectAst` Property objects never reach this branch.
  const assignmentOperator = property.assignment ?? property.operator ?? '=';
  if (assignmentOperator !== '+=') {
    return undefined;
  }
  const typeObj = property.type as
    | { cardinality?: '*' | '+' | '?'; elementType?: { cardinality?: '*' | '+' | '?' } }
    | undefined;
  const cardinality =
    property.ruleCall?.cardinality ??
    property.cardinality ??
    typeObj?.cardinality ??
    typeObj?.elementType?.cardinality;
  if (cardinality === '+') {
    return 1;
  }
  return undefined;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter langium-zod test -- test/unit/extractor.test.ts`
Expected: PASS — the new astNodes case AND the existing "sets minItems=1 only for += properties with + cardinality" (synthetic) case both green.

- [ ] **Step 5: Commit**

```bash
git add packages/langium-zod/src/extractor.ts packages/langium-zod/test/unit/extractor.test.ts
git commit -m "feat(extractor): derive array minItems from grammar astNodes"
```

---

### Task 4: End-to-end integration test (real grammar → emission)

**Files:**
- Test: `packages/langium-zod/test/integration/min-occurrence-grammar.test.ts`

**Interfaces:**
- Consumes: `generateZodSchemas({ grammar })` (`src/api.ts`), Langium grammar services + test parse helper.

- [ ] **Step 1: Write the test**

Create `packages/langium-zod/test/integration/min-occurrence-grammar.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { EmptyFileSystem, type Grammar } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { generateZodSchemas } from '../../src/api.js';

const services = createLangiumGrammarServices(EmptyFileSystem).Grammar;
const parse = parseHelper<Grammar>(services);

async function grammarFrom(src: string): Promise<Grammar> {
  const doc = await parse(src);
  return doc.parseResult.value;
}

describe('min-occurrence from a real parsed grammar', () => {
  it('emits .min(1) for the comma-list idiom x+=A (\',\' x+=A)*', async () => {
    const grammar = await grammarFrom(
      `grammar Test
entry Model: items+=Item (',' items+=Item)*;
Item: name=ID;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).toMatch(/items:\s*z\.array\([^)]*\)\.min\(1\)/);
  });

  it('does NOT emit .min(1) for an optional array (items+=Item)*', async () => {
    const grammar = await grammarFrom(
      `grammar Test2
entry Model: (items+=Item)*;
Item: name=ID;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/items:\s*z\.array\([^)]*\)\.min\(1\)/);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter langium-zod test -- test/integration/min-occurrence-grammar.test.ts`
Expected: PASS. If `langium/test`'s `parseHelper` or `langium/grammar`'s `createLangiumGrammarServices` import paths differ in 4.2.4, resolve against the installed `langium` package exports (these are the standard Langium 4 test entrypoints) before adjusting the test — do NOT weaken the assertions.

- [ ] **Step 3: Run the FULL suite (regression)**

Run: `pnpm --filter langium-zod test`
Expected: PASS — every prior test green, including the synthetic `generation.test.ts` "emits .min(1) only for += properties with + cardinality".

- [ ] **Step 4: Type-check**

Run: `pnpm --filter langium-zod type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/langium-zod/test/integration/min-occurrence-grammar.test.ts
git commit -m "test: end-to-end array min(1) from a real parsed grammar"
```

---

### Task 5: Changeset (minor → 0.10.0)

**Files:**
- Create: `.changeset/array-min-occurrence.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/array-min-occurrence.md`:
```md
---
"langium-zod": minor
---

Derive array `.min(1)` from grammar minimum-occurrence for real parsed grammars.

Previously `.min(1)` was emitted only when a single rule call carried an explicit
`+` cardinality — and only for synthetic `astTypes` fixtures, never from a real
`collectAst` grammar (the real Langium `Property` exposes `astNodes` but no
`cardinality`/`operator`). The generator now walks each array property's
originating `Assignment` nodes' cardinality chains (`Property.astNodes` +
`isOptionalCardinality`) and emits `.min(1)` when any `+=` assignment occurs on a
mandatory path. This covers both `x+=A+` and the comma-list idiom
`x+=A (',' x+=A)*` (e.g. a required `sources+=[Src] (',' sources+=[Src])*`).
```

- [ ] **Step 2: Verify the changeset is recognized**

Run: `pnpm changeset status` (from repo root)
Expected: lists `langium-zod` as a minor bump (→ `0.10.0`).

- [ ] **Step 3: Commit**

```bash
git add .changeset/array-min-occurrence.md
git commit -m "chore: changeset for array min-occurrence (minor)"
```

- [ ] **Step 4: Push + open PR against `develop`**

```bash
git push -u origin feat/array-min-occurrence
gh pr create --repo pradeepmouli/langium-zod --base develop \
  --title "feat: array .min(1) from grammar min-occurrence" \
  --body "Walks Property.astNodes Assignment cardinality chains to emit z.array().min(1) for mandatory += arrays (incl. the comma-list idiom). Additive; synthetic-fixture path preserved. Closes the gap where real grammars never got .min(1)."
```
Release (`changeset version` + publish → `0.10.0`) follows the repo's normal release flow on `develop`; the rune integration plan pins `0.10.0` once published.

---

## Notes for the rune integration (Piece A) — not part of this plan

Once `langium-zod@0.10.0` is published, rune bumps the pin in `pnpm-workspace.yaml` and regenerates `packages/core` + `packages/visual-editor` schemas; `RosettaSynonymSchema.sources` / `RosettaClassSynonymSchema.sources` then carry `.min(1)`. That regeneration + the synonym source-picker work is the separate rune-side plan.
