---
"langium-zod": patch
---

feat(config): add `regexOverrides` option to `ZodGeneratorConfig`

Parser-based Langium datatype rules composed of multiple terminals (e.g. `BigDecimal`)
cannot be automatically converted to a regex because Langium's `buildDataRuleType` only
handles single-element groups and simple terminal references — it bails out for any
multi-element sequence or optional/repetition cardinality.

New `regexOverrides?: Record<string, string>` field on `ZodGeneratorConfig` lets callers
supply the regex manually for such types:

```ts
generateZodSchemas({
  grammar: RuneDslGrammar(),
  regexOverrides: {
    BigDecimal: String.raw`^[+-]?(\.[0-9]+|[0-9]+\.[0-9]*)([eE][+-]?[0-9]+)?$`
  }
})
// → export const BigDecimalSchema = z.string().regex(new RegExp("^[+-]?..."));
```

Any `primitive-alias` (or existing `regex-enum`) descriptor whose name matches a key in
`regexOverrides` is upgraded to a `regex-enum` descriptor in a post-extraction pass inside
`generateZodSchemas()`.
