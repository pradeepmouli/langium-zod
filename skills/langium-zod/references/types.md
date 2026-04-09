# Types & Enums

## Types

### `FilterConfig`
**Properties:**
- `include: string[]` (optional) — 
- `exclude: string[]` (optional) — 

### `ZodGeneratorConfig`
**Properties:**
- `grammar: Grammar | Grammar[]` (optional) — 
- `services: LangiumCoreServices` (optional) — 
- `outputPath: string` (optional) — 
- `astTypes: AstTypesLike` (optional) — 
- `projection: ProjectionConfig` (optional) — 
- `stripInternals: boolean` (optional) — 
- `crossRefValidation: boolean` (optional) — 
- `conformance: { astTypesPath?: string; outputPath?: string }` (optional) — 
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
- `include: string[]` (optional) — 
- `exclude: string[]` (optional) — 

### `AstTypesLike`
**Properties:**
- `interfaces: InterfaceTypeLike[]` — 
- `unions: UnionTypeLike[]` — 

### `InterfaceTypeLike`
**Properties:**
- `name: string` — 
- `properties: PropertyLike[]` (optional) — 
- `superTypes: string[] | Set<string>` (optional) — 
- `comment: string` (optional) — 

### `PropertyLike`
**Properties:**
- `name: string` — 
- `type: unknown` (optional) — 
- `optional: boolean` (optional) — 
- `operator: "=" | "+=" | "?="` (optional) — 
- `assignment: "=" | "+=" | "?="` (optional) — 
- `cardinality: "*" | "+" | "?"` (optional) — 
- `ruleCall: { cardinality?: "*" | "+" | "?" }` (optional) — 
- `isCrossRef: boolean` (optional) — 
- `referenceType: string` (optional) — 
- `comment: string` (optional) — 

### `UnionTypeLike`
**Properties:**
- `name: string` — 
- `type: unknown` (optional) — 
- `members: string[]` (optional) — 

### `ZodPropertyDescriptor`
**Properties:**
- `name: string` — 
- `zodType: ZodTypeExpression` — 
- `optional: boolean` — 
- `minItems: number` (optional) — 
- `comment: string` (optional) — 

### `ZodTypeDescriptor`
```ts
ZodObjectTypeDescriptor | ZodUnionTypeDescriptor | ZodPrimitiveAliasDescriptor | ZodKeywordEnumDescriptor | ZodRegexEnumDescriptor
```

### `ZodTypeExpression`
```ts
{ kind: "primitive"; primitive: ZodPrimitive } | { kind: "literal"; value: string } | { kind: "reference"; typeName: string } | { kind: "array"; element: ZodTypeExpression } | { kind: "crossReference"; targetType: string } | { kind: "union"; members: ZodTypeExpression[] } | { kind: "lazy"; inner: ZodTypeExpression }
```

### `ZodSchemaGenerator`

### `ZodSchemaGeneratorServices`

### `LangiumZodConfig`
User-facing config file shape (langium-zod.config.js / .ts)
**Properties:**
- `langiumConfig: string` (optional) — Path to `langium-config.json`. Defaults to `langium-config.json` in cwd.
Only used when picked up via the CLI; programmatic API ignores it.
- `outputPath: string` (optional) — Explicit output path. Overrides derived path from langium-config.json `out` field.
- `projection: ProjectionConfig` (optional) — 
- `stripInternals: boolean` (optional) — 
- `crossRefValidation: boolean` (optional) — 
- `conformance: { astTypesPath?: string; outputPath?: string }` (optional) — 
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
- `include: string[]` (optional) — 
- `exclude: string[]` (optional) — 

### `GenerateOptions`
**Properties:**
- `langiumConfigPath: string` — Absolute path to langium-config.json
- `config: LangiumZodConfig` (optional) — Merged generator config (from user's langium-zod.config.js + CLI flags)
