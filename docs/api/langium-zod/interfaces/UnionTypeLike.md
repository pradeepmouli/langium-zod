[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / UnionTypeLike

# Interface: UnionTypeLike

Defined in: [packages/langium-zod/src/types.ts:117](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L117)

Duck-typed representation of a Langium `UnionType` (including datatype rules
that alias primitives or terminal regex patterns). The `type` field holds the
raw Langium type-model node and is inspected structurally by the extractor to
classify the union as a keyword-enum, regex-enum, discriminated-union, or
primitive alias.

## Properties

### members?

> `optional` **members?**: `string`[]

Defined in: [packages/langium-zod/src/types.ts:120](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L120)

***

### name

> **name**: `string`

Defined in: [packages/langium-zod/src/types.ts:118](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L118)

***

### type?

> `optional` **type?**: `unknown`

Defined in: [packages/langium-zod/src/types.ts:119](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L119)
