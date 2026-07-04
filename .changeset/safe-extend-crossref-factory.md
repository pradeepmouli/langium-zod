---
"langium-zod": patch
---

Fix the generated `create<X>Schema(refs)` cross-reference factory throwing at
first invocation when its base object schema carries a `.superRefine()`
(e.g. an at-least-one-of constraint from the schema-driven-synonym-validity
work).

Zod v4's `.extend()` throws ("Cannot overwrite keys on object schemas
containing refinements") when overriding a key that already exists on a
refined schema — and the generated factory always overrides at least one
cross-reference-bearing key on the base object shape. No real consumer has
hit this yet (rune-langium's own generated schemas didn't combine a refined
type with a cross-reference property until recently), so it was latent, but
it's a landmine for the first adopter of the generated cross-ref factories
against any refined type.

Switched the factory emitter to `.safeExtend()` — a drop-in replacement with
identical shape-merge semantics that simply permits the refinement/overlap
case, mirroring the fix already applied consumer-side in rune-langium's
`deriveUiSchema` (commit `e789fbad`). Covered by a new integration test that
parses a real grammar producing a type that is BOTH refined (a mandatory
2-way alternation) and cross-reference-bearing, generates its schema with
`crossRefValidation: true`, and confirms the resulting `create<X>Schema`
factory constructs and validates without throwing — confirmed to fail with
the exact zod overlap error before the fix (reverted, reran, restored).
