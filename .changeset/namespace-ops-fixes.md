---
"langium-zod": minor
---

Fix three bugs in namespace-ops emitter:
- Skip non-object referenced types (e.g. ValidID string unions) to avoid unimported names in generated code
- Add reserved-word escaping for field names used as parameter names (`function` → `function_`)
- Alias all AST type imports with `$` suffix to avoid TS2395 when `export namespace Foo` and `import type { Foo }` coexist in the same file
