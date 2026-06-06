# langium-zod `domain` Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `domain` generation target to `langium-zod` that emits a quirk-free, typed *domain surface* from a Langium grammar — per-kind read interfaces, a `toDomain(node)` read projection, and field-precise write accessors — reusing the existing IR pipeline.

**Architecture:** A new emitter (`src/emitters/domain.ts`) consumes the **same** `ZodTypeDescriptor[]` IR the Zod emitter uses (after the shared extract → strip pipeline). It builds a per-object *domain plan* (read fields + source-targeted write accessors), applies a Rune-agnostic mechanical layer (cross-ref → flattened `$refText` string) plus an optional **semantic overlay** config (renames + read-only merges), then emits a self-contained `// @ts-nocheck` TypeScript module. A new programmatic entry point `generateDomainSchemas(config)` mirrors `generateZodSchemas`, and minimal additive CLI flags (`--domain`, `--domain-out`) drive it from the command line.

**Tech Stack:** TypeScript 5.x (ESM, NodeNext), Langium 4.2.x, Vitest. Single package `packages/langium-zod`. Build: `tsc -p tsconfig.json`. Tests: `vitest run`.

---

## Background / context for the engineer

You are working in the repo `/Users/pmouli/GitHub.nosync/active/ts/langium-zod`, package `packages/langium-zod`, branch `develop`. All commands below run from the **repo root** unless stated otherwise (the package's `vitest`/`tsc` are invoked there via the workspace).

Key existing files you will read or touch:

- `src/types.ts` — the IR. The relevant types:
  - `ZodTypeExpression = { kind:'primitive'; primitive:'string'|'number'|'boolean'|'bigint' } | { kind:'literal'; value:string } | { kind:'reference'; typeName:string } | { kind:'array'; element:ZodTypeExpression } | { kind:'crossReference'; targetType:string } | { kind:'union'; members:ZodTypeExpression[] } | { kind:'lazy'; inner:ZodTypeExpression }`
  - `ZodPropertyDescriptor = { name:string; zodType:ZodTypeExpression; optional:boolean; minItems?:number; comment?:string }`
  - `ZodObjectTypeDescriptor = { name:string; kind:'object'; properties:ZodPropertyDescriptor[]; comment?:string }`
  - `ZodUnionTypeDescriptor = { name:string; kind:'union'; members:string[]; discriminator:string }`
  - `ZodTypeDescriptor = ZodObjectTypeDescriptor | ZodUnionTypeDescriptor | ZodPrimitiveAliasDescriptor | ZodKeywordEnumDescriptor | ZodRegexEnumDescriptor`
- `src/projection.ts` — `applyProjectionToDescriptors(descriptors, { projection?, stripInternals?, warn? })` returns a stripped/filtered `ZodTypeDescriptor[]`. **Preserves `$type`.** We call it first to honor `--strip-internals`.
- `src/api.ts` — `generateZodSchemas(config)`; the shared `buildDescriptorPipeline(astTypes, config)` (private) runs `extractTypeDescriptors`; `resolveAstTypes` normalizes. We add `generateDomainSchemas` alongside.
- `src/config.ts` — `ZodGeneratorConfig extends FilterConfig`. We add three optional fields.
- `src/cli.ts` — `generate(opts)` + `main()` flag parsing. We add `--domain` / `--domain-out`.
- `src/index.ts` — public barrel. We add the new exports.
- `src/generator.ts` — the **reference emit style** for the Zod target (string-array `lines` accumulator, `// @ts-nocheck` header, topo sort). The domain emitter mirrors the *style* but is simpler (interfaces + hoisted functions forward-reference freely, so **no topo sort is needed**).

Test conventions (mirror exactly):
- Unit tests live in `packages/langium-zod/test/unit/*.test.ts`, import from `../../src/<file>.js`, use plain `ZodTypeDescriptor[]` fixtures, `import { describe, expect, it } from 'vitest'`.
- Integration tests live in `packages/langium-zod/test/integration/*.test.ts`, call the public API with `AstTypesLike` fixtures, and write to `tmpdir()` when exercising disk I/O.

**Design rules that must hold (from the spec §0.5):**
1. The emitter stays **generic** — zero Rune-specific knowledge. The only Rune-specificity is data passed in via the overlay config.
2. **Mechanical layer (generic):** every single-valued cross-reference property → a `string` domain field (the `$refText`); every `+=` cross-reference → `string[]`.
3. **Semantic overlays (config-driven):** `renames` are bidirectional (one source field → one domain field, write-back to the source). `merges` are **read-only on the merged name** — the merged read field concatenates source arrays, but write accessors target the **source** fields (no merged setter, never an unmerge).
4. Generated output is a committed artifact: self-contained, `// @ts-nocheck`, never hand-edited.

---

## File structure

| File | Responsibility |
|---|---|
| `src/emitters/domain.ts` (create) | The domain emitter: overlay config types, `DomainGenerationOptions`, `generateDomainCode(descriptors, options)`, and all private helpers (`planObject`, emit helpers). One file owns the whole domain surface. |
| `src/api.ts` (modify) | Add `generateDomainSchemas(config)` mirroring `generateZodSchemas`. |
| `src/config.ts` (modify) | Add `emitDomain?`, `domainOutputPath?`, `domainOverlays?` to `ZodGeneratorConfig`. |
| `src/cli.ts` (modify) | Parse `--domain` / `--domain-out`; dispatch to `generateDomainSchemas`. |
| `src/index.ts` (modify) | Export `generateDomainSchemas`, `generateDomainCode`, and the overlay config types. |
| `test/unit/domain-emitter.test.ts` (create) | Unit tests over plain descriptor fixtures: interfaces, read fn, write accessors, references, unions, master dispatch, renames, merges. |
| `test/integration/domain-generation.test.ts` (create) | End-to-end: `AstTypesLike` → `generateDomainSchemas` → assert source + file write. |

---

## Task 1: Domain emitter scaffold + flat read interfaces

**Files:**
- Create: `packages/langium-zod/src/emitters/domain.ts`
- Test: `packages/langium-zod/test/unit/domain-emitter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/langium-zod/test/unit/domain-emitter.test.ts
import { describe, expect, it } from 'vitest';
import { generateDomainCode } from '../../src/emitters/domain.js';
import type { ZodTypeDescriptor } from '../../src/types.js';

const flatObject: ZodTypeDescriptor[] = [
  {
    name: 'Data',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Data' }, optional: false },
      { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false },
      { name: 'order', zodType: { kind: 'primitive', primitive: 'number' }, optional: true },
      { name: 'superType', zodType: { kind: 'crossReference', targetType: 'Data' }, optional: true }
    ]
  }
];

describe('generateDomainCode — flat interfaces', () => {
  it('emits a header and a per-object read interface, flattening cross-refs to string', () => {
    const source = generateDomainCode(flatObject);
    expect(source).toContain('// @ts-nocheck');
    expect(source).toContain('export interface DataDomain {');
    expect(source).toContain('name: string;');
    expect(source).toContain('order?: number;');
    // single cross-reference flattens to a string ($refText); $type is dropped from the surface
    expect(source).toContain('superType?: string;');
    expect(source).not.toContain('$type');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: FAIL — `Cannot find module '../../src/emitters/domain.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/langium-zod/src/emitters/domain.ts
import type {
  ZodObjectTypeDescriptor,
  ZodTypeDescriptor,
  ZodTypeExpression
} from '../types.js';
import { applyProjectionToDescriptors, type ProjectionConfig } from '../projection.js';

export interface DomainGenerationOptions {
  /** Reuses the Zod projection for `defaults.strip` + per-type `fields`. */
  projection?: ProjectionConfig;
  /** Drop `$`-internal metadata fields (`$container`, `$cstNode`, …). */
  stripInternals?: boolean;
}

/** TS surface type for a property's read shape. Single cross-refs flatten to `string`. */
function domainTsType(expression: ZodTypeExpression): string {
  switch (expression.kind) {
    case 'primitive':
      return expression.primitive; // 'string' | 'number' | 'boolean' | 'bigint'
    case 'literal':
      return JSON.stringify(expression.value);
    case 'reference':
      return `${expression.typeName}Domain`;
    case 'crossReference':
      return 'string';
    case 'array':
      return `${domainTsType(expression.element)}[]`;
    case 'union':
      return expression.members.map(domainTsType).join(' | ');
    case 'lazy':
      return domainTsType(expression.inner);
  }
}

function emitInterface(descriptor: ZodObjectTypeDescriptor): string[] {
  const out = [`export interface ${descriptor.name}Domain {`];
  for (const property of descriptor.properties) {
    if (property.name === '$type') {
      continue;
    }
    out.push(`  ${property.name}${property.optional ? '?' : ''}: ${domainTsType(property.zodType)};`);
  }
  out.push('}', '');
  return out;
}

export function generateDomainCode(
  descriptors: ZodTypeDescriptor[],
  options: DomainGenerationOptions = {}
): string {
  const surface = applyProjectionToDescriptors(descriptors, {
    projection: options.projection,
    stripInternals: options.stripInternals
  });
  const objects = surface.filter(
    (descriptor): descriptor is ZodObjectTypeDescriptor => descriptor.kind === 'object'
  );

  const lines: string[] = [
    '// @ts-nocheck — generated domain surface; edit the grammar / domain-surfaces.json to regenerate',
    ''
  ];

  for (const object of objects) {
    lines.push(...emitInterface(object));
  }

  return `${lines.join('\n').trim()}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter langium-zod run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/src/emitters/domain.ts packages/langium-zod/test/unit/domain-emitter.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(domain): emit flat read interfaces with cross-ref flattening"
```

---

## Task 2: `toDomain<Name>` read projection (flat)

**Files:**
- Modify: `packages/langium-zod/src/emitters/domain.ts`
- Test: `packages/langium-zod/test/unit/domain-emitter.test.ts`

- [ ] **Step 1: Write the failing test** (append to the existing describe block, new `describe`)

```ts
describe('generateDomainCode — read projection', () => {
  it('emits toDomain<Name> reading $refText for cross-refs and raw values otherwise', () => {
    const source = generateDomainCode(flatObject);
    expect(source).toContain('export function toDomainData(node: any): DataDomain {');
    expect(source).toContain('name: node.name,');
    expect(source).toContain('order: node.order,');
    expect(source).toContain('superType: node.superType?.$refText,');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: FAIL — source has no `toDomainData`.

- [ ] **Step 3: Write minimal implementation** — add the read-expression helper + emit function, and call it.

Add after `domainTsType` in `src/emitters/domain.ts`:

```ts
/** Read-projection expression mapping a source access path to the domain value. */
function domainReadExpr(expression: ZodTypeExpression, access: string): string {
  switch (expression.kind) {
    case 'primitive':
    case 'literal':
      return access;
    case 'crossReference':
      return `${access}?.$refText`;
    case 'reference':
      return `${access} ? toDomain${expression.typeName}(${access}) : undefined`;
    case 'array':
      return `(${access} ?? []).map((item) => ${domainReadExpr(expression.element, 'item')})`;
    case 'union':
      // Inline property-level unions pass through unchanged (rare — named unions
      // arrive as `reference`). Documented limitation; see Task 5 note.
      return access;
    case 'lazy':
      return domainReadExpr(expression.inner, access);
  }
}

function emitReadFn(descriptor: ZodObjectTypeDescriptor): string[] {
  const out = [`export function toDomain${descriptor.name}(node: any): ${descriptor.name}Domain {`, '  return {'];
  for (const property of descriptor.properties) {
    if (property.name === '$type') {
      continue;
    }
    out.push(`    ${property.name}: ${domainReadExpr(property.zodType, `node.${property.name}`)},`);
  }
  out.push('  };', '}', '');
  return out;
}
```

Update the loop in `generateDomainCode`:

```ts
  for (const object of objects) {
    lines.push(...emitInterface(object));
    lines.push(...emitReadFn(object));
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: PASS (both describe blocks).

- [ ] **Step 5: Commit**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/src/emitters/domain.ts packages/langium-zod/test/unit/domain-emitter.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(domain): emit toDomain<Name> read projection"
```

---

## Task 3: Field-precise write accessors (scalar / cross-ref / array)

**Files:**
- Modify: `packages/langium-zod/src/emitters/domain.ts`
- Test: `packages/langium-zod/test/unit/domain-emitter.test.ts`

The write accessors target the **source** AST field. Scalars get `set<Field>`; cross-refs get `set<Field>` that mutates `$refText` in place; arrays get `add<Field>` + `remove<Field>At`. Array elements are typed `unknown` for object/cross-ref elements (the caller supplies a properly shaped Mutative draft), `string` for cross-ref array text, and the primitive for primitive arrays.

- [ ] **Step 1: Write the failing test** (new describe)

```ts
const arrayObject: ZodTypeDescriptor[] = [
  {
    name: 'Func',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Func' }, optional: false },
      { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false },
      { name: 'output', zodType: { kind: 'crossReference', targetType: 'Data' }, optional: true },
      {
        name: 'inputs',
        zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Attribute' } },
        optional: false
      },
      {
        name: 'tags',
        zodType: { kind: 'array', element: { kind: 'primitive', primitive: 'string' } },
        optional: false
      }
    ]
  }
];

describe('generateDomainCode — write accessors', () => {
  it('emits set for scalars, $refText-mutating set for cross-refs, add/remove for arrays', () => {
    const source = generateDomainCode(arrayObject);
    expect(source).toContain('export function setName(node: any, value: string): void {');
    expect(source).toContain('  node.name = value;');
    expect(source).toContain('export function setOutput(node: any, value: string): void {');
    expect(source).toContain('  if (node.output) node.output.$refText = value;');
    expect(source).toContain('export function addInputs(node: any, item: unknown): void {');
    expect(source).toContain('  (node.inputs ??= []).push(item);');
    expect(source).toContain('export function removeInputsAt(node: any, index: number): void {');
    expect(source).toContain('  node.inputs?.splice(index, 1);');
    expect(source).toContain('export function addTags(node: any, item: string): void {');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: FAIL — no `setName`/`addInputs`.

- [ ] **Step 3: Write minimal implementation** — add `capitalize`, the accessor planner, and the emit function, then call it.

Add near the top of `src/emitters/domain.ts` (after imports):

```ts
function capitalize(name: string): string {
  return name.length === 0 ? name : `${name[0]!.toUpperCase()}${name.slice(1)}`;
}
```

Add a write type helper after `domainReadExpr`:

```ts
/** Param type for a scalar/primitive setter or an array element add. */
function domainWriteType(expression: ZodTypeExpression): string {
  switch (expression.kind) {
    case 'primitive':
      return expression.primitive;
    case 'crossReference':
      return 'string';
    case 'literal':
      return JSON.stringify(expression.value);
    default:
      // reference (nested AST node), union, array, lazy: caller supplies a draft.
      return 'unknown';
  }
}
```

Add the accessor emitter (operates on a `sourceName` + the property's `zodType` + a PascalCase `label`):

```ts
function emitAccessors(label: string, sourceName: string, expression: ZodTypeExpression): string[] {
  const src = `node.${sourceName}`;
  if (expression.kind === 'array') {
    const elementType = domainWriteType(expression.element);
    return [
      `export function add${label}(node: any, item: ${elementType}): void {`,
      expression.element.kind === 'crossReference'
        ? `  (${src} ??= []).push({ $refText: item });`
        : `  (${src} ??= []).push(item);`,
      '}',
      '',
      `export function remove${label}At(node: any, index: number): void {`,
      `  ${src}?.splice(index, 1);`,
      '}',
      ''
    ];
  }
  if (expression.kind === 'crossReference') {
    return [
      `export function set${label}(node: any, value: string): void {`,
      `  if (${src}) ${src}.$refText = value;`,
      '}',
      ''
    ];
  }
  if (expression.kind === 'primitive') {
    return [
      `export function set${label}(node: any, value: ${expression.primitive}): void {`,
      `  ${src} = value;`,
      '}',
      ''
    ];
  }
  // reference (nested object) scalar, literal, union: no setter in the MVP surface.
  return [];
}

function emitWriteAccessors(descriptor: ZodObjectTypeDescriptor): string[] {
  const out: string[] = [];
  for (const property of descriptor.properties) {
    if (property.name === '$type') {
      continue;
    }
    out.push(...emitAccessors(capitalize(property.name), property.name, property.zodType));
  }
  return out;
}
```

> Note: cross-ref array `add` pushes `{ $refText: item }` (a minimal partial reference). The `unknown` test above is for an **object** array (`inputs`); the `tags` primitive array uses `string`. Update the array test for a cross-ref array is covered in Task 4 references — for now `inputs` (object ref) yields `unknown`, which matches the test.

Update the loop in `generateDomainCode`:

```ts
  for (const object of objects) {
    lines.push(...emitInterface(object));
    lines.push(...emitReadFn(object));
    lines.push(...emitWriteAccessors(object));
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter langium-zod run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/src/emitters/domain.ts packages/langium-zod/test/unit/domain-emitter.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(domain): emit field-precise write accessors (set/add/remove)"
```

---

## Task 4: Nested references in interface + read projection

**Files:**
- Test only: `packages/langium-zod/test/unit/domain-emitter.test.ts` (the implementation from Tasks 1–2 already handles `reference`/array-of-reference; this task locks the behavior with a test and fixes any gap.)

- [ ] **Step 1: Write the failing test** (new describe)

```ts
const nestedObject: ZodTypeDescriptor[] = [
  {
    name: 'Attribute',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Attribute' }, optional: false },
      { name: 'name', zodType: { kind: 'primitive', primitive: 'string' }, optional: false }
    ]
  },
  {
    name: 'Data',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Data' }, optional: false },
      { name: 'header', zodType: { kind: 'reference', typeName: 'Attribute' }, optional: true },
      {
        name: 'attributes',
        zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Attribute' } },
        optional: false
      }
    ]
  }
];

describe('generateDomainCode — nested references', () => {
  it('types nested refs as <Name>Domain and recurses in the read projection', () => {
    const source = generateDomainCode(nestedObject);
    expect(source).toContain('header?: AttributeDomain;');
    expect(source).toContain('attributes: AttributeDomain[];');
    expect(source).toContain('header: node.header ? toDomainAttribute(node.header) : undefined,');
    expect(source).toContain(
      'attributes: (node.attributes ?? []).map((item) => item ? toDomainAttribute(item) : undefined),'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes)**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: PASS already, given `domainTsType`/`domainReadExpr` from Tasks 1–2. If it fails, the failure pinpoints a gap — fix `domainTsType`/`domainReadExpr` accordingly. Do not add new code if it already passes.

- [ ] **Step 3: Commit**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/test/unit/domain-emitter.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "test(domain): lock nested-reference interface + read projection"
```

---

## Task 5: Union domain type alias + `toDomain<Union>` dispatcher

**Files:**
- Modify: `packages/langium-zod/src/emitters/domain.ts`
- Test: `packages/langium-zod/test/unit/domain-emitter.test.ts`

A grammar union (`ZodUnionTypeDescriptor`) becomes a domain type alias plus a `$type`-switch dispatcher. (Property-level *inline* unions — `zodType.kind === 'union'` — are passed through by `domainReadExpr`; that limitation is acceptable because Langium emits named unions as `reference` to the union type. If a real grammar needs inline-union projection, that is a follow-up.)

- [ ] **Step 1: Write the failing test** (new describe)

```ts
const withUnion: ZodTypeDescriptor[] = [
  {
    name: 'Literal',
    kind: 'object',
    properties: [{ name: '$type', zodType: { kind: 'literal', value: 'Literal' }, optional: false }]
  },
  {
    name: 'BinaryExpr',
    kind: 'object',
    properties: [{ name: '$type', zodType: { kind: 'literal', value: 'BinaryExpr' }, optional: false }]
  },
  { name: 'Expression', kind: 'union', members: ['Literal', 'BinaryExpr'], discriminator: '$type' }
];

describe('generateDomainCode — unions', () => {
  it('emits a domain type alias + a $type dispatcher for grammar unions', () => {
    const source = generateDomainCode(withUnion);
    expect(source).toContain('export type ExpressionDomain = LiteralDomain | BinaryExprDomain;');
    expect(source).toContain('export function toDomainExpression(node: any): ExpressionDomain {');
    expect(source).toContain('case "Literal": return toDomainLiteral(node);');
    expect(source).toContain('case "BinaryExpr": return toDomainBinaryExpr(node);');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: FAIL — no `ExpressionDomain`.

- [ ] **Step 3: Write minimal implementation**

Add the import for the union descriptor type at the top of `src/emitters/domain.ts`:

```ts
import type {
  ZodObjectTypeDescriptor,
  ZodTypeDescriptor,
  ZodTypeExpression,
  ZodUnionTypeDescriptor
} from '../types.js';
```

Add the emit helper:

```ts
function emitUnion(descriptor: ZodUnionTypeDescriptor): string[] {
  const alias = `export type ${descriptor.name}Domain = ${descriptor.members
    .map((member) => `${member}Domain`)
    .join(' | ')};`;
  const out = [
    alias,
    '',
    `export function toDomain${descriptor.name}(node: any): ${descriptor.name}Domain {`,
    '  switch (node.$type) {'
  ];
  for (const member of descriptor.members) {
    out.push(`    case ${JSON.stringify(member)}: return toDomain${member}(node);`);
  }
  out.push(
    '  }',
    `  throw new Error(\`Unknown ${descriptor.name} member: \${node.$type}\`);`,
    '}',
    ''
  );
  return out;
}
```

In `generateDomainCode`, compute the unions and emit them after the objects:

```ts
  const unions = surface.filter(
    (descriptor): descriptor is ZodUnionTypeDescriptor => descriptor.kind === 'union'
  );
  // … after the object loop:
  for (const union of unions) {
    lines.push(...emitUnion(union));
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/src/emitters/domain.ts packages/langium-zod/test/unit/domain-emitter.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(domain): emit union domain alias + toDomain dispatcher"
```

---

## Task 6: Master `toDomain(node)` dispatcher + `AnyDomain`

**Files:**
- Modify: `packages/langium-zod/src/emitters/domain.ts`
- Test: `packages/langium-zod/test/unit/domain-emitter.test.ts`

- [ ] **Step 1: Write the failing test** (new describe)

```ts
describe('generateDomainCode — master dispatcher', () => {
  it('emits AnyDomain and a toDomain(node) switch over all objects', () => {
    const source = generateDomainCode(nestedObject); // Attribute + Data from Task 4
    expect(source).toContain('export type AnyDomain = AttributeDomain | DataDomain;');
    expect(source).toContain('export function toDomain(node: any): AnyDomain {');
    expect(source).toContain('case "Attribute": return toDomainAttribute(node);');
    expect(source).toContain('case "Data": return toDomainData(node);');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: FAIL — no `AnyDomain`.

- [ ] **Step 3: Write minimal implementation**

Add the emit helper:

```ts
function emitMasterDispatch(objects: ZodObjectTypeDescriptor[]): string[] {
  if (objects.length === 0) {
    return [];
  }
  const alias = `export type AnyDomain = ${objects.map((object) => `${object.name}Domain`).join(' | ')};`;
  const out = [alias, '', 'export function toDomain(node: any): AnyDomain {', '  switch (node.$type) {'];
  for (const object of objects) {
    out.push(`    case ${JSON.stringify(object.name)}: return toDomain${object.name}(node);`);
  }
  out.push('  }', '  throw new Error(`Unknown node type: ${node.$type}`);', '}', '');
  return out;
}
```

In `generateDomainCode`, after the union loop:

```ts
  lines.push(...emitMasterDispatch(objects));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter langium-zod run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/src/emitters/domain.ts packages/langium-zod/test/unit/domain-emitter.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(domain): emit master toDomain dispatcher + AnyDomain"
```

---

## Task 7: Semantic overlays — renames (config + planObject refactor)

**Files:**
- Modify: `packages/langium-zod/src/emitters/domain.ts`
- Test: `packages/langium-zod/test/unit/domain-emitter.test.ts`

This task introduces the overlay config and refactors emission to go through a per-object **plan** so renames (and Task 8's merges) have a single home. A `rename` changes the *domain field name* and the *accessor label*, but the read/write still target the **source** field.

- [ ] **Step 1: Write the failing test** (new describe)

```ts
const renameObject: ZodTypeDescriptor[] = [
  {
    name: 'Choice',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'Choice' }, optional: false },
      {
        name: 'attributes',
        zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Attribute' } },
        optional: false
      }
    ]
  }
];

describe('generateDomainCode — renames', () => {
  it('renames the domain field + accessors but reads/writes the source field', () => {
    const source = generateDomainCode(renameObject, {
      overlays: { types: { Choice: { renames: { attributes: 'options' } } } }
    });
    expect(source).toContain('options: AttributeDomain[];');
    expect(source).toContain('options: (node.attributes ?? []).map((item) =>');
    expect(source).toContain('export function addOptions(node: any, item: unknown): void {');
    expect(source).toContain('  (node.attributes ??= []).push(item);');
    expect(source).not.toContain('addAttributes');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: FAIL — `generateDomainCode` has no `overlays` option; field stays `attributes`.

- [ ] **Step 3: Write minimal implementation** — add overlay types, a plan model, `planObject`, and rewrite the emit helpers to consume the plan.

Add the overlay/option types (replace the existing `DomainGenerationOptions`):

```ts
export interface DomainOverlayTypeConfig {
  /** Source field → domain field. Bidirectional: read & write both target the source. */
  renames?: Record<string, string>;
  /** Read-only aggregations: concat `from` source arrays into one `to` read field. */
  merges?: Array<{ from: string[]; to: string }>;
}

export interface DomainOverlayConfig {
  types?: Record<string, DomainOverlayTypeConfig>;
}

export interface DomainGenerationOptions {
  projection?: ProjectionConfig;
  stripInternals?: boolean;
  overlays?: DomainOverlayConfig;
}
```

Add the plan model + builder:

```ts
interface DomainFieldPlan {
  name: string; // surface (domain) field name
  tsType: string;
  optional: boolean;
  readExpr: string; // expression in terms of `node`
}

interface AccessorPlan {
  label: string; // PascalCase fn label
  sourceName: string; // AST source field the accessor mutates
  expression: ZodTypeExpression;
}

interface DomainObjectPlan {
  name: string;
  fields: DomainFieldPlan[];
  accessors: AccessorPlan[];
}

function planObject(
  descriptor: ZodObjectTypeDescriptor,
  overlay: DomainOverlayTypeConfig | undefined
): DomainObjectPlan {
  const renames = overlay?.renames ?? {};
  const merges = overlay?.merges ?? [];
  const mergedSources = new Set(merges.flatMap((merge) => merge.from));

  const properties = descriptor.properties.filter((property) => property.name !== '$type');
  const fields: DomainFieldPlan[] = [];
  const accessors: AccessorPlan[] = [];

  for (const property of properties) {
    const isMergeSource = mergedSources.has(property.name);
    if (!isMergeSource) {
      const domainName = renames[property.name] ?? property.name;
      fields.push({
        name: domainName,
        tsType: domainTsType(property.zodType),
        optional: property.optional,
        readExpr: domainReadExpr(property.zodType, `node.${property.name}`)
      });
    }
    // Accessors always target the SOURCE field; merge sources keep distinct accessors.
    const label = capitalize(isMergeSource ? property.name : renames[property.name] ?? property.name);
    accessors.push({ label, sourceName: property.name, expression: property.zodType });
  }

  // (Task 8 appends merged READ fields here.)

  return { name: descriptor.name, fields, accessors };
}
```

Rewrite the three object emit helpers to consume the plan:

```ts
function emitInterface(plan: DomainObjectPlan): string[] {
  const out = [`export interface ${plan.name}Domain {`];
  for (const field of plan.fields) {
    out.push(`  ${field.name}${field.optional ? '?' : ''}: ${field.tsType};`);
  }
  out.push('}', '');
  return out;
}

function emitReadFn(plan: DomainObjectPlan): string[] {
  const out = [`export function toDomain${plan.name}(node: any): ${plan.name}Domain {`, '  return {'];
  for (const field of plan.fields) {
    out.push(`    ${field.name}: ${field.readExpr},`);
  }
  out.push('  };', '}', '');
  return out;
}

function emitWriteAccessors(plan: DomainObjectPlan): string[] {
  const out: string[] = [];
  for (const accessor of plan.accessors) {
    out.push(...emitAccessors(accessor.label, accessor.sourceName, accessor.expression));
  }
  return out;
}
```

Update the object loop in `generateDomainCode` to build a plan:

```ts
  const overlayTypes = options.overlays?.types ?? {};
  for (const object of objects) {
    const plan = planObject(object, overlayTypes[object.name]);
    lines.push(...emitInterface(plan));
    lines.push(...emitReadFn(plan));
    lines.push(...emitWriteAccessors(plan));
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: PASS — all describe blocks (Tasks 1–7) green. The refactor preserves earlier behavior because `planObject` with no overlay yields the same fields/accessors.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter langium-zod run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/src/emitters/domain.ts packages/langium-zod/test/unit/domain-emitter.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(domain): plan-based emission + rename overlays"
```

---

## Task 8: Semantic overlays — merges (read-only merged field, source-targeted writes)

**Files:**
- Modify: `packages/langium-zod/src/emitters/domain.ts`
- Test: `packages/langium-zod/test/unit/domain-emitter.test.ts`

A `merge` produces **one read field** concatenating the source arrays, and **no merged setter** — the source fields keep their own `add`/`remove` accessors (already emitted in Task 7, since merge sources still get accessors keyed to the source name).

- [ ] **Step 1: Write the failing test** (new describe)

```ts
const mergeObject: ZodTypeDescriptor[] = [
  {
    name: 'RosettaFunction',
    kind: 'object',
    properties: [
      { name: '$type', zodType: { kind: 'literal', value: 'RosettaFunction' }, optional: false },
      {
        name: 'conditions',
        zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Condition' } },
        optional: false
      },
      {
        name: 'postConditions',
        zodType: { kind: 'array', element: { kind: 'reference', typeName: 'Condition' } },
        optional: false
      }
    ]
  }
];

describe('generateDomainCode — merges', () => {
  it('emits one merged read field concatenating sources, with no merged setter', () => {
    const source = generateDomainCode(mergeObject, {
      overlays: {
        types: {
          RosettaFunction: {
            merges: [{ from: ['conditions', 'postConditions'], to: 'conditions' }]
          }
        }
      }
    });
    // single merged read field, type from the first source's element
    expect(source).toContain('conditions: ConditionDomain[];');
    expect(source).toContain(
      'conditions: [...(node.conditions ?? []).map((item) => item ? toDomainCondition(item) : undefined), ...(node.postConditions ?? []).map((item) => item ? toDomainCondition(item) : undefined)],'
    );
    // write accessors stay source-keyed, distinct, no merged setter
    expect(source).toContain('export function addConditions(node: any, item: unknown): void {');
    expect(source).toContain('  (node.conditions ??= []).push(item);');
    expect(source).toContain('export function addPostConditions(node: any, item: unknown): void {');
    expect(source).toContain('  (node.postConditions ??= []).push(item);');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: FAIL — no merged `conditions` read field; `postConditions` may still appear as its own read field.

- [ ] **Step 3: Write minimal implementation** — append merged read fields in `planObject` (replace the `// (Task 8 appends merged READ fields here.)` comment):

```ts
  for (const merge of merges) {
    const sourceProps = merge.from
      .map((sourceName) => properties.find((property) => property.name === sourceName))
      .filter((property): property is (typeof properties)[number] => property !== undefined);

    const firstArray = sourceProps.find((property) => property.zodType.kind === 'array');
    const elementTsType =
      firstArray && firstArray.zodType.kind === 'array'
        ? domainTsType(firstArray.zodType.element)
        : 'unknown';

    const spreadExprs = sourceProps
      .filter((property) => property.zodType.kind === 'array')
      .map((property) => `...${domainReadExpr(property.zodType, `node.${property.name}`)}`);

    fields.push({
      name: merge.to,
      tsType: `${elementTsType}[]`,
      optional: false,
      readExpr: `[${spreadExprs.join(', ')}]`
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter langium-zod test -- domain-emitter`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter langium-zod run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/src/emitters/domain.ts packages/langium-zod/test/unit/domain-emitter.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(domain): read-only merge overlays (source-targeted writes)"
```

---

## Task 9: Config fields + `generateDomainSchemas` API + barrel exports

**Files:**
- Modify: `packages/langium-zod/src/config.ts`
- Modify: `packages/langium-zod/src/api.ts`
- Modify: `packages/langium-zod/src/index.ts`
- Test: `packages/langium-zod/test/integration/domain-generation.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// packages/langium-zod/test/integration/domain-generation.test.ts
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateDomainSchemas } from '../../src/index.js';
import type { AstTypesLike } from '../../src/types.js';

const astTypes: AstTypesLike = {
  interfaces: [
    { name: 'Attribute', properties: [{ name: 'name', type: 'ID', optional: false }] },
    {
      name: 'Data',
      properties: [
        { name: 'name', type: 'ID', optional: false },
        { name: 'attributes', type: 'Attribute', assignment: '+=', optional: false }
      ]
    }
  ],
  unions: []
};

describe('generateDomainSchemas (integration)', () => {
  it('returns domain source and writes it when domainOutputPath is set', () => {
    const outDir = join(tmpdir(), `langium-zod-domain-${process.pid}`);
    mkdirSync(outDir, { recursive: true });
    const domainOutputPath = join(outDir, 'domain.ts');

    try {
      const source = generateDomainSchemas({
        astTypes,
        domainOutputPath,
        stripInternals: true
      });

      expect(source).toContain('export interface DataDomain {');
      expect(source).toContain('attributes: AttributeDomain[];');
      expect(source).toContain('export function toDomain(node: any): AnyDomain {');
      expect(existsSync(domainOutputPath)).toBe(true);
      expect(readFileSync(domainOutputPath, 'utf8')).toBe(source);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter langium-zod test -- domain-generation`
Expected: FAIL — `generateDomainSchemas` is not exported.

- [ ] **Step 3a: Extend `ZodGeneratorConfig`** — in `src/config.ts`, add the import and three fields.

At the top of `src/config.ts`, extend the projection import line to also import the overlay type:

```ts
import type { ProjectionConfig } from './projection.js';
import type { DomainOverlayConfig } from './emitters/domain.js';
```

Inside `interface ZodGeneratorConfig extends FilterConfig { … }`, after `objectStyle?: 'loose' | 'strict';`, add:

```ts
  /** When true, the CLI also emits the domain surface to `domainOutputPath`. */
  emitDomain?: boolean;
  /** Output path for the generated domain surface (`domain.ts`). */
  domainOutputPath?: string;
  /** Rune-specific semantic overlays (renames + read-only merges) for the domain target. */
  domainOverlays?: DomainOverlayConfig;
```

- [ ] **Step 3b: Add `generateDomainSchemas`** — in `src/api.ts`, add the import and the function.

Add to the imports in `src/api.ts`:

```ts
import { generateDomainCode } from './emitters/domain.js';
```

Append after `buildDescriptorPipeline` (end of file):

```ts
/**
 * Programmatic entry point for the domain target. Runs the same extract pipeline
 * as {@link generateZodSchemas}, then emits the domain surface (read interfaces +
 * `toDomain` projection + field-precise write accessors). Writes to
 * `config.domainOutputPath` when set.
 */
export function generateDomainSchemas(config: ZodGeneratorConfig): string {
  let rawAstTypes: AstTypesLike;
  if (config.astTypes) {
    rawAstTypes = config.astTypes;
  } else if (config.grammar) {
    rawAstTypes = collectAst(config.grammar) as unknown as AstTypesLike;
  } else {
    throw new ZodGeneratorError('Missing grammar or astTypes in ZodGeneratorConfig', {
      suggestion: "Provide astTypes from Langium's collectAst() or pass a grammar object"
    });
  }

  const astTypes = resolveAstTypes(rawAstTypes);
  const descriptors = buildDescriptorPipeline(astTypes, config);
  const source = generateDomainCode(descriptors, {
    projection: config.projection,
    stripInternals: config.stripInternals,
    overlays: config.domainOverlays
  });

  if (config.domainOutputPath) {
    mkdirSync(dirname(config.domainOutputPath), { recursive: true });
    writeFileSync(config.domainOutputPath, source, 'utf8');
  }

  return source;
}
```

- [ ] **Step 3c: Export from the barrel** — in `src/index.ts`, add:

```ts
export { generateDomainSchemas } from './api.js';
export { generateDomainCode } from './emitters/domain.js';
export type {
  DomainGenerationOptions,
  DomainOverlayConfig,
  DomainOverlayTypeConfig
} from './emitters/domain.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter langium-zod test -- domain-generation`
Expected: PASS.

- [ ] **Step 5: Type-check + full suite (catch barrel/circular-import regressions)**

Run: `pnpm --filter langium-zod run type-check && pnpm --filter langium-zod test`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/src/config.ts packages/langium-zod/src/api.ts packages/langium-zod/src/index.ts packages/langium-zod/test/integration/domain-generation.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(domain): generateDomainSchemas API + config + barrel exports"
```

---

## Task 10: CLI `--domain` / `--domain-out` flags

**Files:**
- Modify: `packages/langium-zod/src/cli.ts`
- Test: `packages/langium-zod/test/integration/domain-generation.test.ts` (append a CLI-path test via the programmatic `generate`)

The minimal-fallback approach (spec §0.5): additive flags on the existing `generate` command. When `--domain` is present, `generate()` also runs `generateDomainSchemas` after the Zod emit, writing to the resolved domain path. `--domain-out <path>` overrides the default (`<outDir>/domain.ts`).

- [ ] **Step 1: Write the failing test** (append a new describe to `domain-generation.test.ts`)

```ts
import { generate } from '../../src/index.js';
import { writeFileSync } from 'node:fs';

describe('generate() — domain flag path', () => {
  it('writes domain.ts alongside zod-schemas.ts when emitDomain is set', async () => {
    const dir = join(tmpdir(), `langium-zod-cli-domain-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const langiumConfigPath = join(dir, 'langium-config.json');
    const grammarPath = join(dir, 'test.langium');
    writeFileSync(
      grammarPath,
      [
        'grammar Test',
        "entry Model: items+=Item*;",
        "Item: 'item' name=ID;",
        'terminal ID: /[_a-zA-Z][\\w_]*/;'
      ].join('\n'),
      'utf8'
    );
    writeFileSync(
      langiumConfigPath,
      JSON.stringify({
        projectName: 'Test',
        out: 'generated',
        languages: [{ grammar: 'test.langium' }]
      }),
      'utf8'
    );

    try {
      await generate({
        langiumConfigPath,
        config: { emitDomain: true, domainOutputPath: join(dir, 'generated', 'domain.ts') }
      });
      expect(existsSync(join(dir, 'generated', 'domain.ts'))).toBe(true);
      expect(readFileSync(join(dir, 'generated', 'domain.ts'), 'utf8')).toContain('toDomain');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter langium-zod test -- domain-generation`
Expected: FAIL — `generate()` does not emit a domain file (no `domain.ts`).

- [ ] **Step 3: Write minimal implementation**

In `src/cli.ts`, add the import:

```ts
import { generateZodSchemas, generateDomainSchemas } from './api.js';
```

(Replace the existing `import { generateZodSchemas } from './api.js';`.)

In `generate()`, after the existing `generateZodSchemas({ grammar, outputPath, ...restConfig });` call and its `console.log`, add the domain emit:

```ts
  if (userConfig.emitDomain) {
    const domainOutputPath = userConfig.domainOutputPath ?? join(outDir, 'domain.ts');
    generateDomainSchemas({
      grammar,
      domainOutputPath,
      stripInternals: restConfig.stripInternals,
      projection: restConfig.projection,
      domainOverlays: restConfig.domainOverlays,
      include: restConfig.include,
      exclude: restConfig.exclude
    });
    console.log(`✓ Generated domain surface → ${domainOutputPath}`);
  }
```

> `userConfig.domainOutputPath` is read from the merged config; the destructure at the top of `generate()` (`const { langiumConfig: _ignored, outputPath: _op, ...restConfig } = userConfig;`) already keeps `emitDomain`/`domainOutputPath`/`domainOverlays` inside `restConfig`, so no change to that line is needed — but reference `userConfig.emitDomain` / `userConfig.domainOutputPath` directly to avoid relying on `restConfig` containing them.

In `main()`, parse the new flags — after `const crossRefValidationEnabled = args.includes('--cross-ref-validation');` add:

```ts
  const domainEnabled = args.includes('--domain');
  const domainOutFlagValue = getArgValue(args, '--domain-out');
```

And after the `if (crossRefValidationEnabled) { … }` block, add:

```ts
  if (domainEnabled) {
    userConfig = {
      ...userConfig,
      emitDomain: true,
      domainOutputPath: domainOutFlagValue
        ? resolve(process.cwd(), domainOutFlagValue)
        : userConfig.domainOutputPath
    };
  }
```

Finally, document the flags in `printHelp()` — add two lines under OPTIONS:

```
	--domain          Also emit the domain surface (domain.ts)
	--domain-out <path> Output path for the domain surface
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter langium-zod test -- domain-generation`
Expected: PASS.

- [ ] **Step 5: Type-check + full suite**

Run: `pnpm --filter langium-zod run type-check && pnpm --filter langium-zod test`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/src/cli.ts packages/langium-zod/test/integration/domain-generation.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(domain): CLI --domain/--domain-out flags"
```

---

## Task 11: Full verification + README note

**Files:**
- Modify: `packages/langium-zod/README.md` (add a short "Domain target" section — only if a README exists; otherwise skip the doc edit and still run verification)

- [ ] **Step 1: Run the complete package suite + type-check + lint**

Run: `pnpm --filter langium-zod test && pnpm --filter langium-zod run type-check`
Expected: all green.

Run (if the repo defines a root lint script): `pnpm run lint`
Expected: no new lint errors in the touched files. If there is no lint script, skip.

- [ ] **Step 2: Manual smoke of generated output shape**

Add a temporary scratch check (do NOT commit it) to eyeball a full emitted file:

```bash
node --input-type=module -e "
import { generateDomainSchemas } from './packages/langium-zod/src/index.ts';
" 2>/dev/null || echo "ts not directly runnable — rely on the integration test output instead"
```

The integration tests already assert the emitted shape; this step is just a confidence check. If you want to inspect a real file, run the CLI against `packages/langium-zod/test/fixtures/langium-config.json` with `--domain --domain-out /tmp/domain.ts` after building (`pnpm --filter langium-zod build`), then read `/tmp/domain.ts`.

- [ ] **Step 3: README note (only if `packages/langium-zod/README.md` exists)**

Add a section:

```markdown
## Domain target (experimental)

Besides Zod schemas, langium-zod can emit a **domain surface** — quirk-free read
interfaces, a `toDomain(node)` read projection, and field-precise write accessors:

    langium-zod generate --domain --domain-out src/generated/domain.ts

Mechanical rules are generic (single cross-reference → flattened `$refText`
string). Project-specific renames and read-only merges are supplied via
`domainOverlays` in `langium-zod.config.js`:

    export default {
      domainOverlays: {
        types: {
          Choice: { renames: { attributes: 'options' } },
          RosettaFunction: { merges: [{ from: ['conditions', 'postConditions'], to: 'conditions' }] }
        }
      }
    };

Merges are read-only on the merged name; write accessors target the source
fields (`addConditions`, `addPostConditions`) — there is no merged setter.
```

- [ ] **Step 4: Commit (README only, if changed)**

```bash
SKIP_SIMPLE_GIT_HOOKS=1 git add packages/langium-zod/README.md
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "docs(domain): document the domain target + overlays"
```

---

## Self-review checklist (performed during plan authoring)

**Spec coverage (§0.5):**
- Reuse IR pipeline → Tasks 1, 9 (`applyProjectionToDescriptors` + `buildDescriptorPipeline`). ✓
- Mechanical cross-ref → `string` → Tasks 1, 2, 3. ✓
- `--strip-internals` honored → Task 1 (`applyProjectionToDescriptors`). ✓
- Semantic overlays (renames + merges) via config extension + a post-projection pass → Tasks 7, 8 (`planObject`). ✓ (Implemented inside the emitter's `planObject` rather than a standalone `applySemanticOverlays(descriptors, config)` pass — chosen because renames/merges must record the source↔domain mapping the write accessors need, which a descriptor-in/descriptor-out pass would erase. Functionally equivalent, single home for overlay logic.)
- Asymmetric surface (read merges freely; field-precise source writes) → Tasks 3, 8. ✓
- Generated artifact: per-kind interfaces + `toDomain` + write accessors, `// @ts-nocheck`, self-contained → Tasks 1–6. ✓
- Target dispatch (`--target` preferred; `--domain` minimal fallback acceptable) → Task 10 uses the **minimal fallback** by explicit spec allowance; full `--target zod|domain` is a noted future enhancement. ✓
- Conformance (optional) → **deferred**: the spec marks it optional ("reuse infra"); it is not on the Phase 3 critical path (rune adoption needs the surface, not the round-trip guard). Tracked as a follow-up, not a gap in the MVP surface.

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every code step shows complete code. ✓

**Type consistency:** `generateDomainCode(descriptors, options)` signature is stable from Task 1; `DomainObjectPlan`/`DomainFieldPlan`/`AccessorPlan` introduced in Task 7 and used consistently in Tasks 7–8; `DomainGenerationOptions`/`DomainOverlayConfig`/`DomainOverlayTypeConfig` names match across emitter, config, api, and barrel. Emit fn names (`emitInterface`, `emitReadFn`, `emitWriteAccessors`, `emitAccessors`, `emitUnion`, `emitMasterDispatch`) are consistent. ✓

**Known limitations (explicit, not silent):**
- Inline property-level unions (`zodType.kind === 'union'`) are passed through unchanged in the read projection (Task 5 note). Named unions (the common case) are handled via `reference` + `emitUnion`.
- Nested-reference array elements read as `T | undefined` under the field's `T[]` type; `// @ts-nocheck` covers the nominal mismatch (elements are non-null at runtime). Tightening is a follow-up.
- Write accessors for nested-object array elements and `array-ref` add take `unknown` (the Mutative recipe supplies a correctly shaped draft node), keeping `domain.ts` free of an `ast.ts` import.
