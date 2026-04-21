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
 *
 * @remarks
 * This type is part of the lower-level descriptor API. Most consumers do not need to
 * construct `ZodTypeExpression` values directly; they are produced by the extractor
 * from Langium grammar types. Custom descriptor transformations (e.g. injecting
 * additional validation constraints before code generation) are the primary use case.
 *
 * @category Analysis
 * @see {@link ZodPropertyDescriptor}
 * @see {@link ZodTypeDescriptor}
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
  /** Property name as it appears in the Langium grammar (e.g. `"elements"`). */
  name: string;
  /** Resolved Zod type expression for this property. */
  zodType: ZodTypeExpression;
  /** `true` when the grammar uses `?=` assignment or marks the property optional. */
  optional: boolean;
  /**
   * Minimum array length when the grammar uses `+=` with `+` cardinality;
   * `undefined` for all other cases. Emits `.min(1)` on the generated array schema.
   */
  minItems?: number;
  /** JSDoc/grammar comment to propagate into form metadata, if any. */
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
 *
 * @remarks
 * Use the `kind` discriminator to narrow to a specific variant before accessing
 * variant-specific fields:
 * ```ts
 * if (descriptor.kind === 'object') {
 *   // descriptor is ZodObjectTypeDescriptor
 *   descriptor.properties; // available
 * }
 * ```
 *
 * @category Analysis
 * @see {@link extractTypeDescriptors}
 * @see {@link generateZodCode}
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
 *
 * @remarks
 * Use this interface when building synthetic `AstTypesLike` fixtures for unit tests
 * or when feeding a custom grammar model into {@link extractTypeDescriptors} without
 * going through Langium's parser. You only need to populate the fields your test
 * exercises — `properties` and `superTypes` default to undefined and are treated as
 * empty by the extractor.
 *
 * @category Analysis
 * @see {@link AstTypesLike}
 */
export interface InterfaceTypeLike {
  /** Type name as declared in the Langium grammar (e.g. `"Expression"`). */
  name: string;
  /** Properties declared directly on this interface type. */
  properties?: PropertyLike[];
  /** Names of super-types this interface extends, used for property inheritance. */
  superTypes?: Set<string> | string[];
  /** JSDoc/grammar comment attached to this interface type, if any. */
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
  /** Union type name as declared in the Langium grammar (e.g. `"Statement"`). */
  name: string;
  /**
   * Raw Langium type-model node; inspected structurally by the extractor to classify
   * the union as a keyword-enum, regex-enum, discriminated-union, or primitive alias.
   */
  type?: unknown;
  /** Explicit member type names, when the extractor pre-populates them. */
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
  /** Property name as declared in the grammar (e.g. `"left"`, `"elements"`). */
  name: string;
  /** Raw Langium type node for this property, inspected by the type mapper. */
  type?: unknown;
  /** `true` when the grammar marks the property optional. */
  optional?: boolean;
  /**
   * Grammar assignment operator: `=` (single value), `+=` (array append),
   * `?=` (boolean flag).
   */
  operator?: '=' | '+=' | '?=';
  /**
   * Alternative assignment field used in some Langium 3.x AST shapes;
   * the extractor consults both `operator` and `assignment`.
   */
  assignment?: '=' | '+=' | '?=';
  /** Cardinality suffix on the property's type node (`*`, `+`, `?`). */
  cardinality?: '*' | '+' | '?' | undefined;
  /**
   * Cardinality on the rule call inside the type node (Langium 4.x shape);
   * the extractor checks this when `cardinality` is absent.
   */
  ruleCall?: { cardinality?: '*' | '+' | '?' | undefined };
  /** `true` when the property holds a Langium cross-reference (`ref:` prefix). */
  isCrossRef?: boolean;
  /**
   * Target type name for cross-reference properties (e.g. `"Symbol"` in `ref:Symbol`).
   * Used by the extractor to emit `ReferenceSchema` with the correct target type name.
   */
  referenceType?: string;
  /** JSDoc/grammar comment for this property, propagated to form metadata. */
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
 *
 * @remarks
 * Obtain a real `AstTypesLike` value by calling Langium's `collectAst(grammar)` and
 * casting the result: `collectAst(grammar) as unknown as AstTypesLike`. In tests,
 * construct plain objects conforming to this interface directly.
 *
 * @example
 * ```ts
 * import type { AstTypesLike } from 'langium-zod';
 *
 * const astTypes: AstTypesLike = {
 *   interfaces: [{ name: 'Greeting', properties: [{ name: 'message', type: 'STRING', optional: false }] }],
 *   unions: []
 * };
 * ```
 *
 * @category Analysis
 * @see {@link extractTypeDescriptors}
 * @see {@link InterfaceTypeLike}
 * @see {@link UnionTypeLike}
 */
export interface AstTypesLike {
  /** All interface types defined in the grammar, including those inherited via `superTypes`. */
  interfaces: InterfaceTypeLike[];
  /** All union and datatype-rule types defined in the grammar. */
  unions: UnionTypeLike[];
}
