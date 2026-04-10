[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodTypeDescriptor

# Type Alias: ZodTypeDescriptor

> **ZodTypeDescriptor** = `ZodObjectTypeDescriptor` \| `ZodUnionTypeDescriptor` \| `ZodPrimitiveAliasDescriptor` \| `ZodKeywordEnumDescriptor` \| `ZodRegexEnumDescriptor`

Defined in: [packages/langium-zod/src/types.ts:95](https://github.com/pradeepmouli/langium-zod/blob/a8107a97ff90f2682446b99d409a99ea05b059dc/packages/langium-zod/src/types.ts#L95)

Union of all type descriptor shapes that the extractor can produce and the
code generator can consume. Each variant carries a discriminating `kind` field:
`'object'`, `'union'`, `'primitive-alias'`, `'keyword-enum'`, or `'regex-enum'`.
