[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / AstTypesLike

# Interface: AstTypesLike

Defined in: [packages/langium-zod/src/types.ts:157](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/types.ts#L157)

Duck-typed representation of the type model returned by Langium's `collectAst()`
function. Holds the full set of interface types and union/datatype-rule types
that the extractor analyses to produce [ZodTypeDescriptor](../type-aliases/ZodTypeDescriptor.md) records.

Using this interface rather than Langium's concrete `AstTypes` class means the
extractor and tests can supply plain object literals without importing from
Langium's grammar internals.

## Properties

### interfaces

> **interfaces**: [`InterfaceTypeLike`](InterfaceTypeLike.md)[]

Defined in: [packages/langium-zod/src/types.ts:158](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/types.ts#L158)

***

### unions

> **unions**: [`UnionTypeLike`](UnionTypeLike.md)[]

Defined in: [packages/langium-zod/src/types.ts:159](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/types.ts#L159)
