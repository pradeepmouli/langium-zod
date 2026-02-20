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

The plugin passes `ZodTypeDescriptor[]` to `x-to-zod` for Zod code generation. The expected `x-to-zod` API:

```typescript
// Expected x-to-zod interface (owned by user's library)
interface XToZodGenerator {
  generate(descriptors: ZodTypeDescriptor[]): string;
}
```

The exact API will depend on `x-to-zod`'s implementation. The `ZodTypeDescriptor` IR serves as the contract boundary between the Langium plugin and the Zod generation library.
