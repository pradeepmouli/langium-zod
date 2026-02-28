---
'langium-zod': minor
---

Add Rune DSL schema generation enhancements:

- preserve one-or-more cardinality (`+= Rule+`) as `z.array(...).min(1)`
- add CLI include/exclude filters with deterministic overlap handling and warnings for unknown types
- add projection and strip-internals schema surface controls
- add optional conformance artifact generation with AST path resolution
- add optional cross-reference validation factories and export reusable `zRef`
