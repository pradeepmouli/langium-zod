---
"langium-zod": patch
---

namespace-ops: emit a single-barrel `domain.ts` so AST names merge with their ops

The emitter now produces `import * as ast` + `export * from './ast.js'` and, per
namespaced type, a local `export type Foo = ast.Foo` alongside `export namespace Foo`.
The type alias merges with the value namespace under one name (type space + value
space) and shadows the star-exported interface/reflection-const, so consumers import a
single barrel where `Foo` is both the interface type AND the ops namespace
(`Foo.addBar(node, ...)`). Function signatures qualify every type through the `ast.*`
binding because `export *` re-exports names to consumers without binding them in the
module's own lexical scope. Replaces the prior `$`-suffixed aliased-import form.
