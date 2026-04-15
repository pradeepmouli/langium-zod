/** The subset of JavaScript primitive types that Zod supports natively. */
export type ZodPrimitive = 'string' | 'number' | 'boolean' | 'bigint';

/**
 * A discriminated union that represents a single Zod type node in the descriptor
 * tree produced by the extractor and consumed by the code generator.
 *
 * Each variant maps to a specific Zod combinator:
 * - `primitive` → `z.string()` / `z.number()` / `z.boolean()` / `z.bigint()`
 * - `literal` → `z.literal(value)`
 * - `reference` → `<TypeName>Schema` (a reference to another generated schema)
 * - `array` → `z.array(element)`
 * - `crossReference` → `ReferenceSchema` (Langium cross-reference, optionally
 *   refined with {@link zRef} when cross-reference validation is enabled)
 * - `union` → `z.union([...members])`
 * - `lazy` → `z.lazy(() => inner)` (used for self-referential types)
 */
export type ZodTypeExpression =
  | { kind: 'primitive'; primitive: ZodPrimitive }
  | { kind: 'literal'; value: string }
  | { kind: 'reference'; typeName: string }
  | { kind: 'array'; element: ZodTypeExpression }
  | { kind: 'crossReference'; targetType: string }
  | { kind: 'union'; members: ZodTypeExpression[] }
  | { kind: 'lazy'; inner: ZodTypeExpression };

/**
 * Describes a single property of a Langium interface type after extraction,
 * capturing all information the code generator needs to emit a Zod property
 * expression.
 *
 * - `name` — property name as it appears in the grammar (e.g. `"elements"`).
 * - `zodType` — the resolved {@link ZodTypeExpression} for this property.
 * - `optional` — `true` when the grammar uses `?=` assignment or marks the
 *   property as optional.
 * - `minItems` — minimum array length when the grammar uses `+=` with `+`
 *   cardinality (emits `.min(1)`); `undefined` for all other cases.
 * - `comment` — JSDoc/grammar comment to propagate into form metadata, if any.
 */
export interface ZodPropertyDescriptor {
  name: string;
  zodType: ZodTypeExpression;
  optional: boolean;
  minItems?: number;
  comment?: string;
}

export interface ZodObjectTypeDescriptor {
  name: string;
  kind: 'object';
  properties: ZodPropertyDescriptor[];
  comment?: string;
}

export interface ZodUnionTypeDescriptor {
  name: string;
  kind: 'union';
  members: string[];
  discriminator: string;
}

/** Emits `export const XSchema = z.string()` (or number/boolean/bigint) for Langium datatype rules. */
export interface ZodPrimitiveAliasDescriptor {
  name: string;
  kind: 'primitive-alias';
  primitive: ZodPrimitive;
}

/** Emits `export const XSchema = z.union([z.literal("a"), z.literal("b")])` for Langium keyword enum rules. */
export interface ZodKeywordEnumDescriptor {
  name: string;
  kind: 'keyword-enum';
  keywords: string[];
}

/**
 * Emits `export const XSchema = z.union([z.string().regex(new RegExp("...")), z.literal("kw")])` for
 * Langium datatype rules that mix a terminal regex with keyword alternatives
 * (e.g. `ValidID returns string: ID | 'condition' | 'source' | ...`).
 * When `keywords` is empty, emits `z.string().regex(new RegExp("..."))` directly.
 */
export interface ZodRegexEnumDescriptor {
  name: string;
  kind: 'regex-enum';
  /** The raw regex string from Langium, including wrapping slashes e.g. `"/[a-z]+/"`. */
  regex: string;
  keywords: string[];
}

/**
 * Union of all type descriptor shapes that the extractor can produce and the
 * code generator can consume. Each variant carries a discriminating `kind` field:
 * `'object'`, `'union'`, `'primitive-alias'`, `'keyword-enum'`, or `'regex-enum'`.
 */
export type ZodTypeDescriptor =
  | ZodObjectTypeDescriptor
  | ZodUnionTypeDescriptor
  | ZodPrimitiveAliasDescriptor
  | ZodKeywordEnumDescriptor
  | ZodRegexEnumDescriptor;

/**
 * Duck-typed representation of a Langium `InterfaceType`, carrying only the fields
 * that langium-zod needs. Using this abstraction instead of Langium's concrete
 * class keeps the extractor decoupled from Langium's internal AST model and makes
 * unit testing easier via plain object stubs.
 */
export interface InterfaceTypeLike {
  name: string;
  properties?: PropertyLike[];
  superTypes?: Set<string> | string[];
  comment?: string;
}

/**
 * Duck-typed representation of a Langium `UnionType` (including datatype rules
 * that alias primitives or terminal regex patterns). The `type` field holds the
 * raw Langium type-model node and is inspected structurally by the extractor to
 * classify the union as a keyword-enum, regex-enum, discriminated-union, or
 * primitive alias.
 */
export interface UnionTypeLike {
  name: string;
  type?: unknown;
  members?: string[];
}

/**
 * Duck-typed representation of a single property within a Langium `InterfaceType`.
 *
 * Captures the grammar-level attributes the extractor uses to determine the Zod
 * type expression, optionality, and array cardinality for a property:
 * - `operator` / `assignment` — grammar assignment operators (`=`, `+=`, `?=`).
 * - `cardinality` — cardinality suffix on the property's type node.
 * - `ruleCall.cardinality` — cardinality on the rule call inside the type node
 *   (Langium 4.x shape).
 * - `isCrossRef` / `referenceType` — signals that the property holds a Langium
 *   cross-reference rather than an inline value.
 */
export interface PropertyLike {
  name: string;
  type?: unknown;
  optional?: boolean;
  operator?: '=' | '+=' | '?=';
  assignment?: '=' | '+=' | '?=';
  cardinality?: '*' | '+' | '?' | undefined;
  ruleCall?: { cardinality?: '*' | '+' | '?' | undefined };
  isCrossRef?: boolean;
  referenceType?: string;
  comment?: string;
}

/**
 * Duck-typed representation of the type model returned by Langium's `collectAst()`
 * function. Holds the full set of interface types and union/datatype-rule types
 * that the extractor analyses to produce {@link ZodTypeDescriptor} records.
 *
 * Using this interface rather than Langium's concrete `AstTypes` class means the
 * extractor and tests can supply plain object literals without importing from
 * Langium's grammar internals.
 */
export interface AstTypesLike {
  interfaces: InterfaceTypeLike[];
  unions: UnionTypeLike[];
}
