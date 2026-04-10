[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / extractTypeDescriptors

# Function: extractTypeDescriptors()

> **extractTypeDescriptors**(`astTypes`, `config?`): [`ZodTypeDescriptor`](../type-aliases/ZodTypeDescriptor.md)[]

Defined in: [packages/langium-zod/src/extractor.ts:328](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/extractor.ts#L328)

Extracts [ZodTypeDescriptor](../type-aliases/ZodTypeDescriptor.md) records from a Langium grammar's type model.

Runs a three-phase pipeline:
1. **Object descriptors** — converts each `InterfaceType` (with inherited
   properties resolved through the super-type chain) into a `ZodObjectTypeDescriptor`.
2. **Union / enum descriptors** — converts each `UnionType` into one of:
   `ZodUnionTypeDescriptor` (discriminated union of interfaces),
   `ZodKeywordEnumDescriptor` (pure keyword literal union),
   `ZodRegexEnumDescriptor` (terminal regex ± keyword alternatives), or
   `ZodPrimitiveAliasDescriptor` (simple primitive alias such as `BigDecimal`).
3. **Stub descriptors** — synthesises primitive-alias stubs for any referenced
   type name that does not appear in `astTypes` (e.g. standalone datatype rules).

Include/exclude filtering from `config` is applied at each phase.

## Parameters

### astTypes

[`AstTypesLike`](../interfaces/AstTypesLike.md)

The interface and union types collected from a Langium grammar,
  typically produced by Langium's `collectAst()`.

### config?

[`FilterConfig`](../interfaces/FilterConfig.md)

Optional include/exclude filter controlling which type names are
  emitted.

## Returns

[`ZodTypeDescriptor`](../type-aliases/ZodTypeDescriptor.md)[]

A flat array of type descriptors ready for code generation.

## Throws

[ZodGeneratorError](../classes/ZodGeneratorError.md) when a property's type cannot be mapped to a
  known Zod schema kind.
