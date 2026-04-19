# Types & Enums

## Configuration

### `FilterConfig`
Include/exclude filter that controls which Langium type names are emitted
during schema generation.

When `include` is non-empty, only the listed type names (and any stub types
they reference) are generated. When `exclude` is non-empty, the listed names
are skipped. If both are supplied, `exclude` takes precedence for names that
appear in both lists. An empty (or omitted) `FilterConfig` emits all types.
**Properties:**
- `include: string[]` (optional)
- `exclude: string[]` (optional)

### `ZodGeneratorConfig`
Full configuration object for generateZodSchemas.

At least one of `grammar` or `astTypes` must be provided:
- `grammar` — a parsed Langium `Grammar` AST (or array for multi-grammar
  projects); the extractor calls Langium's `collectAst()` internally.
- `astTypes` — a pre-built AstTypesLike descriptor, useful when the
  caller already has the type model and wants to skip grammar parsing.

All other fields are optional and control output path, include/exclude
filtering, projection, strip-internals, cross-reference validation, conformance
artifact generation, regex overrides, form metadata emission, and object style.
**Properties:**
- `grammar: Grammar | Grammar[]` (optional)
- `services: LangiumCoreServices` (optional)
- `outputPath: string` (optional)
- `astTypes: AstTypesLike` (optional)
- `projection: ProjectionConfig` (optional)
- `stripInternals: boolean` (optional)
- `crossRefValidation: boolean` (optional)
- `conformance: { astTypesPath?: string; outputPath?: string }` (optional)
- `regexOverrides: Record<string, string>` (optional) — Override the generated schema for specific type names.

Use this for parser-based datatype rules (e.g. `BigDecimal returns string: ... INT ...`)
whose structure cannot be expressed as a regex automatically by Langium.

The value is a raw regex pattern string (without surrounding `/` slashes).
The named type will emit `z.string().regex(new RegExp("..."))` instead of `z.string()`.
- `formMetadata: boolean` (optional) — When `true`, emit `.meta({ title, description? })` on generated Zod schemas
using humanized property/type names as `title` and JSDoc comments from the grammar
as `description`. The `description` field is only included when a JSDoc/grammar
comment exists for the corresponding type or property. Useful for zod-to-forms
integrations that derive field labels from metadata.
- `objectStyle: "loose" | "strict"` (optional) — Controls how object schemas are emitted.
- `'loose'` (default): emits `z.looseObject(...)` which allows extra properties to
  pass through unchanged.
- `'strict'`: emits `z.object(...)` (the standard Zod object). This strips unknown
  properties by default instead of rejecting them with a validation error. Consumers
  can call `.strict()` on the emitted schema if they need hard rejection of unknown
  properties.
- `include: string[]` (optional)
- `exclude: string[]` (optional)

## cli

### `GenerateOptions`
Options accepted by the programmatic generate function.

Allows the core generation logic to be invoked directly from other tools or
scripts without going through the CLI argument parser.
**Properties:**
- `langiumConfigPath: string` — Absolute path to langium-config.json
- `config: LangiumZodConfig` (optional) — Merged generator config (from user's langium-zod.config.js + CLI flags)

### `LangiumZodConfig`
User-facing config file shape (langium-zod.config.js / .ts)
**Properties:**
- `langiumConfig: string` (optional) — Path to `langium-config.json`. Defaults to `langium-config.json` in cwd.
Only used when picked up via the CLI; programmatic API ignores it.
- `outputPath: string` (optional) — Explicit output path. Overrides derived path from langium-config.json `out` field.
- `projection: ProjectionConfig` (optional)
- `stripInternals: boolean` (optional)
- `crossRefValidation: boolean` (optional)
- `conformance: { astTypesPath?: string; outputPath?: string }` (optional)
- `regexOverrides: Record<string, string>` (optional) — Override the generated schema for specific type names.

Use this for parser-based datatype rules (e.g. `BigDecimal returns string: ... INT ...`)
whose structure cannot be expressed as a regex automatically by Langium.

The value is a raw regex pattern string (without surrounding `/` slashes).
The named type will emit `z.string().regex(new RegExp("..."))` instead of `z.string()`.
- `formMetadata: boolean` (optional) — When `true`, emit `.meta({ title, description? })` on generated Zod schemas
using humanized property/type names as `title` and JSDoc comments from the grammar
as `description`. The `description` field is only included when a JSDoc/grammar
comment exists for the corresponding type or property. Useful for zod-to-forms
integrations that derive field labels from metadata.
- `objectStyle: "loose" | "strict"` (optional) — Controls how object schemas are emitted.
- `'loose'` (default): emits `z.looseObject(...)` which allows extra properties to
  pass through unchanged.
- `'strict'`: emits `z.object(...)` (the standard Zod object). This strips unknown
  properties by default instead of rejecting them with a validation error. Consumers
  can call `.strict()` on the emitted schema if they need hard rejection of unknown
  properties.
- `include: string[]` (optional)
- `exclude: string[]` (optional)

## Analysis

### `AstTypesLike`
Duck-typed representation of the type model returned by Langium's `collectAst()`
function. Holds the full set of interface types and union/datatype-rule types
that the extractor analyses to produce ZodTypeDescriptor records.

Using this interface rather than Langium's concrete `AstTypes` class means the
extractor and tests can supply plain object literals without importing from
Langium's grammar internals.
**Properties:**
- `interfaces: InterfaceTypeLike[]`
- `unions: UnionTypeLike[]`

### `InterfaceTypeLike`
Duck-typed representation of a Langium `InterfaceType`, carrying only the fields
that langium-zod needs. Using this abstraction instead of Langium's concrete
class keeps the extractor decoupled from Langium's internal AST model and makes
unit testing easier via plain object stubs.
**Properties:**
- `name: string`
- `properties: PropertyLike[]` (optional)
- `superTypes: string[] | Set<string>` (optional)
- `comment: string` (optional)

### `ZodTypeDescriptor`
Union of all type descriptor shapes that the extractor can produce and the
code generator can consume. Each variant carries a discriminating `kind` field:
`'object'`, `'union'`, `'primitive-alias'`, `'keyword-enum'`, or `'regex-enum'`.
```ts
ZodObjectTypeDescriptor | ZodUnionTypeDescriptor | ZodPrimitiveAliasDescriptor | ZodKeywordEnumDescriptor | ZodRegexEnumDescriptor
```

### `ZodTypeExpression`
A discriminated union that represents a single Zod type node in the descriptor
tree produced by the extractor and consumed by the code generator.

Each variant maps to a specific Zod combinator:
- `primitive` → `z.string()` / `z.number()` / `z.boolean()` / `z.bigint()`
- `literal` → `z.literal(value)`
- `reference` → `<TypeName>Schema` (a reference to another generated schema)
- `array` → `z.array(element)`
- `crossReference` → `ReferenceSchema` (Langium cross-reference, optionally
  refined with zRef when cross-reference validation is enabled)
- `union` → `z.union([...members])`
- `lazy` → `z.lazy(() => inner)` (used for self-referential types)
```ts
{ kind: "primitive"; primitive: ZodPrimitive } | { kind: "literal"; value: string } | { kind: "reference"; typeName: string } | { kind: "array"; element: ZodTypeExpression } | { kind: "crossReference"; targetType: string } | { kind: "union"; members: ZodTypeExpression[] } | { kind: "lazy"; inner: ZodTypeExpression }
```

## types

### `PropertyLike`
Duck-typed representation of a single property within a Langium `InterfaceType`.

Captures the grammar-level attributes the extractor uses to determine the Zod
type expression, optionality, and array cardinality for a property:
- `operator` / `assignment` — grammar assignment operators (`=`, `+=`, `?=`).
- `cardinality` — cardinality suffix on the property's type node.
- `ruleCall.cardinality` — cardinality on the rule call inside the type node
  (Langium 4.x shape).
- `isCrossRef` / `referenceType` — signals that the property holds a Langium
  cross-reference rather than an inline value.
**Properties:**
- `name: string`
- `type: unknown` (optional)
- `optional: boolean` (optional)
- `operator: "=" | "+=" | "?="` (optional)
- `assignment: "=" | "+=" | "?="` (optional)
- `cardinality: "*" | "+" | "?"` (optional)
- `ruleCall: { cardinality?: "*" | "+" | "?" }` (optional)
- `isCrossRef: boolean` (optional)
- `referenceType: string` (optional)
- `comment: string` (optional)

### `UnionTypeLike`
Duck-typed representation of a Langium `UnionType` (including datatype rules
that alias primitives or terminal regex patterns). The `type` field holds the
raw Langium type-model node and is inspected structurally by the extractor to
classify the union as a keyword-enum, regex-enum, discriminated-union, or
primitive alias.
**Properties:**
- `name: string`
- `type: unknown` (optional)
- `members: string[]` (optional)

### `ZodPropertyDescriptor`
Describes a single property of a Langium interface type after extraction,
capturing all information the code generator needs to emit a Zod property
expression.

- `name` — property name as it appears in the grammar (e.g. `"elements"`).
- `zodType` — the resolved ZodTypeExpression for this property.
- `optional` — `true` when the grammar uses `?=` assignment or marks the
  property as optional.
- `minItems` — minimum array length when the grammar uses `+=` with `+`
  cardinality (emits `.min(1)`); `undefined` for all other cases.
- `comment` — JSDoc/grammar comment to propagate into form metadata, if any.
**Properties:**
- `name: string`
- `zodType: ZodTypeExpression`
- `optional: boolean`
- `minItems: number` (optional)
- `comment: string` (optional)

## DI

### `ZodSchemaGenerator`
Service interface for generating Zod schemas from a parsed Langium grammar.

Implemented by DefaultZodSchemaGenerator and registered in the Langium
dependency-injection container via ZodSchemaGeneratorModule. Consumers
that obtain Langium services through the standard DI mechanism can retrieve this
service from `services.shared.ZodSchemaGenerator`.

### `ZodSchemaGeneratorServices`
Langium DI service container shape for the langium-zod extension.

Declares the `shared.ZodSchemaGenerator` slot so that TypeScript can type-check
service access and module contributions without requiring a full Langium service
registry at compile time.
