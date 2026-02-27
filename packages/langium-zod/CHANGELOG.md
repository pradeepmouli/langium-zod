# langium-zod

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
