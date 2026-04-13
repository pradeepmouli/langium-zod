[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / DefaultZodSchemaGenerator

# Class: DefaultZodSchemaGenerator

Defined in: [packages/langium-zod/src/di.ts:24](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/di.ts#L24)

Default implementation of [ZodSchemaGenerator](../interfaces/ZodSchemaGenerator.md).

Wraps the top-level [generateZodSchemas](../functions/generateZodSchemas.md) function and injects the
`LangiumCoreServices` instance provided by the DI container, so callers do not
need to pass services manually on every invocation.

## Implements

- [`ZodSchemaGenerator`](../interfaces/ZodSchemaGenerator.md)

## Constructors

### Constructor

> **new DefaultZodSchemaGenerator**(`services`): `DefaultZodSchemaGenerator`

Defined in: [packages/langium-zod/src/di.ts:27](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/di.ts#L27)

#### Parameters

##### services

`LangiumCoreServices`

#### Returns

`DefaultZodSchemaGenerator`

## Methods

### generate()

> **generate**(`grammar`, `config?`): `string`

Defined in: [packages/langium-zod/src/di.ts:31](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/di.ts#L31)

#### Parameters

##### grammar

`Grammar`

##### config?

`Partial`\<[`ZodGeneratorConfig`](../interfaces/ZodGeneratorConfig.md)\>

#### Returns

`string`

#### Implementation of

[`ZodSchemaGenerator`](../interfaces/ZodSchemaGenerator.md).[`generate`](../interfaces/ZodSchemaGenerator.md#generate)
