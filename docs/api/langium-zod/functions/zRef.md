[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / zRef

# Function: zRef()

> **zRef**(`collection`, `message?`): `ZodString`

Defined in: [packages/langium-zod/src/ref-utils.ts:25](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/ref-utils.ts#L25)

Creates a Zod string schema that validates a cross-reference value against an
allowlist of known identifiers, evaluated lazily at parse time.

This is used in generated cross-reference schema factories (emitted when
`crossRefValidation` is enabled) to validate that a `$refText` string resolves
to an identifier that actually exists in the current document model. The
collection is resolved lazily via a getter function so that it can reference the
live state of the Langium document at validation time rather than a snapshot
captured at schema construction.

Empty strings and whitespace-only values always pass (they represent
unresolved/placeholder references). When the collection is empty or not yet
populated, validation also passes to avoid false negatives during incremental
parsing.

## Parameters

### collection

`string`[] \| (() => `string`[])

Either a static `string[]` or a zero-argument function that
  returns the current list of valid reference target names.

### message?

`string` = `'Unknown reference value'`

Custom validation error message returned when the value is not
  found in the collection. Defaults to `'Unknown reference value'`.

## Returns

`ZodString`

A `z.ZodString` schema with a `.refine` constraint attached.
