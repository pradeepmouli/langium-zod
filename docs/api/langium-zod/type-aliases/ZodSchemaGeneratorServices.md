[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodSchemaGeneratorServices

# Type Alias: ZodSchemaGeneratorServices

> **ZodSchemaGeneratorServices** = `object`

Defined in: [packages/langium-zod/src/di.ts:50](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/di.ts#L50)

Langium DI service container shape for the langium-zod extension.

Declares the `shared.ZodSchemaGenerator` slot so that TypeScript can type-check
service access and module contributions without requiring a full Langium service
registry at compile time.

## Properties

### shared

> **shared**: `object`

Defined in: [packages/langium-zod/src/di.ts:51](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/di.ts#L51)

#### ZodSchemaGenerator

> **ZodSchemaGenerator**: [`ZodSchemaGenerator`](../interfaces/ZodSchemaGenerator.md)
