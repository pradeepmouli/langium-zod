# langium-zod

## 0.11.0

### Minor Changes

- [#98](https://github.com/pradeepmouli/langium-zod/pull/98) [`bfb6b96`](https://github.com/pradeepmouli/langium-zod/commit/bfb6b961edce55794e72ced4587bc3c3caa7d343) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - Make generated Zod schemas an honest validity oracle for two remaining gaps:

  - **At-least-one-of refinements**: for grammar rules whose top-level `Alternatives`
    group is a GUARANTEED-TO-EXECUTE mutually-exclusive property producer (e.g.
    `RosettaSynonymBody`'s `value|hint|merge|...` choice, or a `when`/`set` mapping
    instance), the parser can never produce an instance where none of the
    branch-introduced properties are populated. The generator now derives this
    structurally from the grammar (via each property's `Assignment`/`Action`
    `astNodes`) and emits a `.superRefine` requiring at least one to be
    present/non-empty, naming the missing set in the issue message. The
    `Alternatives` group must be unconditional: any `?`/`*` cardinality on the
    group itself or an ancestor element, a branch position inside an OUTER
    multi-way `Alternatives`, or a fragment-rule call-site boundary all skip the
    refinement entirely (an optional, starred, nested, or optionally-called
    alternation may legally execute zero times). Each branch's OWN candidate
    assignment must also be unconditional WITHIN the branch — a branch entered
    via a leading keyword whose only checkable assignment is starred, optional,
    or nested inside an optional sub-group does not guarantee that assignment
    fires, so it is excluded from the "at least one" set the same way a
    keyword-only branch is. Boolean flag assignments (`?=`) are excluded from the
    check (Langium always serialises them as `false` when absent, so a branch
    containing only a flag can legally produce zero checkable properties — the
    whole refinement is dropped when it would otherwise reject a valid
    empty-except-flag branch). Branches whose subtree infers a DIFFERENT type via
    `{infer Type.x=current}` (Langium's tree-rebuilding left-recursion idiom, e.g.
    path-vs-deep-path selection) are also excluded — that shape is a type-union
    rule, not an intra-type alternation.
  - **Array `.optional()` cleanup**: array-typed properties never emit
    `.optional()` regardless of the grammar's optional flag. Langium's
    `assignMandatoryProperties` always materialises `[]` for array-typed
    properties — an array is never `undefined` in real parse output, so
    `.optional()` admitted a shape the parser can never produce. `min(1)` (from
    the existing comma-list/`+`-cardinality analysis) is preserved where derived.

  Both changes tighten what a passing `safeParse` guarantees without ever
  rejecting anything a real grammar's parser can produce. Validated against a
  real consuming grammar (rune-langium): the four rules that gain at-least-one-of
  refinements there are all unconditional alternations, so rune's generated
  output is unaffected by the cardinality guard; separately, adversarial
  synthetic grammars (optional/starred/nested/fragment-gated alternations) are
  covered by regression tests confirming the refinement is correctly withheld.

## 0.10.1

### Patch Changes

- [#96](https://github.com/pradeepmouli/langium-zod/pull/96) [`5bbb59a`](https://github.com/pradeepmouli/langium-zod/commit/5bbb59ad95752b8b0eb6037625fece032799c084) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - Fix fragment-defined array properties incorrectly emitting `.min(1)`.

  When a `+=` assignment lives inside a grammar fragment (e.g.
  `fragment ClassSynonyms: synonyms+=RosettaClassSynonym;`), Langium's
  `Property.astNodes` points to the assignment inside the fragment definition.
  The `$container` chain of that assignment ends at the fragment rule — not at
  the optional use site (e.g. `(ClassSynonyms)*`) — so the cardinality walk in
  `isMandatoryOccurrence` never saw the optionality and incorrectly returned
  `true`, emitting `.min(1)` for arrays that can legitimately be empty.

  The fix adds a guard after the walk: if the terminal container is a fragment
  `ParserRule`, the occurrence is treated as optional (conservative under-emit —
  never rejects a valid document). Assignments in regular rules (e.g. the
  mandatory comma-list `sources+=[Src] (',' sources+=[Src])*`) are unaffected.

## 0.10.0

### Minor Changes

- [#94](https://github.com/pradeepmouli/langium-zod/pull/94) [`cb0bafb`](https://github.com/pradeepmouli/langium-zod/commit/cb0bafb8fddf9829ef8ac2036367f8ace06f4a4c) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - Derive array `.min(1)` from grammar minimum-occurrence for real parsed grammars.

  Previously `.min(1)` was emitted only when a single rule call carried an explicit
  `+` cardinality — and only for synthetic `astTypes` fixtures, never from a real
  `collectAst` grammar (the real Langium `Property` exposes `astNodes` but no
  `cardinality`/`operator`). The generator now walks each array property's
  originating `Assignment` nodes' cardinality chains (`Property.astNodes` +
  `isOptionalCardinality`) and emits `.min(1)` when any `+=` assignment occurs on a
  mandatory path. This covers both `x+=A+` and the comma-list idiom
  `x+=A (',' x+=A)*` (e.g. a required `sources+=[Src] (',' sources+=[Src])*`).

## 0.9.0

### Minor Changes

- [#87](https://github.com/pradeepmouli/langium-zod/pull/87) [`76e3df3`](https://github.com/pradeepmouli/langium-zod/commit/76e3df363f7b9fd840b96add4aad845728cb78b1) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - namespace-ops: emit a generated typed domain repository — generic `Repository<T>` + `createRepository` (throws `DuplicateKeyError` on duplicate key), plus `AnyDomain` union, `DomainRepository` (`byType` typed via `Extract<AnyDomain, { $type: K }>`), and `createDomainRepository`, driven by a new `repository.elementTypes` list in the domain-surface config. Configured element types are validated at codegen time to declare a required `name` (the qualified-name identity source), so a missing/optional `name` fails fast instead of producing a `domain.ts` that won't compile downstream.

## 0.8.3

### Patch Changes

- [#83](https://github.com/pradeepmouli/langium-zod/pull/83) [`5769eae`](https://github.com/pradeepmouli/langium-zod/commit/5769eae3b4cb2c6f7636d5232b230ff87ec60193) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - namespace-ops: `moveXAt` now guards an out-of-range `from` index. Previously
  `splice(from, 1)` with a negative `from` removed an element from the END of the
  array (corrupting order) instead of being a no-op. Adds
  `if (from < 0 || from >= node.<field>.length) return;`, matching the typical
  consumer reorder contract (out-of-range from → no-op).

## 0.8.2

### Patch Changes

- [#81](https://github.com/pradeepmouli/langium-zod/pull/81) [`fe4f779`](https://github.com/pradeepmouli/langium-zod/commit/fe4f779a4f029ae9bf0478dc97a64a63b42dfa66) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - namespace-ops: config-declared identity `removeX` op. `generateNamespaceOps`
  accepts `{ identity: Record<elementType, fieldPath> }`; array fields whose
  element type has an identity path get `removeX(node, item): boolean` matching
  by that path (single-segment direct, nested segments optional-chained). New CLI
  flag `--domain-surface-config <path>` loads the `{ identity: {...} }` map.

## 0.8.1

### Patch Changes

- [#79](https://github.com/pradeepmouli/langium-zod/pull/79) [`cc9491f`](https://github.com/pradeepmouli/langium-zod/commit/cc9491f6dff00ef367514f6f4d6d6440c1d724d7) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - namespace-ops: emit a single-barrel `domain.ts` so AST names merge with their ops

  The emitter now produces `import * as ast` + `export * from './ast.js'` and, per
  namespaced type, a local `export type Foo = ast.Foo` alongside `export namespace Foo`.
  The type alias merges with the value namespace under one name (type space + value
  space) and shadows the star-exported interface/reflection-const, so consumers import a
  single barrel where `Foo` is both the interface type AND the ops namespace
  (`Foo.addBar(node, ...)`). Function signatures qualify every type through the `ast.*`
  binding because `export *` re-exports names to consumers without binding them in the
  module's own lexical scope. Replaces the prior `$`-suffixed aliased-import form.

## 0.8.0

### Minor Changes

- [`6171c9d`](https://github.com/pradeepmouli/langium-zod/commit/6171c9d83dd6cb51b5f05ae7cf33efc4d58e1d8d) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - Fix three bugs in namespace-ops emitter:
  - Skip non-object referenced types (e.g. ValidID string unions) to avoid unimported names in generated code
  - Add reserved-word escaping for field names used as parameter names (`function` → `function_`)
  - Alias all AST type imports with `$` suffix to avoid TS2395 when `export namespace Foo` and `import type { Foo }` coexist in the same file

## 0.7.0

### Minor Changes

- [#75](https://github.com/pradeepmouli/langium-zod/pull/75) [`abb1460`](https://github.com/pradeepmouli/langium-zod/commit/abb14602bef215d87ca9d7ae957348be6e44c9a7) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - - fix(domain): toAst reads renamed fields from the domain key, not the AST key
  - fix(domain): normalise crossReference reads to plain DomainRef, stripping Langium runtime ref
  - test(domain): document toAst merge-target drop is a known non-round-trippable limitation
  - feat(domain): $type-dispatched toAst inverse (drops normalization aliases)
  - fix(domain): preserve + forward config-file normalizations to the emitter

## 0.6.0

### Minor Changes

- [#68](https://github.com/pradeepmouli/langium-zod/pull/68) [`6f1ee85`](https://github.com/pradeepmouli/langium-zod/commit/6f1ee85cf44197b977202155bd8875843a270ebb) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - - feat(domain): add domain-surface target — emit quirk-free read interfaces, `toDomain` read projections, and field-precise write accessors from a Langium grammar
  - feat(domain): `generateDomainSchemas` API + `domainOverlays` config for project-specific renames and read-only merges
  - feat(domain): CLI `--domain` / `--domain-out` flags
  - fix(domain): type-qualify write-accessor names to avoid export collisions
  - note: `regexOverrides` are intentionally not applied on the domain path; domain output is documented in the README under "Domain target (experimental)"

## 0.5.4

### Patch Changes

- [#48](https://github.com/pradeepmouli/langium-zod/pull/48) [`1bca116`](https://github.com/pradeepmouli/langium-zod/commit/1bca116ce719644594e7ea15bca278f60f434b7d) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - - chore: bump typedoc-plugin-to-skills to ^1.3.0

## 0.5.3

### Patch Changes

- [`835c5e5`](https://github.com/pradeepmouli/langium-zod/commit/835c5e53534da899304d3e9aea47caa2d4f92185) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - chore: verify release pipeline

## 0.5.2

### Patch Changes

- [#20](https://github.com/pradeepmouli/langium-zod/pull/20) [`596b2e2`](https://github.com/pradeepmouli/langium-zod/commit/596b2e2ad9772d741c77aa9ee7e7ec5ce2b4befb) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - - chore: test CI/CD automation pipeline

## 0.5.1

### Patch Changes

- [#18](https://github.com/pradeepmouli/langium-zod/pull/18) [`10ad7de`](https://github.com/pradeepmouli/langium-zod/commit/10ad7deca4a0b46b558b20b9727d449b1778a9f9) Thanks [@pradeepmouli](https://github.com/pradeepmouli)! - - fix: use jq instead of node -p to read package.json in changeset workflow
  - chore: test automation pipeline

## 0.3.5

### Patch Changes

- - chore: standardize CI/CD with changesets/action@v1 and OIDC publishing

## 0.3.4

### Patch Changes

- 22e2203: ### Changes\n\n• \n

## 0.5.0

### Minor Changes

- d07316f: Add Rune DSL schema generation enhancements:

  - preserve one-or-more cardinality (`+= Rule+`) as `z.array(...).min(1)`
  - add CLI include/exclude filters with deterministic overlap handling and warnings for unknown types
  - add projection and strip-internals schema surface controls
  - add optional conformance artifact generation with AST path resolution
  - add optional cross-reference validation factories and export reusable `zRef`

## Unreleased

### Minor Changes

- Add Rune DSL generation enhancements:
  - preserve `+= Rule+` as `z.array(...).min(1)`
  - add CLI `--include`/`--exclude` filtering with overlap resolution (`exclude` wins) and unknown-type warnings
  - add projection support via `--projection` plus global `--strip-internals`
  - add optional conformance artifact generation (`--conformance`, `--ast-types`, `--conformance-out`)
  - add optional runtime cross-reference validation factories (`--cross-ref-validation`) and export reusable `zRef`

## 0.4.0

### Minor Changes

- 1c435e9: Add `langium-zod generate` CLI command

  Consumers can now run `langium-zod generate` instead of maintaining a custom
  `generate-zod.ts` script. The CLI reads `langium-config.json` to locate the
  grammar file and optionally loads a `langium-zod.config.js` (or `.mjs`) for
  `regexOverrides`, `outputPath`, `include`, and `exclude` options.

  Usage:

  ```sh
  langium-zod generate [--config langium-config.json] [--out src/generated/zod-schemas.ts]
  ```

  Example `langium-zod.config.js`:

  ```js
  export default {
    outputPath: "src/generated/zod-schemas.ts",
    regexOverrides: {
      BigDecimal: String.raw`^[+-]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][+-]?[0-9]+)?$`,
    },
  };
  ```

  Also exports `LangiumZodConfig` and `GenerateOptions` types and the `generate()`
  function from the package root for programmatic use.

## 0.3.6

### Patch Changes

- 2d3be6f: feat(config): add `regexOverrides` option to `ZodGeneratorConfig`

  Parser-based Langium datatype rules composed of multiple terminals (e.g. `BigDecimal`)
  cannot be automatically converted to a regex because Langium's `buildDataRuleType` only
  handles single-element groups and simple terminal references — it bails out for any
  multi-element sequence or optional/repetition cardinality.

  New `regexOverrides?: Record<string, string>` field on `ZodGeneratorConfig` lets callers
  supply the regex manually for such types:

  ```ts
  generateZodSchemas({
    grammar: RuneDslGrammar(),
    regexOverrides: {
      BigDecimal: String.raw`^[+-]?(\.[0-9]+|[0-9]+\.[0-9]*)([eE][+-]?[0-9]+)?$`,
    },
  });
  // → export const BigDecimalSchema = z.string().regex(new RegExp("^[+-]?..."));
  ```

  Any `primitive-alias` (or existing `regex-enum`) descriptor whose name matches a key in
  `regexOverrides` is upgraded to a `regex-enum` descriptor in a post-extraction pass inside
  `generateZodSchemas()`.

## 0.3.5

### Patch Changes

- 29ef910: feat(extractor): map regex terminal + keyword unions to z.string().regex() + z.literal() union

  Langium datatype rules like `ValidID returns string: ID | 'condition' | 'source' | ...`
  surface as `{ types: [{ primitive: 'string', regex: '/.../' }, { string: 'kw' }, ...] }`.
  Previously these collapsed to `z.string()`.

  New `ZodRegexEnumDescriptor` (`kind: 'regex-enum'`) captures the terminal regex and keyword
  alternatives and emits:
  `z.union([z.string().regex(new RegExp("...")), z.literal("kw1"), ...])`

  or, for a pure regex with no keywords:
  `z.string().regex(new RegExp("..."))`

## 0.3.4

### Patch Changes

- Map Langium `bigint` primitive rules (e.g. `Integer returns bigint`) to `z.bigint()` instead of falling back to `z.string()`.

## 0.3.3

### Patch Changes

- 0b8d795: Emit `z.union([z.literal(...)])` for Langium keyword enum rules (e.g. `CardinalityModifier returns string: 'any' | 'all'`) instead of falling back to `z.string()`.
- 6c27687: handle literal types

## 0.3.1

### Patch Changes

- 882efc3: Map Langium `StringType` values to `z.literal(...)` and map `PropertyUnion` of string tokens to unions of literals for more precise AST node validation.

## 0.3.0

### Minor Changes

- 232c3e8: Improve AST schema generation and mapping behavior:

  - Add a generated master discriminated union export named `AstNodeSchema` keyed by `$type`
  - Improve extractor handling for primitive aliases and filtered fallback stubs
  - Improve cross-reference mapping in the type mapper and expand test coverage

## 0.2.0

### Minor Changes

- dd84bf3: Improve schema generation for Langium unions and datatype aliases, add safer reference handling in generated code, and upgrade `x-to-zod` to `^0.8.0`.
