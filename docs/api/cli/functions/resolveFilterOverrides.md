[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [cli](../README.md) / resolveFilterOverrides

# Function: resolveFilterOverrides()

> **resolveFilterOverrides**(`base`, `includeArg?`, `excludeArg?`): `Pick`\<[`LangiumZodConfig`](../interfaces/LangiumZodConfig.md), `"include"` \| `"exclude"`\>

Defined in: [packages/langium-zod/src/cli.ts:91](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/cli.ts#L91)

Merges CLI `--include` / `--exclude` flag values with the base filter from a
user config file, producing a deduplicated, conflict-free filter pair.

CLI arguments take precedence over the config file values. Any name that appears
in both `include` and `exclude` is removed from `include` so that the exclude
list is authoritative.

## Parameters

### base

`Pick`\<[`LangiumZodConfig`](../interfaces/LangiumZodConfig.md), `"include"` \| `"exclude"`\>

Baseline include/exclude arrays from the user's
  `langium-zod.config.js`, used when the corresponding CLI flag is absent.

### includeArg?

`string`

Raw comma-separated string from `--include`, or `undefined`
  when the flag was not passed.

### excludeArg?

`string`

Raw comma-separated string from `--exclude`, or `undefined`
  when the flag was not passed.

## Returns

`Pick`\<[`LangiumZodConfig`](../interfaces/LangiumZodConfig.md), `"include"` \| `"exclude"`\>

A resolved `{ include, exclude }` pair ready to merge into the
  generator config.
