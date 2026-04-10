[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [cli](../README.md) / LangiumZodConfig

# Interface: LangiumZodConfig

Defined in: [packages/langium-zod/src/cli.ts:26](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/cli.ts#L26)

User-facing config file shape (langium-zod.config.js / .ts)

## Extends

- `Omit`\<[`ZodGeneratorConfig`](../../langium-zod/interfaces/ZodGeneratorConfig.md), `"grammar"` \| `"services"` \| `"astTypes"`\>

## Properties

### conformance?

> `optional` **conformance?**: `object`

Defined in: [packages/langium-zod/src/config.ts:18](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/config.ts#L18)

#### astTypesPath?

> `optional` **astTypesPath?**: `string`

#### outputPath?

> `optional` **outputPath?**: `string`

#### Inherited from

[`ZodGeneratorConfig`](../../langium-zod/interfaces/ZodGeneratorConfig.md).[`conformance`](../../langium-zod/interfaces/ZodGeneratorConfig.md#conformance)

***

### crossRefValidation?

> `optional` **crossRefValidation?**: `boolean`

Defined in: [packages/langium-zod/src/config.ts:17](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/config.ts#L17)

#### Inherited from

[`ZodGeneratorConfig`](../../langium-zod/interfaces/ZodGeneratorConfig.md).[`crossRefValidation`](../../langium-zod/interfaces/ZodGeneratorConfig.md#crossrefvalidation)

***

### exclude?

> `optional` **exclude?**: `string`[]

Defined in: [packages/langium-zod/src/config.ts:7](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/config.ts#L7)

#### Inherited from

[`FilterConfig`](../../langium-zod/interfaces/FilterConfig.md).[`exclude`](../../langium-zod/interfaces/FilterConfig.md#exclude)

***

### formMetadata?

> `optional` **formMetadata?**: `boolean`

Defined in: [packages/langium-zod/src/config.ts:46](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/config.ts#L46)

When `true`, emit `.meta({ title, description? })` on generated Zod schemas
using humanized property/type names as `title` and JSDoc comments from the grammar
as `description`. The `description` field is only included when a JSDoc/grammar
comment exists for the corresponding type or property. Useful for zod-to-forms
integrations that derive field labels from metadata.

#### Inherited from

[`ZodGeneratorConfig`](../../langium-zod/interfaces/ZodGeneratorConfig.md).[`formMetadata`](../../langium-zod/interfaces/ZodGeneratorConfig.md#formmetadata)

***

### include?

> `optional` **include?**: `string`[]

Defined in: [packages/langium-zod/src/config.ts:6](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/config.ts#L6)

#### Inherited from

[`FilterConfig`](../../langium-zod/interfaces/FilterConfig.md).[`include`](../../langium-zod/interfaces/FilterConfig.md#include)

***

### langiumConfig?

> `optional` **langiumConfig?**: `string`

Defined in: [packages/langium-zod/src/cli.ts:32](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/cli.ts#L32)

Path to `langium-config.json`. Defaults to `langium-config.json` in cwd.
Only used when picked up via the CLI; programmatic API ignores it.

***

### objectStyle?

> `optional` **objectStyle?**: `"loose"` \| `"strict"`

Defined in: [packages/langium-zod/src/config.ts:56](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/config.ts#L56)

Controls how object schemas are emitted.
- `'loose'` (default): emits `z.looseObject(...)` which allows extra properties to
  pass through unchanged.
- `'strict'`: emits `z.object(...)` (the standard Zod object). This strips unknown
  properties by default instead of rejecting them with a validation error. Consumers
  can call `.strict()` on the emitted schema if they need hard rejection of unknown
  properties.

#### Inherited from

[`ZodGeneratorConfig`](../../langium-zod/interfaces/ZodGeneratorConfig.md).[`objectStyle`](../../langium-zod/interfaces/ZodGeneratorConfig.md#objectstyle)

***

### outputPath?

> `optional` **outputPath?**: `string`

Defined in: [packages/langium-zod/src/cli.ts:34](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/cli.ts#L34)

Explicit output path. Overrides derived path from langium-config.json `out` field.

#### Overrides

[`ZodGeneratorConfig`](../../langium-zod/interfaces/ZodGeneratorConfig.md).[`outputPath`](../../langium-zod/interfaces/ZodGeneratorConfig.md#outputpath)

***

### projection?

> `optional` **projection?**: `ProjectionConfig`

Defined in: [packages/langium-zod/src/config.ts:15](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/config.ts#L15)

#### Inherited from

[`ZodGeneratorConfig`](../../langium-zod/interfaces/ZodGeneratorConfig.md).[`projection`](../../langium-zod/interfaces/ZodGeneratorConfig.md#projection)

***

### regexOverrides?

> `optional` **regexOverrides?**: `Record`\<`string`, `string`\>

Defined in: [packages/langium-zod/src/config.ts:38](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/config.ts#L38)

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

#### Inherited from

[`ZodGeneratorConfig`](../../langium-zod/interfaces/ZodGeneratorConfig.md).[`regexOverrides`](../../langium-zod/interfaces/ZodGeneratorConfig.md#regexoverrides)

***

### stripInternals?

> `optional` **stripInternals?**: `boolean`

Defined in: [packages/langium-zod/src/config.ts:16](https://github.com/pradeepmouli/langium-zod/blob/7d83c2f151cd9ce940900d6e01f9f7b8a4576b19/packages/langium-zod/src/config.ts#L16)

#### Inherited from

[`ZodGeneratorConfig`](../../langium-zod/interfaces/ZodGeneratorConfig.md).[`stripInternals`](../../langium-zod/interfaces/ZodGeneratorConfig.md#stripinternals)
