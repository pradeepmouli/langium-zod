[**langium-zod v0.1.0**](../../README.md)

***

[langium-zod](../../README.md) / [](../../README.md) / ZodTypeDescriptor

# Type Alias: ZodTypeDescriptor

> **ZodTypeDescriptor** = `ZodObjectTypeDescriptor` \| `ZodUnionTypeDescriptor` \| `ZodPrimitiveAliasDescriptor` \| `ZodKeywordEnumDescriptor` \| `ZodRegexEnumDescriptor`

Defined in: [packages/langium-zod/src/types.ts:95](https://github.com/pradeepmouli/langium-zod/blob/fd214dfbfc75ce9ead8cac3a806267879de59eb4/packages/langium-zod/src/types.ts#L95)

Union of all type descriptor shapes that the extractor can produce and the
code generator can consume. Each variant carries a discriminating `kind` field:
`'object'`, `'union'`, `'primitive-alias'`, `'keyword-enum'`, or `'regex-enum'`.
