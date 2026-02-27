# Contract: Generator Enhancements (Feature 002)

**Date**: 2026-02-27
**Spec**: [../spec.md](../spec.md)

## CLI Contract

### Command: `langium-zod generate`

#### New/updated options

| Option | Type | Required | Behavior |
|---|---|---|---|
| `--include <types>` | comma-separated string | No | Include only listed types |
| `--exclude <types>` | comma-separated string | No | Exclude listed types |
| `--projection <file>` | path string | No | Load projection JSON config |
| `--strip-internals` | boolean flag | No | Strip default internal fields globally |
| `--conformance` | boolean flag | No | Generate conformance artifact |
| `--ast-types <path>` | path string | No* | Explicit AST path; if omitted under conformance, resolve from `langium-config.json` |
| `--conformance-out <path>` | path string | No | Override conformance artifact output path |
| `--cross-ref-validation` | boolean flag | No | Emit runtime cross-reference schema factories |

`*` Required only when `--conformance` is set and AST path cannot be resolved from `langium-config.json`.

#### Filter precedence rules

1. Merge config + CLI values; CLI wins when both specified.
2. Apply include first.
3. Apply exclude second.
4. Overlap result is excluded.

#### Error/warning behavior

| Condition | Outcome |
|---|---|
| Unknown include/exclude type | Warning; continue |
| Unknown projection field | Warning; continue |
| Invalid/unreadable projection file | Error; fail fast; no output write |
| `--conformance` with unresolved AST path | Error; fail fast |
| Missing AST type export for schema | Warning; skip type in conformance artifact |

## Programmatic API Contract

### `ZodGeneratorConfig` extensions

```ts
interface ZodGeneratorConfig {
  include?: string[];
  exclude?: string[];
  projection?: ProjectionConfig;
  crossRefValidation?: boolean;
  conformance?: {
    astTypesPath?: string;
    outputPath?: string;
  };
}
```

### Cross-reference helper contract

```ts
export function zRef(
  collection: string[] | (() => string[]),
  message?: string
): z.ZodString;
```

Behavior:
- Returns `z.string()` refined by membership in the provided collection.
- Designed to compose with `.optional()` for optional cross-reference fields.

## Generated Output Contract

### Cardinality

- `+= Rule+` => `z.array(...).min(1)`
- `+= Rule*` and `+= Rule` => `z.array(...)`

### Projection

- Projection applies after include/exclude filtering.
- If type is not in projection `types`, only default strip applies.
- `$type` discriminator remains unless explicitly superseded by current generator invariant.

### Conformance

When enabled, emit `*.conformance.ts` containing:
- type imports from AST source
- schema imports from schema output
- `_Internals` union from active strip set
- per-type bidirectional assignability checks (`_Fwd`, `_Rev`)

### Cross-reference validation factories

When enabled and applicable, emit:
- `export interface <TypeName>SchemaRefs`
- `export function create<TypeName>Schema(refs: <TypeName>SchemaRefs = {})`

Only retained cross-reference fields (after projection/strip) receive refinement.
