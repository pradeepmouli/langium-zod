[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / InterfaceTypeLike

# Interface: InterfaceTypeLike

Defined in: [packages/langium-zod/src/types.ts:103](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/types.ts#L103)

Duck-typed representation of a Langium `InterfaceType`, carrying only the fields
that langium-zod needs. Using this abstraction instead of Langium's concrete
class keeps the extractor decoupled from Langium's internal AST model and makes
unit testing easier via plain object stubs.

## Properties

### comment?

> `optional` **comment?**: `string`

Defined in: [packages/langium-zod/src/types.ts:107](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/types.ts#L107)

***

### name

> **name**: `string`

Defined in: [packages/langium-zod/src/types.ts:104](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/types.ts#L104)

***

### properties?

> `optional` **properties?**: [`PropertyLike`](PropertyLike.md)[]

Defined in: [packages/langium-zod/src/types.ts:105](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/types.ts#L105)

***

### superTypes?

> `optional` **superTypes?**: `string`[] \| `Set`\<`string`\>

Defined in: [packages/langium-zod/src/types.ts:106](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/types.ts#L106)
