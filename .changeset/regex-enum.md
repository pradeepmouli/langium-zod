---
"langium-zod": patch
---

feat(extractor): map regex terminal + keyword unions to z.string().regex() + z.literal() union

Langium datatype rules like `ValidID returns string: ID | 'condition' | 'source' | ...`
surface as `{ types: [{ primitive: 'string', regex: '/.../' }, { string: 'kw' }, ...] }`.
Previously these collapsed to `z.string()`.

New `ZodRegexEnumDescriptor` (`kind: 'regex-enum'`) captures the terminal regex and keyword
alternatives and emits:
  `z.union([z.string().regex(new RegExp("...")), z.literal("kw1"), ...])`

or, for a pure regex with no keywords:
  `z.string().regex(new RegExp("..."))`
