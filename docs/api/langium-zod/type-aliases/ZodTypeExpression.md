[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodTypeExpression

# Type Alias: ZodTypeExpression

> **ZodTypeExpression** = \{ `kind`: `"primitive"`; `primitive`: `ZodPrimitive`; \} \| \{ `kind`: `"literal"`; `value`: `string`; \} \| \{ `kind`: `"reference"`; `typeName`: `string`; \} \| \{ `element`: `ZodTypeExpression`; `kind`: `"array"`; \} \| \{ `kind`: `"crossReference"`; `targetType`: `string`; \} \| \{ `kind`: `"union"`; `members`: `ZodTypeExpression`[]; \} \| \{ `inner`: `ZodTypeExpression`; `kind`: `"lazy"`; \}

Defined in: [packages/langium-zod/src/types.ts:18](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/types.ts#L18)

A discriminated union that represents a single Zod type node in the descriptor
tree produced by the extractor and consumed by the code generator.

Each variant maps to a specific Zod combinator:
- `primitive` → `z.string()` / `z.number()` / `z.boolean()` / `z.bigint()`
- `literal` → `z.literal(value)`
- `reference` → `<TypeName>Schema` (a reference to another generated schema)
- `array` → `z.array(element)`
- `crossReference` → `ReferenceSchema` (Langium cross-reference, optionally
  refined with [zRef](../functions/zRef.md) when cross-reference validation is enabled)
- `union` → `z.union([...members])`
- `lazy` → `z.lazy(() => inner)` (used for self-referential types)
