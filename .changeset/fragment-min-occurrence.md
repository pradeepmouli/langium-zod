---
"langium-zod": patch
---

Fix fragment-defined array properties incorrectly emitting `.min(1)`.

When a `+=` assignment lives inside a grammar fragment (e.g.
`fragment ClassSynonyms: synonyms+=RosettaClassSynonym;`), Langium's
`Property.astNodes` points to the assignment inside the fragment definition.
The `$container` chain of that assignment ends at the fragment rule — not at
the optional use site (e.g. `(ClassSynonyms)*`) — so the cardinality walk in
`isMandatoryOccurrence` never saw the optionality and incorrectly returned
`true`, emitting `.min(1)` for arrays that can legitimately be empty.

The fix adds a guard after the walk: if the terminal container is a fragment
`ParserRule`, the occurrence is treated as optional (conservative under-emit —
never rejects a valid document). Assignments in regular rules (e.g. the
mandatory comma-list `sources+=[Src] (',' sources+=[Src])*`) are unaffected.
