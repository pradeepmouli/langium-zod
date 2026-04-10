[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodGeneratorConfig

# Interface: ZodGeneratorConfig

Defined in: [packages/langium-zod/src/config.ts:10](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L10)

## Extends

- [`FilterConfig`](FilterConfig.md)

## Properties

### astTypes?

> `optional` **astTypes?**: [`AstTypesLike`](AstTypesLike.md)

Defined in: [packages/langium-zod/src/config.ts:14](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L14)

***

### conformance?

> `optional` **conformance?**: `object`

Defined in: [packages/langium-zod/src/config.ts:18](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L18)

#### astTypesPath?

> `optional` **astTypesPath?**: `string`

#### outputPath?

> `optional` **outputPath?**: `string`

***

### crossRefValidation?

> `optional` **crossRefValidation?**: `boolean`

Defined in: [packages/langium-zod/src/config.ts:17](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L17)

***

### exclude?

> `optional` **exclude?**: `string`[]

Defined in: [packages/langium-zod/src/config.ts:7](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L7)

#### Inherited from

[`FilterConfig`](FilterConfig.md).[`exclude`](FilterConfig.md#exclude)

***

### formMetadata?

> `optional` **formMetadata?**: `boolean`

Defined in: [packages/langium-zod/src/config.ts:46](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L46)

When `true`, emit `.meta({ title, description? })` on generated Zod schemas
using humanized property/type names as `title` and JSDoc comments from the grammar
as `description`. The `description` field is only included when a JSDoc/grammar
comment exists for the corresponding type or property. Useful for zod-to-forms
integrations that derive field labels from metadata.

***

### grammar?

> `optional` **grammar?**: `Grammar` \| `Grammar`[]

Defined in: [packages/langium-zod/src/config.ts:11](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L11)

***

### include?

> `optional` **include?**: `string`[]

Defined in: [packages/langium-zod/src/config.ts:6](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L6)

#### Inherited from

[`FilterConfig`](FilterConfig.md).[`include`](FilterConfig.md#include)

***

### objectStyle?

> `optional` **objectStyle?**: `"loose"` \| `"strict"`

Defined in: [packages/langium-zod/src/config.ts:56](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L56)

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

Defined in: [packages/langium-zod/src/config.ts:13](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L13)

***

### projection?

> `optional` **projection?**: `ProjectionConfig`

Defined in: [packages/langium-zod/src/config.ts:15](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L15)

***

### regexOverrides?

> `optional` **regexOverrides?**: `Record`\<`string`, `string`\>

Defined in: [packages/langium-zod/src/config.ts:38](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L38)

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

Defined in: [packages/langium-zod/src/config.ts:12](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L12)

***

### stripInternals?

> `optional` **stripInternals?**: `boolean`

Defined in: [packages/langium-zod/src/config.ts:16](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/config.ts#L16)
