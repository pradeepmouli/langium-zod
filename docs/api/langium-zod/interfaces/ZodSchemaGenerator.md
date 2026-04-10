[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodSchemaGenerator

# Interface: ZodSchemaGenerator

Defined in: [packages/langium-zod/src/di.ts:13](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/di.ts#L13)

Service interface for generating Zod schemas from a parsed Langium grammar.

Implemented by [DefaultZodSchemaGenerator](../classes/DefaultZodSchemaGenerator.md) and registered in the Langium
dependency-injection container via [ZodSchemaGeneratorModule](../variables/ZodSchemaGeneratorModule.md). Consumers
that obtain Langium services through the standard DI mechanism can retrieve this
service from `services.shared.ZodSchemaGenerator`.

## Methods

### generate()

> **generate**(`grammar`, `config?`): `string`

Defined in: [packages/langium-zod/src/di.ts:14](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/di.ts#L14)

#### Parameters

##### grammar

`Grammar`

##### config?

`Partial`\<[`ZodGeneratorConfig`](ZodGeneratorConfig.md)\>

#### Returns

`string`
