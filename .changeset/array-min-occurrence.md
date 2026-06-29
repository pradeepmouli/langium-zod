---
"langium-zod": minor
---

Derive array `.min(1)` from grammar minimum-occurrence for real parsed grammars.

Previously `.min(1)` was emitted only when a single rule call carried an explicit
`+` cardinality — and only for synthetic `astTypes` fixtures, never from a real
`collectAst` grammar (the real Langium `Property` exposes `astNodes` but no
`cardinality`/`operator`). The generator now walks each array property's
originating `Assignment` nodes' cardinality chains (`Property.astNodes` +
`isOptionalCardinality`) and emits `.min(1)` when any `+=` assignment occurs on a
mandatory path. This covers both `x+=A+` and the comma-list idiom
`x+=A (',' x+=A)*` (e.g. a required `sources+=[Src] (',' sources+=[Src])*`).
