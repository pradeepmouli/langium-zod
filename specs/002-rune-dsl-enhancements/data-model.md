# Data Model: Rune DSL schema generation enhancements

**Date**: 2026-02-27
**Feature**: 002-rune-dsl-enhancements

## Entities

### GenerationRequest
Represents one invocation of generation.

| Field | Type | Description |
|---|---|---|
| grammar | `Grammar \| Grammar[]` | Langium grammar input |
| outputPath | `string` | Main schema output file path |
| include | `string[] \| undefined` | Type allowlist from CLI/config |
| exclude | `string[] \| undefined` | Type denylist from CLI/config |
| projection | `ProjectionConfig \| undefined` | Field-surface policy |
| stripInternals | `boolean` | Shortcut for stripping default internal fields |
| conformance | `ConformanceOptions \| undefined` | Conformance artifact settings |
| crossRefValidation | `boolean` | Enables schema factory emission |

### ProjectionConfig
Controls schema field surface.

| Field | Type | Description |
|---|---|---|
| defaults.strip | `string[]` | Fields removed from all types by default |
| types.<Type>.fields | `string[]` | Explicit allowlist of retained fields for a type |

Validation rules:
- Unknown fields in `types.<Type>.fields` are warned and skipped.
- Unreadable/invalid projection file is fatal.

### PropertyDescriptor (extended)
Internal descriptor for generated schema properties.

| Field | Type | Description |
|---|---|---|
| name | `string` | Property name |
| type | `ZodTypeExpression` | Property type expression |
| optional | `boolean` | Optionality marker |
| minItems | `number \| undefined` | Array minimum, set to `1` for `+=` with `+` cardinality |
| isCrossReference | `boolean` | Marks cross-reference fields for optional runtime refinement |
| crossRefTargetType | `string \| undefined` | Target type name for cross-reference validation |

### ConformanceOptions
Defines output for compile-time assignability checks.

| Field | Type | Description |
|---|---|---|
| enabled | `boolean` | Whether to generate conformance file |
| astTypesPath | `string` | Explicit path or resolved from `langium-config.json` |
| outputPath | `string \| undefined` | Optional conformance output override |
| strippedFields | `string[]` | Effective stripped fields used in `Omit<>` surface |

### CrossRefFactoryContract
Per-type runtime validation contract emitted only when applicable.

| Field | Type | Description |
|---|---|---|
| interfaceName | `string` | `<TypeName>SchemaRefs` |
| refMap | `Record<string, string[] \| undefined>` | Target type -> valid names |
| factoryName | `string` | `create<TypeName>Schema` |
| refinedFields | `string[]` | Cross-reference fields retained after projection |

## Relationships

- `GenerationRequest` produces a set of schema descriptors.
- `ProjectionConfig` transforms descriptor fields into a `TypeSchemaSurface`.
- `ConformanceOptions` consumes final `TypeSchemaSurface` and schema names.
- `CrossRefFactoryContract` is derived from final `TypeSchemaSurface` where cross-ref fields remain.

## State Transitions

1. Parse CLI/config to `GenerationRequest`.
2. Extract grammar types to descriptors.
3. Apply include/exclude filtering.
4. Apply projection/strip rules to produce final schema surface.
5. Emit schema code.
6. Optionally emit conformance artifact.
7. Optionally emit cross-reference schema factories.

## Invariants

- If `minItems` is set, field type must be array.
- Conformance generation cannot proceed without resolved `astTypesPath`.
- Cross-reference refinements are emitted only for fields present after projection.
- Projection file parse/read failure prevents any output mutation.
