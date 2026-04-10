[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [cli](../README.md) / generate

# Function: generate()

> **generate**(`opts`): `Promise`\<`void`\>

Defined in: [packages/langium-zod/src/cli.ts:254](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/cli.ts#L254)

Programmatic entry point for the `langium-zod generate` command.

Loads `langium-config.json` from `opts.langiumConfigPath`, resolves the grammar
file path, parses the grammar with Langium services (including eager import
loading so cross-file references link correctly), then calls
[generateZodSchemas](../../langium-zod/functions/generateZodSchemas.md) with the merged configuration. Prints a success
message to stdout when generation completes.

## Parameters

### opts

[`GenerateOptions`](../interfaces/GenerateOptions.md)

[GenerateOptions](../interfaces/GenerateOptions.md) specifying the langium config path and
  optional pre-merged generator config.

## Returns

`Promise`\<`void`\>

## Throws

`Error` when the langium-config.json or grammar file cannot be found, or
  when the config defines no languages.
