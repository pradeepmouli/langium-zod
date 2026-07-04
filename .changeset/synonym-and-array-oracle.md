---
"langium-zod": minor
---

Make generated Zod schemas an honest validity oracle for two remaining gaps:

- **At-least-one-of refinements**: for grammar rules whose top-level `Alternatives`
  group is a GUARANTEED-TO-EXECUTE mutually-exclusive property producer (e.g.
  `RosettaSynonymBody`'s `value|hint|merge|...` choice, or a `when`/`set` mapping
  instance), the parser can never produce an instance where none of the
  branch-introduced properties are populated. The generator now derives this
  structurally from the grammar (via each property's `Assignment`/`Action`
  `astNodes`) and emits a `.superRefine` requiring at least one to be
  present/non-empty, naming the missing set in the issue message. The
  `Alternatives` group must be unconditional: any `?`/`*` cardinality on the
  group itself or an ancestor element, a branch position inside an OUTER
  multi-way `Alternatives`, or a fragment-rule call-site boundary all skip the
  refinement entirely (an optional, starred, nested, or optionally-called
  alternation may legally execute zero times). Boolean flag assignments (`?=`)
  are excluded from the check (Langium always serialises them as `false` when
  absent, so a branch containing only a flag can legally produce zero checkable
  properties — the whole refinement is dropped when it would otherwise reject a
  valid empty-except-flag branch). Branches whose subtree infers a DIFFERENT
  type via `{infer Type.x=current}` (Langium's tree-rebuilding left-recursion
  idiom, e.g. path-vs-deep-path selection) are also excluded — that shape is a
  type-union rule, not an intra-type alternation.
- **Array `.optional()` cleanup**: array-typed properties never emit
  `.optional()` regardless of the grammar's optional flag. Langium's
  `assignMandatoryProperties` always materialises `[]` for array-typed
  properties — an array is never `undefined` in real parse output, so
  `.optional()` admitted a shape the parser can never produce. `min(1)` (from
  the existing comma-list/`+`-cardinality analysis) is preserved where derived.

Both changes tighten what a passing `safeParse` guarantees without ever
rejecting anything a real grammar's parser can produce. Validated against a
real consuming grammar (rune-langium): the four rules that gain at-least-one-of
refinements there are all unconditional alternations, so rune's generated
output is unaffected by the cardinality guard; separately, adversarial
synthetic grammars (optional/starred/nested/fragment-gated alternations) are
covered by regression tests confirming the refinement is correctly withheld.
