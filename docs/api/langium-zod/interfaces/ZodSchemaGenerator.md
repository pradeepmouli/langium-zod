[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodSchemaGenerator

# Interface: ZodSchemaGenerator

Defined in: [packages/langium-zod/src/di.ts:13](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/di.ts#L13)

Service interface for generating Zod schemas from a parsed Langium grammar.

Implemented by [DefaultZodSchemaGenerator](../classes/DefaultZodSchemaGenerator.md) and registered in the Langium
dependency-injection container via [ZodSchemaGeneratorModule](../variables/ZodSchemaGeneratorModule.md). Consumers
that obtain Langium services through the standard DI mechanism can retrieve this
service from `services.shared.ZodSchemaGenerator`.

## Methods

### generate()

> **generate**(`grammar`, `config?`): `string`

Defined in: [packages/langium-zod/src/di.ts:14](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/di.ts#L14)

#### Parameters

##### grammar

`Grammar`

##### config?

`Partial`\<[`ZodGeneratorConfig`](ZodGeneratorConfig.md)\>

#### Returns

`string`
