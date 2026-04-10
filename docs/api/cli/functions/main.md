[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [cli](../README.md) / main

# Function: main()

> **main**(): `Promise`\<`void`\>

Defined in: [packages/langium-zod/src/cli.ts:359](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/cli.ts#L359)

CLI entry point executed when the `langium-zod` binary is invoked directly.

Parses `process.argv`, resolves `langium-config.json`, loads an optional
`langium-zod.config.js` from the same directory, merges all CLI flag overrides
(--out, --include, --exclude, --projection, --strip-internals, --conformance,
--cross-ref-validation), then delegates to [generate](generate.md). Exits the process
with code 1 on error.

## Returns

`Promise`\<`void`\>
