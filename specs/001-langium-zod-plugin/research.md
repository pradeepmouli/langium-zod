# Research: Langium Zod Generator Plugin

**Date**: 2026-02-20
**Feature**: 001-langium-zod-plugin

## Decision 1: Schema Generation Approach — Use `x-to-zod` Library

**Decision**: Use the user's `x-to-zod` library as the core schema generation engine. The plugin will extract type information from Langium's resolved grammar, transform it into an intermediate representation that `x-to-zod` can consume, and produce Zod 4.x schema output.

**Rationale**: The user explicitly requested using their `x-to-zod` library for generating Zod schemas. This separates concerns: the Langium plugin handles grammar introspection and type extraction, while `x-to-zod` handles the Zod schema code generation. This makes the Langium-specific logic reusable and testable independently of the Zod output format.

**Alternatives considered**:
- Direct Zod code generation via string templates — rejected because `x-to-zod` already handles this
- `ts-to-zod` (public npm package) — rejected in favor of user's library per explicit instruction

## Decision 2: Langium Grammar Type Extraction API

**Decision**: Use Langium's `collectAst()` function from `langium/grammar/type-system/ast-collector` to extract the resolved `AstTypes` (interfaces and unions) from the grammar. This is the same API that Langium's CLI uses internally to generate `ast.ts`.

**Rationale**: `collectAst()` returns a fully resolved `AstTypes` object containing:
- `interfaces`: Array of `InterfaceType` objects with properties, supertypes, subtypes
- `unions`: Array of `UnionType` objects with member types

This gives us the complete, post-resolution type system without needing to manually traverse grammar rules, resolve imports, or handle fragments/actions. Langium has already done all that work.

**Key APIs**:
- `collectAst(grammars: Grammar | Grammar[])` → `AstTypes { interfaces, unions }`
- `InterfaceType.properties` → property name, type, optionality
- `InterfaceType.superTypes` / `.subTypes` → type hierarchy
- `UnionType.type` → union members

**Alternatives considered**:
- Manual grammar traversal via ParserRule/Interface AST nodes — rejected as duplicating Langium's own type resolution logic
- Using AstReflection at runtime — rejected as this is a runtime API, not suitable for code generation

## Decision 3: Zod 4.x API Usage

**Decision**: Generate Zod 4.x schemas using the following API patterns:

| Langium Concept | Zod 4.x API |
|----------------|-------------|
| Object schema | `z.looseObject({...})` (passthrough by default) |
| String property | `z.string()` |
| Number property | `z.number()` |
| Boolean property | `z.boolean()` |
| Array property | `z.array(elementSchema)` |
| Optional property | `z.optional(schema)` |
| $type discriminator | `z.literal("TypeName")` |
| Union type | `z.discriminatedUnion("$type", [...members])` |
| Cross-reference | Custom `ReferenceSchema` with `$refText: z.string()` |
| Recursive type | Getter pattern: `get prop() { return schema }` |

**Rationale**: Zod 4.x introduces `z.looseObject()` as the preferred passthrough replacement, getter-based recursive types as a cleaner alternative to `z.lazy()`, and unified error handling via the `error` parameter. Using Zod 4 native patterns ensures idiomatic output.

**Key Zod 4 changes from 3.x**:
- `z.object().passthrough()` → `z.looseObject()` (both supported, looseObject preferred)
- `z.lazy(() => schema)` → `get prop() { return schema }` (both supported, getter preferred)
- `message` parameter → `error` parameter for error customization
- Import: `import { z } from "zod/v4"` or `import { z } from "zod"`

**Alternatives considered**:
- Zod 3.x — rejected per user clarification choosing Zod 4.x
- Zod Mini — rejected as it has a reduced API surface

## Decision 4: Project Structure — Monorepo Package

**Decision**: Create the plugin as a package within the existing pnpm monorepo at `packages/langium-zod`. The `x-to-zod` library will be a separate package at `packages/x-to-zod`.

**Rationale**: The project is already set up as a pnpm workspace monorepo. Placing the plugin as a package follows the established pattern and allows `x-to-zod` to remain independent/reusable.

**Alternatives considered**:
- Single package combining both — rejected as it couples Langium-specific logic to the Zod generation engine
- External dependency for x-to-zod — rejected as user indicated it's their library (likely in this monorepo)

## Decision 5: Output File Strategy

**Decision**: Generate a single `zod-schemas.ts` file in the same `src/generated/` directory where Langium outputs `ast.ts`. The file will import Zod from `zod/v4` and export named schemas matching the pattern `<TypeName>Schema` (e.g., `ExpressionSchema`, `AdditionSchema`).

**Rationale**: Mirrors Langium's own single-file `ast.ts` pattern (per clarification). Placing it in `src/generated/` follows Langium conventions and ensures it's regenerated alongside other artifacts.

**Alternatives considered**:
- Separate output directory — rejected as it breaks the convention of co-located generated artifacts
- One file per type — rejected per clarification choosing single-file output

## Decision 6: Integration with Langium DI

**Decision**: Register the Zod schema generator as a service in Langium's dependency injection module. It will be invocable both programmatically (via the service API) and through a CLI command extension.

**Rationale**: Langium's architecture recommends having generators as injected services for access to other services (grammar, configuration, etc.). This aligns with FR-014.

**Integration pattern**:
```
LangiumServices → shared.ZodSchemaGenerator → generateZodSchemas(grammar)
```

**Alternatives considered**:
- Standalone CLI only — rejected as it doesn't integrate with `langium generate`
- Monkey-patching — rejected as anti-pattern in DI architecture
