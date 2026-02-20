# Data Model: Langium Zod Generator Plugin

**Date**: 2026-02-20
**Feature**: 001-langium-zod-plugin

## Input Types (from Langium)

These are read-only types consumed from Langium's `collectAst()` output. We do not own or modify them.

### AstTypes

The top-level container returned by `collectAst()`.

| Field | Type | Description |
|-------|------|-------------|
| interfaces | `InterfaceType[]` | All resolved AST interface types |
| unions | `UnionType[]` | All resolved union/type alias types |

### InterfaceType

Represents a concrete AST node type (e.g., `Addition`, `Variable`).

| Field | Type | Description |
|-------|------|-------------|
| name | `string` | Type name (becomes the `$type` literal value) |
| properties | `Property[]` | Declared + inherited properties |
| superTypes | `Set<string>` | Names of parent interfaces |
| subTypes | `Set<string>` | Names of child interfaces |
| typeNames | `Set<string>` | All names this type is known as (including ancestors) |

### UnionType

Represents a declared union type (e.g., `type Expression = Addition | Multiplication`).

| Field | Type | Description |
|-------|------|-------------|
| name | `string` | Union type name |
| type | `TypeDefinition` | Union member type definitions |
| superTypes | `Set<string>` | Parent type names |
| subTypes | `Set<string>` | Child type names |

### Property

Represents a single property on an InterfaceType.

| Field | Type | Description |
|-------|------|-------------|
| name | `string` | Property name |
| type | `PropertyType` | Type information (primitive, reference, array, cross-ref) |
| optional | `boolean` | Whether the property is optional |

### PropertyType (discriminated)

| Variant | Fields | Maps to Zod |
|---------|--------|-------------|
| Primitive (string) | value: `"string"` | `z.string()` |
| Primitive (number) | value: `"number"` | `z.number()` |
| Primitive (boolean) | value: `"boolean"` | `z.boolean()` |
| Reference (AST type) | referenceType: `string` | `<TypeName>Schema` |
| Cross-reference | referenceType: `string`, isCrossRef: `true` | `ReferenceSchema` |
| Array | elementType: `PropertyType` | `z.array(elementSchema)` |

## Intermediate Representation (IR)

The plugin transforms Langium's `AstTypes` into an IR that `x-to-zod` can consume. This decouples the Langium-specific extraction from the Zod generation.

### ZodTypeDescriptor

Describes a single type to be converted to a Zod schema.

| Field | Type | Description |
|-------|------|-------------|
| name | `string` | Schema export name (e.g., `"Addition"`) |
| kind | `"object" \| "union"` | Whether this is an object schema or discriminated union |
| properties | `ZodPropertyDescriptor[]` | Properties (for object kind) |
| members | `string[]` | Union member type names (for union kind) |
| discriminator | `string` | Discriminator property name (always `"$type"` for unions) |

### ZodPropertyDescriptor

Describes a single property within a type descriptor.

| Field | Type | Description |
|-------|------|-------------|
| name | `string` | Property name |
| zodType | `ZodTypeExpression` | The Zod type expression to generate |
| optional | `boolean` | Whether wrapped in `z.optional()` |

### ZodTypeExpression (discriminated)

| Variant | Fields | Generated Zod Code |
|---------|--------|-------------------|
| `primitive` | primitive: `"string" \| "number" \| "boolean"` | `z.string()` / `z.number()` / `z.boolean()` |
| `literal` | value: `string` | `z.literal("value")` |
| `reference` | typeName: `string` | `<TypeName>Schema` |
| `array` | element: `ZodTypeExpression` | `z.array(element)` |
| `crossReference` | targetType: `string` | `ReferenceSchema` |
| `union` | members: `ZodTypeExpression[]` | `z.union([...members])` |
| `lazy` | inner: `ZodTypeExpression` | getter pattern for recursive types |

## Output Types (generated Zod schemas)

### Generated File Structure

```typescript
// src/generated/zod-schemas.ts
import { z } from "zod/v4";

// Shared reference schema for cross-references
export const ReferenceSchema = z.looseObject({
  $refText: z.string(),
  ref: z.optional(z.unknown()),
});

// Per-type schemas (one per InterfaceType)
export const AdditionSchema = z.looseObject({
  $type: z.literal("Addition"),
  left: z.lazy(() => ExpressionSchema),
  operator: z.string(),
  right: z.lazy(() => ExpressionSchema),
});

// Union schemas (one per UnionType)
export const ExpressionSchema = z.discriminatedUnion("$type", [
  AdditionSchema,
  MultiplicationSchema,
  NumberLiteralSchema,
]);
```

## Entity Relationships

```
Grammar ──[collectAst()]──> AstTypes
                              ├── InterfaceType[] ──[transform]──> ZodTypeDescriptor (kind: "object")
                              └── UnionType[]     ──[transform]──> ZodTypeDescriptor (kind: "union")

ZodTypeDescriptor[] ──[x-to-zod]──> zod-schemas.ts
```

## State Transitions

This plugin is stateless — it's a pure transformation pipeline:

```
Grammar input → Type extraction → IR construction → Zod code generation → File output
```

No runtime state, no persistence, no lifecycle management. Each generation run is idempotent: same grammar always produces the same output.
