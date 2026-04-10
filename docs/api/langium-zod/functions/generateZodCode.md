[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / generateZodCode

# Function: generateZodCode()

> **generateZodCode**(`descriptors`, `recursiveTypes`, `options?`): `string`

Defined in: [packages/langium-zod/src/generator.ts:265](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/generator.ts#L265)

Generates a TypeScript source string containing Zod schema exports for all
provided type descriptors.

Emission order is:
1. Keyword-enum schemas (`z.literal` / `z.union([z.literal(...)])`)
2. Regex-enum schemas (`z.string().regex(...)`)
3. Primitive-alias schemas (`z.string()`, `z.number()`, etc.)
4. Object schemas in topological dependency order; properties that form
   reference cycles are emitted as getter accessors to avoid forward-reference
   errors.
5. Discriminated-union schemas (all member object schemas are already declared).
6. A master `AstNodeSchema` discriminated union across all object schemas.
7. Optional cross-reference schema factories when `options.crossRefValidation`
   is enabled.

## Parameters

### descriptors

[`ZodTypeDescriptor`](../type-aliases/ZodTypeDescriptor.md)[]

Full set of type descriptors produced by
  [extractTypeDescriptors](extractTypeDescriptors.md). Projection / stripInternals filtering is
  applied internally via `applyProjectionToDescriptors`.

### recursiveTypes

`Set`\<`string`\>

Set of type names that participate in a reference cycle,
  produced by [detectRecursiveTypes](detectRecursiveTypes.md). These are emitted with getter syntax.

### options?

`GenerationOptions` = `{}`

Optional flags controlling output style (objectStyle, formMetadata,
  crossRefValidation, projection, stripInternals).

## Returns

`string`

The generated TypeScript source as a string (does not write to disk).
