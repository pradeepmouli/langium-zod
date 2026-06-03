# Types & Enums

## Analysis

### `AstTypesLike`
Duck-typed representation of the type model returned by Langium's `collectAst()`
function. Holds the full set of interface types and union/datatype-rule types
that the extractor analyses to produce ZodTypeDescriptor records.

Using this interface rather than Langium's concrete `AstTypes` class means the
extractor and tests can supply plain object literals without importing from
Langium's grammar internals.
**Properties:**
- `interfaces: InterfaceTypeLike[]` — All interface types defined in the grammar, including those inherited via `superTypes`.
- `unions: UnionTypeLike[]` — All union and datatype-rule types defined in the grammar.

### `InterfaceTypeLike`
Duck-typed representation of a Langium `InterfaceType`, carrying only the fields
that langium-zod needs. Using this abstraction instead of Langium's concrete
class keeps the extractor decoupled from Langium's internal AST model and makes
unit testing easier via plain object stubs.
**Properties:**
- `name: string` — Type name as declared in the Langium grammar (e.g. `"Expression"`).
- `properties: PropertyLike[]` (optional) — Properties declared directly on this interface type.
- `superTypes: string[] | Set<string>` (optional) — Names of super-types this interface extends, used for property inheritance.
- `comment: string` (optional) — JSDoc/grammar comment attached to this interface type, if any.

### `ZodTypeDescriptor`
Union of all type descriptor shapes that the extractor can produce and the
code generator can consume. Each variant carries a discriminating `kind` field:
`'object'`, `'union'`, `'primitive-alias'`, `'keyword-enum'`, or `'regex-enum'`.
```ts
ZodObjectTypeDescriptor | ZodUnionTypeDescriptor | ZodPrimitiveAliasDescriptor | ZodKeywordEnumDescriptor | ZodRegexEnumDescriptor
```

### `ZodTypeExpression`
A discriminated union that represents a single Zod type node in the descriptor
tree produced by the extractor and consumed by the code generator.

Each variant maps to a specific Zod combinator:
- `primitive` → `z.string()` / `z.number()` / `z.boolean()` / `z.bigint()`
- `literal` → `z.literal(value)`
- `reference` → `<TypeName>Schema` (a reference to another generated schema)
- `array` → `z.array(element)`
- `crossReference` → `ReferenceSchema` (Langium cross-reference, optionally
  refined with zRef when cross-reference validation is enabled)
- `union` → `z.union([...members])`
- `lazy` → `z.lazy(() => inner)` (used for self-referential types)
```ts
{ kind: "primitive"; primitive: ZodPrimitive } | { kind: "literal"; value: string } | { kind: "reference"; typeName: string } | { kind: "array"; element: ZodTypeExpression } | { kind: "crossReference"; targetType: string } | { kind: "union"; members: ZodTypeExpression[] } | { kind: "lazy"; inner: ZodTypeExpression }
```

## types

### `PropertyLike`
Duck-typed representation of a single property within a Langium `InterfaceType`.

Captures the grammar-level attributes the extractor uses to determine the Zod
type expression, optionality, and array cardinality for a property:
- `operator` / `assignment` — grammar assignment operators (`=`, `+=`, `?=`).
- `cardinality` — cardinality suffix on the property's type node.
- `ruleCall.cardinality` — cardinality on the rule call inside the type node
  (Langium 4.x shape).
- `isCrossRef` / `referenceType` — signals that the property holds a Langium
  cross-reference rather than an inline value.
**Properties:**
- `name: string` — Property name as declared in the grammar (e.g. `"left"`, `"elements"`).
- `type: unknown` (optional) — Raw Langium type node for this property, inspected by the type mapper.
- `optional: boolean` (optional) — `true` when the grammar marks the property optional.
- `operator: "=" | "+=" | "?="` (optional) — Grammar assignment operator: `=` (single value), `+=` (array append),
`?=` (boolean flag).
- `assignment: "=" | "+=" | "?="` (optional) — Alternative assignment field used in some Langium 3.x AST shapes;
the extractor consults both `operator` and `assignment`.
- `cardinality: "*" | "+" | "?"` (optional) — Cardinality suffix on the property's type node (`*`, `+`, `?`).
- `ruleCall: { cardinality?: "*" | "+" | "?" }` (optional) — Cardinality on the rule call inside the type node (Langium 4.x shape);
the extractor checks this when `cardinality` is absent.
- `isCrossRef: boolean` (optional) — `true` when the property holds a Langium cross-reference (`ref:` prefix).
- `referenceType: string` (optional) — Target type name for cross-reference properties (e.g. `"Symbol"` in `ref:Symbol`).
Used by the extractor to emit `ReferenceSchema` with the correct target type name.
- `comment: string` (optional) — JSDoc/grammar comment for this property, propagated to form metadata.

### `UnionTypeLike`
Duck-typed representation of a Langium `UnionType` (including datatype rules
that alias primitives or terminal regex patterns). The `type` field holds the
raw Langium type-model node and is inspected structurally by the extractor to
classify the union as a keyword-enum, regex-enum, discriminated-union, or
primitive alias.
**Properties:**
- `name: string` — Union type name as declared in the Langium grammar (e.g. `"Statement"`).
- `type: unknown` (optional) — Raw Langium type-model node; inspected structurally by the extractor to classify
the union as a keyword-enum, regex-enum, discriminated-union, or primitive alias.
- `members: string[]` (optional) — Explicit member type names, when the extractor pre-populates them.

### `ZodPropertyDescriptor`
Describes a single property of a Langium interface type after extraction,
capturing all information the code generator needs to emit a Zod property
expression.

- `name` — property name as it appears in the grammar (e.g. `"elements"`).
- `zodType` — the resolved ZodTypeExpression for this property.
- `optional` — `true` when the grammar uses `?=` assignment or marks the
  property as optional.
- `minItems` — minimum array length when the grammar uses `+=` with `+`
  cardinality (emits `.min(1)`); `undefined` for all other cases.
- `comment` — JSDoc/grammar comment to propagate into form metadata, if any.
**Properties:**
- `name: string` — Property name as it appears in the Langium grammar (e.g. `"elements"`).
- `zodType: ZodTypeExpression` — Resolved Zod type expression for this property.
- `optional: boolean` — `true` when the grammar uses `?=` assignment or marks the property optional.
- `minItems: number` (optional) — Minimum array length when the grammar uses `+=` with `+` cardinality;
`undefined` for all other cases. Emits `.min(1)` on the generated array schema.
- `comment: string` (optional) — JSDoc/grammar comment to propagate into form metadata, if any.

## DI

### `ZodSchemaGenerator`
Service interface for generating Zod schemas from a parsed Langium grammar.

Implemented by DefaultZodSchemaGenerator and registered in the Langium
dependency-injection container via ZodSchemaGeneratorModule. Consumers
that obtain Langium services through the standard DI mechanism can retrieve this
service from `services.shared.ZodSchemaGenerator`.

### `ZodSchemaGeneratorServices`
Langium DI service container shape for the langium-zod extension.

Declares the `shared.ZodSchemaGenerator` slot so that TypeScript can type-check
service access and module contributions without requiring a full Langium service
registry at compile time.
