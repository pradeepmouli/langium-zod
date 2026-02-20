# Generator API Contract

**Date**: 2026-02-20
**Feature**: 001-langium-zod-plugin

## Core API

### `generateZodSchemas(config: ZodGeneratorConfig): string`

The primary entry point. Accepts configuration, extracts types from the grammar, transforms them to IR, passes to `x-to-zod`, and returns the generated TypeScript source code.

**Input**:
```typescript
interface ZodGeneratorConfig {
  /** Resolved Langium grammar(s) */
  grammar: Grammar | Grammar[];

  /** Optional Langium services instance (for type resolution) */
  services?: LangiumCoreServices;

  /** AST types to include (if set, only these are generated) */
  include?: string[];

  /** AST types to exclude (if set, these are skipped) */
  exclude?: string[];

  /** Output file path (default: src/generated/zod-schemas.ts) */
  outputPath?: string;
}
```

**Output**: `string` — The generated TypeScript source code for `zod-schemas.ts`.

**Errors**:
- `ZodGeneratorError` if grammar extraction fails (includes grammar element location)
- `ZodGeneratorError` if a type cannot be mapped to Zod (includes type name and reason)

---

### `extractTypeDescriptors(astTypes: AstTypes, config?: FilterConfig): ZodTypeDescriptor[]`

Transforms Langium's `AstTypes` into the intermediate representation consumed by `x-to-zod`.

**Input**:
```typescript
interface FilterConfig {
  include?: string[];
  exclude?: string[];
}
```

**Output**: `ZodTypeDescriptor[]` — Array of type descriptors ready for Zod generation.

**Behavior**:
- Filters types by include/exclude config
- Resolves inheritance (flattens inherited properties into subtypes)
- Detects recursive types and marks them for lazy evaluation
- Maps cross-references to `ReferenceSchema` usage
- Adds `$type` literal property to every object descriptor

---

### `ZodSchemaGenerator` (DI Service)

Langium DI service wrapping the generation logic.

```typescript
interface ZodSchemaGenerator {
  /** Generate Zod schemas for the language's grammar */
  generate(grammar: Grammar, config?: Partial<ZodGeneratorConfig>): string;
}
```

Registered in the Langium module as:
```typescript
{
  shared: {
    ZodSchemaGenerator: (services) => new DefaultZodSchemaGenerator(services)
  }
}
```

## Error Contract

```typescript
class ZodGeneratorError extends Error {
  /** The grammar element that caused the error (if applicable) */
  grammarElement?: string;

  /** The type name that caused the error (if applicable) */
  typeName?: string;

  /** Human-readable suggestion for fixing the issue */
  suggestion?: string;
}
```

## x-to-zod Integration Contract

The plugin uses the published `x-to-zod` npm package (v0.7.0+) via its fluent builder API. The `generator.ts` module iterates over `ZodTypeDescriptor[]` and constructs Zod code strings using the builder:

```typescript
// x-to-zod builder API (published npm package)
import { build } from 'x-to-zod';

// Example usage in generator.ts:
build.string()          // → "z.string()"
build.number()          // → "z.number()"
build.boolean()         // → "z.boolean()"
build.literal("Foo")    // → 'z.literal("Foo")'
build.array(inner)      // → "z.array(<inner>)"
build.object({ ... })   // → "z.looseObject({ ... })"

// Each builder call produces a node; call .text() to get the Zod code string
const code = build.object({ name: build.string() }).text();
```

The `ZodTypeDescriptor` IR is internal to `langium-zod` and is not exposed to `x-to-zod`. The `generator.ts` module is responsible for translating IR into builder calls.
