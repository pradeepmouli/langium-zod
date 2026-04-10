[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / PropertyLike

# Interface: PropertyLike

Defined in: [packages/langium-zod/src/types.ts:135](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L135)

Duck-typed representation of a single property within a Langium `InterfaceType`.

Captures the grammar-level attributes the extractor uses to determine the Zod
type expression, optionality, and array cardinality for a property:
- `operator` / `assignment` — grammar assignment operators (`=`, `+=`, `?=`).
- `cardinality` — cardinality suffix on the property's type node.
- `ruleCall.cardinality` — cardinality on the rule call inside the type node
  (Langium 4.x shape).
- `isCrossRef` / `referenceType` — signals that the property holds a Langium
  cross-reference rather than an inline value.

## Properties

### assignment?

> `optional` **assignment?**: `"="` \| `"+="` \| `"?="`

Defined in: [packages/langium-zod/src/types.ts:140](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L140)

***

### cardinality?

> `optional` **cardinality?**: `"*"` \| `"+"` \| `"?"`

Defined in: [packages/langium-zod/src/types.ts:141](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L141)

***

### comment?

> `optional` **comment?**: `string`

Defined in: [packages/langium-zod/src/types.ts:145](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L145)

***

### isCrossRef?

> `optional` **isCrossRef?**: `boolean`

Defined in: [packages/langium-zod/src/types.ts:143](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L143)

***

### name

> **name**: `string`

Defined in: [packages/langium-zod/src/types.ts:136](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L136)

***

### operator?

> `optional` **operator?**: `"="` \| `"+="` \| `"?="`

Defined in: [packages/langium-zod/src/types.ts:139](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L139)

***

### optional?

> `optional` **optional?**: `boolean`

Defined in: [packages/langium-zod/src/types.ts:138](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L138)

***

### referenceType?

> `optional` **referenceType?**: `string`

Defined in: [packages/langium-zod/src/types.ts:144](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L144)

***

### ruleCall?

> `optional` **ruleCall?**: `object`

Defined in: [packages/langium-zod/src/types.ts:142](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L142)

#### cardinality?

> `optional` **cardinality?**: `"*"` \| `"+"` \| `"?"`

***

### type?

> `optional` **type?**: `unknown`

Defined in: [packages/langium-zod/src/types.ts:137](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L137)
