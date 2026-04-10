[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / generateZodSchemas

# Function: generateZodSchemas()

> **generateZodSchemas**(`config`): `string`

Defined in: [packages/langium-zod/src/api.ts:38](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/api.ts#L38)

Main entry point for programmatic Zod schema generation.

Accepts a [ZodGeneratorConfig](../interfaces/ZodGeneratorConfig.md) that specifies either a parsed Langium
Grammar object or a pre-built [AstTypesLike](../interfaces/AstTypesLike.md) descriptor, then runs
the full extraction → projection → code-generation pipeline and returns the
generated TypeScript source as a string. When `config.outputPath` is set the
result is also written to disk. Conformance artifacts are generated when
`config.conformance` is provided.

## Parameters

### config

[`ZodGeneratorConfig`](../interfaces/ZodGeneratorConfig.md)

Generator configuration including the grammar or AST types,
  optional output path, include/exclude filters, and feature flags.

## Returns

`string`

The generated TypeScript source containing all Zod schema exports.

## Throws

[ZodGeneratorError](../classes/ZodGeneratorError.md) when required configuration is missing or a
  grammar property type cannot be mapped to a Zod schema.
