[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / FilterConfig

# Interface: FilterConfig

Defined in: [packages/langium-zod/src/config.ts:14](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L14)

Include/exclude filter that controls which Langium type names are emitted
during schema generation.

When `include` is non-empty, only the listed type names (and any stub types
they reference) are generated. When `exclude` is non-empty, the listed names
are skipped. If both are supplied, `exclude` takes precedence for names that
appear in both lists. An empty (or omitted) `FilterConfig` emits all types.

## Extended by

- [`ZodGeneratorConfig`](ZodGeneratorConfig.md)

## Properties

### exclude?

> `optional` **exclude?**: `string`[]

Defined in: [packages/langium-zod/src/config.ts:16](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L16)

***

### include?

> `optional` **include?**: `string`[]

Defined in: [packages/langium-zod/src/config.ts:15](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/config.ts#L15)
