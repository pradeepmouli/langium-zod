# Functions

## Generation

### `generateZodSchemas`
Main entry point for programmatic Zod schema generation from a Langium grammar.

Accepts a ZodGeneratorConfig that specifies either a parsed Langium
`Grammar` object or a pre-built AstTypesLike descriptor, then runs the
full extraction → projection → code-generation pipeline and returns the
generated TypeScript source as a string. When `config.outputPath` is set the
result is also written to disk. Conformance artifacts are generated when
`config.conformance` is provided.

This is the primary API for most consumers. It combines extractTypeDescriptors,
detectRecursiveTypes, and generateZodCode into a single call. Use the
lower-level functions directly only when you need fine-grained control over individual
pipeline stages (e.g. to inspect descriptors before code generation, or to cache
extraction results across multiple code-generation runs).

The function is synchronous and writes to disk only when `config.outputPath` is set.
It does not shell out or spawn child processes.

**Config option decision tree:**
- Does your grammar have recursive rules (e.g. `Expression: ... | left=Expression`)? →
  no action needed; cycle detection is automatic. If you run a custom pipeline, pass the
  *full* (unprojected) descriptor set to `detectRecursiveTypes` first.
- Does your grammar have cross-references (`ref:` properties)? →
  if you need runtime ref-text validation in a live language server, enable
  `crossRefValidation: true` and use the emitted `create*Schema()` factories.
  Otherwise leave it off — unconstrained `ReferenceSchema` is lighter and sufficient for
  batch/offline validation.
- Do you want to strip Langium internal bookkeeping fields (`$container`, `$document`,
  `$cstNode`, etc.)? → set `stripInternals: true`. These fields are never meaningful
  in a validation context and inflate the generated schema.
- Do you need form labels and descriptions driven by the grammar? → enable `formMetadata: true`.
  Only properties whose grammar rule has a JSDoc/grammar comment get a `description`; every
  property gets a humanized `title` regardless.
- Are you using Zod 4's `z.looseObject`? → the default `objectStyle: 'loose'` emits
  `z.looseObject(...)`. Switch to `objectStyle: 'strict'` + `.strict()` on the schema only
  when you need hard rejection of unknown properties (e.g. strict API request validation).
```ts
generateZodSchemas(config: ZodGeneratorConfig): string
```
**Parameters:**
- `config: ZodGeneratorConfig` — Generator configuration including the grammar or AST types,
  optional output path, include/exclude filters, projection, and feature flags.
**Returns:** `string` — The generated TypeScript source containing all Zod schema exports.
**Throws:** ZodGeneratorError when required configuration is missing, when
  `conformance` is enabled without `outputPath`, or when a grammar property type
  cannot be mapped to a Zod schema.
**See:** - extractTypeDescriptors
 - detectRecursiveTypes
 - generateZodCode
 - ZodGeneratorConfig
```ts
import { createLangiumGrammarServices } from 'langium/grammar';
import { NodeFileSystem } from 'langium/node';
import { generateZodSchemas } from 'langium-zod';

const { grammar } = createLangiumGrammarServices(NodeFileSystem);
// assume `parsedGrammar` is a Grammar node obtained from Langium
const source = generateZodSchemas({
  grammar: parsedGrammar,
  outputPath: 'src/generated/zod-schemas.ts',
  stripInternals: true,
});
console.log(source); // TypeScript source with Zod schema exports
```
```ts
// Using a pre-built AstTypesLike descriptor (skips grammar parsing)
import { generateZodSchemas } from 'langium-zod';
import { collectAst } from 'langium/grammar';

const astTypes = collectAst(myGrammar);
const source = generateZodSchemas({ astTypes });
```

### `generateZodCode`
Generates a TypeScript source string containing Zod schema exports for all
provided type descriptors.

Emission order is:
1. Keyword-enum schemas (`z.literal` / `z.union([z.literal(...)])`)
2. Regex-enum schemas (`z.string().regex(...)`)
3. Primitive-alias schemas (`z.string()`, `z.number()`, etc.)
4. Object schemas in topological dependency order; properties that form
   reference cycles are emitted as getter accessors to avoid forward-reference
   errors.
5. Discriminated-union schemas (all member object schemas are already declared).
6. A master `AstNodeSchema` discriminated union across all object schemas.
7. Optional cross-reference schema factories when `options.crossRefValidation`
   is enabled.

The generated file includes a `// @ts-nocheck` comment at the top because the
getter-based cycle-breaking syntax is not always accepted by TypeScript's strict
object literal type checker. Do not remove it from generated output.

Union schemas are always emitted **after** all object schemas. Properties that
reference a union type use `z.lazy()` wrappers automatically (tracked via
`unionNames`), so the output is always valid even when object schemas reference
unions that are defined later in the file.

This function does not write to disk; call generateZodSchemas to write
to `config.outputPath`.
```ts
generateZodCode(descriptors: ZodTypeDescriptor[], recursiveTypes: Set<string>, options: GenerationOptions): string
```
**Parameters:**
- `descriptors: ZodTypeDescriptor[]` — Full set of type descriptors produced by
  extractTypeDescriptors. Projection / stripInternals filtering is
  applied internally via `applyProjectionToDescriptors`.
- `recursiveTypes: Set<string>` — Set of type names that participate in a reference cycle,
  produced by detectRecursiveTypes. These are emitted with getter syntax.
- `options: GenerationOptions` — default: `{}` — Optional flags controlling output style (`objectStyle`,
  `formMetadata`, `crossRefValidation`, `projection`, `stripInternals`).
**Returns:** `string` — The generated TypeScript source as a string (does not write to disk).
**See:** - extractTypeDescriptors
 - detectRecursiveTypes
 - generateZodSchemas
```ts
import { extractTypeDescriptors, detectRecursiveTypes, generateZodCode } from 'langium-zod';
import { collectAst } from 'langium/grammar';

const astTypes = collectAst(myGrammar);
const descriptors = extractTypeDescriptors(astTypes);
const recursiveTypes = detectRecursiveTypes(descriptors);
const source = generateZodCode(descriptors, recursiveTypes, { objectStyle: 'strict' });
```

### `zRef`
Creates a Zod string schema that validates a cross-reference value against an
allowlist of known identifiers, evaluated lazily at parse time.

This is used in generated cross-reference schema factories (emitted when
`crossRefValidation` is enabled in ZodGeneratorConfig) to validate that
a `$refText` string resolves to an identifier that actually exists in the current
document model. The collection is resolved lazily via a getter function so that it
can reference the live state of the Langium document at validation time rather than
a snapshot captured at schema construction.

Empty strings and whitespace-only values always pass (they represent
unresolved/placeholder references). When the collection is empty or not yet
populated, validation also passes to avoid false negatives during incremental
parsing.

Generated schema factories produced by `crossRefValidation: true` call this
function with a getter (lambda) instead of a static array. This ensures the
resolved reference list reflects the document's live state at the moment of
validation rather than at schema creation time.

`zRef` is exported for consumers who want to extend or wrap the generated schemas
with custom cross-reference validation that shares the same leniency semantics
(empty string passes, empty collection passes).
```ts
zRef(collection: string[] | (() => string[]), message: string): ZodString
```
**Parameters:**
- `collection: string[] | (() => string[])` — Either a static `string[]` or a zero-argument function that
  returns the current list of valid reference target names.
- `message: string` — default: `'Unknown reference value'` — Custom validation error message returned when the value is not
  found in the collection. Defaults to `'Unknown reference value'`.
**Returns:** `ZodString` — A `z.ZodString` schema with a `.refine` constraint attached.
**See:** ZodGeneratorConfig.crossRefValidation
```ts
import { zRef } from 'langium-zod';

// Static allowlist
const schema = zRef(['Alice', 'Bob', 'Carol']);
schema.parse('Alice');  // ok
schema.parse('Dave');   // throws ZodError: Unknown reference value

// Lazy getter — collection is resolved at parse time
const liveRefs: string[] = [];
const lazySchema = zRef(() => liveRefs);
liveRefs.push('Alice');
lazySchema.parse('Alice'); // ok — picked up the live state
```

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

## cli

### `generate`
Programmatic entry point for the `langium-zod generate` command.

Loads `langium-config.json` from `opts.langiumConfigPath`, resolves the grammar
file path, parses the grammar with Langium services (including eager import
loading so cross-file references link correctly), then calls
generateZodSchemas with the merged configuration. Prints a success
message to stdout when generation completes.
```ts
generate(opts: GenerateOptions): Promise<void>
```
**Parameters:**
- `opts: GenerateOptions` — GenerateOptions specifying the langium config path and
  optional pre-merged generator config.
**Returns:** `Promise<void>`
**Throws:** `Error` when the langium-config.json or grammar file cannot be found, or
  when the config defines no languages.
```ts
import { generate } from 'langium-zod';
import { resolve } from 'node:path';

await generate({
  langiumConfigPath: resolve(process.cwd(), 'langium-config.json'),
  config: {
    outputPath: 'src/generated/zod-schemas.ts',
    stripInternals: true,
  },
});
// Prints: ✓ Generated Zod schemas → src/generated/zod-schemas.ts
```
