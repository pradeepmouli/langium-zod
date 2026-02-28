export type ZodPrimitive = 'string' | 'number' | 'boolean' | 'bigint';

export type ZodTypeExpression =
	| { kind: 'primitive'; primitive: ZodPrimitive }
	| { kind: 'literal'; value: string }
	| { kind: 'reference'; typeName: string }
	| { kind: 'array'; element: ZodTypeExpression }
	| { kind: 'crossReference'; targetType: string }
	| { kind: 'union'; members: ZodTypeExpression[] }
	| { kind: 'lazy'; inner: ZodTypeExpression };

export interface ZodPropertyDescriptor {
	name: string;
	zodType: ZodTypeExpression;
	optional: boolean;
	minItems?: number;
}

export interface ZodObjectTypeDescriptor {
	name: string;
	kind: 'object';
	properties: ZodPropertyDescriptor[];
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

export type ZodTypeDescriptor = ZodObjectTypeDescriptor | ZodUnionTypeDescriptor | ZodPrimitiveAliasDescriptor | ZodKeywordEnumDescriptor | ZodRegexEnumDescriptor;

export interface InterfaceTypeLike {
	name: string;
	properties?: PropertyLike[];
	superTypes?: Set<string> | string[];
}

export interface UnionTypeLike {
	name: string;
	type?: unknown;
	members?: string[];
}

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
}

export interface AstTypesLike {
	interfaces: InterfaceTypeLike[];
	unions: UnionTypeLike[];
}
