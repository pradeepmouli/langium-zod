[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodGeneratorConfig

# Interface: ZodGeneratorConfig

Defined in: [packages/langium-zod/src/config.ts:32](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L32)

Full configuration object for [generateZodSchemas](../functions/generateZodSchemas.md).

At least one of `grammar` or `astTypes` must be provided:
- `grammar` — a parsed Langium `Grammar` AST (or array for multi-grammar
  projects); the extractor calls Langium's `collectAst()` internally.
- `astTypes` — a pre-built [AstTypesLike](AstTypesLike.md) descriptor, useful when the
  caller already has the type model and wants to skip grammar parsing.

All other fields are optional and control output path, include/exclude
filtering, projection, strip-internals, cross-reference validation, conformance
artifact generation, regex overrides, form metadata emission, and object style.

## Extends

- [`FilterConfig`](FilterConfig.md)

## Properties

### astTypes?

> `optional` **astTypes?**: [`AstTypesLike`](AstTypesLike.md)

Defined in: [packages/langium-zod/src/config.ts:36](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L36)

***

### conformance?

> `optional` **conformance?**: `object`

Defined in: [packages/langium-zod/src/config.ts:40](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L40)

#### astTypesPath?

> `optional` **astTypesPath?**: `string`

#### outputPath?

> `optional` **outputPath?**: `string`

***

### crossRefValidation?

> `optional` **crossRefValidation?**: `boolean`

Defined in: [packages/langium-zod/src/config.ts:39](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L39)

***

### exclude?

> `optional` **exclude?**: `string`[]

Defined in: [packages/langium-zod/src/config.ts:16](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L16)

#### Inherited from

[`FilterConfig`](FilterConfig.md).[`exclude`](FilterConfig.md#exclude)

***

### formMetadata?

> `optional` **formMetadata?**: `boolean`

Defined in: [packages/langium-zod/src/config.ts:68](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L68)

When `true`, emit `.meta({ title, description? })` on generated Zod schemas
using humanized property/type names as `title` and JSDoc comments from the grammar
as `description`. The `description` field is only included when a JSDoc/grammar
comment exists for the corresponding type or property. Useful for zod-to-forms
integrations that derive field labels from metadata.

***

### grammar?

> `optional` **grammar?**: `Grammar` \| `Grammar`[]

Defined in: [packages/langium-zod/src/config.ts:33](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L33)

***

### include?

> `optional` **include?**: `string`[]

Defined in: [packages/langium-zod/src/config.ts:15](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L15)

#### Inherited from

[`FilterConfig`](FilterConfig.md).[`include`](FilterConfig.md#include)

***

### objectStyle?

> `optional` **objectStyle?**: `"loose"` \| `"strict"`

Defined in: [packages/langium-zod/src/config.ts:78](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L78)

Controls how object schemas are emitted.
- `'loose'` (default): emits `z.looseObject(...)` which allows extra properties to
  pass through unchanged.
- `'strict'`: emits `z.object(...)` (the standard Zod object). This strips unknown
  properties by default instead of rejecting them with a validation error. Consumers
  can call `.strict()` on the emitted schema if they need hard rejection of unknown
  properties.

***

### outputPath?

> `optional` **outputPath?**: `string`

Defined in: [packages/langium-zod/src/config.ts:35](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L35)

***

### projection?

> `optional` **projection?**: `ProjectionConfig`

Defined in: [packages/langium-zod/src/config.ts:37](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L37)

***

### regexOverrides?

> `optional` **regexOverrides?**: `Record`\<`string`, `string`\>

Defined in: [packages/langium-zod/src/config.ts:60](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L60)

Override the generated schema for specific type names.

Use this for parser-based datatype rules (e.g. `BigDecimal returns string: ... INT ...`)
whose structure cannot be expressed as a regex automatically by Langium.

The value is a raw regex pattern string (without surrounding `/` slashes).
The named type will emit `z.string().regex(new RegExp("..."))` instead of `z.string()`.

#### Example

```ts
regexOverrides: {
  BigDecimal: String.raw`^[+-]?(\.[0-9]+|[0-9]+\.?[0-9]*)([eE][+-]?[0-9]+)?$`
}
```

***

### services?

> `optional` **services?**: `LangiumCoreServices`

Defined in: [packages/langium-zod/src/config.ts:34](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L34)

***

### stripInternals?

> `optional` **stripInternals?**: `boolean`

Defined in: [packages/langium-zod/src/config.ts:38](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L38)
