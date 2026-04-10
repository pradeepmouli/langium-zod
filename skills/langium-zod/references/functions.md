# Functions

## api

### `generateZodSchemas`
Main entry point for programmatic Zod schema generation.

Accepts a ZodGeneratorConfig that specifies either a parsed Langium
Grammar object or a pre-built AstTypesLike descriptor, then runs
the full extraction → projection → code-generation pipeline and returns the
generated TypeScript source as a string. When `config.outputPath` is set the
result is also written to disk. Conformance artifacts are generated when
`config.conformance` is provided.
```ts
generateZodSchemas(config: ZodGeneratorConfig): string
```
**Parameters:**
- `config: ZodGeneratorConfig` — Generator configuration including the grammar or AST types,
  optional output path, include/exclude filters, and feature flags.
**Returns:** `string` — The generated TypeScript source containing all Zod schema exports.
**Throws:** ZodGeneratorError when required configuration is missing or a
  grammar property type cannot be mapped to a Zod schema.

## extractor

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
  known Zod schema kind.

## generator

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
```ts
generateZodCode(descriptors: ZodTypeDescriptor[], recursiveTypes: Set<string>, options: GenerationOptions): string
```
**Parameters:**
- `descriptors: ZodTypeDescriptor[]` — Full set of type descriptors produced by
  extractTypeDescriptors. Projection / stripInternals filtering is
  applied internally via `applyProjectionToDescriptors`.
- `recursiveTypes: Set<string>` — Set of type names that participate in a reference cycle,
  produced by detectRecursiveTypes. These are emitted with getter syntax.
- `options: GenerationOptions` — default: `{}` — Optional flags controlling output style (objectStyle, formMetadata,
  crossRefValidation, projection, stripInternals).
**Returns:** `string` — The generated TypeScript source as a string (does not write to disk).

## recursion-detector

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
```ts
detectRecursiveTypes(descriptors: ZodTypeDescriptor[]): Set<string>
```
**Parameters:**
- `descriptors: ZodTypeDescriptor[]` — The full list of type descriptors to analyse, as returned
  by extractTypeDescriptors.
**Returns:** `Set<string>` — A `Set` of type names that are involved in at least one reference cycle.

## ref-utils

### `zRef`
Creates a Zod string schema that validates a cross-reference value against an
allowlist of known identifiers, evaluated lazily at parse time.

This is used in generated cross-reference schema factories (emitted when
`crossRefValidation` is enabled) to validate that a `$refText` string resolves
to an identifier that actually exists in the current document model. The
collection is resolved lazily via a getter function so that it can reference the
live state of the Langium document at validation time rather than a snapshot
captured at schema construction.

Empty strings and whitespace-only values always pass (they represent
unresolved/placeholder references). When the collection is empty or not yet
populated, validation also passes to avoid false negatives during incremental
parsing.
```ts
zRef(collection: string[] | (() => string[]), message: string): ZodString
```
**Parameters:**
- `collection: string[] | (() => string[])` — Either a static `string[]` or a zero-argument function that
  returns the current list of valid reference target names.
- `message: string` — default: `'Unknown reference value'` — Custom validation error message returned when the value is not
  found in the collection. Defaults to `'Unknown reference value'`.
**Returns:** `ZodString` — A `z.ZodString` schema with a `.refine` constraint attached.

## cli

### `resolveFilterOverrides`
Merges CLI `--include` / `--exclude` flag values with the base filter from a
user config file, producing a deduplicated, conflict-free filter pair.

CLI arguments take precedence over the config file values. Any name that appears
in both `include` and `exclude` is removed from `include` so that the exclude
list is authoritative.
```ts
resolveFilterOverrides(base: Pick<LangiumZodConfig, "include" | "exclude">, includeArg?: string, excludeArg?: string): Pick<LangiumZodConfig, "include" | "exclude">
```
**Parameters:**
- `base: Pick<LangiumZodConfig, "include" | "exclude">` — Baseline include/exclude arrays from the user's
  `langium-zod.config.js`, used when the corresponding CLI flag is absent.
- `includeArg: string` (optional) — Raw comma-separated string from `--include`, or `undefined`
  when the flag was not passed.
- `excludeArg: string` (optional) — Raw comma-separated string from `--exclude`, or `undefined`
  when the flag was not passed.
**Returns:** `Pick<LangiumZodConfig, "include" | "exclude">` — A resolved `{ include, exclude }` pair ready to merge into the
  generator config.

### `getUnknownFilterNames`
Returns the subset of `requested` names that are not present in
`availableTypeNames`.

Used to surface warnings when the user's `--include` or `--exclude` list
references type names that do not exist in the parsed grammar, helping catch
typos before generation runs.
```ts
getUnknownFilterNames(requested: string[] | undefined, availableTypeNames: string[]): string[]
```
**Parameters:**
- `requested: string[] | undefined` — The type names requested by the user (include or exclude
  list). Returns an empty array immediately when this is `undefined` or empty.
- `availableTypeNames: string[]` — All type names present in the parsed Langium grammar
  (both interface types and union/datatype rule types).
**Returns:** `string[]` — An array of names from `requested` that are absent from
  `availableTypeNames`.

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

### `main`
CLI entry point executed when the `langium-zod` binary is invoked directly.

Parses `process.argv`, resolves `langium-config.json`, loads an optional
`langium-zod.config.js` from the same directory, merges all CLI flag overrides
(--out, --include, --exclude, --projection, --strip-internals, --conformance,
--cross-ref-validation), then delegates to generate. Exits the process
with code 1 on error.
```ts
main(): Promise<void>
```
**Returns:** `Promise<void>`
