[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodPropertyDescriptor

# Interface: ZodPropertyDescriptor

Defined in: [packages/langium-zod/src/types.ts:40](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L40)

Describes a single property of a Langium interface type after extraction,
capturing all information the code generator needs to emit a Zod property
expression.

- `name` — property name as it appears in the grammar (e.g. `"elements"`).
- `zodType` — the resolved [ZodTypeExpression](../type-aliases/ZodTypeExpression.md) for this property.
- `optional` — `true` when the grammar uses `?=` assignment or marks the
  property as optional.
- `minItems` — minimum array length when the grammar uses `+=` with `+`
  cardinality (emits `.min(1)`); `undefined` for all other cases.
- `comment` — JSDoc/grammar comment to propagate into form metadata, if any.

## Properties

### comment?

> `optional` **comment?**: `string`

Defined in: [packages/langium-zod/src/types.ts:45](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L45)

***

### minItems?

> `optional` **minItems?**: `number`

Defined in: [packages/langium-zod/src/types.ts:44](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L44)

***

### name

> **name**: `string`

Defined in: [packages/langium-zod/src/types.ts:41](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L41)

***

### optional

> **optional**: `boolean`

Defined in: [packages/langium-zod/src/types.ts:43](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L43)

***

### zodType

> **zodType**: [`ZodTypeExpression`](../type-aliases/ZodTypeExpression.md)

Defined in: [packages/langium-zod/src/types.ts:42](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L42)
