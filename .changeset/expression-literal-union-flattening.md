---
"langium-zod": patch
---

Fix a pre-existing bug where a discriminated union's member list silently
dropped any raw member that was itself another union (rather than a leaf
interface), instead of flattening that nested union's own members in.

Grammar rules like:

```
PrimaryExpression infers Expression: A | LiteralRule | ...
LiteralRule infers Literal: BoolLiteral | StringLiteral | NumberLiteral | IntLiteral
```

produce a Langium type model where `Expression`'s raw alternation includes the
name `Literal` — itself a union, never a `$type` any real AST node carries.
The extractor's union-member filter only kept members that were already-known
LEAF interfaces, so `Literal`'s 4 members were silently omitted from
`ExpressionSchema`'s `z.discriminatedUnion(...)` member array (even though
`LiteralSchema` itself was generated correctly, just never merged in). Any
real parser-produced node using one of those 4 literal shapes wherever an
`Expression` was expected failed the discriminator check with "Invalid
discriminator value" — a direct violation of the schema-never-rejects-parser-
output invariant this generator exists to uphold.

Fixed by resolving each union's transitive interface membership (recursively
flattening any member that names another union, guarded against cyclic union
graphs) instead of a single non-recursive filter pass. Covered by: a unit test
reproducing the exact `RosettaExpression`/`RosettaLiteral` shape plus a
2-level-deeper synthetic case and a cyclic-reference safety case; an
integration test parsing a real grammar and `safeParse`-ing real literal-typed
AST shapes against the regenerated schema; and a permanent completeness-audit
test that independently recomputes (via a separate BFS over the raw grammar
union graph, not by calling the fixed function itself) every union's expected
transitive interface closure and asserts it matches the generated
`members` set — a regression guard for this whole bug CLASS, not just this
one instance.

Verified against a real large consuming grammar (rune-langium): the fix
surfaces the missing 4 literal members on `RosettaExpressionSchema` as
expected, plus two additional real cases the completeness audit was designed
to catch (`RosettaMapTestSchema` and `RosettaMapTestExpressionSchema`, which
transitively reach the same `RosettaLiteral` union through a different,
two-level nesting path plus a second nested union) — confirming the
class-level fix, not a one-off patch for the single reported symptom. No
existing union's members shrank; no `.superRefine()`/`.min(1)`/array-optional
invariants from the prior release regressed.
