---
'langium-zod': minor
---

namespace-ops: emit a generated typed domain repository — generic `Repository<T>` + `createRepository` (throws `DuplicateKeyError` on duplicate key), plus `AnyDomain` union, `DomainRepository` (`byType` typed via `Extract<AnyDomain, { $type: K }>`), and `createDomainRepository`, driven by a new `repository.elementTypes` list in the domain-surface config. Configured element types are validated at codegen time to declare a required `name` (the qualified-name identity source), so a missing/optional `name` fails fast instead of producing a `domain.ts` that won't compile downstream.
