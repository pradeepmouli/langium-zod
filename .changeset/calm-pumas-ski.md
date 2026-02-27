---
"langium-zod": minor
---

Improve AST schema generation and mapping behavior:

- Add a generated master discriminated union export named `AstNodeSchema` keyed by `$type`
- Improve extractor handling for primitive aliases and filtered fallback stubs
- Improve cross-reference mapping in the type mapper and expand test coverage
