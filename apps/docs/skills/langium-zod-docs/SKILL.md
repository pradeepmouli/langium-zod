---
name: langium-zod-docs
description: Documentation site for langium-zod
---

# langium-zod-docs

Documentation site for langium-zod

## When to Use

- You have a parsed Langium `Grammar` object and want Zod schemas as a TypeScript string.
- You are integrating langium-zod into a build pipeline (Vite plugin, codegen script, etc.).
- You need conformance artifacts (type-guard files) alongside the schema output.
- You want to write generated schemas to disk in a single call.
- You want to inspect or transform the intermediate descriptor representation before
- generating code (e.g. to add custom properties or change types).
- You are caching descriptors across multiple calls to generateZodCode with
- different options, so you only want to pay the extraction cost once.
- You are writing tests against the descriptor model rather than the generated source.
- You already have descriptors and a recursion set and want to run code generation
- in isolation (e.g. for testing the emitter with synthetic descriptors).
- You need to generate code multiple times with different `options` from the same
- descriptor set without re-running extraction.
- You are building a custom pipeline that inserts descriptor transformations between
- extraction and code generation.
- You need to know which grammar types are recursive before calling
- generateZodCode (e.g. to log or filter them).
- You are building a custom code emitter and need the same cycle information that
- the built-in generator uses.
- You need runtime cross-reference validation and are using `crossRefValidation: true`
- to have the generator emit `create*Schema()` factories that call `zRef`.
- You are extending a generated schema with custom cross-reference validation using
- the same empty-string leniency semantics as generated factories.
- You are building a Langium language server plugin that needs live document
- validation with lazily-resolved reference targets.

**Avoid when:**
- You only need to inspect the intermediate type descriptors without generating code —
- use extractTypeDescriptors directly instead.
- You are running inside the Langium DI container — prefer DefaultZodSchemaGenerator
- which injects services automatically.
- You want to generate schemas for only a subset of types at runtime — pass `include`/`exclude`
- in the config rather than post-processing the output.
- You just want generated Zod schemas — use generateZodSchemas instead, which
- calls this function internally.
- You want to apply `regexOverrides` — those are applied in generateZodSchemas
- after extraction and are not visible in the raw descriptor array.
- You are doing a standard end-to-end generation — use generateZodSchemas
- instead, which orchestrates all pipeline stages and handles disk writes.
- You need `regexOverrides` applied — those are applied by generateZodSchemas
- before this function is called.
- You are using the standard pipeline — generateZodSchemas and
- generateZodCode call this function internally; you do not need to
- call it yourself.
- You are doing offline/batch validation with a fully-resolved document — use a plain
- `z.string().refine(v => knownSet.has(v))` instead which is simpler and faster.
- You do not need cross-reference validation at all — omit `crossRefValidation` in
- the config to skip generating these factories entirely.
- You are validating Langium's `$container` / `$document` metadata fields — those
- are not cross-references and should not be validated with `zRef`.
- API surface: 6 functions, 2 classes, 13 types, 2 constants

## Pitfalls

- NEVER omit both `grammar` and `astTypes` — the function throws ZodGeneratorError
- immediately. BECAUSE there is no default grammar source and no way to recover silently.
- NEVER enable `conformance` without setting `outputPath` — the function will throw before
- writing any output. BECAUSE the conformance module needs to derive a sibling output path
- from the schema file's directory.
- NEVER pass a `Grammar[]` array when grammars share type names across files without
- verifying that Langium's `collectAst()` merges them correctly. BECAUSE duplicate type names
- will silently overwrite each other in the type map, producing truncated schemas.
- NEVER call with `crossRefValidation: true` on grammars with no cross-reference properties —
- it emits dead `create*Schema` factory functions that add noise without benefit.
- NEVER filter by `include` without including stub types that are transitively
- referenced (e.g. `ValidID`). BECAUSE phase 3 only emits stubs for names that
- `shouldInclude()` passes; missing stubs produce `undefined` schema references at
- code-gen time.
- NEVER assume the returned array order matches the grammar declaration order.
- BECAUSE the array is grouped by phase (object, then union, then stub); use
- generateZodCode which topologically sorts object schemas.
- NEVER mutate the returned descriptors and re-pass them to extraction — descriptors
- are consumed by the generator as values, but the super-type resolution cache lives
- inside a single `extractTypeDescriptors` call; mutations do not propagate.
- NEVER pass a grammar with a union type whose only member is itself filtered out by
- `include`. BECAUSE the union will have zero members and produce a broken
- discriminated union schema.
- NEVER pass a `recursiveTypes` set that was computed from a different descriptor set
- than `descriptors`. BECAUSE the generator uses the set to decide which properties
- need getter syntax; a stale set will produce `const` declarations that reference
- variables before they are initialised, causing runtime errors.
- NEVER rely on emission order outside the documented phases. BECAUSE topological
- sort is applied only to object descriptors; union and enum schemas appear in
- their extraction order. Post-processing the string is fragile — transform descriptors
- before calling this function instead.
- NEVER assume `formMetadata: true` adds `description` to every property. BECAUSE
- `description` is only included when the grammar comment for that property/type is
- non-empty; title is always emitted via `humanize-string`.
- NEVER pass descriptors that have already had projection applied (via
- `applyProjectionToDescriptors`) to this function if the projection strips
- properties that close cycles. BECAUSE the cycle detection graph will miss the
- back-edge and fail to mark those types as recursive, leading to `undefined`
- reference errors in the generated schemas at runtime.
- NEVER assume the returned set is stable across different filter configurations.
- BECAUSE filtering with `include`/`exclude` can remove types that close a cycle,
- making previously recursive types appear acyclic.
- NEVER pass a static snapshot of the reference array when calling `zRef` inside a
- Langium validator that runs repeatedly. BECAUSE the snapshot will not reflect
- document edits; pass a getter `() => myLiveList` instead.
- NEVER expect `zRef` to fail on empty strings. BECAUSE empty strings are
- intentionally allowed to represent unresolved/placeholder references — this matches
- Langium's own handling of incomplete cross-references during editing.
- NEVER use `zRef` as the sole cross-reference validation mechanism in a security
- context. BECAUSE it only checks string membership; it does not validate that the
- referenced object is of the correct type or that it exists in the correct scope.

## Quick Reference

**Generation:** `generateZodSchemas`, `generateZodCode`, `zRef`, `ZodGeneratorError`
**Analysis:** `extractTypeDescriptors`, `detectRecursiveTypes`, `AstTypesLike`, `InterfaceTypeLike`, `ZodTypeDescriptor`, `ZodTypeExpression`
**cli:** `generate`, `GenerateOptions`, `LangiumZodConfig`
**DI:** `DefaultZodSchemaGenerator`, `ZodSchemaGenerator`, `ZodSchemaGeneratorServices`, `ZodSchemaGeneratorModule`
**Configuration:** `FilterConfig`, `ZodGeneratorConfig`, `DEFAULT_OUTPUT_PATH`
**types:** `PropertyLike`, `UnionTypeLike`, `ZodPropertyDescriptor`

## Links

- Author: Pradeep Mouli <pmouli@mac.com> (https://github.com/pradeepmouli)