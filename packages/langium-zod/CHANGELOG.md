# langium-zod

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
