---
name: langium-zod
description: "Langium generator plugin that derives Zod schemas from grammar definitions Use when: You have a parsed Langium `Grammar` object and want Zod schemas as a.... Also: langium, zod, codegen, ast."
license: MIT
---

# langium-zod

Langium generator plugin that derives Zod schemas from grammar definitions

**langium-zod** — generate Zod validation schemas from Langium grammar definitions.

Before generating, ask:
- **Recursive rules?** Grammar rules that reference themselves (e.g. `Expression: ... | left=Expression`) require cycle detection. `generateZodSchemas` handles this automatically via detectRecursiveTypes, but if you build a custom pipeline you must run detection on the *full* descriptor set before any projection.
- **Cross-references?** Langium `ref:` properties become `ReferenceSchema` by default. Enable `crossRefValidation: true` only when you have a live document model to validate against at runtime; otherwise every cross-ref property will emit an unconstrained `ReferenceSchema`.
- **Discriminated unions?** Every Langium union type (e.g. `Expression = Literal | BinaryExpr`) maps to a Zod discriminated union keyed on `$type`. All member types must be emitted — use `include` with care when union types are involved.
- **Grammar changes?** Generated schemas are compile-time artifacts. Any grammar edit (new rule, renamed property, changed cardinality) requires regeneration. Wire `langium-zod generate` into your build step so stale schemas are caught early.
- **AST imports path?** The conformance artifact imports from your grammar's `ast.ts`. If the generated file moves, update `conformance.astTypesPath` to point to the new location or import errors will appear at compile time.

**Entry points:**
- generateZodSchemas — main programmatic API (grammar → TypeScript source string)
- generateZodCode — low-level emitter operating on pre-built descriptors
- extractTypeDescriptors — extracts the descriptor tree from `AstTypesLike`
- detectRecursiveTypes — identifies reference cycles before code generation
- zRef — cross-reference validation helper for generated schema factories
- ZodSchemaGeneratorModule — Langium DI module for service-based integration

## Quick Start

```ts
import { generateZodSchemas } from 'langium-zod';

const source = generateZodSchemas({ grammar, services });
```

## When to Use

**Use this skill when:**
- You have a parsed Langium `Grammar` object and want Zod schemas as a TypeScript string. → use `generateZodSchemas`
- You are integrating langium-zod into a build pipeline (Vite plugin, codegen script, etc.). → use `generateZodSchemas`
- You need conformance artifacts (type-guard files) alongside the schema output. → use `generateZodSchemas`
- You want to write generated schemas to disk in a single call. → use `generateZodSchemas`
- You want to inspect or transform the intermediate descriptor representation before generating code (e.g. to add custom properties or change types). → use `extractTypeDescriptors`
- You are caching descriptors across multiple calls to generateZodCode with different options, so you only want to pay the extraction cost once. → use `extractTypeDescriptors`
- You are writing tests against the descriptor model rather than the generated source. → use `extractTypeDescriptors`
- You already have descriptors and a recursion set and want to run code generation in isolation (e.g. for testing the emitter with synthetic descriptors). → use `generateZodCode`
- You need to generate code multiple times with different `options` from the same descriptor set without re-running extraction. → use `generateZodCode`
- You are building a custom pipeline that inserts descriptor transformations between extraction and code generation. → use `generateZodCode`
- You need to know which grammar types are recursive before calling generateZodCode (e.g. to log or filter them). → use `detectRecursiveTypes`
- You are building a custom code emitter and need the same cycle information that the built-in generator uses. → use `detectRecursiveTypes`
- You need runtime cross-reference validation and are using `crossRefValidation: true` to have the generator emit `create*Schema()` factories that call `zRef`. → use `zRef`
- You are extending a generated schema with custom cross-reference validation using the same empty-string leniency semantics as generated factories. → use `zRef`
- You are building a Langium language server plugin that needs live document validation with lazily-resolved reference targets. → use `zRef`
- You are wrapping generateZodSchemas in a try/catch and want to surface actionable error messages to the user. → use `ZodGeneratorError`
- You are building a Vite/webpack plugin and need to map generation failures to build-time warnings. → use `ZodGeneratorError`
- You are using the Langium DI lifecycle and want the default generation behaviour accessible as `services.shared.ZodSchemaGenerator`. → use `DefaultZodSchemaGenerator`
- You want to extend or override the generator within the DI system. → use `DefaultZodSchemaGenerator`

**Do NOT use when:**
- You only need to inspect the intermediate type descriptors without generating code — use extractTypeDescriptors directly instead. (`generateZodSchemas`)
- You are running inside the Langium DI container — prefer DefaultZodSchemaGenerator which injects services automatically. (`generateZodSchemas`)
- You want to generate schemas for only a subset of types at runtime — pass `include`/`exclude` in the config rather than post-processing the output. (`generateZodSchemas`)
- You just want generated Zod schemas — use generateZodSchemas instead, which calls this function internally. (`extractTypeDescriptors`)
- You want to apply `regexOverrides` — those are applied in generateZodSchemas after extraction and are not visible in the raw descriptor array. (`extractTypeDescriptors`)
- You are doing a standard end-to-end generation — use generateZodSchemas instead, which orchestrates all pipeline stages and handles disk writes. (`generateZodCode`)
- You need `regexOverrides` applied — those are applied by generateZodSchemas before this function is called. (`generateZodCode`)
- You are using the standard pipeline — generateZodSchemas and generateZodCode call this function internally; you do not need to call it yourself. (`detectRecursiveTypes`)
- You are doing offline/batch validation with a fully-resolved document — use a plain `z.string().refine(v => knownSet.has(v))` instead which is simpler and faster. (`zRef`)
- You do not need cross-reference validation at all — omit `crossRefValidation` in the config to skip generating these factories entirely. (`zRef`)
- You are validating Langium's `$container` / `$document` metadata fields — those are not cross-references and should not be validated with `zRef`. (`zRef`)
- You do not need structured context — a plain `Error.message` check is sufficient for simple pipelines. (`ZodGeneratorError`)
- You need the full ZodGeneratorConfig surface (projection, conformance, formMetadata, etc.) — use generateZodSchemas directly. (`DefaultZodSchemaGenerator`)

API surface: 6 functions, 2 classes, 9 types, 2 constants

## NEVER

- NEVER omit both `grammar` and `astTypes` — the function throws ZodGeneratorError immediately. BECAUSE there is no default grammar source and no way to recover silently. FIX: provide at least `{ grammar: parsedGrammar }` or `{ astTypes: collectAst(grammar) }`.
- NEVER enable `conformance` without setting `outputPath` — the function will throw before writing any output. BECAUSE the conformance module needs to derive a sibling output path from the schema file's directory. FIX: always set `outputPath` when `conformance` is truthy.
- NEVER pass a `Grammar[]` array when grammars share type names across files without verifying that Langium's `collectAst()` merges them correctly. BECAUSE duplicate type names will silently overwrite each other in the type map, producing truncated schemas. FIX: run `collectAst` separately and inspect the merged map before generation.
- NEVER call with `crossRefValidation: true` on grammars with no cross-reference properties — it emits dead `create*Schema` factory functions that add noise without benefit. FIX: only enable `crossRefValidation` when your grammar has at least one `ref:` property.
- NEVER remove the `// @ts-nocheck` comment from generated output files. BECAUSE the getter-based recursive property syntax (emitted for self-referential types) is not always accepted by TypeScript's strict object-literal type checker — removing the comment causes immediate TS build failures in grammars with recursive rules. FIX: treat generated files as opaque artifacts; place any hand-written extensions in a separate file that imports the schema.
- NEVER commit generated schemas as the sole copy of your schema logic. BECAUSE any grammar edit (new rule, renamed property, changed cardinality) produces stale schemas that pass TypeScript but fail at Zod validation runtime. FIX: wire `langium-zod generate` as a pre-build or CI step so schema freshness is enforced automatically.
- NEVER filter by `include` without including stub types that are transitively referenced (e.g. `ValidID`). BECAUSE phase 3 only emits stubs for names that `shouldInclude()` passes; missing stubs produce `undefined` schema references at code-gen time.
- NEVER assume the returned array order matches the grammar declaration order. BECAUSE the array is grouped by phase (object, then union, then stub); use generateZodCode which topologically sorts object schemas.
- NEVER mutate the returned descriptors and re-pass them to extraction — descriptors are consumed by the generator as values, but the super-type resolution cache lives inside a single `extractTypeDescriptors` call; mutations do not propagate.
- NEVER pass a grammar with a union type whose only member is itself filtered out by `include`. BECAUSE the union will have zero members and produce a broken discriminated union schema.
- NEVER pass a `recursiveTypes` set that was computed from a different descriptor set than `descriptors`. BECAUSE the generator uses the set to decide which properties need getter syntax; a stale set will produce `const` declarations that reference variables before they are initialised, causing runtime errors.
- NEVER rely on emission order outside the documented phases. BECAUSE topological sort is applied only to object descriptors; union and enum schemas appear in their extraction order. Post-processing the string is fragile — transform descriptors before calling this function instead.
- NEVER assume `formMetadata: true` adds `description` to every property. BECAUSE `description` is only included when the grammar comment for that property/type is non-empty; title is always emitted via `humanize-string`.
- NEVER pass descriptors that have already had projection applied (via `applyProjectionToDescriptors`) to this function if the projection strips properties that close cycles. BECAUSE the cycle detection graph will miss the back-edge and fail to mark those types as recursive, leading to `undefined` reference errors in the generated schemas at runtime.
- NEVER assume the returned set is stable across different filter configurations. BECAUSE filtering with `include`/`exclude` can remove types that close a cycle, making previously recursive types appear acyclic.
- NEVER pass a static snapshot of the reference array when calling `zRef` inside a Langium validator that runs repeatedly. BECAUSE the snapshot will not reflect document edits; pass a getter `() => myLiveList` instead.
- NEVER expect `zRef` to fail on empty strings. BECAUSE empty strings are intentionally allowed to represent unresolved/placeholder references — this matches Langium's own handling of incomplete cross-references during editing.
- NEVER use `zRef` as the sole cross-reference validation mechanism in a security context. BECAUSE it only checks string membership; it does not validate that the referenced object is of the correct type or that it exists in the correct scope.
- NEVER use `instanceof ZodGeneratorError` in a plugin host that bundles its own copy of langium-zod. BECAUSE `instanceof` fails across module boundaries when multiple instances of the class exist; use `error.name === 'ZodGeneratorError'` instead.
- NEVER call `new DefaultZodSchemaGenerator(services)` manually in production code if you are already using the DI container. BECAUSE the container may inject a different instance (e.g. a mock), and constructing a second instance bypasses DI overrides set up for tests.

## Configuration

4 configuration interfaces — see references/config.md for details.

## Quick Reference

**Generation:** `generateZodSchemas` (Main entry point for programmatic Zod schema generation from a Langium grammar), `generateZodCode` (Generates a TypeScript source string containing Zod schema exports for all
provided type descriptors), `zRef` (Creates a Zod string schema that validates a cross-reference value against an
allowlist of known identifiers, evaluated lazily at parse time), `ZodGeneratorError` (Custom error class thrown by the langium-zod code generator when it
encounters a condition it cannot recover from)
**Analysis:** `extractTypeDescriptors` (Extracts ZodTypeDescriptor records from a Langium grammar's type model), `detectRecursiveTypes` (Detects type names that participate in a reference cycle across the descriptor
graph), `AstTypesLike` (Duck-typed representation of the type model returned by Langium's `collectAst()`
function), `InterfaceTypeLike` (Duck-typed representation of a Langium `InterfaceType`, carrying only the fields
that langium-zod needs), `ZodTypeDescriptor` (Union of all type descriptor shapes that the extractor can produce and the
code generator can consume), `ZodTypeExpression` (A discriminated union that represents a single Zod type node in the descriptor
tree produced by the extractor and consumed by the code generator)
**cli:** `generate` (Programmatic entry point for the `langium-zod generate` command)
**DI:** `DefaultZodSchemaGenerator` (Default implementation of ZodSchemaGenerator), `ZodSchemaGenerator` (Service interface for generating Zod schemas from a parsed Langium grammar), `ZodSchemaGeneratorServices` (Langium DI service container shape for the langium-zod extension), `ZodSchemaGeneratorModule` (Langium `Module` definition that registers DefaultZodSchemaGenerator
under `shared)
**types:** `PropertyLike` (Duck-typed representation of a single property within a Langium `InterfaceType`), `UnionTypeLike` (Duck-typed representation of a Langium `UnionType` (including datatype rules
that alias primitives or terminal regex patterns)), `ZodPropertyDescriptor` (Describes a single property of a Langium interface type after extraction,
capturing all information the code generator needs to emit a Zod property
expression)
**Configuration:** `DEFAULT_OUTPUT_PATH` (Default output path used when no explicit `outputPath` is provided and the
project's `langium-config)

## References

Load these on demand — do NOT read all at once:

- When calling any function → read `references/functions.md` for full signatures, parameters, and return types
- When using a class → read `references/classes/` for properties, methods, and inheritance
- When defining typed variables or function parameters → read `references/types.md`
- When using exported constants → read `references/variables.md`
- When configuring options → read `references/config.md` for all settings and defaults

## Links

- [Repository](https://github.com/pradeepmouli/langium-zod)
- Author: Pradeep Mouli <pmouli@mac.com> (https://github.com/pradeepmouli)