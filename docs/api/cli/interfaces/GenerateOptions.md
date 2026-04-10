[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [cli](../README.md) / GenerateOptions

# Interface: GenerateOptions

Defined in: [packages/langium-zod/src/cli.ts:233](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/cli.ts#L233)

Options accepted by the programmatic [generate](../functions/generate.md) function.

Allows the core generation logic to be invoked directly from other tools or
scripts without going through the CLI argument parser.

## Properties

### config?

> `optional` **config?**: [`LangiumZodConfig`](LangiumZodConfig.md)

Defined in: [packages/langium-zod/src/cli.ts:237](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/cli.ts#L237)

Merged generator config (from user's langium-zod.config.js + CLI flags)

***

### langiumConfigPath

> **langiumConfigPath**: `string`

Defined in: [packages/langium-zod/src/cli.ts:235](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/cli.ts#L235)

Absolute path to langium-config.json
