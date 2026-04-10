[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodTypeExpression

# Type Alias: ZodTypeExpression

> **ZodTypeExpression** = \{ `kind`: `"primitive"`; `primitive`: `ZodPrimitive`; \} \| \{ `kind`: `"literal"`; `value`: `string`; \} \| \{ `kind`: `"reference"`; `typeName`: `string`; \} \| \{ `element`: `ZodTypeExpression`; `kind`: `"array"`; \} \| \{ `kind`: `"crossReference"`; `targetType`: `string`; \} \| \{ `kind`: `"union"`; `members`: `ZodTypeExpression`[]; \} \| \{ `inner`: `ZodTypeExpression`; `kind`: `"lazy"`; \}

Defined in: [packages/langium-zod/src/types.ts:3](https://github.com/pradeepmouli/langium-zod/blob/d6718272515c07b7b78477335d2b8b752ea98756/packages/langium-zod/src/types.ts#L3)
