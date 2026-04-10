[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [cli](../README.md) / getUnknownFilterNames

# Function: getUnknownFilterNames()

> **getUnknownFilterNames**(`requested`, `availableTypeNames`): `string`[]

Defined in: [packages/langium-zod/src/cli.ts:144](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/cli.ts#L144)

Returns the subset of `requested` names that are not present in
`availableTypeNames`.

Used to surface warnings when the user's `--include` or `--exclude` list
references type names that do not exist in the parsed grammar, helping catch
typos before generation runs.

## Parameters

### requested

`string`[] \| `undefined`

The type names requested by the user (include or exclude
  list). Returns an empty array immediately when this is `undefined` or empty.

### availableTypeNames

`string`[]

All type names present in the parsed Langium grammar
  (both interface types and union/datatype rule types).

## Returns

`string`[]

An array of names from `requested` that are absent from
  `availableTypeNames`.
