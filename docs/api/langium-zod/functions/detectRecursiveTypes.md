[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / detectRecursiveTypes

# Function: detectRecursiveTypes()

> **detectRecursiveTypes**(`descriptors`): `Set`\<`string`\>

Defined in: [packages/langium-zod/src/recursion-detector.ts:40](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/recursion-detector.ts#L40)

Detects type names that participate in a reference cycle across the descriptor
graph.

Builds a directed graph where each object type descriptor is a node and each
type reference in its properties is an edge. A depth-first search then
identifies all nodes that belong to at least one cycle. The generator uses this
set to emit getter-based property accessors instead of direct value expressions,
avoiding JavaScript "used before declaration" errors for mutually-recursive Zod
schemas.

Only `'object'` kind descriptors are considered; union and primitive-alias
descriptors are transparent to cycle detection.

## Parameters

### descriptors

[`ZodTypeDescriptor`](../type-aliases/ZodTypeDescriptor.md)[]

The full list of type descriptors to analyse, as returned
  by [extractTypeDescriptors](extractTypeDescriptors.md).

## Returns

`Set`\<`string`\>

A `Set` of type names that are involved in at least one reference cycle.
