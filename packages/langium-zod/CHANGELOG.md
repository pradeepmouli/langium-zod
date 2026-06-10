# langium-zod

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
