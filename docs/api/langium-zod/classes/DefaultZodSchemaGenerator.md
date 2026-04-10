[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / DefaultZodSchemaGenerator

# Class: DefaultZodSchemaGenerator

Defined in: [packages/langium-zod/src/di.ts:9](https://github.com/pradeepmouli/langium-zod/blob/8fd659df780609212971daac7b7a5219f1e3211b/packages/langium-zod/src/di.ts#L9)

## Implements

- [`ZodSchemaGenerator`](../interfaces/ZodSchemaGenerator.md)

## Constructors

### Constructor

> **new DefaultZodSchemaGenerator**(`services`): `DefaultZodSchemaGenerator`

Defined in: [packages/langium-zod/src/di.ts:12](https://github.com/pradeepmouli/langium-zod/blob/8fd659df780609212971daac7b7a5219f1e3211b/packages/langium-zod/src/di.ts#L12)

#### Parameters

##### services

`LangiumCoreServices`

#### Returns

`DefaultZodSchemaGenerator`

## Methods

### generate()

> **generate**(`grammar`, `config?`): `string`

Defined in: [packages/langium-zod/src/di.ts:16](https://github.com/pradeepmouli/langium-zod/blob/8fd659df780609212971daac7b7a5219f1e3211b/packages/langium-zod/src/di.ts#L16)

#### Parameters

##### grammar

`Grammar`

##### config?

`Partial`\<[`ZodGeneratorConfig`](../interfaces/ZodGeneratorConfig.md)\>

#### Returns

`string`

#### Implementation of

[`ZodSchemaGenerator`](../interfaces/ZodSchemaGenerator.md).[`generate`](../interfaces/ZodSchemaGenerator.md#generate)
