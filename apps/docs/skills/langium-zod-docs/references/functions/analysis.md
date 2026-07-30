# Functions

## Analysis

### `extractTypeDescriptors`
Extracts ZodTypeDescriptor records from a Langium grammar's type model.

Runs a three-phase pipeline:
1. **Object descriptors** — converts each `InterfaceType` (with inherited
   properties resolved through the super-type chain) into a `ZodObjectTypeDescriptor`.
2. **Union / enum descriptors** — converts each `UnionType` into one of:
   `ZodUnionTypeDescriptor` (discriminated union of interfaces),
   `ZodKeywordEnumDescriptor` (pure keyword literal union),
   `ZodRegexEnumDescriptor` (terminal regex ± keyword alternatives), or
   `ZodPrimitiveAliasDescriptor` (simple primitive alias such as `BigDecimal`).
3. **Stub descriptors** — synthesises primitive-alias stubs for any referenced
   type name that does not appear in `astTypes` (e.g. standalone datatype rules).

Include/exclude filtering from `config` is applied at each phase.

This function operates on the duck-typed AstTypesLike shape rather than
Langium's concrete `AstTypes` class. You can pass plain object literals in tests
without importing from Langium internals.

Properties whose names start with `$` (other than `$type`) are silently skipped —
these are Langium bookkeeping fields (`$container`, `$document`, etc.) that should
not appear in user-facing Zod schemas. Use `stripInternals` in
ZodGeneratorConfig (via generateZodSchemas) to also strip `$type`
from the projection surface.

Each object descriptor always includes a synthetic `$type` literal property set to
the interface's name. This property is the discriminator key for generated
discriminated-union schemas.
```ts
extractTypeDescriptors(astTypes: AstTypesLike, config?: FilterConfig): ZodTypeDescriptor[]
```
**Parameters:**
- `astTypes: AstTypesLike` — The interface and union types collected from a Langium grammar,
  typically produced by Langium's `collectAst()`.
- `config: FilterConfig` (optional) — Optional include/exclude filter controlling which type names are
  emitted.
**Returns:** `ZodTypeDescriptor[]` — A flat array of type descriptors ready for code generation.
**Throws:** ZodGeneratorError when a property's type cannot be mapped to a
  known Zod schema kind (e.g. an unresolvable terminal reference).
**See:** - generateZodCode
 - detectRecursiveTypes
 - AstTypesLike
 - ZodTypeDescriptor
```ts
import { extractTypeDescriptors } from 'langium-zod';
import { collectAst } from 'langium/grammar';

const astTypes = collectAst(myGrammar);
const descriptors = extractTypeDescriptors(astTypes, { exclude: ['InternalNode'] });
console.log(descriptors.map(d => d.name));
```

### `detectRecursiveTypes`
Detects type names that participate in a reference cycle across the descriptor
graph.

Builds a directed graph where each object type descriptor is a node and each
type reference in its properties is an edge. A depth-first search then
identifies all nodes that belong to at least one cycle. The generator uses this
set to emit getter-based property accessors instead of direct value expressions,
avoiding JavaScript "used before declaration" errors for mutually-recursive Zod
schemas.

Only `'object'` kind descriptors are considered; union and primitive-alias
descriptors are transparent to cycle detection.

A Langium grammar with a rule like `Expression: value=Expression | ...` is
self-referential at the object level. Without getter syntax, the emitted
`const ExpressionSchema = z.object({ value: ExpressionSchema })` would fail at
runtime because `ExpressionSchema` is referenced before it is defined. The
returned set marks `Expression` as recursive so the generator can emit
`get value() { return ExpressionSchema; }` instead.

Mutual cycles (A → B → A) are also detected: both A and B will appear in the
returned set. Diamond-shaped references (A → C and B → C, but no back-edge)
are not cycles and will not appear in the result.
```ts
detectRecursiveTypes(descriptors: ZodTypeDescriptor[]): Set<string>
```
**Parameters:**
- `descriptors: ZodTypeDescriptor[]` — The full list of type descriptors to analyse, as returned
  by extractTypeDescriptors.
**Returns:** `Set<string>` — A `Set` of type names that are involved in at least one reference cycle.
**See:** - extractTypeDescriptors
 - generateZodCode
 - ZodTypeDescriptor
```ts
import { extractTypeDescriptors, detectRecursiveTypes } from 'langium-zod';
import { collectAst } from 'langium/grammar';

const descriptors = extractTypeDescriptors(collectAst(myGrammar));
const recursive = detectRecursiveTypes(descriptors);
console.log([...recursive]); // e.g. ['Expression', 'Statement']
```
